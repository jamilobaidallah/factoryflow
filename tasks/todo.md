# Fix: FAB Position Conflicts with Bottom Nav

## Problem

The Floating Action Button (FAB) is positioned at `bottom-24` (96px), but the mobile bottom navigation height varies based on the device's safe area inset. On devices with home indicators (iPhone X+), the nav grows taller and overlaps with the FAB.

## Analysis

### Current Implementation

**FAB** (`src/components/layout/floating-action-button.tsx:90`):
```typescript
className="fixed bottom-24 right-4 z-50 md:hidden flex flex-col-reverse items-end gap-3"
```

**Mobile Nav** (`src/components/layout/mobile-nav.tsx:115`):
- Uses `pb-safe` class for safe area padding
- Nav height = ~60px content + safe-area-inset-bottom (0-34px)

**Global CSS** (`src/app/globals.css:95-96`):
```css
.pb-safe {
  padding-bottom: env(safe-area-inset-bottom);
}
```

### Root Cause

The FAB uses a fixed `bottom-24` (96px) which doesn't account for `env(safe-area-inset-bottom)`. On devices with large safe areas (34px), the nav height is ~94px, causing overlap.

### Solution

Use CSS `calc()` with `env(safe-area-inset-bottom)` to dynamically position the FAB above the nav regardless of safe area size:

```typescript
className="fixed bottom-[calc(env(safe-area-inset-bottom)+5.5rem)] right-4 z-50 md:hidden ..."
```

This ensures: safe-area + 88px (5.5rem) = always above nav with consistent 12-16px gap.

---

## Todo List

- [ ] **1. Update FAB positioning**
  - Change `bottom-24` to `bottom-[calc(env(safe-area-inset-bottom)+5.5rem)]`
  - File: `src/components/layout/floating-action-button.tsx` line 90

- [ ] **2. Verify TypeScript compiles**
  - Run `npx tsc --noEmit`

- [ ] **3. Visual verification note**
  - Document that this should be tested on:
    - iPhone with notch (Safari)
    - Android device
    - Desktop browser (should be hidden via md:hidden)

---

## Files to Modify

| File | Change |
|------|--------|
| `src/components/layout/floating-action-button.tsx` | Update bottom position class |

---

## Constraints

- Single line change - minimal impact
- Uses existing CSS env() function pattern (already used for pb-safe)
- No JavaScript changes needed
- Backwards compatible (env() falls back to 0 if unsupported)

---

## Review

### Summary of Changes

Fixed FAB positioning to account for device safe areas, preventing overlap with the mobile bottom navigation on devices with home indicators (iPhone X+, etc.).

### Files Modified

| File | Change |
|------|--------|
| `src/components/layout/floating-action-button.tsx` | Line 90: `bottom-24` → `bottom-[calc(env(safe-area-inset-bottom)+5.5rem)]` |

### Before/After

```typescript
// BEFORE (fixed position, ignores safe area)
className="fixed bottom-24 right-4 z-50 md:hidden ..."

// AFTER (dynamic position, respects safe area)
className="fixed bottom-[calc(env(safe-area-inset-bottom)+5.5rem)] right-4 z-50 md:hidden ..."
```

### Verification

| Check | Result |
|-------|--------|
| TypeScript | ✅ Compiles without errors |
| Pattern consistency | ✅ Uses same `env()` pattern as `pb-safe` in mobile-nav |
| Backwards compatible | ✅ `env()` falls back to 0 on unsupported browsers |

### Testing Recommendations

- Test on iPhone with notch/Dynamic Island (Safari)
- Test on Android device
- Verify FAB is hidden on desktop (`md:hidden`)
