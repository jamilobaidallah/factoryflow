"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.insertJournalEntry = insertJournalEntry;
exports.getNextSequenceNumber = getNextSequenceNumber;
exports.getJournalEntries = getJournalEntries;
exports.getJournalEntryById = getJournalEntryById;
exports.getLinesForJournalEntry = getLinesForJournalEntry;
exports.getJournalEntriesForTransaction = getJournalEntriesForTransaction;
exports.deleteJournalEntry = deleteJournalEntry;
exports.deleteJournalEntriesForTransaction = deleteJournalEntriesForTransaction;
exports.getTrialBalance = getTrialBalance;
exports.getTrialBalanceSummary = getTrialBalanceSummary;
exports.getAccountLedger = getAccountLedger;
exports.getBalanceSheet = getBalanceSheet;
const drizzle_orm_1 = require("drizzle-orm");
const journal_schema_1 = require("../../src/lib/schema/journal.schema");
const chart_of_accounts_schema_1 = require("../../src/lib/schema/chart-of-accounts.schema");
/** Tolerance for floating-point comparison (0.001 = 1/1000 of a currency unit) */
const BALANCE_TOLERANCE = 0.001;
/**
 * The single chokepoint for writing journal entries.
 * Enforces debits = credits BEFORE writing anything.
 * The entry and all its lines are written in one atomic transaction —
 * if balance check fails or any line insert fails, nothing is persisted.
 *
 * This is the function the 1,000-entry hard gate test stress-tests.
 */
function insertJournalEntry(db, entry, lines) {
    // 1. Validate inputs
    if (lines.length === 0) {
        throw new Error('Journal entry must have at least one line');
    }
    const totalDebit = lines.reduce((sum, l) => sum + (l.debit || 0), 0);
    const totalCredit = lines.reduce((sum, l) => sum + (l.credit || 0), 0);
    if (Math.abs(totalDebit - totalCredit) > BALANCE_TOLERANCE) {
        throw new Error(`Unbalanced journal entry: DR ${totalDebit.toFixed(3)} ≠ CR ${totalCredit.toFixed(3)}. ` +
            `Entry rejected.`);
    }
    if (totalDebit <= 0) {
        throw new Error('Journal entry must have non-zero amounts');
    }
    // 2. Compute sequence number + entry number atomically inside the transaction
    return db.transaction((tx) => {
        const nextSeq = getNextSequenceNumber(tx, entry.profileId);
        const entryId = entry.id ?? `je-${entry.profileId}-${nextSeq}`;
        const entryNumber = `JE-${String(nextSeq).padStart(6, '0')}`;
        const insertedEntry = tx.insert(journal_schema_1.journalEntries).values({
            ...entry,
            id: entryId,
            sequenceNumber: nextSeq,
            entryNumber,
        }).returning().get();
        const insertedLines = [];
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const row = tx.insert(journal_schema_1.journalLines).values({
                id: `${entryId}-line-${i + 1}`,
                journalId: entryId,
                profileId: entry.profileId,
                ...line,
            }).returning().get();
            insertedLines.push(row);
        }
        return { entry: insertedEntry, lines: insertedLines };
    });
}
/**
 * Returns the next sequence number for journal entries in this profile.
 * Sequence numbers are gapless (1, 2, 3, ...) per profile.
 */
function getNextSequenceNumber(db, profileId) {
    const result = db
        .select({ max: (0, drizzle_orm_1.max)(journal_schema_1.journalEntries.sequenceNumber) })
        .from(journal_schema_1.journalEntries)
        .where((0, drizzle_orm_1.eq)(journal_schema_1.journalEntries.profileId, profileId))
        .get();
    return (result?.max ?? 0) + 1;
}
function getJournalEntries(db, profileId, limit = 500) {
    return db.select().from(journal_schema_1.journalEntries)
        .where((0, drizzle_orm_1.eq)(journal_schema_1.journalEntries.profileId, profileId))
        .orderBy((0, drizzle_orm_1.desc)(journal_schema_1.journalEntries.sequenceNumber))
        .limit(limit)
        .all();
}
function getJournalEntryById(db, id) {
    return db.select().from(journal_schema_1.journalEntries).where((0, drizzle_orm_1.eq)(journal_schema_1.journalEntries.id, id)).get();
}
function getLinesForJournalEntry(db, journalId) {
    return db.select().from(journal_schema_1.journalLines)
        .where((0, drizzle_orm_1.eq)(journal_schema_1.journalLines.journalId, journalId))
        .orderBy((0, drizzle_orm_1.asc)(journal_schema_1.journalLines.id))
        .all();
}
function getJournalEntriesForTransaction(db, transactionId) {
    return db.select().from(journal_schema_1.journalEntries)
        .where((0, drizzle_orm_1.eq)(journal_schema_1.journalEntries.linkedTransactionId, transactionId))
        .all();
}
/**
 * Delete a journal entry and all its lines. Used by deleteLedgerEntry to
 * remove linked journals.
 */
