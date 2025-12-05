# Feature: Improve Error Classification in LedgerService

## Problem

All errors in `LedgerService.ts` collapse to generic Arabic messages like "حدث خطأ أثناء حفظ الحركة المالية". Users cannot distinguish between:
- Network issues (connectivity problems)
- Permission errors (unauthorized access)
- Validation failures (bad data)
- Not found errors (missing records)

## Analysis

### Existing Infrastructure (Already Available!)

The codebase already has comprehensive error handling in `src/lib/error-handling.ts`:

```typescript
enum ErrorType {
  VALIDATION, FIREBASE, NETWORK, DUPLICATE, NOT_FOUND, PERMISSION, RATE_LIMITED, UNKNOWN
}

function handleError(error: unknown): AppError {
  // Already classifies Firebase, Zod, network, and unknown errors
  // Returns: { type, message, details?, field?, code? }
}
```

This includes Arabic messages for Firebase error codes like:
- `permission-denied` → "ليس لديك صلاحية للقيام بهذا الإجراء"
- `not-found` → "البيانات المطلوبة غير موجودة"
- `unavailable` → "الخدمة غير متاحة حالياً"
- etc.

### Current Problem in LedgerService.ts

~15 catch blocks all return generic messages:
```typescript
catch (error) {
  console.error("Error creating simple ledger entry:", error);
  return {
    success: false,
    error: "حدث خطأ أثناء حفظ الحركة المالية", // Generic!
  };
}
```

### Files to Modify

| File | Changes |
|------|---------|
| `src/services/ledger/types.ts` | Add optional `errorType` to `ServiceResult` |
| `src/services/ledger/LedgerService.ts` | Use `handleError` in all catch blocks |
| `src/services/journalService.ts` | Same pattern (optional, if time permits) |

---

## Todo List

- [ ] **1. Extend ServiceResult type**
  - Add optional `errorType?: ErrorType` field
  - Keeps backwards compatibility (callers can ignore it)

- [ ] **2. Update LedgerService.ts catch blocks**
  - Import `handleError`, `ErrorType`, `logError` from `@/lib/error-handling`
  - Update all catch blocks (~15) to use classified messages
  - Pattern:
    ```typescript
    catch (error) {
      const appError = handleError(error);
      logError(appError, { operation: 'createSimpleLedgerEntry', userId: this.userId });
      return {
        success: false,
        error: appError.message,
        errorType: appError.type,
      };
    }
    ```

- [ ] **3. Preserve existing specific error handlers**
  - Keep `isDataIntegrityError` check in `deleteLedgerEntry`
  - Keep validation errors (they should pass through as-is)
  - Keep storage-specific errors in `addChequeToEntry`

- [ ] **4. Verify TypeScript compiles**
  - Run `npx tsc --noEmit`

- [ ] **5. Verify no sensitive data leaks**
  - Ensure `appError.details` (contains internal error messages) is logged but NOT returned to user
  - Only `appError.message` (Arabic user-friendly) goes to client

---

## Constraints

- Use existing `error-handling.ts` utilities (no reinventing)
- Don't change return type structure drastically (backwards compatible)
- Keep changes focused on error handling, not business logic
- Maintain Arabic-first approach for user messages
- Don't expose internal error details to users

---

## Expected Outcomes

| Before | After |
|--------|-------|
| All errors: "حدث خطأ أثناء حفظ الحركة المالية" | Permission: "ليس لديك صلاحية للقيام بهذا الإجراء" |
| No error classification | Network: "فشل الاتصال بالإنترنت. يرجى التحقق من الاتصال والمحاولة مرة أخرى" |
| Generic logs | Not found: "البيانات المطلوبة غير موجودة" |
| | Structured logs with context |

---

## Review Section

### Summary of Changes

Improved error classification in LedgerService by leveraging the existing `handleError()` function from `src/lib/error-handling.ts`. Users now see context-appropriate Arabic error messages instead of generic ones.

### Files Modified

| File | Changes |
|------|---------|
| `src/services/ledger/types.ts` | Added `errorType?: ErrorType` to `ServiceResult` interface |
| `src/services/ledger/LedgerService.ts` | Updated 12 catch blocks with consistent error handling pattern |

### Key Changes

**Consistent Pattern Applied to All Catch Blocks:**
```typescript
// BEFORE (generic message)
catch (error) {
  console.error("Error creating ledger entry:", error);
  return {
    success: false,
    error: "حدث خطأ أثناء حفظ الحركة المالية",  // Generic!
  };
}

// AFTER (classified message)
catch (error) {
  const { message, type } = handleError(error);
  console.error("Error creating ledger entry:", error);
  return {
    success: false,
    error: message,      // Arabic user-friendly message
    errorType: type,     // For programmatic handling
  };
}
```

**Preserved Specific Error Handlers:**
- `isDataIntegrityError` check in `deleteLedgerEntry` - custom inventory integrity message
- Storage error handling in `addChequeToEntry` - specific permission/quota messages

### Error Messages Now Displayed

| Error Type | Arabic Message |
|------------|----------------|
| Permission | ليس لديك صلاحية للقيام بهذا الإجراء |
| Network | فشل الاتصال بالإنترنت. يرجى التحقق من الاتصال والمحاولة مرة أخرى |
| Not Found | البيانات المطلوبة غير موجودة |
| Duplicate | البيانات موجودة مسبقاً |
| Unknown | حدث خطأ غير متوقع |

### Verification Results

| Check | Result |
|-------|--------|
| TypeScript | Compiles without errors |
| Catch blocks updated | 12 blocks using consistent pattern |
| Sensitive data leaks | None - only `message` returned, `details` logged |
| Backwards compatibility | Maintained - `errorType` is optional |

### Security Verification

- `appError.message` (user-friendly Arabic) → returned to client
- `appError.details` (internal error message) → logged only, not exposed
- Full error object → logged to console for debugging
