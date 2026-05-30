/**
 * Phase 6 — Per-collection field mappers.
 *
 * Pure functions that convert Firestore-shaped export documents into the
 * SQLite row shapes defined in `src/lib/schema`. One mapper per collection.
 *
 * Each mapper:
 *   - preserves the original Firestore document `id` as the SQLite primary key
 *     (so cross-references like `linkedTransactionId`, `paymentId`, etc. keep
 *     working post-migration without rewriting any foreign references)
 *   - converts every date/timestamp to a UTC ISO string via the existing
 *     `firestoreTimestampToIso` helper (timezone-bug prevention)
 *   - applies the same boolean-coercion rules as the IPC handlers, so values
 *     written by either path read back identically
 *   - leaves fields the schema declares as optional `undefined` when absent
 *     (Drizzle then writes the schema's default), and only sets `null`
 *     explicitly when the schema column is nullable
 *
 * These functions are side-effect free and unit-testable without a database.
 */

import {
  clients,
  partners,
  cheques,
  payments,
  ledger,
  inventory,
  employees,
  invoices,
} from '@/lib/schema';
import { firestoreTimestampToIso, firestoreTimestampToIsoOr, type FirestoreDateLike } from './transform';

type NewClientRow    = typeof clients.$inferInsert;
type NewPartnerRow   = typeof partners.$inferInsert;
type NewChequeRow    = typeof cheques.$inferInsert;
type NewPaymentRow   = typeof payments.$inferInsert;
type NewLedgerRow    = typeof ledger.$inferInsert;
type NewInventoryRow = typeof inventory.$inferInsert;
type NewEmployeeRow  = typeof employees.$inferInsert;
type NewInvoiceRow   = typeof invoices.$inferInsert;

// ── Shared helpers ─────────────────────────────────────────────────────────────

/**
 * Coerce the various truthy representations Firestore can hand us into a real
 * boolean. Firestore stores booleans, but old documents sometimes have `1` or
 * `"true"` left over from prior migrations; match the IPC handler's tolerance.
 */
function toBool(value: unknown): boolean {
  return value === true || value === 1 || value === '1' || value === 'true';
}

/** Coerce to number, defaulting to 0 — Firestore sometimes serializes 0 as missing. */
function toNum(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) { return value; }
  if (typeof value === 'string') {
    const n = parseFloat(value);
    return Number.isFinite(n) ? n : fallback;
  }
  return fallback;
}

/** Coerce to string, defaulting to '' — covers null/undefined/non-string. */
function toStr(value: unknown, fallback = ''): string {
  if (typeof value === 'string') { return value; }
  if (value === null || value === undefined) { return fallback; }
  return String(value);
}

interface MapperOpts {
  profileId: string;
  /** Fallback ISO date for documents whose primary date field is missing. */
  fallbackIso: string;
}

// ── Clients ────────────────────────────────────────────────────────────────────

export interface FirestoreClient {
  id: string;
  name?: string;
  phone?: string;
  email?: string;
  address?: string;
  balance?: number;
  createdAt?: FirestoreDateLike;
}

export function mapClient(doc: FirestoreClient, opts: MapperOpts): NewClientRow {
  return {
    id: doc.id,
    profileId: opts.profileId,
    name: toStr(doc.name, '(no name)'),
    phone: toStr(doc.phone),
    email: toStr(doc.email),
    address: toStr(doc.address),
    balance: toNum(doc.balance),
    createdAt: firestoreTimestampToIsoOr(doc.createdAt, opts.fallbackIso),
  };
}

// ── Partners ───────────────────────────────────────────────────────────────────

export interface FirestorePartner {
  id: string;
  name?: string;
  ownershipPercentage?: number;
  phone?: string;
  email?: string;
  initialInvestment?: number;
  joinDate?: FirestoreDateLike;
  active?: boolean;
  capitalAccountCode?: string;
  drawingsAccountCode?: string;
  createdAt?: FirestoreDateLike;
}

export function mapPartner(doc: FirestorePartner, opts: MapperOpts): NewPartnerRow {
  const joinDateIso = firestoreTimestampToIsoOr(doc.joinDate, opts.fallbackIso);
  return {
    id: doc.id,
    profileId: opts.profileId,
    name: toStr(doc.name, '(no name)'),
    ownershipPercentage: toNum(doc.ownershipPercentage),
    phone: toStr(doc.phone),
    email: toStr(doc.email),
    initialInvestment: toNum(doc.initialInvestment),
    joinDate: joinDateIso,
    active: doc.active === false ? false : true,
    capitalAccountCode: doc.capitalAccountCode ?? null,
    drawingsAccountCode: doc.drawingsAccountCode ?? null,
    createdAt: firestoreTimestampToIsoOr(doc.createdAt, joinDateIso),
  };
}