function deleteJournalEntry(db, id) {
    db.transaction((tx) => {
        tx.delete(journal_schema_1.journalLines).where((0, drizzle_orm_1.eq)(journal_schema_1.journalLines.journalId, id)).run();
        tx.delete(journal_schema_1.journalEntries).where((0, drizzle_orm_1.eq)(journal_schema_1.journalEntries.id, id)).run();
    });
}
function deleteJournalEntriesForTransaction(db, transactionId) {
    const entries = getJournalEntriesForTransaction(db, transactionId);
    db.transaction((tx) => {
        for (const e of entries) {
            tx.delete(journal_schema_1.journalLines).where((0, drizzle_orm_1.eq)(journal_schema_1.journalLines.journalId, e.id)).run();
            tx.delete(journal_schema_1.journalEntries).where((0, drizzle_orm_1.eq)(journal_schema_1.journalEntries.id, e.id)).run();
        }
    });
}
/**
 * Trial balance — sum of all debits/credits per account.
 * Used to verify accounting integrity: total debits must equal total credits.
 *
 * Returns one row per account that has at least one journal line.
 * Returns ALL accounts (not just non-zero) so users can spot missing balances.
 */
function getTrialBalance(db, profileId) {
    const rows = db
        .select({
        accountCode: journal_schema_1.journalLines.accountCode,
        accountName: journal_schema_1.journalLines.accountName,
        accountNameAr: journal_schema_1.journalLines.accountNameAr,
        totalDebit: (0, drizzle_orm_1.sql) `COALESCE(SUM(${journal_schema_1.journalLines.debit}), 0)`,
        totalCredit: (0, drizzle_orm_1.sql) `COALESCE(SUM(${journal_schema_1.journalLines.credit}), 0)`,
    })
        .from(journal_schema_1.journalLines)
        .where((0, drizzle_orm_1.eq)(journal_schema_1.journalLines.profileId, profileId))
        .groupBy(journal_schema_1.journalLines.accountCode, journal_schema_1.journalLines.accountName, journal_schema_1.journalLines.accountNameAr)
        .orderBy((0, drizzle_orm_1.asc)(journal_schema_1.journalLines.accountCode))
        .all();
    return rows.map(r => ({
        accountCode: r.accountCode,
        accountName: r.accountName,
        accountNameAr: r.accountNameAr,
        totalDebit: Number(r.totalDebit || 0),
        totalCredit: Number(r.totalCredit || 0),
        balance: Number(r.totalDebit || 0) - Number(r.totalCredit || 0),
    }));
}
function getTrialBalanceSummary(db, profileId) {
    const rows = getTrialBalance(db, profileId);
    const totalDebits = rows.reduce((s, r) => s + r.totalDebit, 0);
    const totalCredits = rows.reduce((s, r) => s + r.totalCredit, 0);
    const difference = Math.abs(totalDebits - totalCredits);
    return {
        totalDebits,
        totalCredits,
        difference,
        isBalanced: difference <= BALANCE_TOLERANCE,
    };
}
function getAccountLedger(db, profileId, accountCode) {
    const rows = db
        .select({
        journalId: journal_schema_1.journalLines.journalId,
        entryNumber: journal_schema_1.journalEntries.entryNumber,
        date: journal_schema_1.journalEntries.date,
        description: journal_schema_1.journalLines.description,
        debit: journal_schema_1.journalLines.debit,
        credit: journal_schema_1.journalLines.credit,
    })
        .from(journal_schema_1.journalLines)
        .innerJoin(journal_schema_1.journalEntries, (0, drizzle_orm_1.eq)(journal_schema_1.journalLines.journalId, journal_schema_1.journalEntries.id))
        .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(journal_schema_1.journalLines.profileId, profileId), (0, drizzle_orm_1.eq)(journal_schema_1.journalLines.accountCode, accountCode)))
        .orderBy((0, drizzle_orm_1.asc)(journal_schema_1.journalEntries.date), (0, drizzle_orm_1.asc)(journal_schema_1.journalEntries.sequenceNumber))
        .all();
    let running = 0;
    return rows.map(r => {
        running += (r.debit || 0) - (r.credit || 0);
        return {
            journalId: r.journalId,
            entryNumber: r.entryNumber,
            date: r.date,
            description: r.description,
            debit: r.debit || 0,
            credit: r.credit || 0,
            runningBalance: running,
        };
    });
}
function getBalanceSheet(db, profileId) {
    // Join trial balance against chart of accounts to know the type of each account
    const tb = getTrialBalance(db, profileId);
    const accounts = db.select().from(chart_of_accounts_schema_1.chartOfAccounts)
        .where((0, drizzle_orm_1.eq)(chart_of_accounts_schema_1.chartOfAccounts.profileId, profileId))
        .all();
    const accountTypeByCode = new Map(accounts.map(a => [a.code, a.type]));
    const assets = [];
    const liabilities = [];
    const equity = [];
    for (const row of tb) {
        const type = accountTypeByCode.get(row.accountCode);
        if (type === 'asset') {
            assets.push(row);
        }
        if (type === 'liability') {
            liabilities.push(row);
        }
        if (type === 'equity') {
            equity.push(row);
        }
    }
    // For credit-normal accounts (liability, equity), positive balance = CR > DR
    // Assets are debit-normal: positive = DR > CR
    const totalAssets = assets.reduce((s, r) => s + r.balance, 0);
    const totalLiabilities = liabilities.reduce((s, r) => s - r.balance, 0);
    const totalEquity = equity.reduce((s, r) => s - r.balance, 0);
    return { assets, liabilities, equity, totalAssets, totalLiabilities, totalEquity };
}
