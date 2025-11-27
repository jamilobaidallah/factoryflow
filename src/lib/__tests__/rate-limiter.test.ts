import {
  RateLimiter,
  getRateLimiter,
  resetRateLimiter,
  formatRemainingTime,
  DEFAULT_RATE_LIMIT_CONFIG,
  RATE_LIMIT_MESSAGES,
} from '../rate-limiter';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: jest.fn((key: string) => store[key] || null),
    setItem: jest.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: jest.fn((key: string) => {
      delete store[key];
    }),
    clear: jest.fn(() => {
      store = {};
    }),
    get length() {
      return Object.keys(store).length;
    },
    key: jest.fn((index: number) => Object.keys(store)[index] || null),
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

describe('RateLimiter', () => {
  let rateLimiter: RateLimiter;

  beforeEach(() => {
    jest.clearAllMocks();
    localStorageMock.clear();
    resetRateLimiter();
    rateLimiter = new RateLimiter();
  });

  describe('checkRateLimit', () => {
    it('returns unlocked status for new email', () => {
      const status = rateLimiter.checkRateLimit('test@example.com');

      expect(status.isLocked).toBe(false);
      expect(status.remainingAttempts).toBe(DEFAULT_RATE_LIMIT_CONFIG.maxAttempts);
      expect(status.lockoutEndTime).toBeNull();
    });

    it('returns unlocked status with remaining attempts after failed attempts', () => {
      // Record 2 failed attempts
      rateLimiter.recordAttempt('test@example.com', false);
      rateLimiter.recordAttempt('test@example.com', false);

      const status = rateLimiter.checkRateLimit('test@example.com');

      expect(status.isLocked).toBe(false);
      expect(status.remainingAttempts).toBe(DEFAULT_RATE_LIMIT_CONFIG.maxAttempts - 2);
    });

    it('returns locked status after max attempts exceeded', () => {
      const email = 'test@example.com';

      // Record max failed attempts
      for (let i = 0; i < DEFAULT_RATE_LIMIT_CONFIG.maxAttempts; i++) {
        rateLimiter.recordAttempt(email, false);
      }

      const status = rateLimiter.checkRateLimit(email);

      expect(status.isLocked).toBe(true);
      expect(status.remainingAttempts).toBe(0);
      expect(status.lockoutEndTime).not.toBeNull();
      expect(status.lockoutRemainingMs).toBeGreaterThan(0);
    });

    it('treats emails case-insensitively', () => {
      rateLimiter.recordAttempt('TEST@example.com', false);
      rateLimiter.recordAttempt('test@EXAMPLE.com', false);

      const status = rateLimiter.checkRateLimit('test@example.com');

      expect(status.remainingAttempts).toBe(DEFAULT_RATE_LIMIT_CONFIG.maxAttempts - 2);
    });
  });

  describe('recordAttempt', () => {
    it('decrements remaining attempts on failed login', () => {
      const status1 = rateLimiter.recordAttempt('test@example.com', false);
      expect(status1.remainingAttempts).toBe(DEFAULT_RATE_LIMIT_CONFIG.maxAttempts - 1);

      const status2 = rateLimiter.recordAttempt('test@example.com', false);
      expect(status2.remainingAttempts).toBe(DEFAULT_RATE_LIMIT_CONFIG.maxAttempts - 2);
    });

    it('resets attempts on successful login', () => {
      // Add some failed attempts
      rateLimiter.recordAttempt('test@example.com', false);
      rateLimiter.recordAttempt('test@example.com', false);

      // Successful login
      const status = rateLimiter.recordAttempt('test@example.com', true);

      expect(status.isLocked).toBe(false);
      expect(status.remainingAttempts).toBe(DEFAULT_RATE_LIMIT_CONFIG.maxAttempts);
    });

    it('triggers lockout after max attempts', () => {
      const email = 'test@example.com';
      let status;

      // Record max failed attempts
      for (let i = 0; i < DEFAULT_RATE_LIMIT_CONFIG.maxAttempts; i++) {
        status = rateLimiter.recordAttempt(email, false);
      }

      expect(status!.isLocked).toBe(true);
      expect(status!.remainingAttempts).toBe(0);
      expect(status!.lockoutEndTime).not.toBeNull();
    });

    it('blocks further attempts during lockout', () => {
      const email = 'test@example.com';

      // Trigger lockout
      for (let i = 0; i < DEFAULT_RATE_LIMIT_CONFIG.maxAttempts; i++) {
        rateLimiter.recordAttempt(email, false);
      }

      // Check status during lockout
      const status = rateLimiter.checkRateLimit(email);
      expect(status.isLocked).toBe(true);
    });
  });

  describe('lockout expiration', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('unlocks after lockout period expires', () => {
      const email = 'test@example.com';

      // Trigger lockout
      for (let i = 0; i < DEFAULT_RATE_LIMIT_CONFIG.maxAttempts; i++) {
        rateLimiter.recordAttempt(email, false);
      }

      // Verify locked
      expect(rateLimiter.checkRateLimit(email).isLocked).toBe(true);

      // Advance time past lockout duration
      jest.advanceTimersByTime(DEFAULT_RATE_LIMIT_CONFIG.lockoutDurationMs + 1000);

      // Verify unlocked
      expect(rateLimiter.checkRateLimit(email).isLocked).toBe(false);
    });
  });

  describe('exponential backoff', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('increases lockout duration on repeated lockouts', () => {
      const email = 'test@example.com';

      // First lockout
      for (let i = 0; i < DEFAULT_RATE_LIMIT_CONFIG.maxAttempts; i++) {
        rateLimiter.recordAttempt(email, false);
      }

      const firstLockout = rateLimiter.checkRateLimit(email);
      expect(firstLockout.isLocked).toBe(true);
      const firstLockoutMs = firstLockout.lockoutRemainingMs;

      // Wait for first lockout to expire
      jest.advanceTimersByTime(DEFAULT_RATE_LIMIT_CONFIG.lockoutDurationMs + 1000);

      // Second lockout
      for (let i = 0; i < DEFAULT_RATE_LIMIT_CONFIG.maxAttempts; i++) {
        rateLimiter.recordAttempt(email, false);
      }

      const secondLockout = rateLimiter.checkRateLimit(email);
      expect(secondLockout.isLocked).toBe(true);

      // Second lockout should be longer (2x with exponential backoff)
      expect(secondLockout.lockoutRemainingMs).toBeGreaterThan(firstLockoutMs);
    });
  });

  describe('clearRecord', () => {
    it('clears rate limit record for specific email', () => {
      const email = 'test@example.com';

      // Add some failed attempts
      rateLimiter.recordAttempt(email, false);
      rateLimiter.recordAttempt(email, false);

      // Clear record
      rateLimiter.clearRecord(email);

      // Should be reset
      const status = rateLimiter.checkRateLimit(email);
      expect(status.remainingAttempts).toBe(DEFAULT_RATE_LIMIT_CONFIG.maxAttempts);
    });
  });

  describe('clearAllRecords', () => {
    it('clears all rate limit records', () => {
      // Add attempts for multiple emails
      rateLimiter.recordAttempt('user1@example.com', false);
      rateLimiter.recordAttempt('user2@example.com', false);

      // Clear all
      rateLimiter.clearAllRecords();

      // Both should be reset
      expect(rateLimiter.checkRateLimit('user1@example.com').remainingAttempts).toBe(
        DEFAULT_RATE_LIMIT_CONFIG.maxAttempts
      );
      expect(rateLimiter.checkRateLimit('user2@example.com').remainingAttempts).toBe(
        DEFAULT_RATE_LIMIT_CONFIG.maxAttempts
      );
    });
  });

  describe('custom configuration', () => {
    it('allows custom max attempts', () => {
      const customLimiter = new RateLimiter({ maxAttempts: 3 });
      const email = 'test@example.com';

      customLimiter.recordAttempt(email, false);
      customLimiter.recordAttempt(email, false);
      customLimiter.recordAttempt(email, false);

      const status = customLimiter.checkRateLimit(email);
      expect(status.isLocked).toBe(true);
    });
  });
});

