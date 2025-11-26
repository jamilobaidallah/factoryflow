# Component Refactoring Plan 🔨

## Priority Files to Refactor

### 🔴 CRITICAL (>1500 lines)
1. **ledger-page.tsx** - 2,292 lines
2. **reports-page.tsx** - 1,618 lines

### 🟠 HIGH (>1000 lines)
3. **production-page.tsx** - 1,224 lines

### 🟡 MEDIUM (>800 lines)
4. **employees-page.tsx** - 893 lines
5. **cheques-page.tsx** - 890 lines
6. **fixed-assets-page.tsx** - 847 lines
7. **incoming-cheques-page.tsx** - 847 lines

---

## 1. Ledger Page Refactoring (2,292 → ~400 lines)

### Current Structure Analysis
```
ledger-page.tsx (2,292 lines)
├── State Management (~200 lines)
├── Handler Functions (~600 lines)
├── Main Form Dialog (~400 lines)
├── Quick Pay Dialog (~200 lines)
├── Related Records Dialog (~400 lines)
├── Main Table & UI (~400 lines)
└── Export Functions (~100 lines)
```

### Proposed New Structure
```
ledger/
├── ledger-page.tsx (300 lines) - Main orchestrator
├── components/
│   ├── LedgerFormDialog.tsx (250 lines)
│   ├── QuickPayDialog.tsx (150 lines)
│   ├── RelatedRecordsDialog.tsx (300 lines)
│   ├── LedgerTable.tsx (200 lines)
│   ├── LedgerFilters.tsx (150 lines)
│   └── LedgerStats.tsx (100 lines)
├── hooks/
│   ├── useLedgerData.ts (existing - ✅)
│   ├── useLedgerOperations.ts (400 lines) - CRUD operations
│   └── useLedgerForm.ts (200 lines) - Form state management
└── utils/
    ├── ledger-constants.ts (existing - ✅)
    └── ledger-helpers.ts (existing - ✅)
```

### Step-by-Step Refactoring

#### Phase 1: Extract Dialogs (Week 1)
**Priority: HIGH | Risk: LOW**

1. **Extract QuickPayDialog.tsx** (150 lines)
   ```typescript
   // File: src/components/ledger/components/QuickPayDialog.tsx
   interface QuickPayDialogProps {
     isOpen: boolean;
     onClose: () => void;
     entry: LedgerEntry | null;
     onSubmit: (amount: number) => Promise<void>;
   }
   ```
   - **Benefits:** Self-contained, reduces main file by 150 lines
   - **Testing:** Ensure quick payment still works
   - **Estimated Time:** 2 hours

2. **Extract LedgerFormDialog.tsx** (250 lines)
   ```typescript
   // File: src/components/ledger/components/LedgerFormDialog.tsx
   interface LedgerFormDialogProps {
     isOpen: boolean;
     onClose: () => void;
     editingEntry: LedgerEntry | null;
     onSubmit: (data: LedgerFormData) => Promise<void>;
     clients: Array<{id: string; name: string}>;
     partners: Array<{id: string; name: string}>;
   }
   ```
   - **Benefits:** Isolates complex form logic
   - **Testing:** Test add/edit entry functionality
   - **Estimated Time:** 4 hours

3. **Extract RelatedRecordsDialog.tsx** (300 lines)
   ```typescript
   // File: src/components/ledger/components/RelatedRecordsDialog.tsx
   interface RelatedRecordsDialogProps {
     isOpen: boolean;
     onClose: () => void;
     entry: LedgerEntry;
     onAddPayment: (data: PaymentData) => Promise<void>;
     onAddCheque: (data: ChequeData) => Promise<void>;
     onAddInventory: (data: InventoryData) => Promise<void>;
   }
   ```
   - **Benefits:** Separates related records management
   - **Testing:** Test adding payments/cheques/inventory
   - **Estimated Time:** 4 hours

#### Phase 2: Extract Table & Filters (Week 1)
**Priority: MEDIUM | Risk: LOW**

4. **Extract LedgerTable.tsx** (200 lines)
   ```typescript
   // File: src/components/ledger/components/LedgerTable.tsx
   interface LedgerTableProps {
     entries: LedgerEntry[];
     onEdit: (entry: LedgerEntry) => void;
     onDelete: (id: string) => Promise<void>;
     onQuickPay: (entry: LedgerEntry) => void;
     onViewRelated: (entry: LedgerEntry) => void;
   }
   ```
   - **Benefits:** Reusable table component
   - **Estimated Time:** 3 hours

5. **Extract LedgerFilters.tsx** (150 lines)
   ```typescript
   // File: src/components/ledger/components/LedgerFilters.tsx
   interface LedgerFiltersProps {
     onFilterChange: (filters: LedgerFilters) => void;
     categories: string[];
   }
   ```
   - **Benefits:** Isolates filter logic
   - **Estimated Time:** 2 hours