// ── Cheques ────────────────────────────────────────────────────────────────────

export interface FirestoreCheque {
  id: string;
  chequeNumber?: string;
  clientName?: string;
  amount?: number;
  type?: string;
  chequeType?: string;
  status?: string;
  chequeImageUrl?: string;
  endorsedTo?: string;
  endorsedDate?: FirestoreDateLike;
  endorsedToOutgoingId?: string;
  endorsedSupplierTransactionId?: string;
  isEndorsedCheque?: boolean;
  endorsedFromId?: string;
  linkedTransactionId?: string;
  linkedPaymentId?: string;
  paidTransactionIds?: string[];
  issueDate?: FirestoreDateLike;
  dueDate?: FirestoreDateLike;
  clearedDate?: FirestoreDateLike;
  bouncedDate?: FirestoreDateLike;
  bankName?: string;
  notes?: string;
  clientPhone?: string;
  createdAt?: FirestoreDateLike;
}

export function mapCheque(doc: FirestoreCheque, opts: MapperOpts): NewChequeRow {
  const issueIso = firestoreTimestampToIsoOr(doc.issueDate, opts.fallbackIso);
  const dueIso = firestoreTimestampToIsoOr(doc.dueDate, issueIso);
  return {
    id: doc.id,
    profileId: opts.profileId,
    chequeNumber: toStr(doc.chequeNumber),
    clientName: toStr(doc.clientName, '(no name)'),
    amount: toNum(doc.amount),
    type: toStr(doc.type, 'incoming'),
    chequeType: doc.chequeType ?? null,
    status: toStr(doc.status, 'معلق'),
    chequeImageUrl: doc.chequeImageUrl ?? null,
    endorsedTo: doc.endorsedTo ?? null,
    endorsedDate: firestoreTimestampToIso(doc.endorsedDate),
    endorsedToOutgoingId: doc.endorsedToOutgoingId ?? null,
    endorsedSupplierTransactionId: doc.endorsedSupplierTransactionId ?? null,
    isEndorsedCheque: toBool(doc.isEndorsedCheque),
    endorsedFromId: doc.endorsedFromId ?? null,
    linkedTransactionId: doc.linkedTransactionId ?? null,
    linkedPaymentId: doc.linkedPaymentId ?? null,
    // Schema stores paid_transaction_ids as a JSON-encoded TEXT column
    paidTransactionIds: Array.isArray(doc.paidTransactionIds)
      ? JSON.stringify(doc.paidTransactionIds)
      : null,
    issueDate: issueIso,
    dueDate: dueIso,
    clearedDate: firestoreTimestampToIso(doc.clearedDate),
    bouncedDate: firestoreTimestampToIso(doc.bouncedDate),
    bankName: toStr(doc.bankName),
    notes: toStr(doc.notes),
    clientPhone: doc.clientPhone ?? null,
    createdAt: firestoreTimestampToIsoOr(doc.createdAt, issueIso),
  };
}

// ── Payments (the parent row only — allocations are handled in transform.ts) ──

export interface FirestorePaymentMeta {
  id: string;
  clientName?: string;
  amount?: number;
  type?: string;
  date?: FirestoreDateLike;
  notes?: string;
  category?: string;
  subCategory?: string;
  isMultiAllocation?: boolean;
  totalAllocated?: number;
  allocationMethod?: 'fifo' | 'manual' | string;
  allocationCount?: number;
  linkedChequeId?: string;
  isEndorsement?: boolean;
  noCashMovement?: boolean;
  createdAt?: FirestoreDateLike;
}

export function mapPayment(doc: FirestorePaymentMeta, opts: MapperOpts): NewPaymentRow {
  const dateIso = firestoreTimestampToIsoOr(doc.date, opts.fallbackIso);
  return {
    id: doc.id,
    profileId: opts.profileId,
    clientName: toStr(doc.clientName),
    amount: toNum(doc.amount),
    type: toStr(doc.type, 'قبض'),
    date: dateIso,
    notes: toStr(doc.notes),
    category: doc.category ?? null,
    subCategory: doc.subCategory ?? null,
    isMultiAllocation: toBool(doc.isMultiAllocation),
    totalAllocated: toNum(doc.totalAllocated),
    allocationMethod: (doc.allocationMethod === 'fifo' || doc.allocationMethod === 'manual')
      ? doc.allocationMethod
      : null,
    allocationCount: Math.max(0, Math.floor(toNum(doc.allocationCount))),
    linkedChequeId: doc.linkedChequeId ?? null,
    isEndorsement: toBool(doc.isEndorsement),
    noCashMovement: toBool(doc.noCashMovement),
    createdAt: firestoreTimestampToIsoOr(doc.createdAt, dateIso),
  };
}

