// Tracks, per resource type (work/series/user/chapter/content), how many
// requests were served from cache vs. actually sent to AO3, plus how many
// requests never made it to either because they failed validation first
// (e.g. a malformed URL or invalid ID caught before any cache lookup).
//
// ao3Requests counts every attempt to call AO3, regardless of whether AO3
// responded successfully or the request errored out — "a call was made"
// is the thing being counted, not "a call succeeded."
interface Stats {
  cacheHits: number;
  ao3Requests: number;
  errors: number;
}

const stats = new Map<string, Stats>();

function getOrInit(name: string): Stats {
  let entry = stats.get(name);
  if (!entry) {
    entry = { cacheHits: 0, ao3Requests: 0, errors: 0 };
    stats.set(name, entry);
  }
  return entry;
}

export function recordCacheHit(name: string): void {
  getOrInit(name).cacheHits++;
}

export function recordAo3Request(name: string): void {
  getOrInit(name).ao3Requests++;
}

export function recordError(name: string): void {
  getOrInit(name).errors++;
}

// Per-resource-type breakdown (work/series/user/chapter/content).
export function getCacheStatsByType(): Record<string, Stats> {
  return Object.fromEntries(stats);
}

// Single combined total across all resource types, for this shard.
export function getCacheStatsTotals(): Stats {
  const totals: Stats = { cacheHits: 0, ao3Requests: 0, errors: 0 };
  for (const entry of stats.values()) {
    totals.cacheHits += entry.cacheHits;
    totals.ao3Requests += entry.ao3Requests;
    totals.errors += entry.errors;
  }
  return totals;
}