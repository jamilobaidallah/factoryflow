# Large Pages Refactoring Plan

## Overview
Apply the same successful refactoring patterns used on `ledger-page.tsx` (68.8% reduction) to other large pages in the codebase.

## Target Pages (Priority Order)

| Page | Current Size | Target Size | Est. Reduction | Priority |
|------|-------------|-------------|----------------|----------|
| **reports-page.tsx** | 1,618 lines | ~250 lines | **~84%** | 🔴 HIGH |
| **production-page.tsx** | 1,227 lines | ~300 lines | **~75%** | 🔴 HIGH |
| **employees-page.tsx** | 897 lines | ~250 lines | **~72%** | 🟡 MEDIUM |
| **cheques-page.tsx** | 890 lines | ~250 lines | **~72%** | 🟡 MEDIUM |
| **fixed-assets-page.tsx** | 849 lines | ~250 lines | **~71%** | 🟡 MEDIUM |

---

## 1. REPORTS-PAGE.TSX (1,618 lines) 🎯 **START HERE**

### Current Structure Analysis

**7 Report Tabs (900+ lines of JSX):**
1. Income Statement (543-779) = ~236 lines
2. Cash Flow (782-891) = ~109 lines
3. AR/AP Aging (894-1044) = ~150 lines
4. Inventory (1047-1152) = ~105 lines
5. Sales & COGS (1155-1245) = ~90 lines
6. Fixed Assets (1248-1366) = ~118 lines
7. Trial Balance (1366+) = ~100 lines

**Calculation Functions (~350 lines):**
- `calculateIncomeStatement()` (37 lines)
- `calculateCashFlow()` (26 lines)
- `calculateARAPAging()` (40 lines)
- `calculateInventoryValuation()` (16 lines)
- `calculateSalesAndCOGS()` (20 lines)
- `calculateFixedAssetsSummary()` (32 lines)
- `calculateOwnerEquity()` (25 lines)

**Export Functions (~200 lines):**
- `exportToCSV()`
- `exportIncomeStatementToExcel()`
- `exportIncomeStatementPDF()`
- `exportIncomeStatementHTML()`

**Data Fetching:**
- `fetchReportData()` (~92 lines)

### Refactoring Phases

#### **Phase 1: Extract Report Tab Components** (~900 lines → 70 lines)
Create `/components/reports/tabs/` directory:
- `IncomeStatementTab.tsx` (236 lines)
- `CashFlowTab.tsx` (109 lines)
- `ARAPAgingTab.tsx` (150 lines)
- `InventoryTab.tsx` (105 lines)
- `SalesAndCOGSTab.tsx` (90 lines)
- `FixedAssetsTab.tsx` (118 lines)
- `TrialBalanceTab.tsx` (100 lines)

Replace with:
```tsx
<TabsContent value="income-statement">
  <IncomeStatementTab data={incomeStatement} onExport={exportIncomeStatementToExcel} />
</TabsContent>
```

**Reduction: 900 → 70 lines (-830 lines)**

#### **Phase 2: Extract Calculation Logic** (~350 lines → hook)
Create `useReportCalculations.ts`:
```typescript
export function useReportCalculations(
  ledgerEntries: LedgerEntry[],
  payments: Payment[],
  inventory: InventoryItem[],
  fixedAssets: FixedAsset[]
) {
  const incomeStatement = useMemo(() => calculateIncomeStatement(), [ledgerEntries]);
  const cashFlow = useMemo(() => calculateCashFlow(), [ledgerEntries, payments]);
  const arapAging = useMemo(() => calculateARAPAging(), [ledgerEntries]);
  // ... more calculations

  return {
    incomeStatement,
    cashFlow,
    arapAging,
    inventoryValuation,
    salesAndCOGS,
    fixedAssetsSummary,
    ownerEquity,
  };
}
```

**Reduction: 350 lines → 10 lines usage (-340 lines)**

#### **Phase 3: Extract Data Fetching** (~92 lines → hook)
Create `useReportData.ts`:
```typescript
export function useReportData(startDate: string, endDate: string) {
  const { user } = useUser();
  const [loading, setLoading] = useState(false);
  const [ledgerEntries, setLedgerEntries] = useState<LedgerEntry[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [fixedAssets, setFixedAssets] = useState<FixedAsset[]>([]);

  const fetchReportData = useCallback(async () => {
    // ... fetching logic
  }, [user, startDate, endDate]);

  return {
    loading,
    ledgerEntries,
    payments,
    inventory,
    fixedAssets,
    fetchReportData,
  };
}
```

**Reduction: 92 lines → 5 lines usage (-87 lines)**

#### **Phase 4: Extract Export Functions** (~200 lines → module)
Create `useReportExports.ts`:
```typescript
export function useReportExports() {
  const exportIncomeStatementToExcel = () => { /* logic */ };
  const exportIncomeStatementPDF = () => { /* logic */ };
  const exportIncomeStatementHTML = () => { /* logic */ };
  const exportToCSV = (data: any[], filename: string) => { /* logic */ };

  return {
    exportIncomeStatementToExcel,
    exportIncomeStatementPDF,
    exportIncomeStatementHTML,
    exportToCSV,
  };
}
```

**Reduction: 200 lines → 5 lines usage (-195 lines)**

