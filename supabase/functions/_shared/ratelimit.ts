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
    throw new ApiError("rate_limited", "Rate limiting is unconfigured.", 429, 60);
  }

  try {
    const result = await strictLimiter.limit(identifier);
    if (!result.success) {
      const remainingSecs = Math.ceil((result.reset - Date.now()) / 1000);
      throw new ApiError(
        "rate_limited",
        "Bạn đang thao tác quá nhanh. Vui lòng thử lại sau.",
        429,
        remainingSecs > 0 ? remainingSecs : 1,
      );
    }
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError("rate_limited", "Rate limiting check failed.", 429, 60);
  }
}
