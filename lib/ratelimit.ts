// Simple in-process sliding-window rate limiter.
//
// Limitation: state is per-process. In multi-instance deployments (load
// balancers, PM2 clusters) the effective ceiling is maxRequests × instances.
// For production at scale, back this with Redis or a shared atomic store.
// For a single-server deployment this provides meaningful brute-force protection.

const windows = new Map<string, number[]>();

/**
 * Returns true if the request is within the allowed rate, false if it exceeds
 * the limit and should be rejected with 429.
 *
 * @param key      Unique per-client/action string (e.g. "login:1.2.3.4")
 * @param max      Maximum requests allowed inside the window
 * @param windowMs Window duration in milliseconds
 */
export function checkRateLimit(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const prior = (windows.get(key) ?? []).filter((t) => now - t < windowMs);
  if (prior.length >= max) return false;
  prior.push(now);
  windows.set(key, prior);
  return true;
}

/** Extract the originating client IP (first hop in x-forwarded-for). */
export function clientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  // Fall back to a sentinel so the key is always defined, but avoid
  // grouping all non-proxied traffic into a single bucket in production.
  return "direct";
}
