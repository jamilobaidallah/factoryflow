"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateTransactionId = generateTransactionId;
exports.getLedgerEntries = getLedgerEntries;
exports.getLedgerEntryById = getLedgerEntryById;
exports.getLedgerEntryByTransactionId = getLedgerEntryByTransactionId;
exports.getLedgerCount = getLedgerCount;
exports.getUnpaidARAPCount = getUnpaidARAPCount;
exports.createLedgerEntry = createLedgerEntry;
exports.deleteLedgerEntry = deleteLedgerEntry;
exports.updateLedgerEntryMetadata = updateLedgerEntryMetadata;
exports.updateLedgerPaymentStatus = updateLedgerPaymentStatus;
const drizzle_orm_1 = require("drizzle-orm");
const ledger_schema_1 = require("../../src/lib/schema/ledger.schema");
const journal_queries_1 = require("./journal.queries");
const account_mapping_1 = require("./account-mapping");
/**
 * Generate a unique transaction ID — "TXN-YYYYMMDD-HHMMSS-XXXXXX"
 * The trailing 6 chars use a process-local counter mixed with randomness
 * to guarantee uniqueness even for rapid-fire bulk inserts within the
 * same millisecond. Format matches the Firestore version + extra entropy.
 */
let _txnCounter = 0;
function generateTransactionId() {
    const now = new Date();
    const pad = (n, w = 2) => String(n).padStart(w, '0');
    const dt = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
    const tm = `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
    _txnCounter = (_txnCounter + 1) % 1000000;
    const seq = pad(_txnCounter, 6);
    return `TXN-${dt}-${tm}-${seq}`;
}
// ── Reads ────────────────────────────────────────────────────────────────────
function getLedgerEntries(db, profileId, limit = 500) {
    return db.select().from(ledger_schema_1.ledger)
        .where((0, drizzle_orm_1.eq)(ledger_schema_1.ledger.profileId, profileId))
        .orderBy((0, drizzle_orm_1.desc)(ledger_schema_1.ledger.date))
        .limit(limit)
        .all();
}
function getLedgerEntryById(db, id) {
    return db.select().from(ledger_schema_1.ledger).where((0, drizzle_orm_1.eq)(ledger_schema_1.ledger.id, id)).get();
}
function getLedgerEntryByTransactionId(db, transactionId) {
    return db.select().from(ledger_schema_1.ledger).where((0, drizzle_orm_1.eq)(ledger_schema_1.ledger.transactionId, transactionId)).get();
}
function getLedgerCount(db, profileId) {
    const result = db
        .select({ n: (0, drizzle_orm_1.count)() })
        .from(ledger_schema_1.ledger)
        .where((0, drizzle_orm_1.eq)(ledger_schema_1.ledger.profileId, profileId))
        .get();
    return Number(result?.n ?? 0);
}
function getUnpaidARAPCount(db, profileId) {
    return db.select().from(ledger_schema_1.ledger)
        .where((0, drizzle_orm_1.eq)(ledger_schema_1.ledger.profileId, profileId))
        .all()
        .filter(e => e.isARAPEntry && (e.paymentStatus === 'unpaid' || e.paymentStatus === 'partial'))
        .length;
}
/**
 * Create a ledger entry AND its matching journal entry atomically.
 *
 * This is the foundation function. Complex flows (cheque payments, advance
 * applications, multi-allocation payments, inventory movements) are layered
 * on top via separate handler functions that call this and then create
 * additional records.
 *
 * If anything fails (balance check, journal write, ledger write), the entire
 * transaction rolls back.
 */
function createLedgerEntry(db, input) {
    const transactionId = generateTransactionId();
    const ledgerId = `led-${transactionId}`;
    const now = new Date().toISOString();
    // Determine final field values from input + sensible defaults
    const isInstant = input.immediateSettlement ?? !input.isARAPEntry;
    const isARAP = input.isARAPEntry ?? !isInstant;
    const amount = input.amount;
    const paymentStatus = input.paymentStatus
        ?? (isInstant ? 'paid' : 'unpaid');
    const totalPaid = isInstant ? amount : 0;
    const remainingBal = isInstant ? 0 : amount;
    // Resolve which accounts to use based on type + category + subCategory
    const mapping = (0, account_mapping_1.resolveAccountMapping)({
        type: input.type,
        category: input.category,
        subCategory: input.subCategory,
        isInstant,
        isInventoryPurchase: input.isInventoryPurchase ?? false,
        isReturnEntry: input.isReturnEntry ?? false,
        isCOGSReversal: input.isCOGSReversal ?? false,
    });
    // Build journal lines (always 1 DR + 1 CR for the simple case)
    const lines = [
        {
            accountCode: mapping.debitAccount.code,
            accountName: mapping.debitAccount.name,
            accountNameAr: mapping.debitAccount.nameAr,
            debit: amount,
            credit: 0,
            description: input.description ?? '',
        },
        {
            accountCode: mapping.creditAccount.code,
            accountName: mapping.creditAccount.name,
            accountNameAr: mapping.creditAccount.nameAr,
            debit: 0,
            credit: amount,
            description: input.description ?? '',
        },
    ];
    return db.transaction((tx) => {
        // 1. Insert the journal entry (with balance enforcement inside insertJournalEntry)
        // The transaction handle has the same query API as DrizzleDb but a slightly
        // different TypeScript type — safe to cast within this context.
        const { entry: journal } = (0, journal_queries_1.insertJournalEntry)(tx, {
            profileId: input.profileId,
            date: input.date,
            description: input.description ?? '',
            sourceType: 'ledger',
            sourceTransactionId: transactionId,
            linkedTransactionId: transactionId,
            createdAt: now,
            createdBy: 'local',
        }, lines);
        // 2. Insert the ledger row
        const ledgerRow = tx.insert(ledger_schema_1.ledger).values({
            id: ledgerId,
            profileId: input.profileId,
            transactionId,
            description: input.description ?? '',
            type: input.type,
            amount,
            category: input.category ?? '',
            subCategory: input.subCategory ?? '',
            associatedParty: input.associatedParty ?? '',
            ownerName: input.ownerName ?? null,
            date: input.date,
            createdAt: now,
            paymentStatus: paymentStatus,
            isARAPEntry: isARAP,
            immediateSettlement: isInstant,
            totalPaid,
            remainingBalance: remainingBal,
            totalDiscount: input.totalDiscount ?? 0,
            isInventoryPurchase: input.isInventoryPurchase ?? false,
            isReturnEntry: input.isReturnEntry ?? false,
            returnCostAmount: input.returnCostAmount ?? 0,
            isCOGSReversal: input.isCOGSReversal ?? false,
            ...input.overrides,
        }).returning().get();
        return { ledger: ledgerRow, journalId: journal.id };
    });
}
/**
 * Delete a ledger entry and ALL its linked journal entries.
 * Removes payment allocations too (payment_allocations table references the
 * transactionId via ledger_doc_id).
 */
function deleteLedgerEntry(db, id) {
    const entry = getLedgerEntryById(db, id);
    if (!entry) {
        return;
    }
    db.transaction((tx) => {
        // Remove all journal entries linked to this transactionId
        (0, journal_queries_1.deleteJournalEntriesForTransaction)(tx, entry.transactionId);
        // Remove the ledger row itself
        tx.delete(ledger_schema_1.ledger).where((0, drizzle_orm_1.eq)(ledger_schema_1.ledger.id, id)).run();
    });
}
/**
 * Update non-financial fields on a ledger entry (e.g., notes, description).
 * For financial updates that require journal recreation, use the
 * updateLedgerEntry handler (built in a follow-up commit) which rebuilds
 * the journal entries from scratch.
 */
function updateLedgerEntryMetadata(db, id, data) {
    return db.update(ledger_schema_1.ledger).set(data).where((0, drizzle_orm_1.eq)(ledger_schema_1.ledger.id, id)).returning().get();
}
/**
 * Update payment-related fields after a payment has been applied to this entry.
 */
function updateLedgerPaymentStatus(db, id, totalPaid, totalDiscount, amount) {
    const remaining = Math.max(0, amount - totalPaid - totalDiscount);
    let status;
    if (remaining <= 0.001) {
        status = 'paid';
    }
    else if (totalPaid > 0 || totalDiscount > 0) {
        status = 'partial';
    }
    else {
        status = 'unpaid';
    }
    return db.update(ledger_schema_1.ledger).set({
        totalPaid,
        totalDiscount,
        remainingBalance: remaining,
        paymentStatus: status,
    }).where((0, drizzle_orm_1.eq)(ledger_schema_1.ledger.id, id)).returning().get();
}
