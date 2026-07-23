import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { handleGoogleCalendarOverlayRequest, HandlerDependencies } from "./handler.ts";
import { parseKeyRing } from "../_shared/google-calendar/crypto.ts";
import { withGoogleCalendarProviderRequest } from "../_shared/google-calendar/credentials.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");

    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const keyRing = parseKeyRing(
      Deno.env.get("GOOGLE_CALENDAR_TOKEN_KEYS_JSON"),
      Deno.env.get("GOOGLE_CALENDAR_TEST_MODE") === "true"
    );
    const googleOAuthClient = {
      clientId: Deno.env.get("GOOGLE_OAUTH_CLIENT_ID") || "",
      clientSecret: Deno.env.get("GOOGLE_OAUTH_CLIENT_SECRET") || "",
    };

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized bearer token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();

    const deps: HandlerDependencies = {
      getUserId: async () => user.id,

      hasProGroupFeatures: async (userId: string) => {
        const { data, error } = await supabase.rpc("user_has_pro_group_features", {
          p_user_id: userId,
        });
        if (error || typeof data !== "boolean") {
          // Deny by default if RPC fails — leader must have active subscription
          return false;
        }
        return data;
      },

      getConnection: async (userId: string) => {
        const { data, error } = await supabase
          .from("google_calendar_connections")
          .select("status, opted_in, connection_generation")
          .eq("owner_id", userId)
          .single();

        if (error || !data) return null;
        return {
          status: data.status,
          opted_in: Boolean(data.opted_in),
          connection_generation: Number(data.connection_generation || 0),
        };
      },

      withGoogleCalendarProviderRequest: async <T>(userId, generation, request): Promise<T> => {
        if (!googleOAuthClient.clientId || !googleOAuthClient.clientSecret) {
          throw new Error("credential_refresh_failed");
        }
        return withGoogleCalendarProviderRequest(
          supabase,
          userId,
          generation,
          "personal_event_read",
          keyRing,
          googleOAuthClient,
          request
        );
      },

      readWindowRpc: async (userId, gen, start, end) => {
        const { data, error } = await supabase.rpc("read_google_calendar_overlay_window", {
          p_owner_id: userId,
          p_connection_generation: gen,
          p_range_start: start,
          p_range_end_exclusive: end,
        });
        if (error || !data) {
          return { found: false, sync_token: null, last_synced_at: null, events: [] };
        }
        return data;
      },

      replaceWindowRpc: async (userId, gen, start, end, syncToken, events) => {
        const { data, error } = await supabase.rpc("replace_google_calendar_overlay_window", {
          p_owner_id: userId,
          p_connection_generation: gen,
          p_range_start: start,
          p_range_end_exclusive: end,
          p_sync_token: syncToken,
          p_events: events,
        });
        if (error) return false;
        return Boolean(data);
      },

      applyDeltaRpc: async (userId, gen, start, end, syncToken, upsertEvents, deletedEventIds) => {
        const { data, error } = await supabase.rpc("apply_google_calendar_overlay_delta", {
          p_owner_id: userId,
          p_connection_generation: gen,
          p_range_start: start,
          p_range_end_exclusive: end,
          p_sync_token: syncToken,
          p_upsert_events: upsertEvents,
          p_deleted_event_ids: deletedEventIds,
        });
        if (error) return false;
        return Boolean(data);
      },

      clearWindowRpc: async (userId, gen, start, end) => {
        const { data, error } = await supabase.rpc("clear_google_calendar_overlay_state", {
          p_owner_id: userId,
          p_connection_generation: gen,
          p_range_start: start,
          p_range_end_exclusive: end,
        });
        if (error) return false;
        return Boolean(data);
      },
    };

    const responsePayload = await handleGoogleCalendarOverlayRequest(body, deps);

    return new Response(JSON.stringify(responsePayload), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    const status = message.includes("Unauthorized") || message.includes("unknown parameter") ? 400 : 500;

    return new Response(JSON.stringify({ error: message }), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
