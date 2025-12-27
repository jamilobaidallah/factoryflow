# FactoryFlow Architecture Documentation

> **Last Updated:** December 2024
> **Tech Stack:** Next.js 14, TypeScript, Firebase, React Query, Tailwind CSS, shadcn/ui

## Overview

FactoryFlow is a bilingual Arabic-first factory management system with double-entry bookkeeping. The architecture follows a layered pattern with clear separation of concerns.

---

## Architecture Layers

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              PRESENTATION LAYER                                  │
│                         (React Components & Pages)                               │
├─────────────────────────────────────────────────────────────────────────────────┤
│   Pages (src/app/)              Components (src/components/)                     │
│   ├── layout.tsx                ├── ui/ (shadcn components)                     │
│   ├── page.tsx                  ├── layout/ (header, sidebar, nav)              │
│   └── (main)/                   ├── auth/ (login, permissions)                  │
│       ├── layout.tsx            └── [feature]/ (dashboard, ledger, etc.)        │
│       └── [routes]/                                                              │
└─────────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              STATE MANAGEMENT LAYER                              │
│                         (React Query + Custom Hooks)                             │
├─────────────────────────────────────────────────────────────────────────────────┤
│   Custom Hooks (src/hooks/)                                                      │
│   ├── useAllClients.ts          Firebase Query Hooks                            │
│   ├── useInventoryItems.ts      ├── useFirestoreSubscription.ts                 │
│   ├── usePermissions.ts         ├── useReactiveQueryData.ts                     │
│   └── use-toast.tsx             └── Feature-specific queries                    │
│                                                                                  │
│   Feature Hooks (src/components/[feature]/hooks/)                               │
│   ├── use[Feature]Data.ts       (Data fetching)                                 │
│   ├── use[Feature]Operations.ts (CRUD operations)                               │
│   └── use[Feature]Form.ts       (Form state)                                    │
└─────────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              SERVICE LAYER                                       │
│                         (Business Logic & Firebase)                              │
├─────────────────────────────────────────────────────────────────────────────────┤
│   Services (src/services/)                                                       │
│   ├── journalService.ts         (Double-entry bookkeeping)                      │
│   ├── userService.ts            (Access control & RBAC)                         │
│   ├── activityLogService.ts     (Audit logging)                                 │
│   └── ledger/                                                                    │
│       ├── LedgerService.ts      (Central ledger operations)                     │
│       └── handlers/             (Batch operation handlers)                       │
└─────────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              DATA LAYER                                          │
│                         (Firebase Firestore)                                     │
├─────────────────────────────────────────────────────────────────────────────────┤
│   Firebase (src/firebase/)                                                       │
│   ├── config.ts                 (Firebase initialization)                       │
│   └── firebaseClient.ts         (Client SDK setup)                              │
│                                                                                  │
│   Firestore Collections: users, ledger, payments, cheques, journal_entries...   │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## Component Hierarchy

### Root Layout Structure

```
src/app/layout.tsx (Root)
├── FirebaseClientProvider
│   └── Provides Firebase auth context
├── QueryProvider
│   └── Provides React Query client
└── Toaster
    └── Toast notification system

src/app/(main)/layout.tsx (Protected Routes)
├── Authentication Check
│   ├── Loading → Spinner
│   ├── Not Authenticated → Redirect to login
│   └── Authenticated but no role → AccessRequestForm
└── Main Layout (authenticated)
    ├── Sidebar (desktop navigation)
    ├── Header (user info, search, logout)
    ├── Main Content Area (page.tsx)
    ├── MobileNav (bottom tab bar)
    └── FloatingActionButton (mobile quick actions)
```

### Component Directory Structure

```
src/components/
├── ui/                           # Reusable UI Components (28)
│   ├── button.tsx               # Base button component
│   ├── card.tsx                 # Card container
│   ├── dialog.tsx               # Modal dialogs
│   ├── input.tsx                # Form inputs
│   ├── table.tsx                # Data tables
│   ├── validated-input.tsx      # Input with validation
│   ├── empty-state.tsx          # Empty data state
│   ├── loading-skeleton.tsx     # Loading placeholders
│   └── ...                      # Other shadcn components
│
├── layout/                       # Global Layout Components
│   ├── header.tsx               # Top bar with search & user
│   ├── sidebar.tsx              # Desktop navigation
│   ├── mobile-nav.tsx           # Mobile bottom tabs
│   └── floating-action-button.tsx # Mobile FAB
│
├── auth/                         # Authentication Components
│   ├── login-page.tsx           # Login form
│   ├── forgot-password-page.tsx # Password recovery
│   ├── AccessRequestForm.tsx    # New user access request
│   └── PermissionGate.tsx       # RBAC visibility control
│
├── providers/                    # Context Providers
│   └── QueryProvider.tsx        # React Query setup
│
└── [feature]/                    # Feature Modules
    ├── dashboard/
    ├── clients/
    ├── cheques/
    ├── ledger/
    ├── payments/
    ├── invoices/
    ├── employees/
    ├── fixed-assets/
    ├── inventory/
    ├── production/
    ├── reports/
    ├── partners/
    ├── users/
    ├── search/
    └── activity/
```

