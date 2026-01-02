# FactoryFlow Development Guide

> **This file is automatically read by Claude Code at the start of every session.**

FactoryFlow is a bilingual Arabic-first factory management system with double-entry bookkeeping.
Built with Next.js 14, TypeScript, Firebase, Tailwind CSS, and shadcn/ui.

---

## 🚨 MANDATORY WORKFLOW

### 1. Git Branching
- **Features & refactors:** Create feature branch first (`feature/description` or `fix/issue-description`)
- **Small fixes** (< 20 lines, single file, obvious fix): May commit directly to master
- Feature branches enable Vercel preview deployments

### 2. Planning
- Use Claude Code's built-in **TodoWrite tool** to track tasks
- **Clear tasks** (obvious solution): Proceed and explain as you go
- **Ambiguous tasks** (multiple approaches, unclear requirements): Ask for clarification first

### 3. Execution
- Work through todo items systematically
- Mark complete as you go
- Explain each change

### 4. 🔍 SELF-REVIEW & BUG HUNTING (MANDATORY)

**Before saying "done", Claude MUST perform these steps automatically:**

#### Step A: Generate Test Plan
Create a mental checklist covering:
- Happy path (normal usage)
- Edge cases (empty data, zero values, max values)
- Error scenarios (network failure, permission denied)
- Arabic/RTL correctness
- Mobile responsiveness
- Permission levels (owner vs accountant vs viewer)

#### Step B: Code Review Against Bug Patterns
Go through ALL changed files and check for:

| Check | What to Look For |
|-------|------------------|
| User ID | Any `user.uid` that should be `user.dataOwnerId`? |
| Money Math | Any `+`, `-`, `*`, `/` on money without Decimal.js? |
| Listeners | Any `onSnapshot` without cleanup in useEffect return? |
| RTL | Any `mr-` that should be `ml-` for icons? |
| Queries | Any unbounded queries missing `limit()`? |
| Types | Any `any` types that should be properly typed? |
| Console | Any `console.log` left in production code? |
| Error Handling | Any try/catch without user feedback (toast)? |
| Loading States | Any async operation without loading indicator? |
| Empty States | What happens when data array is empty? |

#### Step C: Trace Data Flow
For each new/modified feature:
1. Trace where data comes FROM (Firestore query? Props? State?)
2. Trace where data goes TO (Firestore write? State update? UI?)
3. Check: What if the source is null/undefined?
4. Check: What if the write fails?

#### Step D: Run Automated Checks
```bash
npm run lint          # Check for lint errors
npm test              # Run unit tests
```

#### Step E: Report Findings
After self-review, report:
```markdown
## 🔍 Self-Review Complete

### Tests Performed:
- [x] Checked for user.uid vs dataOwnerId — PASS
- [x] Checked money calculations use Decimal.js — PASS
- [x] Checked listener cleanup — PASS
- [x] Verified RTL spacing — PASS
- [x] Ran npm test — All tests pass

### Edge Cases Verified:
- [x] Empty client list shows empty state
- [x] Zero amount is rejected by validation
- [x] Network error shows Arabic error message

### Potential Issues Found:
- None / OR list any concerns
```

#### Step F: Code Quality Review
Before committing, verify the code is clean:

| Check | Question |
|-------|----------|
| **Matches patterns** | Does it follow existing code style in the file/codebase? |
| **Readable** | Would another developer understand this in 6 months? |
| **Not over-engineered** | Is this the simplest solution that works? |
| **No duplication** | Could this reuse existing utilities/components? |
| **Named clearly** | Are variables/functions named descriptively? |
| **Minimal changes** | Did I only change what was necessary? |

**Report format (include automatically):**
```
✅ Code Quality: Follows existing patterns, uses established utilities, minimal changes
```
or if issues found:
```
⚠️ Code Quality: Works but [specific concern] - want me to refactor?
```

### 5. 📋 HUMAN TESTING PLAN

