import { getSeries, getUser, getWork } from "@fujocoded/ao3.js";

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

class Cache<T> {
  private store = new Map<string | number, CacheEntry<T>>();
  private ttl: number;

  constructor(ttlMs: number = 60 * 60 * 1000) {
    this.ttl = ttlMs;
  }

  set(key: string | number, value: T): void {
    this.store.set(key, { data: value, expiresAt: Date.now() + this.ttl });
  }

  get(key: string | number): T | null {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return entry.data;
  }

  clear(): void {
    this.store.clear();
  }
}

// Raw AO3 API responses — NOT embeds. Shared by every command/embed builder
// that needs the same workId/seriesId/username, regardless of what they
// render it as.
export const workCache = new Cache<Awaited<ReturnType<typeof getWork>>>(60 * 60 * 1000);
export const seriesCache = new Cache<Awaited<ReturnType<typeof getSeries>>>(60 * 60 * 1000);
export const userCache = new Cache<Awaited<ReturnType<typeof getUser>>>(24 * 60 * 60 * 1000);

// Single entry point for fetching each resource. Every consumer calls these
// instead of getWork/getSeries/getUser directly.
export async function cachedGetWork(workId: string | number) {
  const cached = workCache.get(workId);
  if (cached) return cached;

  const work = await getWork({ workId });
  workCache.set(workId, work);
  return work;
}

export async function cachedGetSeries(seriesId: string | number) {
  const cached = seriesCache.get(seriesId);
  if (cached) return cached;

  const series = await getSeries({ seriesId });
  seriesCache.set(seriesId, series);
  return series;
}

export async function cachedGetUser(username: string) {
  const cached = userCache.get(username);
  if (cached) return cached;

  const user = await getUser({ username });
  userCache.set(username, user);
  return user;
}