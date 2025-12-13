# Task: Fix Console Warnings (Autocomplete & Favicon)

## Branch
`fix/console-warnings-autocomplete-favicon`

---

## Context
Minor console warnings need to be addressed:
1. Password input missing `autocomplete` attribute
2. Missing favicon causing 404 errors

---

## Plan

### Task 1: Add Autocomplete Attributes to Login Form
- [x] Add `autoComplete="email"` to email input
- [x] Add `autoComplete="current-password"` to password input

### Task 2: Add Favicon
- [x] Add factory-themed SVG icon using Next.js App Router convention (`src/app/icon.svg`)

### Task 3: Verify Changes
- [x] TypeScript check passes
- [x] Build succeeds

---

## Review

### Changes Made

| File | Change |
|------|--------|
| `src/components/auth/login-page.tsx` | Added `autoComplete="email"` (line 212) and `autoComplete="current-password"` (line 226) |
| `src/app/icon.svg` | Created new factory-themed SVG favicon (indigo background with factory silhouette) |

### Summary
- **2 files changed**: 1 modified, 1 created
- **Autocomplete**: Browser will now properly autofill email and password fields
- **Favicon**: Simple factory icon in brand color (#4F46E5 indigo) - automatically served by Next.js App Router

### Verification
- TypeScript: No errors
- Build: Success (only pre-existing warnings)

---

## Status: COMPLETED
