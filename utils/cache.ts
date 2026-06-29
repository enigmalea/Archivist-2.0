import { getSeries, getUser, getWork, getWorkContent } from "@fujocoded/ao3.js";

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

type CacheKey = string | number;

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

type WorkData = Awaited<ReturnType<typeof getWork>>;
type SeriesData = Awaited<ReturnType<typeof getSeries>>;
type UserData = Awaited<ReturnType<typeof getUser>>;
type WorkContentData = Awaited<ReturnType<typeof getWorkContent>>;

class Cache<T> {
  private readonly store = new Map<CacheKey, CacheEntry<T>>();
  private readonly inFlight = new Map<CacheKey, Promise<T>>();

  constructor(private readonly ttlMs: number = HOUR_MS) {}

  set(key: CacheKey, value: T): void {
    this.store.set(key, {
      data: value,
      expiresAt: Date.now() + this.ttlMs,
    });
  }

  get(key: CacheKey): T | null {
    const entry = this.store.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }

    return entry.data;
  }

  async getOrSet(key: CacheKey, loader: () => Promise<T>): Promise<T> {
    const cached = this.get(key);
    if (cached !== null) return cached;

    const pending = this.inFlight.get(key);
    if (pending) return pending;

    const promise = (async () => {
      try {
        const value = await loader();
        this.set(key, value);
        return value;
      } finally {
        this.inFlight.delete(key);
      }
    })();

    this.inFlight.set(key, promise);
    return promise;
  }

  clear(): void {
    this.store.clear();
    this.inFlight.clear();
  }
}

export const workCache = new Cache<WorkData>(HOUR_MS);
export const seriesCache = new Cache<SeriesData>(HOUR_MS);
export const workChapterCache = new Cache<WorkData>(HOUR_MS);
export const workContentCache = new Cache<WorkContentData>(HOUR_MS);
export const userCache = new Cache<UserData>(DAY_MS);

export async function cachedGetWork(workId: CacheKey) {
  return workCache.getOrSet(workId, () => getWork({ workId }));
}

export async function cachedGetSeries(seriesId: CacheKey) {
  return seriesCache.getOrSet(seriesId, () => getSeries({ seriesId }));
}

export async function cachedGetUser(username: string) {
  return userCache.getOrSet(username, () => getUser({ username }));
}

function chapterCacheKey(workId: CacheKey, chapterId?: number | string | null): string {
  return `${workId}:${chapterId ?? "default"}`;
}

export async function cachedGetWorkChapter(workId: CacheKey, chapterId?: number) {
  const key = chapterCacheKey(workId, chapterId);
  return workChapterCache.getOrSet(key, () => getWork({ workId, chapterId }));
}

export async function cachedGetWorkContent(workId: CacheKey, chapterId?: number) {
  const key = chapterCacheKey(workId, chapterId);
  return workContentCache.getOrSet(key, () => getWorkContent({ workId, chapterId }));
}