# Task: Modern Design System - Phase 1, 2, 3 & 4

## Branch
`feature/modern-design-system`

---

# Phase 1: Create Modern Design System Foundation

## Context
Modernizing the UI to look like a premium SaaS app (Linear, Stripe style). This establishes design tokens - colors, shadows, spacing, and animations.

## Plan

### Update Tailwind Config
- [x] Add new color palettes (primary, success, danger, warning, slate with all shades)
- [x] Add modern box shadows (soft-*, card, card-hover)
- [x] Add extended border radius (xl, 2xl, 3xl)
- [x] Add new font size (2xs)
- [x] Add new animations and keyframes (fade-in, slide-up, scale-in)
- [x] Preserve existing config (Cairo font, container, accordion animations)

### Update Global CSS
- [x] Update CSS variables with new values (--background-secondary, --card-border, --success-*, --danger-*, --warning-*)
- [x] Add modern component classes (.card-modern, .stats-card-*, .badge-*, .table-row-hover, .btn-modern)
- [x] Preserve existing styles (RTL, print, scrollbar, safe area)

### Verification
- [x] Run TypeScript check - PASSED
- [x] Run build - PASSED (21/21 pages)
- [x] Run lint - PASSED

---

# Phase 2: Modernize Dashboard Stats Cards

## Context
Apply the new design tokens to the dashboard stats cards to make them visually modern and polished.

## Plan

### Update Dashboard Stats Cards
- [x] Update stats array with modern styling classes
- [x] Apply `card-modern` and `stats-card-*` classes
- [x] Add icon containers with rounded backgrounds
- [x] Add hover scale effect on icons
- [x] Use semantic colors (success for revenue, danger for expenses, etc.)
- [x] Apply proper typography hierarchy

### Verification
- [x] Run TypeScript check - PASSED
- [x] Run build - PASSED (21/21 pages)
- [x] Run lint - PASSED

---

## Acceptance Criteria

### Phase 1: Design System Foundation
- [x] Tailwind config updated with new color palette (primary, success, danger, warning, slate)
- [x] CSS variables defined in globals.css
- [x] Modern utility classes created (.card-modern, .badge-*, etc.)
- [x] Animations defined (fade-in, slide-up, scale-in)
- [x] Existing functionality preserved (Cairo font, accordion, RTL, etc.)

### Phase 2: Dashboard Stats Cards
- [x] Stats cards have gradient backgrounds
- [x] Icons have rounded containers with hover scale effect
- [x] Typography hierarchy is clear (label small, value large)
- [x] Positive values styled with success colors, negative with danger
- [x] Cards have subtle shadow and hover effect
- [x] RTL layout works correctly
- [x] Build passes
- [x] No lint errors

---

## Review

### Files Changed

| File | Change |
|------|--------|
| `tailwind.config.ts` | **MODIFIED** - Added color palettes, shadows, animations, font size |
| `src/app/globals.css` | **MODIFIED** - Added CSS variables, utility classes |
| `src/components/dashboard/dashboard-page.tsx` | **MODIFIED** - Modernized stats cards styling |

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

#### dashboard-page.tsx
- **Stats Array**: Updated with modern styling properties (`cardClass`, `iconBgClass`, `iconClass`, `valueClass`)
- **Card Structure**: Now uses `card-modern` base class with `stats-card-*` gradient variants
- **Icon Containers**: `h-12 w-12 rounded-xl` with semi-transparent backgrounds
- **Hover Effects**: `group-hover:scale-110 transition-transform duration-200` on icons
- **Typography**: Label `text-sm font-medium text-slate-600`, value `text-2xl font-bold`
- **Semantic Colors**: Revenue (success), Expenses (danger), Net Profit (conditional), Cash Flow (warning)

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
| `primary-*` | Brand blue, buttons, links, client count |
| `success-*` | Positive actions, income, paid status, revenue |
| `danger-*` | Errors, expenses, unpaid status |
| `warning-*` | Caution, partial status, cash flow |
| `slate-*` | Text, backgrounds, borders |

#### Stats Card Classes
| Class | Effect |
|-------|--------|
| `card-modern` | Base card with shadow and hover |
| `stats-card-primary` | Blue gradient background |
| `stats-card-success` | Green gradient background |
| `stats-card-danger` | Red gradient background |
| `stats-card-warning` | Amber gradient background |

---

# Phase 3: Modernize Ledger Page Data Table

## Context
Apply the new design tokens to the Ledger page data table to make it visually modern and consistent with the design system.

## Plan

### Update LedgerTable Component
- [x] Wrap desktop table in `card-modern` container with overflow-hidden
- [x] Update TableHeader with `bg-slate-50/80` background
- [x] Add `font-semibold text-slate-700` styling to TableHead
- [x] Add `table-row-hover` class to TableRow components
- [x] Update type badges to use `badge-success` / `badge-danger`
- [x] Update payment status badges to use `badge-success` / `badge-warning` / `badge-danger`
- [x] Style amounts with semantic colors (green for income, red for expense)
- [x] Modernize action buttons to ghost style with colored hover states
- [x] Update mobile card to use `card-modern` class
- [x] Replace `text-gray-*` with `text-slate-*` for consistency

### Update Tests
- [x] Update badge class assertions from inline classes to `badge-*` classes
- [x] Update dash element selector from `text-gray-400` to `text-slate-400`

### Verification
- [x] Run TypeScript check - PASSED
- [x] Run build - PASSED (21/21 pages)
- [x] Run lint - PASSED (pre-existing warnings only)
- [x] Run tests - PASSED (1150 tests, 44 suites)

---

## Acceptance Criteria