// ── Ledger ─────────────────────────────────────────────────────────────────────

export interface FirestoreLedger {
  id: string;
  transactionId?: string;
  description?: string;
  type?: string;
  amount?: number;
  category?: string;
  subCategory?: string;
  associatedParty?: string;
  ownerName?: string;
  date?: FirestoreDateLike;
  createdAt?: FirestoreDateLike;
  totalPaid?: number;
  remainingBalance?: number;
  paymentStatus?: 'paid' | 'unpaid' | 'partial' | string;
  isARAPEntry?: boolean;
  totalDiscount?: number;
  writeoffAmount?: number;
  writeoffReason?: string;
  writeoffDate?: FirestoreDateLike;
  writeoffBy?: string;
  immediateSettlement?: boolean;
  paidFromAdvances?: Array<{ advanceId?: string; amount?: number; date?: FirestoreDateLike }>;
  totalPaidFromAdvances?: number;
  isReturnEntry?: boolean;
  returnCostAmount?: number;
  returnInventorySubCode?: string;
  isCOGSReversal?: boolean;
  isInventoryPurchase?: boolean;
}

export function mapLedger(doc: FirestoreLedger, opts: MapperOpts): NewLedgerRow {
  const dateIso = firestoreTimestampToIsoOr(doc.date, opts.fallbackIso);

  // Coerce the union to one of the three allowed values, or leave undefined.
  const status: 'paid' | 'unpaid' | 'partial' | undefined =
    doc.paymentStatus === 'paid' || doc.paymentStatus === 'unpaid' || doc.paymentStatus === 'partial'
      ? doc.paymentStatus
      : undefined;

  // paidFromAdvances is stored as JSON in the schema; serialize it once here so
  // the dashboard / report code can JSON.parse on read.
  const paidFromAdvancesJson = Array.isArray(doc.paidFromAdvances) && doc.paidFromAdvances.length > 0
    ? JSON.stringify(
        doc.paidFromAdvances.map((a) => ({
          advanceId: a.advanceId,
          amount: a.amount ?? 0,
          date: firestoreTimestampToIso(a.date),
        })),
      )
    : null;

  return {
    id: doc.id,
    profileId: opts.profileId,
    transactionId: toStr(doc.transactionId, doc.id),
    description: toStr(doc.description),
    type: toStr(doc.type, 'دخل'),
    amount: toNum(doc.amount),
    category: toStr(doc.category),
    subCategory: toStr(doc.subCategory),
    associatedParty: toStr(doc.associatedParty),
    ownerName: doc.ownerName ?? null,
    date: dateIso,
    createdAt: firestoreTimestampToIsoOr(doc.createdAt, dateIso),
    totalPaid: toNum(doc.totalPaid),
    remainingBalance: toNum(doc.remainingBalance),
    paymentStatus: status,
    isARAPEntry: toBool(doc.isARAPEntry),
    totalDiscount: toNum(doc.totalDiscount),
    writeoffAmount: toNum(doc.writeoffAmount),
    writeoffReason: doc.writeoffReason ?? null,
    writeoffDate: firestoreTimestampToIso(doc.writeoffDate),
    writeoffBy: doc.writeoffBy ?? null,
    immediateSettlement: toBool(doc.immediateSettlement),
    paidFromAdvances: paidFromAdvancesJson,
    totalPaidFromAdvances: toNum(doc.totalPaidFromAdvances),
    isReturnEntry: toBool(doc.isReturnEntry),
    returnCostAmount: toNum(doc.returnCostAmount),
    returnInventorySubCode: doc.returnInventorySubCode ?? null,
    isCOGSReversal: toBool(doc.isCOGSReversal),
    isInventoryPurchase: toBool(doc.isInventoryPurchase),
  };
}

// ── Inventory ──────────────────────────────────────────────────────────────────

export interface FirestoreInventory {
  id: string;
  itemName?: string;
  category?: string;
  subCategory?: string;
  quantity?: number;
  unit?: string;
  unitPrice?: number;
  minStock?: number;
  location?: string;
  notes?: string;
  thickness?: number;
  width?: number;
  length?: number;
  lastPurchasePrice?: number;
  lastPurchaseDate?: FirestoreDateLike;
  lastPurchaseAmount?: number;
  inventoryAccountCode?: string;
  createdAt?: FirestoreDateLike;
}

