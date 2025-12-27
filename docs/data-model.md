# FactoryFlow Data Model Documentation

> **Last Updated:** December 2024
> **Database:** Firebase Firestore (NoSQL Document Database)

## Overview

FactoryFlow uses a multi-tenant architecture where all business data is scoped under a factory owner's user ID. This ensures complete data isolation between different factories/businesses.

---

## Entity Relationship Diagram (ERD)

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              ROOT LEVEL COLLECTIONS                              │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  ┌──────────────┐         ┌─────────────────────┐                               │
│  │    users     │◄────────┤  access_requests    │                               │
│  │  (global)    │         │     (global)        │                               │
│  └──────┬───────┘         └─────────────────────┘                               │
│         │                                                                        │
│         │ owns/manages                                                           │
│         ▼                                                                        │
└─────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────┐
│                      USER-SCOPED COLLECTIONS (Multi-Tenant)                      │
│                         Path: users/{ownerId}/...                                │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  ┌────────────────┐                                                              │
│  │    members     │  Team members with factory access                            │
│  └────────────────┘                                                              │
│                                                                                  │
│  ┌────────────────┐     ┌──────────────────┐     ┌───────────────────┐          │
│  │    clients     │◄────┤     ledger       │────►│  journal_entries  │          │
│  │   (customers)  │     │   (AR/AP core)   │     │ (double-entry)    │          │
│  └────────────────┘     └────────┬─────────┘     └───────────────────┘          │
│                                  │                         ▲                     │
│  ┌────────────────┐              │                         │                     │
│  │   partners     │◄─────────────┤                         │                     │
│  │  (suppliers)   │              │                         │                     │
│  └────────────────┘              ▼                         │                     │
│                         ┌──────────────────┐               │                     │
│                         │    payments      │───────────────┤                     │
│                         │  (receipts/      │               │                     │
│                         │   disbursements) │               │                     │
│                         └────────┬─────────┘               │                     │
│                                  │                         │                     │
│                                  │ allocations             │                     │
│                                  ▼                         │                     │
│                         ┌──────────────────┐               │                     │
│                         │   cheques        │───────────────┤                     │
│                         │ (post-dated/     │               │                     │
│                         │  endorsed)       │               │                     │
│                         └──────────────────┘               │                     │
│                                                            │                     │
│  ┌────────────────┐     ┌──────────────────┐               │                     │
│  │   inventory    │◄────┤ inventory_       │───────────────┘                     │
│  │   (stock)      │     │ movements        │                                     │
│  └────────────────┘     └──────────────────┘                                     │
│                                                                                  │
│  ┌────────────────┐     ┌──────────────────┐                                     │
│  │  fixed_assets  │────►│  depreciation    │                                     │
│  │ (machinery,    │     │  entries in      │                                     │
│  │  vehicles)     │     │  journal_entries │                                     │
│  └────────────────┘     └──────────────────┘                                     │
│                                                                                  │
│  ┌────────────────┐     ┌──────────────────┐                                     │
│  │   accounts     │◄────┤  chart of        │  (Referenced by journal_entries)    │
│  │ (chart of      │     │  accounts        │                                     │
│  │  accounts)     │     │  (1000-5999)     │                                     │
│  └────────────────┘     └──────────────────┘                                     │
│                                                                                  │
│  ┌────────────────┐     ┌──────────────────┐     ┌───────────────────┐          │
│  │   invoices     │     │   employees      │     │   production      │          │
│  │  (billing)     │     │   (payroll)      │     │   (manufacturing) │          │
│  └────────────────┘     └──────────────────┘     └───────────────────┘          │
│                                                                                  │
│  ┌────────────────┐                                                              │
│  │ activity_logs  │  Audit trail of all user actions                             │
│  └────────────────┘                                                              │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## Collection Relationships Diagram

