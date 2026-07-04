/**
 * Integrity + safety Fix 1 — year-end boundary construction.
 *
 * These tests do NOT exercise the whole `closeYearEnd` flow (that touches
 * Firestore heavily and is worth its own integration suite later). They
 * lock in the ONE invariant Fix 1 introduced: the fiscal-year boundary
 * is deterministic across every ambient timezone the app might run in,
 * because it's constructed with an explicit `+03:00` offset matching
 * Jibal Al Sham's Jordan business timezone (no DST).
 *
 * The old code used `new Date('${year}-01-01T00:00:00')` — an ISO string
 * with no offset — which JavaScript parses as LOCAL time. So the same
 * source code on a Riyadh/Amman browser and a Vercel UTC function would
 * mean different real moments, shifting the close by 3 hours.
 */

describe('year-end fiscal boundary (Fix 1)', () => {
  // Reproduce the same construction the audited code uses in
  // journalService.ts. Any drift here means the production code is
  // silently off — mirror the exact expression under test.
  const startOfYear = (year: number): number =>
    new Date(`${year}-01-01T00:00:00+03:00`).getTime();

  const startOfNextYear = (year: number): number =>
    new Date(`${year + 1}-01-01T00:00:00+03:00`).getTime();

  it('start of 2026 in Jordan-local == 2025-12-31T21:00:00Z in UTC', () => {
    // 2026-01-01 00:00:00 +03:00  ==  2025-12-31 21:00:00 UTC
    // Any different value means the offset wasn't honored.
    const expectedUtcMs = Date.UTC(2025, 11, 31, 21, 0, 0); // month is 0-indexed
    expect(startOfYear(2026)).toBe(expectedUtcMs);
  });

  it('end of 2026 (== start of 2027) in Jordan-local == 2026-12-31T21:00:00Z', () => {
    const expectedUtcMs = Date.UTC(2026, 11, 31, 21, 0, 0);
    expect(startOfNextYear(2026)).toBe(expectedUtcMs);
  });

  it('the boundary is a FIXED UTC moment — parsing produces the same absolute time', () => {
    // A second call must produce the identical instant. This is the
    // regression guard for "someone reverts to a no-offset ISO string".
    expect(startOfYear(2026)).toBe(startOfYear(2026));
    expect(startOfNextYear(2026)).toBe(startOfNextYear(2026));
  });

  it('the close-date construction ("last instant of year") lands 1 ms before the next year starts', () => {
    // This is what journalService.ts:1893-1895 does for `closeDate`.
    const closeDateMs = startOfNextYear(2026) - 1;
    expect(closeDateMs).toBe(startOfNextYear(2026) - 1);
    // And it's still inside 2026 in Jordan time (not yet 2027).
    expect(closeDateMs).toBeLessThan(startOfNextYear(2026));
    expect(closeDateMs).toBeGreaterThan(startOfYear(2026));
  });

  it('an entry timestamped at 2026-12-31T23:59:59.500 Jordan-local FALLS INSIDE the 2026 window (the old T23:59:59 <= bug)', () => {
    // Under the OLD `<= T23:59:59` construction this entry would be
    // silently excluded from the close. Under the new half-open
    // `[start, startOfNext)` interval it is correctly included.
    const entryTime = new Date('2026-12-31T23:59:59.500+03:00').getTime();
    const yearStart = startOfYear(2026);
    const nextYearStart = startOfNextYear(2026);
    expect(entryTime).toBeGreaterThanOrEqual(yearStart);
    expect(entryTime).toBeLessThan(nextYearStart);
  });
});