#### Phase 3: Extract Business Logic (Week 2)
**Priority: HIGH | Risk: MEDIUM**

6. **Create useLedgerOperations.ts** (400 lines)
   ```typescript
   // File: src/components/ledger/hooks/useLedgerOperations.ts
   export function useLedgerOperations() {
     const handleSubmit = async (data: LedgerFormData) => { ... };
     const handleDelete = async (id: string) => { ... };
     const handleQuickPayment = async (entryId: string, amount: number) => { ... };
     const handleAddPayment = async (entryId: string, payment: PaymentData) => { ... };
     const handleAddCheque = async (entryId: string, cheque: ChequeData) => { ... };
     const handleAddInventory = async (entryId: string, inventory: InventoryData) => { ... };

     return {
       handleSubmit,
       handleDelete,
       handleQuickPayment,
       handleAddPayment,
       handleAddCheque,
       handleAddInventory,
     };
   }
   ```
   - **Benefits:** Centralizes all CRUD operations
   - **Testing:** Unit test each operation
   - **Estimated Time:** 6 hours

7. **Create useLedgerForm.ts** (200 lines)
   ```typescript
   // File: src/components/ledger/hooks/useLedgerForm.ts
   export function useLedgerForm(editingEntry?: LedgerEntry) {
     const [formData, setFormData] = useState(...);
     const [hasIncomingCheck, setHasIncomingCheck] = useState(false);
     const [hasInventoryUpdate, setHasInventoryUpdate] = useState(false);
     // ... all form state logic

     return {
       formData,
       setFormData,
       hasIncomingCheck,
       setHasIncomingCheck,
       // ... all form state
     };
   }
   ```
   - **Benefits:** Reusable form state management
   - **Estimated Time:** 4 hours

#### Phase 4: Final Cleanup (Week 2)
8. **Update main ledger-page.tsx** to use extracted components
   - **Final Size:** ~300-400 lines
   - **Estimated Time:** 3 hours

### Total Estimated Time: **28 hours** (3.5 days)
### Total Size Reduction: **2,292 → 400 lines** (83% reduction!)

---

## 2. Reports Page Refactoring (1,618 → ~300 lines)

### Current Structure
```
reports-page.tsx (1,618 lines)
├── Multiple Report Types (~1200 lines)
├── Export Functions (~200 lines)
└── Charts & Visualizations (~200 lines)
```

### Proposed Structure
```
reports/
├── reports-page.tsx (200 lines)
├── components/
│   ├── BalanceSheetReport.tsx (300 lines)
│   ├── IncomeStatementReport.tsx (300 lines)
│   ├── CashFlowReport.tsx (300 lines)
│   ├── ClientBalancesReport.tsx (200 lines)
│   ├── PartnerEquityReport.tsx (200 lines)
│   └── ReportExportButtons.tsx (100 lines)
└── hooks/
    ├── useReportData.ts (200 lines)
    └── useReportExport.ts (150 lines)
```

**Estimated Time:** 20 hours

---

## 3. Production Page Refactoring (1,224 → ~300 lines)

### Proposed Structure
```
production/
├── production-page.tsx (200 lines)
├── components/
│   ├── ProductionOrderForm.tsx (250 lines)
│   ├── ProductionOrderTable.tsx (200 lines)
│   ├── RawMaterialsManager.tsx (200 lines)
│   └── ProductionStats.tsx (150 lines)
└── hooks/
    ├── useProductionData.ts (150 lines)
    └── useProductionOperations.ts (250 lines)
```

**Estimated Time:** 16 hours

---

## 4. Smaller Pages Refactoring

### Employees Page (893 lines → ~250 lines)
**Estimated Time:** 12 hours

### Cheques Page (890 lines → ~250 lines)
**Estimated Time:** 12 hours

### Fixed Assets Page (847 lines → ~250 lines)
**Estimated Time:** 10 hours

---

## Implementation Strategy

### Recommended Approach

#### Option A: Incremental (Safer, Recommended)
1. **Week 1:** Extract dialogs from ledger-page.tsx (Phases 1-2)
2. **Week 2:** Extract hooks and finalize ledger-page.tsx (Phases 3-4)
3. **Week 3:** Refactor reports-page.tsx
4. **Week 4:** Refactor production-page.tsx
5. **Week 5:** Refactor remaining pages

**Total Time: 5 weeks (part-time) or 10-12 days (full-time)**

#### Option B: Big Bang (Risky, Not Recommended)
- Refactor everything at once
- High risk of breaking existing functionality
- Difficult to test incrementally

### Testing Strategy

For each extracted component:

