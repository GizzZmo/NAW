/**
 * Distributed rate limiting with optional Redis / Vercel KV.
 *
 * Prefers:
 *   1. Vercel KV (if @vercel/kv is available and KV_URL is set)
 *   2. Upstash Redis REST (if UPSTASH_REDIS_REST_URL + TOKEN are set)
 *   3. In-memory fallback (ephemeral on serverless)
 *
 * Usage:
 *   const result = await checkDistributedRateLimit(clientId);
 *   if (!result.allowed) return 429;
 */

const WINDOW_MS = 60_000;
const MAX_REQUESTS = 10;

interface RateResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

const memoryStore = new Map<string, { count: number; resetAt: number }>();

async function checkMemory(clientId: string): Promise<RateResult> {
  const now = Date.now();
  const entry = memoryStore.get(clientId);
  if (!entry || now > entry.resetAt) {
    const resetAt = now + WINDOW_MS;
    memoryStore.set(clientId, { count: 1, resetAt });
    return { allowed: true, remaining: MAX_REQUESTS - 1, resetAt };
  }
  if (entry.count >= MAX_REQUESTS) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt };
  }
  entry.count += 1;
  return { allowed: true, remaining: MAX_REQUESTS - entry.count, resetAt: entry.resetAt };
}

async function checkUpstash(clientId: string): Promise<RateResult | null> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;

  const key = `naw:rl:${clientId}`;
  const now = Date.now();
  try {
    // INCR + EXPIRE pattern
    const incrRes = await fetch(`${url}/incr/${encodeURIComponent(key)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!incrRes.ok) return null;
    const incrData = await incrRes.json() as { result?: number };
    const count = Number(incrData.result ?? 0);

    if (count === 1) {
      await fetch(`${url}/pexpire/${encodeURIComponent(key)}/${WINDOW_MS}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
    }

    const resetAt = now + WINDOW_MS;
    return {
      allowed: count <= MAX_REQUESTS,
      remaining: Math.max(0, MAX_REQUESTS - count),
      resetAt,
    };
  } catch {
    return null;
  }
}

async function checkVercelKV(clientId: string): Promise<RateResult | null> {
  if (!process.env.KV_URL && !process.env.KV_REST_API_URL) return null;
  try {
    // Dynamic import so the package is optional
    const kv = await import('@vercel/kv').catch(() => null);
    if (!kv) return null;
    const key = `naw:rl:${clientId}`;
    const now = Date.now();
    const count = await kv.kv.incr(key);
    if (count === 1) {
      await kv.kv.pexpire(key, WINDOW_MS);
    }
    return {
      allowed: count <= MAX_REQUESTS,
      remaining: Math.max(0, MAX_REQUESTS - count),
      resetAt: now + WINDOW_MS,
    };
  } catch {
    return null;
  }
}

/**
 * Check rate limit using the best available backend.
 */
export async function checkDistributedRateLimit(clientId: string): Promise<RateResult> {
  const kv = await checkVercelKV(clientId);
  if (kv) return kv;
  const upstash = await checkUpstash(clientId);
  if (upstash) return upstash;
  return checkMemory(clientId);
}

export { MAX_REQUESTS, WINDOW_MS };
