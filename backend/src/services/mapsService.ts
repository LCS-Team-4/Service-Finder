// Central wrapper for all Maps/geocoding API calls.
// Handles caching + graceful failure so the rest of the app
// never talks to the Maps API directly (see docs/roadblock-notes.md).

interface CacheEntry {
  data: unknown;
  timestamp: number;
}

const cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 1000 * 60 * 60; // 1 hour

export async function geocode(query: string): Promise<unknown> {
  const cached = cache.get(query);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.data;
  }

  // TODO: call the actual Maps API here
  // const response = await axios.get(...)
  // cache.set(query, { data: response.data, timestamp: Date.now() });
  // return response.data;
}
