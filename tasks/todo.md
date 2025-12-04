# Fix Silent Data Corruption - Negative Value Clamps

## Problem Summary

**Severity: HIGH** - Silent data corruption

Multiple locations in the codebase silently clamp negative values to zero using `Math.max(0, ...)`. This hides data integrity violations rather than exposing them as bugs.

### The Issue

```typescript
// Example: If revertedQuantity is -5, this silently becomes 0
batch.update(itemDocRef, { quantity: Math.max(0, revertedQuantity) });
```

**Why this is dangerous:**
- Negative inventory = **BUG** (over-sold, double-deletion, data corruption)
- Negative totalPaid = **BUG** (payment double-reversed, data mismatch)
- Silent clamps **hide** these bugs instead of catching them

---

## Affected Locations

| File | Line | Context | Silent Clamp |
|------|------|---------|--------------|
| `ledgerService.ts` | 676 | Inventory reversal on delete | `Math.max(0, revertedQuantity)` |
| `arap-utils.ts` | 119 | ARAP payment subtraction | `zeroFloor(...)` |
| `outgoing-cheques-page.tsx` | 142 | Cheque allocation reversal | `Math.max(0, currentTotalPaid - allocatedAmount)` |
| `incoming-cheques-page.tsx` | 170 | Cheque allocation reversal | `Math.max(0, currentTotalPaid - allocatedAmount)` |
| `useOutgoingChequesOperations.ts` | 80 | ARAP update on cheque | `Math.max(0, currentTotalPaid - amount)` |
| `payments-page.tsx` | 400 | Payment deletion reversal | `Math.max(0, currentTotalPaid - payment.amount)` |
| `currency.ts` | 180-183 | `zeroFloor()` utility | Returns 0 for negatives (by design - used by others) |

---

## Solution Design

### Principle: Fail Fast, Fix Root Cause

Instead of silently clamping, we will:
1. **Detect** when a value would go negative
2. **Log** a detailed error for debugging
3. **Throw** or return failure to surface the issue
4. **Keep** `zeroFloor()` for cases where clamping IS correct (display, UI rounding)

### New Error Type

Create a `DataIntegrityError` for these violations:

```typescript
export class DataIntegrityError extends Error {
  constructor(
    message: string,
    public readonly context: {
      operation: string;
      expectedValue: number;
      actualValue: number;
      entityId?: string;
    }
  ) {
    super(message);
    this.name = 'DataIntegrityError';
  }
}
```

### New Validation Function

```typescript
/**
 * Assert value is non-negative, throw DataIntegrityError if not.
 * Use this instead of Math.max(0, value) to catch bugs.
 */
export function assertNonNegative(
  value: number,
  context: { operation: string; entityId?: string }
): number {
  if (value < 0) {
    throw new DataIntegrityError(
      `Data integrity violation: ${context.operation} resulted in negative value (${value})`,
      { operation: context.operation, expectedValue: 0, actualValue: value, entityId: context.entityId }
    );
  }
  return value;
}
```

---

## Implementation Plan

### Phase 1: Create Error Infrastructure

- [x] **Task 1.1: Create DataIntegrityError class**
  - File: `src/lib/errors.ts` (new file)
  - Define DataIntegrityError with context object
  - Export alongside any existing error types

- [x] **Task 1.2: Create assertNonNegative utility**
  - File: `src/lib/validation.ts` (added to existing file)
  - Assert function that throws DataIntegrityError
  - Keep separate from currency.ts (different responsibility)

### Phase 2: Fix Silent Clamps

- [x] **Task 2.1: Fix ledgerService.ts inventory reversal**
  - Line 676: Replace `Math.max(0, revertedQuantity)` with `assertNonNegative()`
  - Wrap in try/catch to return meaningful error to caller
  - Batch should fail if data integrity violated

- [x] **Task 2.2: Fix arap-utils.ts payment subtraction**
  - Line 119: Replace `zeroFloor()` with `assertNonNegative()`
  - Transaction will fail atomically if violated
  - Error propagates to calling code

- [x] **Task 2.3: Fix outgoing-cheques-page.tsx**
  - Line 142: Replace `Math.max(0, ...)` with `assertNonNegative()`
  - Catch error and show toast with meaningful message
  - Log full error for debugging