export function mapInventoryItem(doc: FirestoreInventory, opts: MapperOpts): NewInventoryRow {
  return {
    id: doc.id,
    profileId: opts.profileId,
    itemName: toStr(doc.itemName, '(no name)'),
    category: toStr(doc.category),
    subCategory: doc.subCategory ?? null,
    quantity: toNum(doc.quantity),
    unit: toStr(doc.unit),
    unitPrice: toNum(doc.unitPrice),
    minStock: toNum(doc.minStock),
    location: toStr(doc.location),
    notes: toStr(doc.notes),
    thickness: doc.thickness ?? null,
    width: doc.width ?? null,
    length: doc.length ?? null,
    lastPurchasePrice: doc.lastPurchasePrice ?? null,
    lastPurchaseDate: firestoreTimestampToIso(doc.lastPurchaseDate),
    lastPurchaseAmount: doc.lastPurchaseAmount ?? null,
    inventoryAccountCode: doc.inventoryAccountCode ?? '1300',
    createdAt: firestoreTimestampToIsoOr(doc.createdAt, opts.fallbackIso),
  };
}

// ── Employees ──────────────────────────────────────────────────────────────────

export interface FirestoreEmployee {
  id: string;
  name?: string;
  currentSalary?: number;
  overtimeEligible?: boolean;
  hireDate?: FirestoreDateLike;
  position?: string;
  createdAt?: FirestoreDateLike;
}

export function mapEmployee(doc: FirestoreEmployee, opts: MapperOpts): NewEmployeeRow {
  const hireIso = firestoreTimestampToIsoOr(doc.hireDate, opts.fallbackIso);
  return {
    id: doc.id,
    profileId: opts.profileId,
    name: toStr(doc.name, '(no name)'),
    currentSalary: toNum(doc.currentSalary),
    overtimeEligible: doc.overtimeEligible === false ? false : true,
    hireDate: hireIso,
    position: toStr(doc.position),
    createdAt: firestoreTimestampToIsoOr(doc.createdAt, hireIso),
  };
}

// ── Invoices ───────────────────────────────────────────────────────────────────

export interface FirestoreInvoice {
  id: string;
  invoiceNumber?: string;
  manualInvoiceNumber?: string;
  clientName?: string;
  clientAddress?: string;
  clientPhone?: string;
  invoiceDate?: FirestoreDateLike;
  dueDate?: FirestoreDateLike;
  items?: unknown[];
  subtotal?: number;
  taxRate?: number;
  taxAmount?: number;
  total?: number;
  status?: string;
  notes?: string;
  invoiceImageUrl?: string;
  linkedTransactionId?: string;
  createdAt?: FirestoreDateLike;
  updatedAt?: FirestoreDateLike;
}

export function mapInvoice(doc: FirestoreInvoice, opts: MapperOpts): NewInvoiceRow {
  const invIso = firestoreTimestampToIsoOr(doc.invoiceDate, opts.fallbackIso);
  const dueIso = firestoreTimestampToIsoOr(doc.dueDate, invIso);
  return {
    id: doc.id,
    profileId: opts.profileId,
    invoiceNumber: toStr(doc.invoiceNumber, doc.id),
    manualInvoiceNumber: doc.manualInvoiceNumber ?? null,
    clientName: toStr(doc.clientName),
    clientAddress: doc.clientAddress ?? null,
    clientPhone: doc.clientPhone ?? null,
    invoiceDate: invIso,
    dueDate: dueIso,
    // Invoice items are stored as a JSON-encoded TEXT column in the schema
    items: JSON.stringify(Array.isArray(doc.items) ? doc.items : []),
    subtotal: toNum(doc.subtotal),
    taxRate: toNum(doc.taxRate),
    taxAmount: toNum(doc.taxAmount),
    total: toNum(doc.total),
    status: toStr(doc.status, 'draft'),
    notes: doc.notes ?? null,
    invoiceImageUrl: doc.invoiceImageUrl ?? null,
    linkedTransactionId: doc.linkedTransactionId ?? null,
    createdAt: firestoreTimestampToIsoOr(doc.createdAt, invIso),
    updatedAt: firestoreTimestampToIsoOr(doc.updatedAt, invIso),
  };
}

// ── Batch helpers ──────────────────────────────────────────────────────────────

/**
 * Map an array of Firestore documents through a single-doc mapper. Tiny but
 * useful: lets the runner write `mapMany(docs, mapClient, opts)` instead of
 * repeating the `.map(...)` boilerplate per collection.
 */
export function mapMany<TDoc, TRow>(
  docs: TDoc[],
  mapper: (doc: TDoc, opts: MapperOpts) => TRow,
  opts: MapperOpts,
): TRow[] {
  return docs.map((d) => mapper(d, opts));
}