```
                                    CORE ACCOUNTING FLOW

    ┌───────────┐                                              ┌───────────┐
    │  clients  │──────────────┐                  ┌────────────│  partners │
    │           │              │                  │            │           │
    └───────────┘              ▼                  ▼            └───────────┘
                         ┌──────────┐       ┌──────────┐
                         │  ledger  │       │  ledger  │
                         │ (income) │       │(expense) │
                         └────┬─────┘       └────┬─────┘
                              │                  │
                              └────────┬─────────┘
                                       │
              ┌────────────────────────┼────────────────────────┐
              │                        │                        │
              ▼                        ▼                        ▼
        ┌───────────┐           ┌───────────┐           ┌───────────┐
        │  cheques  │           │ payments  │           │ inventory │
        │           │           │           │           │ movements │
        └─────┬─────┘           └─────┬─────┘           └─────┬─────┘
              │                       │                       │
              └───────────────────────┼───────────────────────┘
                                      │
                                      ▼
                              ┌───────────────┐
                              │    journal    │
                              │    entries    │
                              │ (debits =     │
                              │  credits)     │
                              └───────┬───────┘
                                      │
                                      ▼
                              ┌───────────────┐
                              │   accounts    │
                              │ (chart of     │
                              │  accounts)    │
                              └───────────────┘
```

---

## Collection Specifications

### Root Level Collections

#### 1. `users` (Global User Registry)

**Path:** `users/{uid}`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `uid` | string | Yes | Firebase Auth UID (document ID) |
| `email` | string | Yes | User email (normalized lowercase) |
| `displayName` | string | Yes | Display name for UI |
| `role` | enum | Yes | `'owner'` \| `'accountant'` \| `'viewer'` |
| `ownerId` | string | Yes | Factory owner's UID (for data scoping) |
| `createdAt` | Timestamp | Yes | Account creation timestamp |

**Relationships:**
- Self-references via `ownerId` → `users/{ownerId}`
- Referenced by `members`, `access_requests`, `activity_logs`

---

#### 2. `access_requests` (Access Request Queue)

**Path:** `access_requests/{requestId}`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `uid` | string | Yes | Requester's Firebase UID |
| `email` | string | Yes | Requester's email |
| `displayName` | string | Yes | Requester's display name |
| `targetOwnerId` | string | Yes | Factory owner's UID |
| `targetOwnerEmail` | string | Yes | Factory owner's email |
| `message` | string | No | Custom message from requester |
| `requestedAt` | Timestamp | Yes | Request submission time |
| `status` | enum | Yes | `'pending'` \| `'approved'` \| `'rejected'` |
| `processedAt` | Timestamp | No | When owner responded |
| `assignedRole` | enum | No | Role assigned upon approval |

**Relationships:**
- `uid` → `users/{uid}` (requester)
- `targetOwnerId` → `users/{targetOwnerId}` (factory owner)

---

### User-Scoped Collections

> **All paths below are prefixed with:** `users/{ownerId}/`

#### 3. `members` (Team Members)

**Path:** `users/{ownerId}/members/{uid}`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `uid` | string | Yes | Member's Firebase UID (document ID) |
| `ownerId` | string | Yes | Factory owner's UID |
| `email` | string | Yes | Member's email |
| `displayName` | string | Yes | Member's display name |
| `role` | enum | Yes | `'owner'` \| `'accountant'` \| `'viewer'` |
| `requestedAt` | Timestamp | Yes | Access request timestamp |
| `approvedAt` | Timestamp | Yes | Approval timestamp |
| `approvedBy` | string | No | UID of approver |
| `isActive` | boolean | Yes | Active access status |

---

#### 4. `ledger` (Income/Expense Transactions - Core AR/AP)

**Path:** `users/{ownerId}/ledger/{entryId}`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | Yes | Document ID |
| `transactionId` | string | Yes | Business ID (TXN-YYYYMMDD-HHMMSS-XXX) |
| `description` | string | Yes | Transaction description |
| `type` | enum | Yes | `'دخل'` \| `'مصروف'` \| `'حركة رأس مال'` |
| `amount` | number | Yes | Transaction amount (use Decimal.js) |
| `category` | string | Yes | Income/expense category |
| `subCategory` | string | Yes | Sub-classification |
| `associatedParty` | string | Yes | Client/supplier name |
| `ownerName` | string | No | Owner name (for equity) |
| `date` | Date | Yes | Transaction date |
| `reference` | string | Yes | Invoice/document reference |
| `notes` | string | Yes | Additional notes |
| `createdAt` | Date | Yes | Creation timestamp |
| `isARAPEntry` | boolean | No | Credit transaction flag |
| `totalPaid` | number | No | Amount paid so far |
| `remainingBalance` | number | No | Outstanding amount |
| `paymentStatus` | enum | No | `'paid'` \| `'unpaid'` \| `'partial'` |
| `totalDiscount` | number | No | Settlement discounts applied |
| `writeoffAmount` | number | No | Bad debt write-off amount |
| `writeoffReason` | string | No | Write-off justification |
| `writeoffDate` | Date | No | Write-off date |
| `writeoffBy` | string | No | User who authorized |