### Feature Module Structure

Each feature module follows a consistent pattern:

```
src/components/[feature]/
├── [feature]-page.tsx           # Main page component
├── components/                   # Sub-components
│   ├── [Feature]Table.tsx       # Data table
│   ├── [Feature]FormDialog.tsx  # Create/edit dialog
│   ├── [Feature]StatsCards.tsx  # Summary stats
│   └── ...                      # Other components
├── hooks/                        # Feature-specific hooks
│   ├── use[Feature]Data.ts      # Data fetching
│   ├── use[Feature]Operations.ts # CRUD operations
│   └── use[Feature]Form.ts      # Form state (if complex)
├── types/                        # TypeScript interfaces
│   └── index.ts
├── constants/                    # Feature constants
│   └── index.ts
└── __tests__/                    # Unit tests
    └── *.test.ts
```

---

## Feature Modules

### Dashboard (`src/components/dashboard/`)

**Purpose:** Financial overview with KPIs, charts, and alerts

**Components:**
- `dashboard-page.tsx` - Main orchestrator with state management
- `DashboardHero.tsx` - Animated cash balance display
- `DashboardSummaryCards.tsx` - Revenue/expenses/profit cards
- `DashboardAlerts.tsx` - Cheques due, unpaid AR/AP alerts
- `DashboardBarChart.tsx` - Monthly revenue vs expenses
- `DashboardDonutChart.tsx` - Expense breakdown by category
- `DashboardTransactions.tsx` - Recent transactions list

**Hooks:**
- `useDashboardData` - Aggregates data from multiple collections
- `useChequesAlerts` - Pending cheques calculations
- `useReceivablesAlerts` - Unpaid AR calculations

**Pattern:** Heavy computation with `useMemo` for chart data aggregation

---

### Ledger (`src/components/ledger/`)

**Purpose:** Income/expense transaction management with AR/AP tracking

**Components:**
- `ledger-page.tsx` - Complex page with multi-step form, filters, pagination
- `LedgerTable.tsx` - Transaction data table
- `LedgerFormDialog.tsx` - Create/edit transaction
- `LedgerStats.tsx` - Summary statistics
- `QuickPayDialog.tsx` - Quick payment modal
- `forms/` - Specialized form cards (cheque, inventory, fixed asset)
- `steps/` - Multi-step form wizard components
- `filters/` - Filter UI components

**Hooks:**
- `useLedgerData` - Paginated transaction data
- `useLedgerForm` - Multi-step form state
- `useLedgerOperations` - CRUD with batch writes
- `useLedgerFilters` - Filter state management

**State Management:**
- `LedgerFormContext` - Multi-step form context
- `ledgerPageReducer` - Complex UI state reducer

**Pattern:** Most complex module with reducer + context for multi-step form

---

### Cheques (`src/components/cheques/`)

**Purpose:** Post-dated and endorsed cheque management

**Page Variants:**
- `cheques-page.tsx` - Overview with tabs
- `incoming-cheques-page.tsx` - Received cheques
- `outgoing-cheques-page.tsx` - Issued cheques

**Components:**
- `IncomingChequesTable.tsx`, `OutgoingChequesTable.tsx`
- `ChequesFormDialog.tsx` - Cheque creation/editing
- `ImageViewerDialog.tsx` - View cheque images
- `EndorseDialog.tsx` - Endorsement workflow
- `ClearChequeDialog.tsx` - Mark as cashed
- `BounceChequeDialog.tsx` - Handle bounced cheques
- `EndorsementAllocationDialog.tsx` - Multi-step allocation

**Hooks:**
- `useChequesData` / `useIncomingChequesData` / `useOutgoingChequesData`
- `useChequesOperations` / `useIncomingChequesOperations` / `useOutgoingChequesOperations`
- `useReversePayment` - Payment reversal logic

