import { Redis } from "https://esm.sh/@upstash/redis@1.34.3";

const redis = new Redis({
    url: Deno.env.get("UPSTASH_REDIS_REST_URL")!,
    token: Deno.env.get("UPSTASH_REDIS_REST_TOKEN")!,
});

export async function cached<T>(
    key: string,
    ttlSeconds: number,
    fetcher: () => Promise<T>
): Promise<T> {
    const hit = await redis.get<T>(key);
    if (hit !== null) return hit;

    const fresh = await fetcher();
    await redis.set(key, JSON.stringify(fresh), { ex: ttlSeconds });
    return fresh;
}

export async function invalidate(pattern: string) {
    await redis.del(pattern);
}

export { redis };