**Relationships:**
- `associatedParty` → `clients.name` or `partners.name`
- Referenced by `payments.allocations`, `cheques`, `journal_entries`, `inventory_movements`

---

#### 5. `payments` (Cash Receipts & Disbursements)

**Path:** `users/{ownerId}/payments/{paymentId}`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | Yes | Document ID |
| `clientName` | string | Yes | Client/supplier name |
| `amount` | number | Yes | Payment amount (use Decimal.js) |
| `type` | enum | Yes | `'قبض'` (receipt) \| `'صرف'` (disbursement) |
| `date` | Date | Yes | Payment date |
| `notes` | string | Yes | Payment memo |
| `category` | string | No | Payment category |
| `subCategory` | string | No | Sub-category |
| `createdAt` | Date | Yes | Creation timestamp |
| `isMultiAllocation` | boolean | No | Split across invoices flag |
| `totalAllocated` | number | No | Sum of allocations |
| `allocationMethod` | enum | No | `'fifo'` \| `'manual'` |
| `allocationCount` | number | No | Number of transactions covered |

**Subcollection:** `payments/{paymentId}/allocations`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | Yes | Allocation ID |
| `transactionId` | string | Yes | Ledger transaction ID |
| `ledgerDocId` | string | Yes | Ledger document ID |
| `allocatedAmount` | number | Yes | Amount applied |
| `transactionDate` | Date | Yes | Transaction date |
| `description` | string | Yes | Transaction description |
| `createdAt` | Date | Yes | Allocation timestamp |

**Relationships:**
- `clientName` → `clients.name` or `partners.name`
- `allocations.ledgerDocId` → `ledger.id`
- Referenced by `journal_entries.linkedPaymentId`

---

#### 6. `cheques` (Post-Dated & Endorsed Cheques)

**Path:** `users/{ownerId}/cheques/{chequeId}`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | Yes | Document ID |
| `chequeNumber` | string | Yes | Bank cheque number |
| `clientName` | string | Yes | Issuer/recipient name |
| `clientPhone` | string | No | Contact number |
| `amount` | number | Yes | Cheque amount (use Decimal.js) |
| `type` | enum | Yes | `'آجل'` (post-dated) \| `'فوري'` (immediate) |
| `chequeType` | string | No | Additional classification |
| `status` | enum | Yes | `'قيد الانتظار'` \| `'تم صرفه'` \| `'مرتجع'` |
| `chequeImageUrl` | string | No | Photo of cheque |
| `endorsedTo` | string | No | Endorsee name |
| `endorsedDate` | Date | No | Endorsement date |
| `endorsedToOutgoingId` | string | No | Outgoing cheque ID |
| `isEndorsedCheque` | boolean | No | Is endorsed flag |
| `endorsedFromId` | string | No | Original cheque ID |
| `endorsedSupplierTransactionId` | string | No | For AR reversal |
| `issueDate` | Date | Yes | Cheque issue date |
| `dueDate` | Date | Yes | Cheque due date |
| `bankName` | string | Yes | Issuing bank |
| `linkedTransactionId` | string | Yes | Related ledger entry |
| `notes` | string | Yes | Cheque notes |
| `createdAt` | Date | Yes | Creation timestamp |

**Relationships:**
- `linkedTransactionId` → `ledger.id`
- `endorsedFromId` → `cheques.id` (endorsement chain)
- Referenced by `journal_entries`

---

#### 7. `inventory` (Stock Items)

