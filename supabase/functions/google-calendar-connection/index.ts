import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { parseKeyRing, encryptToken } from '../_shared/google-calendar/crypto.ts';
import {
  generateOAuthStateEnvelope,
  buildAuthorizationUrl,
  exchangeCodeForTokens,
  revokeToken,
  OAuthConfig
} from '../_shared/google-calendar/oauth.ts';
import {
  storeEncryptedCredential,
  beginDisconnect,
  finalizeDisconnect
} from '../_shared/google-calendar/credentials.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const path = url.pathname.replace(/\/$/, '');

  const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const keyRingJson = Deno.env.get('GOOGLE_CALENDAR_TOKEN_KEYS_JSON') || '{"1":"AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA="}';
  const activeKeyVersion = Number(Deno.env.get('GOOGLE_CALENDAR_TOKEN_ACTIVE_KEY_VERSION') || '1');
  const keyRing = parseKeyRing(keyRingJson);

  const oauthConfig: OAuthConfig = {
    clientId: Deno.env.get('GOOGLE_OAUTH_CLIENT_ID') || 'mock-client-id',
    clientSecret: Deno.env.get('GOOGLE_OAUTH_CLIENT_SECRET') || 'mock-client-secret',
    redirectUri: Deno.env.get('GOOGLE_OAUTH_REDIRECT_URI') || `${url.origin}/functions/v1/google-calendar-connection/callback`
  };

  try {
    // 1. GET callback (Transport public)
    if (req.method === 'GET' && path.endsWith('/callback')) {
      const code = url.searchParams.get('code');
      const rawState = url.searchParams.get('state');
      const error = url.searchParams.get('error');
      const appSettingsUrl = Deno.env.get('APP_SETTINGS_URL') || '/settings';

      if (error || !code || !rawState) {
        return Response.redirect(`${appSettingsUrl}?calendar=denied`, 302);
      }

      // Hash received state
      const encoder = new TextEncoder();
      const stateHashBuf = await crypto.subtle.digest('SHA-256', encoder.encode(rawState));
      const stateDigest = Array.from(new Uint8Array(stateHashBuf))
        .map(b => b.toString(16).padStart(2, '0')).join('');

      // Atomically consume state
      const { data: stateData, error: stateError } = await supabase.rpc('consume_google_calendar_oauth_state', {
        p_state_digest: stateDigest
      });

      if (stateError || !stateData || stateData.length === 0) {
        return Response.redirect(`${appSettingsUrl}?calendar=failed`, 302);
      }

      const consumedState = stateData[0];
      const ownerId = consumedState.owner_id;
      const expectedGen = Number(consumedState.connection_generation);

      // Exchange authorization code for tokens
      const tokenResult = await exchangeCodeForTokens(code, consumedState.encrypted_pkce_verifier, oauthConfig);

      if (!tokenResult.refreshToken) {
        // Initial connection missing refresh token fails closed
        return Response.redirect(`${appSettingsUrl}?calendar=reconnect_required`, 302);
      }

      // Encrypt & store credential in private schema
      await storeEncryptedCredential(
        supabase,
        ownerId,
        expectedGen,
        tokenResult.refreshToken,
        tokenResult.subjectHash || '',
        tokenResult.scope.split(' '),
        keyRing,
        activeKeyVersion
      );

      return Response.redirect(`${appSettingsUrl}?calendar=connected`, 302);
    }

    // Authenticated endpoints require Bearer Token
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized bearer token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // 2. POST authorize
    if (req.method === 'POST' && path.endsWith('/authorize')) {
      const envelope = await generateOAuthStateEnvelope();
      const authUrl = buildAuthorizationUrl(oauthConfig, envelope);

      // Encrypt PKCE verifier for state storage
      const encryptedVerifier = await encryptToken(
        envelope.pkceVerifier,
        keyRing,
        activeKeyVersion,
        `google-calendar:pkce:${user.id}`
      );

      const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 min TTL

      await supabase.rpc('create_google_calendar_oauth_state', {
        p_owner_id: user.id,
        p_state_digest: envelope.stateDigest,
        p_encrypted_pkce_verifier: encryptedVerifier.ciphertext,
        p_pkce_nonce: encryptedVerifier.nonce,
        p_key_version: activeKeyVersion,
        p_oidc_nonce_digest: envelope.oidcNonceDigest,
        p_redirect_uri: oauthConfig.redirectUri,
        p_scope_set_version: 1,
        p_connection_generation: 0,
        p_expires_at: expiresAt
      });

      return new Response(JSON.stringify({ authorizationUrl: authUrl }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // 3. POST status
    if (req.method === 'POST' && path.endsWith('/status')) {
      const { data, error } = await supabase.rpc('get_my_google_calendar_connection', {}, {
        headers: { Authorization: `Bearer ${token}` }
      });

      const row = (data && data.length > 0) ? data[0] : null;

      return new Response(JSON.stringify({
        status: row?.status || 'disconnected',
        optedIn: Boolean(row?.opted_in),
        grantedScopes: row?.granted_scopes || [],
        connectionGeneration: Number(row?.connection_generation || 0),
        attentionCode: row?.attention_code || null,
        connectedAt: row?.connected_at || null,
        updatedAt: row?.updated_at || null
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // 4. POST set_opt_in
    if (req.method === 'POST' && path.endsWith('/set_opt_in')) {
      const body = await req.json();
      const enabled = Boolean(body.enabled);

      const { data, error } = await supabase.rpc('set_google_calendar_opt_in_for_service', {
        p_owner_id: user.id,
        p_enabled: enabled
      });

      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const row = data[0];
      return new Response(JSON.stringify({
        status: row.status,
        optedIn: row.opted_in,
        grantedScopes: row.granted_scopes,
        connectionGeneration: Number(row.connection_generation),
        attentionCode: row.attention_code,
        connectedAt: row.connected_at,
        updatedAt: row.updated_at
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // 5. POST disconnect
    if (req.method === 'POST' && path.endsWith('/disconnect')) {
      const fenceResult = await beginDisconnect(supabase, user.id);
      const finalResult = await finalizeDisconnect(supabase, user.id, fenceResult.fencedGeneration);

      return new Response(JSON.stringify({
        status: finalResult.status,
        optedIn: false,
        grantedScopes: [],
        connectionGeneration: fenceResult.fencedGeneration,
        attentionCode: null,
        connectedAt: null,
        updatedAt: new Date().toISOString()
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ error: 'Endpoint not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (err: unknown) {
    return new Response(JSON.stringify({ error: (err as Error).message || 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
