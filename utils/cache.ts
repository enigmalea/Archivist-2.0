interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

class Cache<T> {
  private store = new Map<string | number, CacheEntry<T>>();
  private ttl: number;

  constructor(ttlMs: number = 60 * 60 * 1000) {
    // default 1 hour
    this.ttl = ttlMs;
  }

  set(key: string | number, value: T): void {
    this.store.set(key, {
      data: value,
      expiresAt: Date.now() + this.ttl,
    });
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

export const workCache = new Cache(60 * 60 * 1000); // 1 hour
export const seriesCache = new Cache(60 * 60 * 1000); // 1 hour
export const userCache = new Cache(24 * 60 * 60 * 1000); // 24 hours