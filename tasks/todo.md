# Task: Create Modern Design System Foundation

## Context
Modernizing the UI to look like a premium SaaS app (Linear, Stripe style). This establishes design tokens - colors, shadows, spacing, and animations.

## Branch
`feature/modern-design-system`

---

## Analysis

### Current State
- **tailwind.config.ts**: Uses shadcn/ui pattern with CSS variables (`hsl(var(--color))`), Cairo font, container settings, accordion/collapsible animations
- **globals.css**: Has light/dark theme variables, RTL support, print styles, custom scrollbar

### What We're Adding
1. **New color palettes**: primary (blue), success (green), danger (red), warning (amber), slate (neutrals) - all with 50-950 shades
2. **Modern shadows**: soft-xs, soft-sm, soft, soft-md, soft-lg, card, card-hover
3. **Extended border radius**: xl, 2xl, 3xl
4. **New font size**: 2xs (0.625rem)
5. **New animations**: fade-in, slide-up, scale-in
6. **Utility classes**: .card-modern, .stats-card-*, .badge-*, .table-row-hover, .btn-modern

### Preservation Requirements
- Keep Cairo font family
- Keep container settings
- Keep accordion/collapsible animations
- Keep existing shadcn color pattern for compatibility
- Keep RTL, print, scrollbar styles in globals.css

---

## Plan

### Phase 1: Update Tailwind Config
- [x] Add new color palettes (primary, success, danger, warning, slate with all shades)
- [x] Add modern box shadows (soft-*, card, card-hover)
- [x] Add extended border radius (xl, 2xl, 3xl)
- [x] Add new font size (2xs)
- [x] Add new animations and keyframes (fade-in, slide-up, scale-in)
- [x] Preserve existing config (Cairo font, container, accordion animations)

### Phase 2: Update Global CSS
- [x] Update CSS variables with new values (--background-secondary, --card-border, --success-*, --danger-*, --warning-*)
- [x] Add modern component classes (.card-modern, .stats-card-*, .badge-*, .table-row-hover, .btn-modern)
- [x] Preserve existing styles (RTL, print, scrollbar, safe area)

### Phase 3: Verification
- [x] Run TypeScript check (`npx tsc --noEmit`) - PASSED
- [x] Run build (`npm run build`) - PASSED (21/21 pages)
- [x] Run lint (`npm run lint`) - PASSED (pre-existing warnings only)

### Phase 4: Finalization
- [x] Add Review section summarizing changes
- [x] Push branch to remote
- [x] Create PR into master

---

## Acceptance Criteria
- [x] Tailwind config updated with new color palette (primary, success, danger, warning, slate)
- [x] CSS variables defined in globals.css
- [x] Modern utility classes created (.card-modern, .badge-*, etc.)
- [x] Animations defined (fade-in, slide-up, scale-in)
- [x] Build passes
- [x] No TypeScript/lint errors
- [x] Existing functionality preserved (Cairo font, accordion, RTL, etc.)

---

## Review

### Files Changed

| File | Change |
|------|--------|
| `tailwind.config.ts` | **MODIFIED** - Added color palettes, shadows, animations, font size |
| `src/app/globals.css` | **MODIFIED** - Added CSS variables, utility classes |

### Summary of Changes

#### tailwind.config.ts
- **Colors**: Added full shade palettes (50-950) for `primary`, `success`, `danger`, `warning`, `slate`
- **Shadows**: Added `soft-xs`, `soft-sm`, `soft`, `soft-md`, `soft-lg`, `card`, `card-hover`
- **Border Radius**: Added `xl` (0.875rem), `2xl` (1rem), `3xl` (1.25rem)
- **Font Size**: Added `2xs` (0.625rem)
- **Animations**: Added `fade-in`, `slide-up`, `scale-in` with corresponding keyframes
- **Preserved**: Cairo font, container settings, accordion/collapsible animations, shadcn color pattern

#### globals.css
- **CSS Variables**: Added `--background-secondary`, `--card-border`, `--success-*`, `--danger-*`, `--warning-*` for both light and dark themes
- **Updated**: `--radius` from 0.5rem to 0.625rem
- **Utility Classes Added**:
  - `.card-modern` - Modern card with subtle shadow and hover effect
  - `.stats-card-primary/success/danger/warning` - Gradient backgrounds for stat cards
  - `.badge-success/danger/warning/primary/neutral` - Modern pill badges
  - `.table-row-hover` - Subtle table row hover effect
  - `.btn-modern` - Button with shadow and scale animation
- **Preserved**: RTL support, print styles, scrollbar styles, safe area support

### Test Results

```
TypeScript: PASSED (no errors)
ESLint: PASSED (pre-existing warnings only)
Build: PASSED (21/21 pages generated)
```

### Design Tokens Reference

#### Color Palette
| Color | Use Case |
|-------|----------|
| `primary-*` | Brand blue, buttons, links |
| `success-*` | Positive actions, income, paid status |
| `danger-*` | Errors, expenses, unpaid status |
| `warning-*` | Caution, partial status |
| `slate-*` | Text, backgrounds, borders |

#### Shadows
| Shadow | Use Case |
|--------|----------|
| `shadow-soft-xs` | Subtle button shadow |
| `shadow-card` | Default card shadow |
| `shadow-card-hover` | Card hover state |

#### Animations
| Animation | Duration | Use Case |
|-----------|----------|----------|
| `animate-fade-in` | 0.2s | Modal/dialog appearance |
| `animate-slide-up` | 0.3s | Toast/notification entry |
| `animate-scale-in` | 0.2s | Dropdown/popover open |

---

## Status: READY FOR PR