**Tiered approach based on change size:**

| Change Type | Testing Required |
|-------------|------------------|
| **Small fix** (< 20 lines, single file) | Quick verification: "Fixed X, tested Y, works" |
| **Feature** (new functionality) | Full testing plan (template below) |
| **Accounting change** (affects ledger/money) | Full plan + journal entry verification |

**For features and significant changes, generate a testing plan:**

```markdown
## 📋 Human Testing Plan

### Feature: [Name of feature/fix]
### Test URL: [Vercel preview URL]
### Time Estimate: [X minutes]

---

### 🟢 Happy Path Tests (Normal Usage)

| # | Test | Steps | Expected Result | ✅/❌ |
|---|------|-------|-----------------|-------|
| 1 | [Test name] | 1. Go to [page]<br>2. Click [button]<br>3. Enter [data] | [What should happen] | |
| 2 | [Test name] | 1. [Step]<br>2. [Step] | [Expected result] | |

---

### 🟡 Edge Case Tests (Unusual but Valid)

| # | Test | Steps | Expected Result | ✅/❌ |
|---|------|-------|-----------------|-------|
| 3 | Empty state | Go to [page] with no data | Shows "لا توجد بيانات" message | |
| 4 | Zero amount | Enter 0 in amount field | Validation error appears | |
| 5 | Max value | Enter 999,999,999 | Accepted or shows limit error | |
| 6 | Arabic text | Enter Arabic characters | Displays correctly RTL | |

---

### 🔴 Error Handling Tests

| # | Test | Steps | Expected Result | ✅/❌ |
|---|------|-------|-----------------|-------|
| 7 | Required field | Leave [field] empty, submit | Arabic error: "هذا الحقل مطلوب" | |
| 8 | Invalid input | Enter [invalid data] | Appropriate error message | |

---

### 📱 Mobile Tests (Resize browser to 375px or use phone)

| # | Test | Steps | Expected Result | ✅/❌ |
|---|------|-------|-----------------|-------|
| 9 | Layout | View [page] on mobile | No horizontal scroll, readable | |
| 10 | Touch | Tap buttons and inputs | Responsive, no missed taps | |
| 11 | Navigation | Use mobile menu | Works correctly | |

---

### 🔐 Permission Tests (If feature has RBAC)

| # | Role | Test | Expected Result | ✅/❌ |
|---|------|------|-----------------|-------|
| 12 | Owner | Access feature | Full access | |
| 13 | Accountant | Access feature | [Expected access level] | |
| 14 | Viewer | Access feature | Read-only or hidden | |

---

### 💰 Accounting Tests (If feature affects money/ledger)

| # | Test | Steps | Expected Result | ✅/❌ |
|---|------|-------|-----------------|-------|
| 15 | Journal entry | Create transaction | Debits = Credits in journal | |
| 16 | Balance update | After transaction | Client/account balance correct | |

---

### ✍️ Test Results Summary

| Total | Passed | Failed |
|-------|--------|--------|
| X | X | X |

### Issues Found:
- [ ] Issue 1: [Description]
- [ ] Issue 2: [Description]
```

### 6. Finalization
- **Small fixes:** Commit, push, report what was done
- **Features:** Push branch, create PR, output testing plan for user review

---

## 🐛 CRITICAL BUG PATTERNS TO AVOID

### User ID Confusion (CRITICAL)
```typescript
// ❌ WRONG — breaks for non-owner users
const path = `users/${user.uid}/ledger`;

// ✅ CORRECT — always use dataOwnerId
const path = `users/${user.dataOwnerId}/ledger`;
```

### Money Calculations
```typescript
// ❌ WRONG — floating point errors
const total = amount1 + amount2;

// ✅ CORRECT — use Decimal.js
import Decimal from 'decimal.js-light';
const total = new Decimal(amount1).plus(amount2).toNumber();
```

