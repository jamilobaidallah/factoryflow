/**
 * Firebase Data Caching Utility
 * Provides in-memory caching with TTL for Firebase queries
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

class FirebaseCache {
  private cache: Map<string, CacheEntry<unknown>> = new Map();
  private defaultTTL = 5 * 60 * 1000; // 5 minutes default

  /**
   * Get cached data if valid, otherwise return null
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key) as CacheEntry<T> | undefined;

    if (!entry) {
      return null;
    }

    const isExpired = Date.now() - entry.timestamp > entry.ttl;

    if (isExpired) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  /**
   * Set data in cache with optional TTL
   */
  set<T>(key: string, data: T, ttl: number = this.defaultTTL): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl,
    });
  }

  /**
   * Invalidate specific cache entry
   */
  invalidate(key: string): void {
    this.cache.delete(key);
  }

  /**
   * Invalidate all entries matching a prefix
   */
  invalidatePrefix(prefix: string): void {
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Clear entire cache
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    };
  }
}

// Singleton instance
export const firebaseCache = new FirebaseCache();

/**
 * Cache key generators for common queries
 */
export const cacheKeys = {
  clients: (userId: string) => `clients:${userId}`,
  ledger: (userId: string) => `ledger:${userId}`,
  payments: (userId: string) => `payments:${userId}`,
  inventory: (userId: string) => `inventory:${userId}`,
  cheques: (userId: string) => `cheques:${userId}`,
  employees: (userId: string) => `employees:${userId}`,
  dashboard: (userId: string) => `dashboard:${userId}`,
};

/**
 * TTL presets in milliseconds
 */
export const cacheTTL = {
  short: 1 * 60 * 1000,      // 1 minute
  medium: 5 * 60 * 1000,     // 5 minutes
  long: 15 * 60 * 1000,      // 15 minutes
  veryLong: 60 * 60 * 1000,  // 1 hour
};