**Path:** `users/{ownerId}/inventory/{itemId}`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | Yes | Document ID |
| `itemName` | string | Yes | Item name |
| `category` | string | Yes | Product category |
| `subCategory` | string | No | Sub-category |
| `quantity` | number | Yes | Current stock quantity |
| `unit` | string | Yes | Unit of measure (كغ، متر، قطعة) |
| `unitPrice` | number | Yes | Price per unit (use Decimal.js) |
| `minStock` | number | Yes | Reorder point |
| `location` | string | Yes | Storage location |
| `notes` | string | Yes | Item notes |
| `thickness` | number | No | Thickness in cm |
| `width` | number | No | Width in cm |
| `length` | number | No | Length in cm |
| `lastPurchasePrice` | number | No | Last unit cost |
| `lastPurchaseDate` | Date | No | Last purchase date |
| `lastPurchaseAmount` | number | No | Last total spent |
| `createdAt` | Date | Yes | Creation timestamp |

**Relationships:**
- Referenced by `inventory_movements.itemId`, `production.inputItemId`

---

#### 8. `inventory_movements` (Stock In/Out)

**Path:** `users/{ownerId}/inventory_movements/{movementId}`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | Yes | Document ID |
| `itemId` | string | Yes | Inventory item ID |
| `itemName` | string | Yes | Item name (denormalized) |
| `quantity` | number | Yes | Quantity moved |
| `type` | enum | Yes | `'دخول'` (entry) \| `'خروج'` (exit) |
| `unit` | string | No | Unit of measure |
| `linkedTransactionId` | string | No | Related ledger entry |
| `notes` | string | No | Movement notes |
| `userEmail` | string | No | User who recorded |
| `createdAt` | Date | Yes | Movement timestamp |

**Relationships:**
- `itemId` → `inventory.id`
- `linkedTransactionId` → `ledger.id`
- Referenced by `journal_entries` (COGS entries)

---

#### 9. `fixed_assets` (Long-Term Assets)

**Path:** `users/{ownerId}/fixed_assets/{assetId}`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | Yes | Document ID |
| `assetNumber` | string | Yes | Internal asset code |
| `assetName` | string | Yes | Asset description |
| `category` | string | Yes | Type (machinery, vehicles, etc.) |
| `purchaseDate` | Date | Yes | Acquisition date |
| `purchaseCost` | number | Yes | Original cost (use Decimal.js) |
| `salvageValue` | number | Yes | Residual value |
| `usefulLifeMonths` | number | Yes | Depreciation period |
| `monthlyDepreciation` | number | Yes | Monthly amount |
| `status` | enum | Yes | `'active'` \| `'disposed'` \| `'sold'` \| `'written-off'` |
| `accumulatedDepreciation` | number | Yes | Total depreciated |
| `bookValue` | number | Yes | Net value |
| `lastDepreciationDate` | Date | No | Last depreciation |
| `location` | string | No | Asset location |
| `serialNumber` | string | No | Serial number |
| `supplier` | string | No | Vendor name |
| `notes` | string | No | Notes |
| `createdAt` | Date | Yes | Creation timestamp |

**Relationships:**
- Referenced by `journal_entries` (depreciation entries)

---

#### 10. `clients` (Customers)

**Path:** `users/{ownerId}/clients/{clientId}`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | Yes | Document ID |
| `name` | string | Yes | Client name |
| `phone` | string | Yes | Contact number |
| `email` | string | Yes | Email address |
| `address` | string | Yes | Physical address |
| `balance` | number | Yes | Current AR balance |
| `createdAt` | Date | Yes | Creation timestamp |

**Relationships:**
- Referenced by `ledger.associatedParty`, `payments.clientName`, `invoices.clientName`

---

#### 11. `partners` (Suppliers/Vendors)

**Path:** `users/{ownerId}/partners/{partnerId}`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | Yes | Document ID |
| `name` | string | Yes | Partner name |
| `phone` | string | No | Contact number |
| `email` | string | No | Email |
| `address` | string | No | Address |
| `active` | boolean | Yes | Active status |
| `notes` | string | No | Partnership notes |
| `createdAt` | Date | Yes | Creation timestamp |

**Relationships:**
- Referenced by `ledger.associatedParty` (for expenses)

---