### Listener Memory Leaks
```typescript
// ❌ WRONG — no cleanup
useEffect(() => {
  onSnapshot(ref, callback);
}, []);

// ✅ CORRECT — always cleanup
useEffect(() => {
  const unsubscribe = onSnapshot(ref, callback);
  return () => unsubscribe();
}, []);
```

### RTL Icon Spacing
```typescript
// ❌ WRONG for Arabic RTL
<Icon className="mr-2" />

// ✅ CORRECT for Arabic RTL
<Icon className="ml-2" />
```

---

## ⚡ PERFORMANCE RULES

### Parallel vs Sequential Queries
```typescript
// ❌ WRONG — sequential queries (10 seconds for 5 queries)
for (const id of ids) {
  await getData(id);
}

// ✅ CORRECT — parallel queries (2 seconds for 5 queries)
await Promise.all(ids.map(id => getData(id)));

// ✅ CORRECT — parallel with error handling
const results = await Promise.allSettled(ids.map(id => getData(id)));
```

### Context Provider Performance
- **NEVER** block initial render with sequential async operations
- Move heavy data fetching OUT of providers into page-level hooks
- Use skeleton loaders during data fetch, not blank screens

### Data Fetching Strategy
| Scenario | Use | Why |
|----------|-----|-----|
| Frequently changing data (dashboard) | `onSnapshot` | Real-time updates |
| Rarely changing data (settings) | `getDocs` | Less overhead |
| Large lists | Pagination + `limit()` | Memory efficiency |

### Loading Performance
```typescript
// ❌ WRONG — loads everything upfront
import { HeavyChart } from './HeavyChart';

// ✅ CORRECT — lazy load heavy components
const HeavyChart = dynamic(() => import('./HeavyChart'), {
  loading: () => <Skeleton />,
});
```

---

## 🔍 QUERY OPTIMIZATION

### Always Bound Queries
```typescript
// ❌ WRONG — loads entire collection (could be 100,000 docs)
const q = query(collectionRef, orderBy('date'));

// ✅ CORRECT — always limit
const q = query(collectionRef, orderBy('date', 'desc'), limit(100));
```

### Avoid Duplicate Listeners
```typescript
// ❌ WRONG — same data subscribed twice
const { ledger } = useLedgerData();      // Listener 1
const { totals } = useLedgerTotals();    // Listener 2 (same collection!)

// ✅ CORRECT — single source, derive what you need
const { ledger } = useLedgerData();
const totals = useMemo(() => calculateTotals(ledger), [ledger]);
```

### Use Composite Indexes for Complex Queries
When combining `where()` + `orderBy()` on different fields, create Firestore indexes.

---

## 🔐 SECURITY CHECKLIST

### Input Validation
```typescript
// ❌ WRONG — trusting client input
const amount = parseFloat(userInput);

// ✅ CORRECT — validate and sanitize
const amount = parseAmount(userInput); // Uses Decimal.js, handles edge cases
if (amount <= 0) throw new Error('المبلغ يجب أن يكون أكبر من صفر');
```

### Never Expose Sensitive Data
```typescript
// ❌ WRONG — logging sensitive info
console.log('User token:', token);
console.log('Payment details:', paymentData);

// ✅ CORRECT — log only IDs/references
console.log('Processing payment:', paymentId);
```

### Firestore Security Rules
- All data access MUST be validated by Firestore rules
- Never trust client-side role checks alone — enforce in rules
- Test rules with Firebase Emulator before deploying

### XSS Prevention
```typescript
// ❌ WRONG — rendering raw HTML
<div dangerouslySetInnerHTML={{ __html: userContent }} />

// ✅ CORRECT — let React escape content
<div>{userContent}</div>
```

---

## 📁 PROJECT STRUCTURE

```
src/
├── app/           # Next.js App Router pages
├── components/
│   ├── ui/        # shadcn/ui base components (DON'T MODIFY)
│   └── [feature]/ # Feature components
├── lib/           # Utilities, constants
├── services/      # Business logic
├── hooks/         # Custom React hooks
├── types/         # TypeScript types
└── firebase/      # Firebase config
```