**Pattern:** State machine for cheque lifecycle (pending → cashed/bounced → reversed)

---

### Reports (`src/components/reports/`)

**Purpose:** Financial reports and analytics

**Tab Components:**
- `BalanceSheetTab.tsx` - Assets = Liabilities + Equity
- `IncomeStatementTab.tsx` - Revenue - Expenses = Profit
- `TrialBalanceTab.tsx` - All accounts with balances
- `CashFlowTab.tsx` - Operating/investing/financing
- `ARAPAgingTab.tsx` - Receivables/payables aging
- `InventoryTab.tsx` - Stock valuation
- `FixedAssetsTab.tsx` - Depreciation schedule
- `SalesAndCOGSTab.tsx` - Gross margin analysis

**Pattern:** Tab-based navigation with consistent chart components

---

### Other Feature Modules

| Module | Purpose | Pattern |
|--------|---------|---------|
| `clients/` | Customer management | Simple CRUD with dialogs |
| `partners/` | Supplier management | Simple CRUD with dialogs |
| `payments/` | Payment allocation | Complex allocation dialog |
| `invoices/` | Invoice generation | Form + preview dialogs |
| `inventory/` | Stock management | Item tracking |
| `fixed-assets/` | Asset depreciation | CRUD + depreciation |
| `employees/` | Payroll management | Staff + salary history |
| `production/` | Manufacturing orders | Order management |
| `users/` | Team management | RBAC + access control |
| `search/` | Global search | Transaction filtering |
| `activity/` | Audit logs | Read-only display |

---

## Service Layer

### journalService.ts (931 lines)

**Responsibility:** Double-entry bookkeeping and accounting operations

**Key Functions:**
```typescript
// Chart of Accounts
seedChartOfAccounts()           // Initialize default accounts
getAccounts()                   // Fetch all accounts
getAccountByCode(code)          // Lookup single account

// Journal Entries
createJournalEntry(entry)       // Create with validation
createJournalEntryForLedger()   // Auto-map income/expense
createJournalEntryForPayment()  // Receipt/disbursement entries
createJournalEntryForCOGS()     // Cost of goods sold
createJournalEntryForDepreciation() // Asset depreciation

// Batch Operations
addJournalEntryToBatch()        // Atomic with ledger
addCOGSJournalEntryToBatch()    // Atomic with inventory

// Reversals
reverseJournalEntry()           // Create offsetting entry

// Reporting
getTrialBalance()               // All account balances
getBalanceSheet()               // Assets = L + E
getAccountBalance(code)         // Single account
```

**Critical Rule:** Debits MUST equal credits in every entry.

---

### userService.ts (488 lines)

**Responsibility:** User access control and organization membership

**Key Functions:**
```typescript
// Owner Management
findOwnerByEmail(email)         // Lookup factory owner

// Access Requests
submitAccessRequest()           // User requests access
getPendingRequests()            // Owner views requests
approveRequest()                // Grant access with role
rejectRequest()                 // Deny access

// Role Management
updateUserRole()                // Change permissions
removeUserAccess()              // Revoke access
getOrganizationMembers()        // List team members
```

**RBAC Roles:**
- `owner` - Full access, can manage team
- `accountant` - Read/write financial data
- `viewer` - Read-only access

---

### LedgerService.ts (900+ lines)

**Responsibility:** Centralized ledger operations with batch support

**Class Structure:**
```typescript
class LedgerService {
  constructor(userId: string, userEmail?: string, userRole?: string)

  // Read Operations
  subscribeLedgerEntries()      // Real-time with pagination
  subscribeClients()            // Client list
  subscribePartners()           // Partner list
  countLedgerEntries()          // Aggregate counts

  // Write Operations
  createLedgerEntry()           // With batch operations
  updateLedgerEntry()           // Full/partial updates
  deleteLedgerEntry()           // With cleanup
  quickPayment()                // ARAP payment
  writeOff()                    // Bad debt

  // Sub-operations
  createCheque()
  markChequeCashed()
  createPayment()
  updateInventory()
  createFixedAsset()

  // Collection References
  get ledgerRef()
  get paymentsRef()
  get chequesRef()
  get inventoryRef()
  ...
}
```

**Batch Handlers:**
- `chequeHandlers.ts` - Incoming/outgoing cheque creation
- `paymentHandlers.ts` - Immediate/partial payments
- `inventoryHandlers.ts` - Stock movements, COGS
- `fixedAssetHandlers.ts` - Asset creation/depreciation

---

