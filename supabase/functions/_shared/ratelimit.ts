import { Redis } from "https://esm.sh/@upstash/redis@1.34.3";
import { Ratelimit } from "https://esm.sh/@upstash/ratelimit@2.0.5";
import { ApiError } from "./responses.ts";

const redisUrl = Deno.env.get("UPSTASH_REDIS_REST_URL");
const redisToken = Deno.env.get("UPSTASH_REDIS_REST_TOKEN");

const redis = redisUrl && redisToken
  ? new Redis({ url: redisUrl, token: redisToken })
  : null;

const strictLimiter = redis
  ? new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(10, "60 s"),
    analytics: true,
    prefix: "teamfair:api",
  })
  : null;

export async function enforceRateLimit(identifier: string): Promise<void> {
  if (!strictLimiter) {
    console.warn("Upstash rate limiting is not configured; allowing request.");
    return;
  }

  try {
    const result = await strictLimiter.limit(identifier);
    if (!result.success) {
      throw new ApiError("rate_limited", "Bạn đang thao tác quá nhanh. Vui lòng thử lại sau.");
    }
  } catch (error) {
    if (error instanceof ApiError) throw error;
    console.warn("Upstash rate limiting failed open:", error);
  }
}