## 🔒 DO NOT TOUCH (Working Well)

| File | Why It's Protected |
|------|-------------------|
| `chequeStateMachine.ts` | 275+ lines of tests, enforces business rules for cheque lifecycle |
| `journalService.ts` | Debits=Credits validation — breaks accounting if changed wrong |
| `permissions.ts` | Complete RBAC matrix — extend only, don't restructure |
| `src/components/ui/*` | shadcn/ui components — stable, well-tested |

---

## ⚠️ KNOWN ISSUES (Don't Make Worse)

### Performance Debt
- **Client balance calculation is O(n²)** — calculated client-side from ledger + payments + cheques every render. Don't add complexity.
- **Some pages have 4+ onSnapshot listeners** — consolidate if possible, don't add more.
- **`usePaginatedCollection` is incomplete** — the `loadMore()` function is a TODO. Don't rely on it.

### N+1 Query Pattern (AVOID)
```typescript
// ❌ WRONG — N+1 queries, very slow
for (const client of clients) {
  client.balance = await getBalance(client.id); // One query per client!
}

// ✅ CORRECT — fetch all data once, calculate in memory
const [clients, ledger, payments] = await Promise.all([...]);
// Calculate balances from loaded data
```

### Hardcoded Limits
- `journalService.ts` has `limit(5000)` — will silently truncate for large datasets
- Be aware when business grows

---

## 📊 DATABASE SCHEMA RULES

### Adding New Fields
When adding new fields to Firestore documents, **always make them optional with defaults**:
```typescript
// ❌ WRONG — existing documents will break
interface Client {
  name: string;
  newRequiredField: string; // Existing docs don't have this!
}

// ✅ CORRECT — backward compatible
interface Client {
  name: string;
  newOptionalField?: string; // Safe for existing docs
}
```

### Reading Data Safely
```typescript
// Always handle missing fields
const value = doc.data()?.newField ?? defaultValue;
```

---

## 🧪 TESTING REQUIREMENTS

### New Business Logic Needs Tests
- Check `src/__tests__/` and `src/lib/__tests__/` for patterns
- Accounting logic MUST have tests (debits = credits)
- State machine transitions MUST have tests

### Test File Location
```
src/
├── lib/
│   ├── chequeStateMachine.ts
│   └── __tests__/
│       └── chequeStateMachine.test.ts  ← Tests next to code
```

### Run Tests Before PR
```bash
npm test             # Run all tests
npm test -- --watch  # Watch mode during development
```

---

## 💰 ACCOUNTING RULES

### Golden Rule
**Debits MUST equal Credits** in every journal entry.

### Common Journal Entries

| Transaction | Debit | Credit |
|-------------|-------|--------|
| Cash Sale | Cash (1100) | Revenue (4100) |
| Credit Sale | AR (1200) | Revenue (4100) |
| Cash Expense | Expense (5XXX) | Cash (1100) |
| Payment Received | Cash (1100) | AR (1200) |
| Owner Capital | Cash (1100) | Owner's Capital (3100) |
| Owner Withdrawal | Drawings (3200) | Cash (1100) |

### Post-Dated Cheques
- **PENDING**: No journal entry (not yet cashed)
- **CASHED**: DR Cash, CR AR
- **BOUNCED after cashing**: Reverse the entry

### Equity ≠ Income/Expense
Owner capital movements affect Balance Sheet, NOT Income Statement.

---

## 🎨 UI PATTERNS

### Colors
- Primary: `primary-50` to `primary-950` (blue)
- Success: `success-50` to `success-900` (green) — income, paid
- Danger: `danger-50` to `danger-900` (red) — expense, unpaid
- Warning: `warning-50` to `warning-900` (amber) — pending