#### 12. `accounts` (Chart of Accounts)

**Path:** `users/{ownerId}/accounts/{accountId}`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | Yes | Document ID |
| `code` | string | Yes | Account code (1000-5999) |
| `name` | string | Yes | English account name |
| `nameAr` | string | Yes | Arabic account name |
| `type` | enum | Yes | `'asset'` \| `'liability'` \| `'equity'` \| `'revenue'` \| `'expense'` |
| `normalBalance` | enum | Yes | `'debit'` \| `'credit'` |
| `isActive` | boolean | Yes | Active flag |
| `parentCode` | string | No | Parent account code |
| `description` | string | No | Account description |
| `createdAt` | Date | Yes | Creation timestamp |
| `updatedAt` | Date | No | Last modification |

**Account Code Ranges:**
- `1000-1999`: Assets (Cash, Bank, AR, Inventory, Fixed Assets)
- `2000-2999`: Liabilities (AP, Loans)
- `3000-3999`: Equity (Capital, Drawings, Retained Earnings)
- `4000-4999`: Revenue (Sales, Service)
- `5000-5999`: Expenses (COGS, Salaries, Rent, Utilities)

**Relationships:**
- Referenced by `journal_entries.lines.accountCode`

---

#### 13. `journal_entries` (Double-Entry Journal)

**Path:** `users/{ownerId}/journal_entries/{entryId}`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | Yes | Document ID |
| `entryNumber` | string | Yes | JE-YYYYMMDD-HHMMSS-XXX format |
| `date` | Date | Yes | Entry date |
| `description` | string | Yes | Entry description |
| `lines` | array | Yes | Debit/credit lines |
| `status` | enum | Yes | `'draft'` \| `'posted'` \| `'reversed'` |
| `linkedTransactionId` | string | No | Related ledger entry |
| `linkedPaymentId` | string | No | Related payment |
| `linkedDocumentType` | string | No | Source type |
| `reversedById` | string | No | Reversing entry ID |
| `reversesEntryId` | string | No | Original entry ID |
| `createdAt` | Date | Yes | Creation timestamp |
| `postedAt` | Date | No | Posting timestamp |
| `updatedAt` | Date | No | Last modification |

**Journal Line Structure:**
```typescript
{
  accountCode: string;      // Account code (e.g., "1000")
  accountName: string;      // English name
  accountNameAr: string;    // Arabic name
  debit: number;           // Debit amount (0 if credit)
  credit: number;          // Credit amount (0 if debit)
  description?: string;    // Line description
}
```

**Critical Rule:** Sum of debits MUST equal sum of credits.

**Relationships:**
- `lines.accountCode` → `accounts.code`
- `linkedTransactionId` → `ledger.id`
- `linkedPaymentId` → `payments.id`
- Self-references via `reversedById`, `reversesEntryId`

---

#### 14. `invoices` (Sales Invoices)

**Path:** `users/{ownerId}/invoices/{invoiceId}`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | Yes | Document ID |
| `invoiceNumber` | string | Yes | Auto-generated number |
| `manualInvoiceNumber` | string | No | Paper invoice number |
| `clientName` | string | Yes | Customer name |
| `clientAddress` | string | No | Delivery address |
| `clientPhone` | string | No | Contact number |
| `invoiceDate` | Date | Yes | Issue date |
| `dueDate` | Date | Yes | Payment due date |
| `items` | array | Yes | Line items |
| `subtotal` | number | Yes | Pre-tax total |
| `taxRate` | number | Yes | Tax percentage |
| `taxAmount` | number | Yes | Calculated tax |
| `total` | number | Yes | Final amount |
| `status` | enum | Yes | `'draft'` \| `'sent'` \| `'paid'` \| `'overdue'` |
| `notes` | string | No | Invoice notes |
| `invoiceImageUrl` | string | No | Paper invoice photo |
| `linkedTransactionId` | string | No | Related ledger entry |
| `createdAt` | Date | Yes | Creation timestamp |
| `updatedAt` | Date | Yes | Last modification |

**Relationships:**
- `clientName` → `clients.name`
- `linkedTransactionId` → `ledger.id`

---

#### 15. `employees` (Staff Records)

