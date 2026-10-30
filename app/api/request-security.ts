const buckets = new Map<string, { count: number; resetAt: number }>();

export function isSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

export function isRateLimited(
  request: Request,
  scope: string,
  limit: number,
  windowMs = 60_000,
) {
  const address = request.headers.get("x-real-ip")?.trim()
    || request.headers.get("cf-connecting-ip")?.trim()
    || "anonymous";
  const key = `${scope}:${address}`;
  const now = Date.now();

  if (buckets.size > 5_000) {
    for (const [bucketKey, bucket] of buckets) {
      if (bucket.resetAt <= now) buckets.delete(bucketKey);
    }
  }
  if (buckets.size >= 10_000 && !buckets.has(key)) return true;

  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return false;
  }
  bucket.count += 1;
  return bucket.count > limit;
}