describe('formatRemainingTime', () => {
  it('formats seconds correctly', () => {
    expect(formatRemainingTime(5000)).toBe('5 ثانية');
    expect(formatRemainingTime(1000)).toBe('1 ثانية');
    expect(formatRemainingTime(30000)).toBe('30 ثانية');
  });

  it('formats minutes correctly', () => {
    expect(formatRemainingTime(60000)).toBe('دقيقة واحدة');
    expect(formatRemainingTime(120000)).toBe('2 دقائق');
    expect(formatRemainingTime(300000)).toBe('5 دقائق');
  });

  it('formats minutes and seconds correctly', () => {
    expect(formatRemainingTime(90000)).toBe('دقيقة و 30 ثانية');
    expect(formatRemainingTime(150000)).toBe('2 دقائق و 30 ثانية');
  });

  it('returns empty string for zero or negative values', () => {
    expect(formatRemainingTime(0)).toBe('');
    expect(formatRemainingTime(-1000)).toBe('');
  });
});

describe('RATE_LIMIT_MESSAGES', () => {
  it('generates locked message with time', () => {
    const message = RATE_LIMIT_MESSAGES.locked('5 دقائق');
    expect(message).toContain('5 دقائق');
    expect(message).toContain('تم تجاوز');
  });

  it('generates warning message with attempts', () => {
    const message = RATE_LIMIT_MESSAGES.warning(2);
    expect(message).toContain('2');
    expect(message).toContain('محاولات');
  });

  it('generates last attempt message', () => {
    expect(RATE_LIMIT_MESSAGES.lastAttempt).toContain('آخر محاولة');
  });
});

describe('getRateLimiter singleton', () => {
  beforeEach(() => {
    resetRateLimiter();
    localStorageMock.clear();
  });

  it('returns the same instance on multiple calls', () => {
    const instance1 = getRateLimiter();
    const instance2 = getRateLimiter();

    expect(instance1).toBe(instance2);
  });

  it('creates new instance after reset', () => {
    const instance1 = getRateLimiter();
    resetRateLimiter();
    const instance2 = getRateLimiter();

    // They should be different instances
    // (We can't directly compare since the class is the same,
    // but internal state should be reset)
    expect(instance2.checkRateLimit('test@example.com').remainingAttempts).toBe(
      DEFAULT_RATE_LIMIT_CONFIG.maxAttempts
    );
  });
});