1. **Unit Tests**
   ```typescript
   // Example: QuickPayDialog.test.tsx
   describe('QuickPayDialog', () => {
     it('should submit payment with correct amount', async () => {
       const onSubmit = jest.fn();
       render(<QuickPayDialog isOpen={true} onSubmit={onSubmit} ... />);
       // ... test interactions
       expect(onSubmit).toHaveBeenCalledWith(expectedAmount);
     });
   });
   ```

2. **Integration Tests**
   - Test the full page still works
   - Verify all dialogs open/close correctly
   - Ensure data flows properly

3. **Manual Testing Checklist**
   - [ ] Can add new ledger entry
   - [ ] Can edit existing entry
   - [ ] Can delete entry
   - [ ] Quick payment works
   - [ ] Related records work
   - [ ] Filtering works
   - [ ] Export works

---

## Benefits of Refactoring

### Performance
- ✅ Smaller bundle sizes (code-splitting)
- ✅ Faster initial page load
- ✅ Better React rendering performance
- ✅ Easier to lazy-load dialogs

### Maintainability
- ✅ Easier to find and fix bugs
- ✅ Easier to add new features
- ✅ Better code organization
- ✅ Easier onboarding for new developers

### Testing
- ✅ Can unit test individual components
- ✅ Faster test execution
- ✅ Better test coverage
- ✅ Easier to mock dependencies

### Developer Experience
- ✅ Faster IDE performance
- ✅ Easier to navigate codebase
- ✅ Better code completion
- ✅ Reduced cognitive load

---

## Code Examples

### Before (ledger-page.tsx - 2,292 lines)
```typescript
export default function LedgerPage() {
  // 50 state variables
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isQuickPayDialogOpen, setIsQuickPayDialogOpen] = useState(false);
  const [isRelatedDialogOpen, setIsRelatedDialogOpen] = useState(false);
  // ... 47 more states

  // 10 handler functions (600 lines)
  const handleSubmit = async (e: React.FormEvent) => {
    // 200 lines of logic
  };

  const handleQuickPayment = async (e: React.FormEvent) => {
    // 100 lines of logic
  };

  // ... 8 more handlers

  return (
    <div>
      {/* 1500 lines of JSX */}
      <Dialog>{/* 400 line form */}</Dialog>
      <Dialog>{/* 200 line quick pay */}</Dialog>
      <Dialog>{/* 400 line related records */}</Dialog>
    </div>
  );
}
```

### After (ledger-page.tsx - ~300 lines)
```typescript
export default function LedgerPage() {
  // Use custom hooks
  const { entries, clients, partners, totalCount } = useLedgerData();
  const operations = useLedgerOperations();
  const formState = useLedgerForm();

  // Minimal state for dialog visibility
  const [activeDialog, setActiveDialog] = useState<'form' | 'quickPay' | 'related' | null>(null);
  const [selectedEntry, setSelectedEntry] = useState<LedgerEntry | null>(null);

  return (
    <div className="space-y-6">
      <LedgerStats entries={entries} />
      <LedgerFilters onFilterChange={handleFilter} />
      <LedgerTable
        entries={entries}
        onEdit={(entry) => {
          setSelectedEntry(entry);
          setActiveDialog('form');
        }}
        onDelete={operations.handleDelete}
        onQuickPay={(entry) => {
          setSelectedEntry(entry);
          setActiveDialog('quickPay');
        }}
      />

      <LedgerFormDialog
        isOpen={activeDialog === 'form'}
        onClose={() => setActiveDialog(null)}
        editingEntry={selectedEntry}
        onSubmit={operations.handleSubmit}
        clients={clients}
        partners={partners}
      />

      <QuickPayDialog
        isOpen={activeDialog === 'quickPay'}
        onClose={() => setActiveDialog(null)}
        entry={selectedEntry}
        onSubmit={operations.handleQuickPayment}
      />

      <RelatedRecordsDialog
        isOpen={activeDialog === 'related'}
        onClose={() => setActiveDialog(null)}
        entry={selectedEntry}
        onAddPayment={operations.handleAddPayment}
        onAddCheque={operations.handleAddCheque}
        onAddInventory={operations.handleAddInventory}
      />
    </div>
  );
}
```

**From 2,292 lines → 300 lines!** 🎉

---

## Next Steps

### Immediate Actions (This Week)
1. Review this refactoring plan
2. Prioritize which pages to refactor first
3. Set aside dedicated refactoring time
4. Create a backup branch before starting

### If You Want Me to Help:
I can start with extracting **QuickPayDialog** from ledger-page.tsx as a proof of concept. It's:
- Self-contained (~150 lines)
- Low risk
- Immediate value
- Good learning example for other extractions

Would you like me to:
- **A)** Start extracting QuickPayDialog as a demo?
- **B)** Create detailed step-by-step instructions for you to do it?
- **C)** Focus on a different page first?
- **D)** Create a dedicated refactoring branch and tackle Phase 1?

Let me know your preference!