- [x] **Task 2.4: Fix incoming-cheques-page.tsx**
  - Line 170: Same fix as outgoing-cheques-page.tsx

- [x] **Task 2.5: Fix useOutgoingChequesOperations.ts**
  - Line 80: Replace `Math.max(0, ...)` with `assertNonNegative()`
  - Also fixed second occurrence at line 325
  - Return failure status if integrity violated

- [x] **Task 2.6: Fix payments-page.tsx**
  - Line 400: Replace `Math.max(0, ...)` with `assertNonNegative()`
  - Show error toast, prevent partial state updates

### Phase 3: Testing

- [x] **Task 3.1: Add unit tests for DataIntegrityError**
  - Test error creation with context
  - Test error message formatting

- [x] **Task 3.2: Add unit tests for assertNonNegative**
  - Test positive values pass through
  - Test zero passes through
  - Test negative values throw DataIntegrityError

- [x] **Task 3.3: Run full test suite**
  - Ensure no regressions
  - All existing tests pass

### Phase 4: Verification

- [x] **Task 4.1: TypeScript compilation**
  - `npx tsc --noEmit` passes

- [x] **Task 4.2: Run production build**
  - `npm run build` succeeds

- [x] **Task 4.3: Run linting**
  - `npm run lint` passes (only pre-existing warnings)

---

## Files to Create

| File | Purpose |
|------|---------|
| `src/lib/errors.ts` | DataIntegrityError class |
| `src/lib/validation.ts` | assertNonNegative utility |
| `src/lib/__tests__/errors.test.ts` | Error class tests |
| `src/lib/__tests__/validation.test.ts` | Validation utility tests |

## Files to Modify

| File | Change |
|------|--------|
| `src/services/ledgerService.ts` | Replace silent clamp with assertion |
| `src/lib/arap-utils.ts` | Replace zeroFloor with assertion |
| `src/components/cheques/outgoing-cheques-page.tsx` | Replace silent clamp with assertion |
| `src/components/cheques/incoming-cheques-page.tsx` | Replace silent clamp with assertion |
| `src/components/cheques/hooks/useOutgoingChequesOperations.ts` | Replace silent clamp with assertion |
| `src/components/payments/payments-page.tsx` | Replace silent clamp with assertion |

---

## Risk Assessment

| Risk | Mitigation |
|------|------------|
| Surfacing hidden bugs | Good! That's the point. Fix root causes |
| Breaking user operations | Errors show helpful message, operation fails safely |
| Production errors | Better to fail fast than corrupt data silently |

---

## Review Section

### Changes Made

**New Files Created:**
- `src/lib/errors.ts` - DataIntegrityError class with context object and type guard
- `src/lib/__tests__/errors.test.ts` - 9 tests for DataIntegrityError
- `src/lib/__tests__/validation-assertions.test.ts` - 12 tests for assertNonNegative

**Files Modified:**
- `src/lib/validation.ts` - Added assertNonNegative function
- `src/services/ledgerService.ts` - Replaced silent clamp with assertion (inventory reversal)
- `src/lib/arap-utils.ts` - Replaced zeroFloor with assertion (payment calculation)
- `src/components/cheques/outgoing-cheques-page.tsx` - Replaced silent clamp with assertion
- `src/components/cheques/incoming-cheques-page.tsx` - Replaced silent clamp with assertion
- `src/components/cheques/hooks/useOutgoingChequesOperations.ts` - Replaced 2 silent clamps with assertions
- `src/components/payments/payments-page.tsx` - Replaced silent clamp with assertion
- `src/lib/__tests__/arap-utils.test.ts` - Updated 2 tests to expect new behavior

### Tests Added
- **21 new tests** for DataIntegrityError and assertNonNegative
- Updated 2 existing tests in arap-utils.test.ts to reflect new "fail fast" behavior

### Verification Results
- **TypeScript**: Compiles without errors
- **Tests**: 1110 tests pass (0 failures)
- **Build**: Production build succeeds
- **Lint**: Only pre-existing warnings, no new issues

### Behavioral Change
Operations that would result in negative inventory or payment values now **fail with an error** instead of silently clamping to zero. This surfaces data integrity bugs rather than hiding them.

---

**Implementation complete. Ready for PR review.**
