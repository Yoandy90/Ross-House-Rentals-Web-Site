/**
 * ═══════════════════════════════════════════════════════════════════════════
 * API Cache Utility — Ross Lending App
 * In-memory cache with TTL to prevent redundant fetches.
 * ═══════════════════════════════════════════════════════════════════════════
 */

interface CacheEntry {
  data: any;
  timestamp: number;
}

const cache = new Map<string, CacheEntry>();
const DEFAULT_TTL = 30_000; // 30 seconds

/**
 * Fetch with caching. Returns cached data if still valid.
 */
export async function cachedFetch(
  url: string,
  options?: RequestInit,
  ttl: number = DEFAULT_TTL
): Promise<any> {
  const key = `${options?.method || 'GET'}:${url}`;
  const cached = cache.get(key);

  if (cached && Date.now() - cached.timestamp < ttl) {
    return cached.data;
  }

  const res = await fetch(url, options);
  if (res.ok) {
    const data = await res.json();
    cache.set(key, { data, timestamp: Date.now() });
    return data;
  }

  throw new Error(`HTTP ${res.status}`);
}

/**
 * Invalidate cache entries matching a pattern.
 */
export function invalidateCache(pattern?: string) {
  if (!pattern) {
    cache.clear();
    return;
  }
  for (const key of cache.keys()) {
    if (key.includes(pattern)) {
      cache.delete(key);
    }
  }
}

/**
 * Parallel fetch multiple endpoints. Uses caching per endpoint.
 */
export async function parallelFetch(
  requests: Array<{ url: string; options?: RequestInit; ttl?: number }>
): Promise<any[]> {
  return Promise.all(
    requests.map(({ url, options, ttl }) => cachedFetch(url, options, ttl).catch(() => null))
  );
}