### Cards
```tsx
<Card className="rounded-xl border border-slate-200/60 shadow-card hover:shadow-card-hover transition-shadow">
```

### Stats Card with Gradient
```tsx
<div className="rounded-xl p-6 bg-gradient-to-br from-success-50 to-success-100/50 border border-success-200/50">
  <div className="text-sm text-success-600 font-medium">إجمالي المبيعات</div>
  <div className="text-2xl font-bold text-success-900 mt-1">٥٠,٠٠٠ دينار</div>
</div>
```

### Button with Icon (RTL)
```tsx
<Button>
  <Plus className="ml-2 h-4 w-4" />  {/* ml-2 not mr-2 for RTL */}
  إضافة جديد
</Button>
```

### Status Badges
```tsx
<span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-success-100 text-success-700">مدفوع</span>
<span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-danger-100 text-danger-700">غير مدفوع</span>
<span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-warning-100 text-warning-700">معلق</span>
```

### Responsive Grid
```tsx
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
```

---

## 🔥 FIRESTORE PATTERNS

### Collection Path
```typescript
// Always scope to dataOwnerId
`users/${user.dataOwnerId}/clients`
`users/${user.dataOwnerId}/ledger`
```

### Always Use Limits
```typescript
// ❌ WRONG — unbounded
query(ref, orderBy('date'));

// ✅ CORRECT — bounded
query(ref, orderBy('date', 'desc'), limit(100));
```

### Batch for Atomic Operations
```typescript
const batch = writeBatch(firestore);
batch.set(docRef1, data1);
batch.set(docRef2, data2);
await batch.commit(); // All succeed or all fail
```

---

## ✅ PRE-COMMIT CHECKLIST

Before saying a task is complete:

- [ ] No `console.log` in production code
- [ ] No TypeScript `any` — use proper types
- [ ] Money uses `Decimal.js`, not `parseFloat`
- [ ] Uses `user.dataOwnerId`, not `user.uid`
- [ ] All listeners have cleanup functions
- [ ] Error messages in Arabic
- [ ] Loading and error states handled
- [ ] Mobile responsive tested
- [ ] RTL layout correct

---

## 🚨 ERROR HANDLING PATTERNS

### Error Types and Responses

| Error Type | User Experience | Implementation |
|------------|-----------------|----------------|
| **Network error** | Arabic message + retry button | `toast.error('حدث خطأ في الاتصال. يرجى المحاولة مرة أخرى')` |
| **Validation error** | Inline field error | Show error below field, focus on field |
| **Permission error** | Redirect to appropriate page | Owner → login, Viewer → read-only view |
| **Not found** | Friendly 404 message | `الصفحة غير موجودة` with link home |

### Never Swallow Errors
```typescript
// ❌ WRONG — silent failure
try {
  await saveData();
} catch (e) {
  console.log(e); // User has no idea it failed
}

// ✅ CORRECT — inform user
try {
  await saveData();
  toast.success('تم الحفظ بنجاح');
} catch (e) {
  console.error('Save failed:', e);
  toast.error('فشل الحفظ. يرجى المحاولة مرة أخرى');
}
```

### Async Operations Pattern
```typescript
const [loading, setLoading] = useState(false);
const [error, setError] = useState<string | null>(null);

const handleSubmit = async () => {
  setLoading(true);
  setError(null);
  try {
    await performAction();
    toast.success('تمت العملية بنجاح');
  } catch (e) {
    setError('حدث خطأ. يرجى المحاولة مرة أخرى');
    toast.error('فشلت العملية');
  } finally {
    setLoading(false);
  }
};
```

---

## ♿ ACCESSIBILITY (a11y)

### Arabic ARIA Labels
```tsx
// ✅ Interactive elements need Arabic labels
<Button aria-label="إضافة عميل جديد">
  <Plus className="h-4 w-4" />
</Button>

<IconButton aria-label="حذف">
  <Trash2 />
</IconButton>
```