**Path:** `users/{ownerId}/employees/{employeeId}`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | Yes | Document ID |
| `name` | string | Yes | Employee name |
| `position` | string | Yes | Job title |
| `hireDate` | Date | Yes | Start date |
| `currentSalary` | number | Yes | Monthly salary |
| `overtimeEligible` | boolean | Yes | Overtime flag |
| `createdAt` | Date | Yes | Creation timestamp |

**Subcollections:**
- `employees/{id}/salary_history` - Salary changes
- `employees/{id}/payroll` - Payroll records

---

#### 16. `production` (Manufacturing Orders)

**Path:** `users/{ownerId}/production/{orderId}`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | Yes | Document ID |
| `orderNumber` | string | Yes | Production order number |
| `date` | Date | Yes | Order date |
| `inputItemId` | string | Yes | Material ID |
| `inputItemName` | string | Yes | Material name |
| `inputQuantity` | number | Yes | Input quantity |
| `inputThickness` | number | No | Input dimension (cm) |
| `inputWidth` | number | No | Input dimension (cm) |
| `inputLength` | number | No | Input dimension (cm) |
| `outputItemName` | string | Yes | Product name |
| `outputQuantity` | number | Yes | Output quantity |
| `outputThickness` | number | No | Output dimension (cm) |
| `outputWidth` | number | No | Output dimension (cm) |
| `outputLength` | number | No | Output dimension (cm) |
| `unit` | string | Yes | Unit of measure |
| `productionExpenses` | number | Yes | Production cost |
| `status` | enum | Yes | `'قيد التنفيذ'` \| `'مكتمل'` \| `'ملغي'` |
| `notes` | string | Yes | Production notes |
| `createdAt` | Date | Yes | Creation timestamp |
| `completedAt` | Date | No | Completion date |

**Relationships:**
- `inputItemId` → `inventory.id`

---

#### 17. `activity_logs` (Audit Trail)

**Path:** `users/{ownerId}/activity_logs/{logId}`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | Yes | Document ID |
| `userId` | string | Yes | Acting user's UID |
| `userEmail` | string | Yes | Acting user's email |
| `userDisplayName` | string | No | Display name |
| `action` | enum | Yes | Action type (create, update, delete, etc.) |
| `module` | enum | Yes | Feature module |
| `targetId` | string | No | Affected item ID |
| `description` | string | Yes | Human-readable description |
| `metadata` | object | No | Additional data (old/new values) |
| `createdAt` | Date | Yes | Action timestamp |

**Relationships:**
- `userId` → `users.uid`

---

## Critical Design Patterns

### 1. Multi-Tenant Data Isolation
All business data is scoped under `users/{ownerId}/` ensuring complete separation between factories.

### 2. Denormalization
Names and amounts are duplicated in journal entries for query performance. Example: `accountName` is stored in journal lines despite referencing `accounts.code`.

### 3. Atomic Transactions
`WriteBatch` is used for operations spanning multiple collections (ledger + journal + cheque).

### 4. Money Handling
All monetary amounts are stored as numbers but MUST use `Decimal.js` for arithmetic in code to avoid floating-point errors.

### 5. User ID Rule
**CRITICAL:** Always use `user.dataOwnerId`, never `user.uid` directly for data paths.

### 6. Query Limits
All queries include `limit()` to prevent unbounded reads:
- Ledger: 2000
- Clients/Partners: 500
- Journal entries: 5000
- Activity logs: 50

---

## Common Journal Entry Patterns

| Transaction | Debit Account | Credit Account |
|-------------|--------------|----------------|
| Cash Sale | Cash (1100) | Revenue (4100) |
| Credit Sale | AR (1200) | Revenue (4100) |
| Cash Expense | Expense (5XXX) | Cash (1100) |
| Payment Received | Cash (1100) | AR (1200) |
| Payment Made | AP (2100) | Cash (1100) |
| Owner Capital | Cash (1100) | Capital (3100) |
| Owner Withdrawal | Drawings (3200) | Cash (1100) |
| Depreciation | Depreciation Exp (5XXX) | Accum. Depr. (1XXX) |
| COGS | COGS (5100) | Inventory (1300) |
