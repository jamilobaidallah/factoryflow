/**
 * Rate Limiter for Login Attempts
 *
 * Protects against brute force attacks by tracking failed login attempts
 * and implementing exponential backoff lockout periods.
 */

// ======================
// Configuration
// ======================

export interface RateLimitConfig {
  maxAttempts: number;        // Maximum failed attempts before lockout
  lockoutDurationMs: number;  // Base lockout duration in milliseconds
  maxLockoutMs: number;       // Maximum lockout duration
  attemptWindowMs: number;    // Time window for counting attempts
  useExponentialBackoff: boolean; // Whether to increase lockout duration exponentially
}

export const DEFAULT_RATE_LIMIT_CONFIG: RateLimitConfig = {
  maxAttempts: 5,                    // 5 failed attempts
  lockoutDurationMs: 60 * 1000,      // 1 minute base lockout
  maxLockoutMs: 30 * 60 * 1000,      // Maximum 30 minute lockout
  attemptWindowMs: 15 * 60 * 1000,   // 15 minute window for counting attempts
  useExponentialBackoff: true,       // Exponential backoff enabled
};

// ======================
// Types
// ======================

export interface LoginAttempt {
  timestamp: number;
  success: boolean;
}

export interface RateLimitRecord {
  email: string;
  attempts: LoginAttempt[];
  lockoutCount: number;        // Number of times user has been locked out
  lockoutUntil: number | null; // Timestamp when lockout ends
  lastAttempt: number;
}

export interface RateLimitStatus {
  isLocked: boolean;
  remainingAttempts: number;
  lockoutEndTime: number | null;
  lockoutRemainingMs: number;
  lockoutRemainingFormatted: string;
}

// ======================
// Storage Keys
// ======================

const STORAGE_KEY_PREFIX = 'factoryflow_rate_limit_';
const GLOBAL_STORAGE_KEY = 'factoryflow_rate_limit_global';

// ======================
// Helper Functions
// ======================

/**
 * Check if localStorage is available
 */