### Keyboard Navigation
```tsx
// ✅ Support keyboard navigation
<div
  role="button"
  tabIndex={0}
  onClick={handleClick}
  onKeyDown={(e) => e.key === 'Enter' && handleClick()}
>
```

### Color + Visual Indicator
```tsx
// ❌ WRONG — color alone conveys meaning
<span className="text-danger-600">فشل</span>

// ✅ CORRECT — color + icon/text
<span className="text-danger-600">
  <XCircle className="inline ml-1 h-4 w-4" />
  فشل
</span>
```

### Form Error Linking
```tsx
// ✅ Link errors to fields for screen readers
<Input
  id="amount"
  aria-invalid={!!errors.amount}
  aria-describedby={errors.amount ? "amount-error" : undefined}
/>
{errors.amount && (
  <p id="amount-error" className="text-danger-600 text-sm">
    {errors.amount}
  </p>
)}
```

---

## 📝 GIT COMMIT STANDARDS

### Conventional Commits
Use these prefixes for commit messages:

| Prefix | Use For | Example |
|--------|---------|---------|
| `feat:` | New feature | `feat: add overtime tracking` |
| `fix:` | Bug fix | `fix: correct balance calculation` |
| `perf:` | Performance improvement | `perf: parallelize Firestore queries` |
| `docs:` | Documentation only | `docs: update CLAUDE.md standards` |
| `refactor:` | Code change (no behavior change) | `refactor: extract payment logic` |
| `test:` | Adding/fixing tests | `test: add cheque state machine tests` |
| `chore:` | Build, config, deps | `chore: upgrade Next.js to 14.2` |

### Commit Message Format
```
<type>: <short description in English>

<optional body explaining why, not what>

🤖 Generated with Claude Code
```

### Examples
```bash
# Good
feat: add employee overtime tracking with monthly summary
fix: use dataOwnerId instead of uid for multi-user support
perf: parallelize legacy owner check queries

# Bad
update code          # Too vague
fixed bug            # What bug?
WIP                  # Don't commit WIP
```

---

## 🧩 COMPONENT ORGANIZATION

### When to Split Components

| Signal | Action |
|--------|--------|
| File > 300 lines | Split into smaller components |
| Multiple responsibilities | Extract focused components |
| Repeated UI patterns | Create reusable component |
| Complex state logic | Extract to custom hook |

### Component File Structure
```
src/components/employees/
├── employees-page.tsx        # Main page component
├── components/               # Sub-components
│   ├── EmployeeTable.tsx
│   ├── EmployeeCard.tsx
│   └── PayrollDialog.tsx
├── hooks/                    # Feature-specific hooks
│   └── useEmployeesData.ts
└── types/                    # Feature-specific types
    └── employees.ts
```

### Naming Conventions
```typescript
// Components: PascalCase
EmployeeTable.tsx
PayrollDialog.tsx

// Hooks: camelCase with 'use' prefix
useEmployeesData.ts
usePayrollCalculation.ts

// Types: PascalCase
interface Employee { }
type PayrollStatus = 'pending' | 'processed';
```

### Keep Related Code Together
```typescript
// ✅ CORRECT — related components in same feature folder
src/components/employees/
  ├── EmployeeTable.tsx
  ├── EmployeeCard.tsx
  └── EmployeeForm.tsx

// ❌ WRONG — scattered across codebase
src/components/tables/EmployeeTable.tsx
src/components/cards/EmployeeCard.tsx
src/components/forms/EmployeeForm.tsx
```

---

## 📚 KEY FILES REFERENCE

| Purpose | File |
|---------|------|
| Constants | `src/lib/constants.ts` |
| Error handling | `src/lib/error-handling.ts` |
| Permissions | `src/lib/permissions.ts` |
| Journal entries | `src/services/journalService.ts` |
| Cheque states | `src/lib/chequeStateMachine.ts` |
| Types | `src/types/*.ts` |
