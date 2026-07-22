import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { getDecryptedRefreshToken } from "../_shared/google-calendar/credentials.ts";
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

        async acquireOperationLease(ownerId, expectedGen, opId, purpose, ttlSecs) {
          const { data, error } = await supabaseClient.rpc("acquire_google_calendar_operation_lease", {
            p_owner_id: ownerId,
            p_expected_generation: expectedGen,
            p_operation_id: opId,
            p_purpose: purpose,
            p_requested_ttl_seconds: ttlSecs,
          });
          if (error || !data || data.length === 0) {
            return { leaseAcquired: false, denialCode: error?.message || "lease_denied", authorizedGeneration: 0 };
          }
          const row = data[0];
          return {
            leaseAcquired: Boolean(row.lease_acquired),
            denialCode: row.denial_code || null,
            authorizedGeneration: Number(row.authorized_generation || 0),
          };
        },

        async releaseOperationLease(ownerId, opId) {
          const { data, error } = await supabaseClient.rpc("release_google_calendar_operation_lease", {
            p_owner_id: ownerId,
            p_operation_id: opId,
          });
          if (error) return false;
          return Boolean(data);
        },

        async getAccessTokenForOwner(ownerId: string): Promise<string | null> {
          try {
            const refreshToken = await getDecryptedRefreshToken(supabaseClient, ownerId);
            if (!refreshToken) return null;
            
            const clientId = Deno.env.get("GOOGLE_CLIENT_ID") || "";
            const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET") || "";
            if (!clientId || !clientSecret) return null;

            const res = await fetch("https://oauth2.googleapis.com/token", {
              method: "POST",
              headers: { "Content-Type": "application/x-www-form-urlencoded" },
              body: new URLSearchParams({
                client_id: clientId,
                client_secret: clientSecret,
                refresh_token: refreshToken,
                grant_type: "refresh_token",
              }),
            });

            if (!res.ok) return null;
            const data = await res.json();
            return data.access_token || null;
          } catch {
            return null;
          }
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