### activityLogService.ts (90 lines)

**Responsibility:** Non-blocking audit trail

**Key Functions:**
```typescript
logActivity()        // Fire-and-forget logging
getRecentActivities() // Fetch logs with filters
```

**Pattern:** Logging is async but not awaited to avoid blocking main operations.

---

## Data Flow Patterns

### Pattern 1: Real-Time Subscriptions

```
┌─────────────────┐
│ Component       │
│ useEffect()     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ onSnapshot()    │
│ (Firestore)     │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────┐
│ queryClient.setQueryData()  │
│ (React Query Cache)         │
└────────┬────────────────────┘
         │
         ▼
┌─────────────────────────────┐
│ useReactiveQueryData()      │
│ (Triggers re-render)        │
└────────┬────────────────────┘
         │
         ▼
┌─────────────────┐
│ Component       │
│ re-renders      │
└─────────────────┘
```

**Implementation:**
```typescript
// hooks/firebase-query/useFirestoreSubscription.ts
export function useFirestoreSubscription<T>({
  queryKey,
  collectionPath,
  constraints,
  transform,
  enabled = true
}) {
  useEffect(() => {
    if (!enabled) return;

    const q = query(collection(db, collectionPath), ...constraints);
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => transform(doc));
      queryClient.setQueryData(queryKey, data);
    });

    return () => unsubscribe(); // Cleanup
  }, [collectionPath, enabled]);

  return useReactiveQueryData<T>(queryKey);
}
```

---

### Pattern 2: Batch Write Operations

```
┌─────────────────┐
│ Form Submit     │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────┐
│ LedgerService.create()      │
└────────┬────────────────────┘
         │
         ▼
┌─────────────────────────────┐
│ writeBatch()                │
│ ├── set(ledgerDoc)          │
│ ├── set(journalDoc)         │
│ ├── set(chequeDoc)          │
│ ├── update(inventoryDoc)    │
│ └── set(activityLogDoc)     │
└────────┬────────────────────┘
         │
         ▼
┌─────────────────┐
│ batch.commit()  │
│ (Atomic)        │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────┐
│ Cache Invalidation          │
│ queryClient.invalidate()    │
└────────┬────────────────────┘
         │
         ▼
┌─────────────────────────────┐
│ onSnapshot fires            │
│ (Real-time update)          │
└─────────────────────────────┘
```

**Implementation:**
```typescript
// services/ledger/LedgerService.ts
async createLedgerEntry(formData: FormData) {
  const batch = writeBatch(this.firestore);

  // 1. Create ledger entry
  const ledgerRef = doc(this.ledgerRef);
  batch.set(ledgerRef, ledgerData);

  // 2. Create journal entry
  addJournalEntryToBatch(batch, journalData);

  // 3. Handle cheque if applicable
  if (formData.hasCheque) {
    handleIncomingCheckBatch(batch, chequeData);
  }

  // 4. Update inventory if applicable
  if (formData.hasInventory) {
    handleInventoryUpdate(batch, inventoryData);
  }

  // 5. Log activity (non-blocking)
  logActivity({ action: 'create', module: 'ledger' });

  // Atomic commit
  await batch.commit();
}
```

---

### Pattern 3: Permission-Based Rendering

```
┌─────────────────────────────┐
│ PermissionGate              │
│ ├── action: "delete"        │
│ └── module: "ledger"        │
└────────┬────────────────────┘
         │
         ▼
┌─────────────────────────────┐
│ usePermissions()            │
│ ├── user.role               │
│ └── hasPermission(a, m)     │
└────────┬────────────────────┘
         │
    ┌────┴────┐
    │ allowed │
    └────┬────┘
    Yes  │  No
    ┌────┴────┐
    ▼         ▼
┌────────┐ ┌────────┐
│ Render │ │ null   │
│ child  │ │        │
└────────┘ └────────┘
```

**Implementation:**
```typescript
// components/auth/PermissionGate.tsx
export function PermissionGate({
  action,
  module,
  children
}: PermissionGateProps) {
  const { can } = usePermissions();

  if (!can(action, module)) {
    return null;
  }

  return <>{children}</>;
}

// Usage
<PermissionGate action="delete" module="ledger">
  <DeleteButton onClick={handleDelete} />
</PermissionGate>
```

---

## State Management Patterns

### 1. Component-Level State

**useState** - Simple UI state:
```typescript
const [isDialogOpen, setIsDialogOpen] = useState(false);
const [selectedItem, setSelectedItem] = useState<Item | null>(null);
```