#### **Phase 5: Extract DateRangeFilter Component** (~30 lines → component)
Create `DateRangeFilter.tsx`:
```typescript
export function DateRangeFilter({
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  onRefresh,
  loading,
}: DateRangeFilterProps) {
  return (
    <Card>
      <CardContent className="pt-6">
        {/* date inputs and refresh button */}
      </CardContent>
    </Card>
  );
}
```

**Reduction: 30 lines → 5 lines usage (-25 lines)**

### Final Result: reports-page.tsx

**Before: 1,618 lines**
**After: ~250 lines**
**REDUCTION: 1,368 lines (84.5%)** 🎉

Final structure:
```tsx
export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState("income-statement");
  const [startDate, setStartDate] = useState(/* ... */);
  const [endDate, setEndDate] = useState(/* ... */);

  const {
    loading,
    ledgerEntries,
    payments,
    inventory,
    fixedAssets,
    fetchReportData,
  } = useReportData(startDate, endDate);

  const calculations = useReportCalculations(ledgerEntries, payments, inventory, fixedAssets);
  const exports = useReportExports();

  return (
    <div className="space-y-6">
      <ReportsHeader />
      <DateRangeFilter {...dateProps} />

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>{/* 7 triggers */}</TabsList>

        <TabsContent value="income-statement">
          <IncomeStatementTab data={calculations.incomeStatement} onExport={exports.exportIncomeStatementToExcel} />
        </TabsContent>
        {/* ... 6 more tabs */}
      </Tabs>
    </div>
  );
}
```

---

## 2. PRODUCTION-PAGE.TSX (1,227 lines)

### Analysis Needed
- Similar patterns expected (forms, dialogs, data tables)
- Multiple production-related operations
- Likely candidates: production forms, material lists, order tables

### Proposed Phases
1. Extract production order form components
2. Extract material/ingredient components
3. Extract calculation hooks (costing, inventory updates)
4. Extract data fetching hooks
5. Extract export/print functions

**Expected Reduction: ~900 lines (73%)**

---

## 3. EMPLOYEES-PAGE.TSX (897 lines)

### Likely Structure
- Employee list/table
- Add/Edit employee forms
- Salary calculations
- Attendance tracking

### Proposed Phases
1. Extract employee form dialog
2. Extract employee table component
3. Extract salary calculation hook
4. Extract employee data management hook

**Expected Reduction: ~650 lines (72%)**

---

## 4. CHEQUES-PAGE.TSX (890 lines)

### Likely Structure
- Cheque list/table
- Add/Edit cheque forms
- Status updates
- Multiple cheque types

### Proposed Phases
1. Extract cheque form dialog
2. Extract cheque table component
3. Extract cheque operations hook
4. Extract status management

**Expected Reduction: ~640 lines (72%)**

---

## 5. FIXED-ASSETS-PAGE.TSX (849 lines)

### Likely Structure
- Asset list/table
- Add/Edit asset forms
- Depreciation calculations
- Asset lifecycle management

### Proposed Phases
1. Extract asset form dialog
2. Extract asset table component
3. Extract depreciation calculation hook
4. Extract asset data management hook

**Expected Reduction: ~600 lines (71%)**

---

## Refactoring Principles (from ledger-page success)

### ✅ DO:
1. **Extract Large JSX Blocks** - Any component section >100 lines
2. **Create Custom Hooks** - For business logic, calculations, data fetching
3. **Memoize Calculations** - Use useMemo for expensive computations
4. **Type Everything** - Maintain strict TypeScript interfaces
5. **Keep Props Clean** - Pass only necessary data
6. **Test After Each Phase** - Ensure no functionality is lost

### ❌ DON'T:
1. **Don't Over-abstract** - Keep components understandable
2. **Don't Break Functionality** - Preserve exact behavior
3. **Don't Skip Tests** - Add tests for extracted components
4. **Don't Rush** - One phase at a time, test each

---

## Execution Strategy

### Week 1: Reports Page (HIGHEST IMPACT)
- Day 1-2: Extract tab components
- Day 3: Extract hooks (calculations, data, exports)
- Day 4: Test, document, commit
- Day 5: Buffer for issues

### Week 2: Production Page
- Similar phased approach
- Focus on form and calculation extraction

### Week 3: Employees & Cheques Pages
- Parallel refactoring possible
- Similar patterns to each other

### Week 4: Fixed Assets & Testing
- Complete fixed-assets refactoring
- Comprehensive testing of all refactored pages
- Performance benchmarking

---

## Success Metrics

| Metric | Target |
|--------|--------|
| Total Lines Reduced | **4,000+ lines** |
| Average Page Size | **~250 lines** |
| Code Reusability | **15+ reusable components** |
| Test Coverage | **70%+ for extracted code** |
| Build Success | **100%** |
| Functionality Preserved | **100%** |

---

## Tools & Commands

### Find large functions:
```bash
grep -n "^  const \|^  function " [page].tsx | wc -l
```

### Count JSX sections:
```bash
grep -n "return (" [page].tsx
```

### Estimate extraction size:
```bash
sed -n '543,779p' reports-page.tsx | wc -l
```

---

## Notes

- **Ledger Page Success**: Reduced from 2,292 → 716 lines (68.8%)
- **Total Potential Impact**: ~4,000 lines → ~1,200 lines
- **Maintainability**: Each component becomes independently testable
- **Reusability**: Tab components can be reused in dashboards

**Let's start with reports-page.tsx for maximum impact!** 🚀