function isLocalStorageAvailable(): boolean {
  try {
    const testKey = '__rate_limit_test__';
    localStorage.setItem(testKey, 'test');
    localStorage.removeItem(testKey);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get storage key for an email
 */
function getStorageKey(email: string): string {
  // Normalize email to lowercase for consistent tracking
  const normalizedEmail = email.toLowerCase().trim();
  // Create a simple hash to avoid storing email directly
  const hash = normalizedEmail.split('').reduce((acc, char) => {
    return ((acc << 5) - acc + char.charCodeAt(0)) | 0;
  }, 0);
  return `${STORAGE_KEY_PREFIX}${Math.abs(hash)}`;
}

/**
 * Get record from storage
 */
function getRecord(email: string): RateLimitRecord | null {
  if (!isLocalStorageAvailable()) {
    return null;
  }

  try {
    const key = getStorageKey(email);
    const data = localStorage.getItem(key);
    if (!data) {
      return null;
    }
    return JSON.parse(data) as RateLimitRecord;
  } catch {
    return null;
  }
}

/**
 * Save record to storage
 */
function saveRecord(email: string, record: RateLimitRecord): void {
  if (!isLocalStorageAvailable()) {
    return;
  }

  try {
    const key = getStorageKey(email);
    localStorage.setItem(key, JSON.stringify(record));
  } catch {
    // Storage full or unavailable - continue without persistence
    // eslint-disable-next-line no-console
    console.warn('Rate limiter: Unable to save to localStorage');
  }
}

/**
 * Get global rate limit record (for IP-based limiting simulation)
 */
function getGlobalRecord(): RateLimitRecord | null {
  if (!isLocalStorageAvailable()) {
    return null;
  }

  try {
    const data = localStorage.getItem(GLOBAL_STORAGE_KEY);
    if (!data) {
      return null;
    }
    return JSON.parse(data) as RateLimitRecord;
  } catch {
    return null;
  }
}

/**
 * Save global record
 */
function saveGlobalRecord(record: RateLimitRecord): void {
  if (!isLocalStorageAvailable()) {
    return;
  }

  try {
    localStorage.setItem(GLOBAL_STORAGE_KEY, JSON.stringify(record));
  } catch {
    // eslint-disable-next-line no-console
    console.warn('Rate limiter: Unable to save global record');
  }
}

/**
 * Format milliseconds to human-readable Arabic string
 */
export function formatRemainingTime(ms: number): string {
  if (ms <= 0) {
    return '';
  }

  const seconds = Math.ceil(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  if (minutes === 0) {
    return `${seconds} ثانية`;
  } else if (remainingSeconds === 0) {
    return minutes === 1 ? 'دقيقة واحدة' : `${minutes} دقائق`;
  } else {
    const minuteText = minutes === 1 ? 'دقيقة' : `${minutes} دقائق`;
    return `${minuteText} و ${remainingSeconds} ثانية`;
  }
}

/**
 * Calculate lockout duration based on lockout count
 */
function calculateLockoutDuration(
  lockoutCount: number,
  config: RateLimitConfig
): number {
  if (!config.useExponentialBackoff) {
    return config.lockoutDurationMs;
  }

  // Exponential backoff: 1min, 2min, 4min, 8min, etc.
  const duration = config.lockoutDurationMs * Math.pow(2, lockoutCount);
  return Math.min(duration, config.maxLockoutMs);
}

// ======================
// Main Rate Limiter Class
// ======================

export class RateLimiter {
  private config: RateLimitConfig;

  constructor(config: Partial<RateLimitConfig> = {}) {
    this.config = { ...DEFAULT_RATE_LIMIT_CONFIG, ...config };
  }

  /**
   * Check if login attempt is allowed for the given email
   */
  checkRateLimit(email: string): RateLimitStatus {
    const now = Date.now();
    const record = getRecord(email);
    const globalRecord = getGlobalRecord();

    // Check global rate limit first (device-level protection)
    if (globalRecord?.lockoutUntil && globalRecord.lockoutUntil > now) {
      const remainingMs = globalRecord.lockoutUntil - now;
      return {
        isLocked: true,
        remainingAttempts: 0,
        lockoutEndTime: globalRecord.lockoutUntil,
        lockoutRemainingMs: remainingMs,
        lockoutRemainingFormatted: formatRemainingTime(remainingMs),
      };
    }

    // Check email-specific rate limit
    if (record?.lockoutUntil && record.lockoutUntil > now) {
      const remainingMs = record.lockoutUntil - now;
      return {
        isLocked: true,
        remainingAttempts: 0,
        lockoutEndTime: record.lockoutUntil,
        lockoutRemainingMs: remainingMs,
        lockoutRemainingFormatted: formatRemainingTime(remainingMs),
      };
    }

    // Count recent failed attempts within the window
    const recentFailedAttempts = this.getRecentFailedAttempts(email);
    const remainingAttempts = Math.max(0, this.config.maxAttempts - recentFailedAttempts);

    return {
      isLocked: false,
      remainingAttempts,
      lockoutEndTime: null,
      lockoutRemainingMs: 0,
      lockoutRemainingFormatted: '',
    };
  }

  /**
   * Record a login attempt (call after each login attempt)
   */
  recordAttempt(email: string, success: boolean): RateLimitStatus {
    const now = Date.now();
    const normalizedEmail = email.toLowerCase().trim();

    // Get or create record
    const record = getRecord(normalizedEmail) || {
      email: normalizedEmail,
      attempts: [],
      lockoutCount: 0,
      lockoutUntil: null,
      lastAttempt: now,
    };

    // Clean up old attempts outside the window
    const windowStart = now - this.config.attemptWindowMs;
    record.attempts = record.attempts.filter(a => a.timestamp > windowStart);

    // Add new attempt
    record.attempts.push({
      timestamp: now,
      success,
    });
    record.lastAttempt = now;

    // If successful, reset lockout count
    if (success) {
      record.lockoutCount = 0;
      record.lockoutUntil = null;
      record.attempts = []; // Clear failed attempts on success
      saveRecord(normalizedEmail, record);
      this.updateGlobalRecord(success);

      return {
        isLocked: false,
        remainingAttempts: this.config.maxAttempts,
        lockoutEndTime: null,
        lockoutRemainingMs: 0,
        lockoutRemainingFormatted: '',
      };
    }

    // Count failed attempts
    const failedAttempts = record.attempts.filter(a => !a.success).length;

    // Check if we need to trigger lockout
    if (failedAttempts >= this.config.maxAttempts) {
      const lockoutDuration = calculateLockoutDuration(record.lockoutCount, this.config);
      record.lockoutUntil = now + lockoutDuration;
      record.lockoutCount += 1;

      saveRecord(normalizedEmail, record);
      this.updateGlobalRecord(false);

      return {
        isLocked: true,
        remainingAttempts: 0,
        lockoutEndTime: record.lockoutUntil,
        lockoutRemainingMs: lockoutDuration,
        lockoutRemainingFormatted: formatRemainingTime(lockoutDuration),
      };
    }

    saveRecord(normalizedEmail, record);
    this.updateGlobalRecord(false);

    const remainingAttempts = this.config.maxAttempts - failedAttempts;
    return {
      isLocked: false,
      remainingAttempts,
      lockoutEndTime: null,
      lockoutRemainingMs: 0,
      lockoutRemainingFormatted: '',
    };
  }

  /**
   * Get number of recent failed attempts for an email
   */
  private getRecentFailedAttempts(email: string): number {
    const record = getRecord(email);
    if (!record) {
      return 0;
    }

    const now = Date.now();
    const windowStart = now - this.config.attemptWindowMs;

    return record.attempts.filter(
      a => !a.success && a.timestamp > windowStart
    ).length;
  }

  /**
   * Update global rate limit record (device-level)
   */
  private updateGlobalRecord(success: boolean): void {
    const now = Date.now();

    const globalRecord = getGlobalRecord() || {
      email: 'global',
      attempts: [],
      lockoutCount: 0,
      lockoutUntil: null,
      lastAttempt: now,
    };

    // Use a larger attempt window for global tracking (30 minutes)
    const globalWindowMs = 30 * 60 * 1000;
    const windowStart = now - globalWindowMs;
    globalRecord.attempts = globalRecord.attempts.filter(a => a.timestamp > windowStart);

    globalRecord.attempts.push({
      timestamp: now,
      success,
    });
    globalRecord.lastAttempt = now;

    if (success) {
      globalRecord.lockoutCount = Math.max(0, globalRecord.lockoutCount - 1);
      globalRecord.lockoutUntil = null;
    } else {
      // Global limit is more lenient: 10 attempts
      const globalFailedAttempts = globalRecord.attempts.filter(a => !a.success).length;
      if (globalFailedAttempts >= 10) {
        const lockoutDuration = calculateLockoutDuration(globalRecord.lockoutCount, {
          ...this.config,
          lockoutDurationMs: 5 * 60 * 1000, // 5 minute base for global
        });
        globalRecord.lockoutUntil = now + lockoutDuration;
        globalRecord.lockoutCount += 1;
      }
    }

    saveGlobalRecord(globalRecord);
  }

  /**
   * Clear rate limit record for an email (for testing or admin reset)
   */
  clearRecord(email: string): void {
    if (!isLocalStorageAvailable()) {
      return;
    }

    try {
      const key = getStorageKey(email);
      localStorage.removeItem(key);
    } catch {
      // Ignore errors
    }
  }

  /**
   * Clear all rate limit records (for testing)
   */
  clearAllRecords(): void {
    if (!isLocalStorageAvailable()) {
      return;
    }

    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith(STORAGE_KEY_PREFIX) || key === GLOBAL_STORAGE_KEY) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(key => localStorage.removeItem(key));
    } catch {
      // Ignore errors
    }
  }
}

// ======================
// Singleton Instance
// ======================

let rateLimiterInstance: RateLimiter | null = null;

/**
 * Get the singleton rate limiter instance
 */
export function getRateLimiter(config?: Partial<RateLimitConfig>): RateLimiter {
  if (!rateLimiterInstance) {
    rateLimiterInstance = new RateLimiter(config);
  }
  return rateLimiterInstance;
}

/**
 * Reset the singleton instance (for testing)
 */
export function resetRateLimiter(): void {
  rateLimiterInstance = null;
}

// ======================
// Error Messages (Arabic)
// ======================

export const RATE_LIMIT_MESSAGES = {
  locked: (remaining: string) =>
    `تم تجاوز عدد محاولات تسجيل الدخول المسموحة. يرجى المحاولة بعد ${remaining}`,
  warning: (attempts: number) =>
    `تحذير: تبقى لديك ${attempts} محاولات قبل قفل الحساب مؤقتاً`,
  lastAttempt: 'تحذير: هذه آخر محاولة قبل قفل الحساب مؤقتاً',
  tooManyDeviceAttempts: 'تم رصد محاولات دخول متعددة من هذا الجهاز. يرجى الانتظار.',
};
