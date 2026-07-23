import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { parseKeyRing } from "../_shared/google-calendar/crypto.ts";
import { withGoogleCalendarProviderRequest } from "../_shared/google-calendar/credentials.ts";
import { GoogleCalendarProviderAdapter } from "./provider.ts";
import { ClaimedTaskSyncJob, runTaskSyncWorkerBatch, SyncWorkerDependencies } from "./sync.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const authHeader = req.headers.get("Authorization") || "";

    if (!authHeader.startsWith("Bearer ") || !serviceKey) {
      return new Response(JSON.stringify({ error: "Unauthorized worker request" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "").trim();
    if (token !== serviceKey) {
      return new Response(JSON.stringify({ error: "Invalid service authorization token" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseClient = createClient(supabaseUrl, serviceKey);
    const keyRing = parseKeyRing(
      Deno.env.get("GOOGLE_CALENDAR_TOKEN_KEYS_JSON"),
      Deno.env.get("GOOGLE_CALENDAR_TEST_MODE") === "true"
    );
    const googleOAuthClient = {
      clientId: Deno.env.get("GOOGLE_OAUTH_CLIENT_ID") || "",
      clientSecret: Deno.env.get("GOOGLE_OAUTH_CLIENT_SECRET") || "",
    };

    let batchSize = 10;
    try {
      const body = await req.json();
      if (typeof body?.batch_size === "number") {
        batchSize = Math.min(Math.max(1, body.batch_size), 10);
      }
    } catch {
      // empty body
    }

    const workerId = `worker-${crypto.randomUUID()}`;
    const provider = new GoogleCalendarProviderAdapter();

    const deps: SyncWorkerDependencies = {
      db: {
        async claimJobs(wId: string, size: number, leaseSecs: number): Promise<ClaimedTaskSyncJob[]> {
          const { data, error } = await supabaseClient.rpc("claim_google_calendar_task_sync_jobs", {
            p_worker_id: wId,
            p_batch_size: size,
            p_lease_seconds: leaseSecs,
          });
          if (error) throw new Error(error.message);
          return (data || []) as ClaimedTaskSyncJob[];
        },

        async completeJob(
          taskId: string,
          ownerId: string,
          leaseToken: string,
          claimedVersion: number,
          googleEventId: string | null,
          etag: string | null,
          connectionGeneration?: number
        ): Promise<boolean> {
          const { data, error } = await supabaseClient.rpc("complete_google_calendar_task_sync_job", {
            p_task_id: taskId,
            p_owner_id: ownerId,
            p_lease_token: leaseToken,
            p_claimed_version: claimedVersion,
            p_google_event_id: googleEventId,
            p_etag: etag,
            p_connection_generation: connectionGeneration || 0,
          });
          if (error) throw new Error(error.message);
          return Boolean(data);
        },

        async rescheduleJob(
          taskId: string,
          ownerId: string,
          leaseToken: string,
          claimedVersion: number,
          outcomeCode: string,
          availableAt: Date | null,
          consumeAttempt: boolean
        ): Promise<boolean> {
          const { data, error } = await supabaseClient.rpc("reschedule_google_calendar_task_sync_job", {
            p_task_id: taskId,
            p_owner_id: ownerId,
            p_lease_token: leaseToken,
            p_claimed_version: claimedVersion,
            p_outcome_code: outcomeCode,
            p_available_at: availableAt ? availableAt.toISOString() : null,
            p_consume_attempt: consumeAttempt,
          });
          if (error) throw new Error(error.message);
          return Boolean(data);
        },

        async checkOwnerEntitlementAndConnection(ownerId: string) {
          const { data: conn, error: connErr } = await supabaseClient
            .from("google_calendar_connections")
            .select("status, opted_in, granted_scopes, connection_generation")
            .eq("owner_id", ownerId)
            .maybeSingle();
          
          if (connErr || !conn) {
            return { status: "disconnected", optedIn: false, grantedScopes: [], connectionGeneration: 0, isEntitled: false };
          }

          const { data: sub } = await supabaseClient
            .from("user_subscriptions")
            .select("plan, status")
            .eq("user_id", ownerId)
            .maybeSingle();

          const isEntitled = sub?.status === "active" && (sub.plan === "pro_group" || sub.plan === "pro_max");

          return {
            status: conn.status,
            optedIn: conn.opted_in,
            grantedScopes: conn.granted_scopes || [],
            connectionGeneration: Number(conn.connection_generation || 0),
            isEntitled,
          };
        },

        async withGoogleCalendarProviderRequest<T>(ownerId, expectedGen, purpose, request): Promise<T> {
          if (!googleOAuthClient.clientId || !googleOAuthClient.clientSecret) {
            throw new Error("credential_refresh_failed");
          }
          return withGoogleCalendarProviderRequest(
            supabaseClient,
            ownerId,
            expectedGen,
            purpose,
            keyRing,
            googleOAuthClient,
            request
          );
        },
      },
      provider,
    };

    const result = await runTaskSyncWorkerBatch(workerId, batchSize, deps);

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    const msg = (err as Error)?.message || "Internal worker error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
