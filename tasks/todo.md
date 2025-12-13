# Task: Redesign Dashboard Page

## Branch
`feature/dashboard-redesign`

---

## Context
Redesign the FactoryFlow dashboard to a cleaner, more professional design. The current dashboard is cluttered with too many elements. The new design focuses on:
- Hero cash balance display with animation
- Financial summary with month/total toggle
- Alerts section for items needing attention
- Simplified charts (one bar chart, one donut chart)
- Last 5 transactions list

---

## Completed Tasks

### Sections REMOVED:
- [x] Client count stat card
- [x] Top 5 Clients bar chart
- [x] New Clients section
- [x] Separate Cash Flow composed chart
- [x] Line chart (replaced with bar chart)
- [x] Recharts library dependency (using pure CSS/SVG)

### Phase 1: Setup & Data Layer ✅
- [x] Add state for new toggles (summaryView, expenseView, chartPeriod, selectedMonth)
- [x] Add state for animations (isLoaded, cashDisplay, hoveredSegment, hoveredBar)
- [x] Add query for cheques due within 7 days
- [x] Add query for unpaid receivables from ledger
- [x] Update monthly data calculation to support month filtering

### Phase 2: Hero Cash Balance Section ✅
- [x] Create hero section with slate-800 background
- [x] Display "الرصيد النقدي" label
- [x] Show animated cash balance (counting up effect)
- [x] Add "دينار" suffix
- [x] Handle negative balance display (rose color)

### Phase 3: Financial Summary Section ✅
- [x] Create header with "الملخص المالي" title
- [x] Add شهري/الإجمالي toggle component
- [x] Add month selector dropdown (visible only in monthly mode)
- [x] Create 3 summary cards (الإيرادات, المصروفات, صافي الربح)
- [x] Add hover effects (lift + shadow)
- [x] Dynamic color based on profit/loss

### Phase 4: Alerts + Bar Chart Row ✅
- [x] Create two-column layout
- [x] LEFT: "يحتاج انتباهك" alerts section
  - [x] Cheques due soon (rose background, pulsing red dot)
  - [x] Unpaid receivables (amber background)
  - [x] "All good" indicator when nothing urgent
- [x] RIGHT: Revenue/Expense bar chart
  - [x] Add شهر/3 أشهر/6 أشهر tabs
  - [x] Animate bars growing from bottom
  - [x] Add hover tooltips with actual amounts
  - [x] Add legend

### Phase 5: Expense Donut Chart ✅
- [x] Create full-width section
- [x] Add شهري/الإجمالي toggle
- [x] Create 3D-effect donut chart using SVG
- [x] Animate segments appearing in sequence
- [x] Show hovered segment amount in center
- [x] Add interactive legend

### Phase 6: Last 5 Transactions ✅
- [x] Create transactions list section
- [x] Add "عرض الكل" link (navigates to ledger page)
- [x] Display transaction name, category, date, amount
- [x] Color-code income (emerald) vs expense (slate)
- [x] Add hover effects and stagger animation

### Phase 7: Styling & Polish ✅
- [x] Apply color palette (slate-800, emerald-500/600, slate-400/500, rose-600/700)
- [x] RTL layout maintained (dir="rtl")
- [x] CSS animations for smooth effects
- [x] Responsive design (grid cols adjust)

### Phase 8: Cleanup & Verification ✅
- [x] Remove unused imports (recharts removed)
- [x] TypeScript check passes (`npx tsc --noEmit`)
- [x] Build succeeds (`npm run build`)

---

## Review

### Summary of Changes

**File Modified:** `src/components/dashboard/dashboard-page.tsx`

### Key Changes:
1. **Complete UI Redesign** - Replaced cluttered 5-card stats + multiple charts layout with a cleaner, focused design
2. **Hero Cash Balance** - Large slate-800 hero section with animated counting effect
3. **Financial Summary Cards** - 3 cards (Revenue, Expenses, Profit) with شهري/الإجمالي toggle and month selector
4. **Alerts Section** - "يحتاج انتباهك" showing cheques due within 7 days and unpaid receivables
5. **Custom Bar Chart** - Pure CSS/SVG bar chart (no recharts) with hover tooltips and period tabs
6. **3D Donut Chart** - SVG-based donut with perspective transform, interactive segments, and center display
7. **Transactions List** - Last 5 transactions with stagger animation and "عرض الكل" link

### Removed Dependencies:
- Removed usage of `recharts` library (LineChart, BarChart, PieChart, ComposedChart)
- Removed lazy-loaded chart components
- Removed client count, top customers, new clients sections

### New Features:
- **Animated Cash Counter** - Numbers count up on page load
- **Month/Total Toggle** - Switch between monthly and all-time views
- **Period Selector** - Choose 1, 3, or 6 months for bar chart
- **Interactive Donut** - Hover to see category amounts in center
- **Pulsing Alert Dot** - Visual indicator for urgent items
- **Hover Effects** - Cards lift with shadow on hover

### Color Palette:
- Cash Balance: `slate-800` background
- Revenue: `emerald-500/600`
- Expenses: `slate-400/500` (gray, not red)
- Loss/Urgent: `rose-600/700`
- Warning: `amber-500`
- Success: `emerald-500`

### Data Queries:
- Ledger: Revenue, expenses, categories, recent transactions, unpaid receivables
- Payments: Cash balance (in - out)
- Cheques: Due within 7 days with pending status

---

## Status: COMPLETE ✅

**Ready for PR creation.**