### Phase 3: Ledger Data Table
- [x] Table wrapped in card-modern container
- [x] Table header has subtle background color
- [x] Table rows have hover effect
- [x] Type badges use badge-success/badge-danger classes
- [x] Payment status badges use modern badge classes
- [x] Income amounts styled green, expense amounts styled red
- [x] Action buttons use ghost variant with colored hover states
- [x] Mobile cards use card-modern styling
- [x] All tests pass
- [x] Build passes
- [x] No lint errors

---

## Files Changed (Phase 3)

| File | Change |
|------|--------|
| `src/components/ledger/components/LedgerTable.tsx` | **MODIFIED** - Modernized table styling |
| `src/components/ledger/components/__tests__/LedgerTable.test.tsx` | **MODIFIED** - Updated tests for new class names |

### Summary of Changes (Phase 3)

#### LedgerTable.tsx
- **Table Container**: Added `card-modern overflow-hidden` to desktop table wrapper
- **Table Header**: Added `bg-slate-50/80` background, `font-semibold text-slate-700` to heads
- **Table Row**: Added `table-row-hover` class for hover effect
- **Type Badge**: Changed from inline classes to `badge-success` / `badge-danger`
- **Payment Status Badge**: Changed from inline classes to `badge-success` / `badge-warning` / `badge-danger`
- **Amount Display**: Added semantic colors with `text-green-600` / `text-red-600` and `font-semibold`
- **Action Buttons**: Changed to ghost variant with colored hover states:
  - Quick Pay: `text-green-600 hover:bg-green-50`
  - View Related: `text-blue-600 hover:bg-blue-50`
  - Edit: `text-slate-600 hover:bg-slate-100`
  - Delete: `text-red-600 hover:bg-red-50`
- **Mobile Card**: Updated to use `card-modern` class, consistent badge styling
- **Text Colors**: Replaced `text-gray-*` with `text-slate-*` throughout

---

# Phase 4: Modernize Dashboard Charts

## Context
The dashboard charts work but look basic. Updated them with a modern color palette, better styling, and improved tooltips.

## Plan

### Add Chart Color Constants
- [x] Create CHART_COLORS constant with harmonious palette
- [x] Create tooltipStyle constant for consistent tooltips

### Update Line Chart (Revenue vs Expenses)
- [x] Add modern margins and remove vertical grid lines
- [x] Style axis with no axis lines, subtle tick colors
- [x] Add modern tooltip with white background and shadow
- [x] Update legend with proper formatting
- [x] Add smooth lines with dots and active dots

### Update Composed Chart (Cash Flow)
- [x] Apply same axis and grid styling
- [x] Add rounded corners to bars with radius
- [x] Add cursor highlight on hover
- [x] Style tooltip consistently

### Update Bar Chart (Top Customers)
- [x] Apply horizontal layout styling
- [x] Add rounded corners to bars
- [x] Style axis labels
- [x] Format tooltip for currency

### Update Pie Chart (Expenses by Category)
- [x] Convert to donut chart (innerRadius)
- [x] Add padding between segments
- [x] Use harmonious color palette
- [x] Add vertical legend on right side

### Update Card Containers
- [x] Add `card-modern` class to all chart cards
- [x] Update CardHeader with `pb-2` for tighter spacing
- [x] Update CardTitle with `text-base font-semibold text-slate-800`
- [x] Update page header to use slate colors

### Update Recent Activity Cards
- [x] Add `card-modern` class
- [x] Update border colors to slate-100
- [x] Add hover effect on list items
- [x] Update text colors to slate palette

### Verification
- [x] Run TypeScript check - PASSED
- [x] Run build - PASSED (21/21 pages)
- [x] Run lint - PASSED (pre-existing warnings only)

---

## Acceptance Criteria

### Phase 4: Dashboard Charts
- [x] Line chart has smooth lines with modern colors
- [x] Bar charts have rounded corners
- [x] Pie chart is donut style with harmonious colors
- [x] All tooltips have white background with shadow
- [x] Grid lines are subtle (light gray, dashed)
- [x] Axis labels are readable but not prominent
- [x] Legends have proper Arabic labels
- [x] All chart cards use card-modern styling
- [x] Recent activity cards have hover effects
- [x] Build passes
- [x] No lint errors

---

## Files Changed (Phase 4)

| File | Change |
|------|--------|
| `src/components/dashboard/dashboard-page.tsx` | **MODIFIED** - Modernized all charts and cards |

### Summary of Changes (Phase 4)

#### dashboard-page.tsx
- **CHART_COLORS constant**: Added modern color palette with primary, success, danger, warning, info, purple, pink, slate colors and pieColors array
- **tooltipStyle constant**: Reusable tooltip styling with white background, shadow, rounded corners
- **ChartSkeleton**: Updated to use slate colors
- **Page Header**: Changed from gray to slate colors
- **Line Chart**:
  - Added margins, removed vertical grid lines
  - Styled axis with no lines, slate tick colors
  - Modern tooltip and legend formatting
  - Lines with strokeWidth 2.5, dots with r=4, activeDot r=6
- **Composed Chart (Cash Flow)**:
  - Same axis/grid styling
  - Bars with radius [4,4,0,0] and maxBarSize 40
  - Cursor highlight on hover
- **Bar Chart (Top Customers)**:
  - Horizontal layout with proper margins
  - Bars with radius [0,4,4,0]
  - Styled axis labels
- **Pie Chart (Expenses)**:
  - Donut style with innerRadius 60, outerRadius 100
  - paddingAngle 2 between segments
  - Vertical legend on right
  - Uses CHART_COLORS.pieColors
- **All Cards**:
  - Added `card-modern` class
  - CardHeader with `pb-2`
  - CardTitle with `text-base font-semibold text-slate-800`
- **Recent Activity**:
  - Hover effect on list items
  - Updated borders to slate-100
  - Text colors to slate palette

---

## Status: READY FOR PR