**useReducer** - Complex page state:
```typescript
// ledger/reducers/ledgerPageReducer.ts
type State = {
  filters: Filters;
  pagination: Pagination;
  dialogs: DialogState;
  loading: LoadingState;
};

type Action =
  | { type: 'SET_FILTER'; payload: Partial<Filters> }
  | { type: 'SET_PAGE'; payload: number }
  | { type: 'OPEN_DIALOG'; payload: DialogType }
  | { type: 'CLOSE_DIALOG' };

const [state, dispatch] = useReducer(ledgerPageReducer, initialState);
```

### 2. Context-Level State

**LedgerFormContext** - Multi-step form:
```typescript
// ledger/context/LedgerFormContext.tsx
const LedgerFormContext = createContext<{
  formData: FormData;
  currentStep: number;
  setFormData: (data: Partial<FormData>) => void;
  nextStep: () => void;
  prevStep: () => void;
} | null>(null);
```

### 3. Server State (React Query)

**Query Cache** - Centralized data store:
```typescript
// hooks/firebase-query/keys.ts
export const queryKeys = {
  clients: {
    all: ['clients'] as const,
    detail: (id: string) => ['clients', id] as const,
    balances: ['clients', 'balances'] as const,
  },
  ledger: {
    all: ['ledger'] as const,
    list: (filters: Filters) => ['ledger', 'list', filters] as const,
    paginated: (page: number) => ['ledger', 'paginated', page] as const,
  },
  // ... other keys
};

// Cache invalidation after mutations
queryClient.invalidateQueries({ queryKey: queryKeys.ledger.all });
```

---

## Key Architectural Decisions

### 1. Arabic-First Design
- All UI labels in Arabic
- RTL layout with Tailwind (`dir="rtl"`)
- Use `ml-*` for icon spacing (not `mr-*`)

### 2. Multi-Tenant Data Isolation
- All data paths use `users/{ownerId}/`
- **CRITICAL:** Use `user.dataOwnerId`, never `user.uid`

### 3. Real-Time Updates
- Firestore `onSnapshot` for live data
- React Query cache for UI state
- Combined via `useReactiveQueryData`

### 4. Atomic Transactions
- `writeBatch()` for multi-collection writes
- Ensures data consistency across ledger, journal, cheques

### 5. Double-Entry Bookkeeping
- Every transaction creates journal entries
- Debits = Credits enforced in `journalService`

### 6. RBAC at Component Level
- `PermissionGate` for UI visibility
- Service-level checks for operations

### 7. Query Limits
- All queries include `limit()` to prevent unbounded reads
- Cursor-based pagination for large datasets

---

## Performance Considerations

### Optimizations Used
1. **useMemo** - Heavy computations (dashboard charts, balance calculations)
2. **React Query** - Automatic caching and background refetching
3. **Cursor Pagination** - `startAfter()` for large lists
4. **Denormalization** - Duplicate data for query performance

### Known Performance Debt
1. **Client balance calculation is O(n²)** - Calculated client-side
2. **Some pages have 4+ onSnapshot listeners** - Could be consolidated
3. **`usePaginatedCollection` is incomplete** - `loadMore()` is TODO
4. **Trial balance has 5000 limit** - May truncate for large accounts

---

## File Structure Summary

```
src/
├── app/                    # Next.js App Router
│   ├── layout.tsx         # Root layout (providers)
│   ├── page.tsx           # Root page (redirect)
│   └── (main)/            # Protected routes
│       ├── layout.tsx     # Main app layout
│       └── [routes]/      # Feature pages
│
├── components/             # React components
│   ├── ui/                # Reusable UI (shadcn)
│   ├── layout/            # Global layout
│   ├── auth/              # Authentication
│   ├── providers/         # Context providers
│   └── [feature]/         # Feature modules
│
├── hooks/                  # Global hooks
│   ├── firebase-query/    # Firestore + React Query
│   └── *.ts               # Other hooks
│
├── services/               # Business logic
│   ├── journalService.ts  # Accounting
│   ├── userService.ts     # Access control
│   └── ledger/            # Ledger operations
│
├── lib/                    # Utilities
│   ├── constants.ts       # App constants
│   ├── permissions.ts     # RBAC matrix
│   ├── error-handling.ts  # Error utilities
│   └── utils.ts           # Helpers
│
├── types/                  # TypeScript types
│   └── *.ts               # Type definitions
│
└── firebase/               # Firebase config
    └── *.ts               # Client setup
```
