/**
 * Journal Service Layer
 *
 * Firestore operations for double-entry bookkeeping.
 * Pure calculation logic is in @/lib/journal-utils.ts for testability.
 */

import { firestore } from '@/firebase/config';
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  getDocs,
  getDoc,
  query,
  where,
  orderBy,
  writeBatch,
  Timestamp,
  WriteBatch,
  limit,
} from 'firebase/firestore';
import {
  Account,
  JournalEntry,
  JournalEntryDocument,
  JournalLine,
  AccountBalance,
  TrialBalanceSummary,
  BalanceSheet,
  ACCOUNT_CODES,
  validateJournalEntry,
  calculateAccountBalance,
  getNormalBalance,
} from '@/types/accounting';
import { getDefaultAccountsForSeeding } from '@/lib/chart-of-accounts';
import {
  getAccountMappingForLedgerEntry,
  getAccountMappingForPayment,
  getAccountMappingForCOGS,
  getAccountMappingForDepreciation,
  getAccountMappingForBadDebt,
  getAccountMappingForFixedAssetPurchase,
  getAccountNameAr,
} from '@/lib/account-mapping';
import { roundCurrency, safeAdd, safeSubtract } from '@/lib/currency';
import { convertFirestoreDates } from '@/lib/firestore-utils';
import {
  createJournalLines,
  getAccountTypeFromCode,
  generateJournalEntryNumber,
  validateUserId,
  validateAmount,
  validateDate,
  validateDescription,
  ValidationError,
} from '@/lib/journal-utils';

// ============================================================================
// Collection Paths
// ============================================================================

const getAccountsPath = (userId: string) => `users/${userId}/accounts`;
const getJournalEntriesPath = (userId: string) => `users/${userId}/journal_entries`;
const getLedgerPath = (userId: string) => `users/${userId}/ledger`;
const getPaymentsPath = (userId: string) => `users/${userId}/payments`;

// ============================================================================
// Result Types
// ============================================================================

export interface ServiceResult<T = void> {
  success: boolean;
  data?: T;
  error?: string;
}

// Re-export ValidationError for consumers
export { ValidationError } from '@/lib/journal-utils';

// ============================================================================
// Internal Helpers
// ============================================================================

/**
 * Delete journal entries by a specific field query
 */
async function deleteJournalEntriesByField(
  userId: string,
  fieldName: string,
  fieldValue: string
): Promise<ServiceResult<number>> {
  try {
    const journalRef = collection(firestore, getJournalEntriesPath(userId));
    const q = query(journalRef, where(fieldName, '==', fieldValue));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      return { success: true, data: 0 };
    }

    const batch = writeBatch(firestore);
    snapshot.docs.forEach((docSnap) => {
      batch.delete(docSnap.ref);
    });

    await batch.commit();
    return { success: true, data: snapshot.size };
  } catch (error) {
    console.error(`Error deleting journal entries by ${fieldName}:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete entries',
    };
  }
}

// ============================================================================
// Chart of Accounts Operations
// ============================================================================

/**
 * Check if user has Chart of Accounts initialized
 * @throws {ValidationError} if userId is invalid
 */
export async function hasChartOfAccounts(userId: string): Promise<boolean> {
  validateUserId(userId);
  const accountsRef = collection(firestore, getAccountsPath(userId));
  // Only need to check if ANY accounts exist, so limit to 1
  const snapshot = await getDocs(query(accountsRef, limit(1)));
  return !snapshot.empty;
}

/**
 * Seed default Chart of Accounts for a user
 * Only runs if accounts collection is empty
 * @throws {ValidationError} if userId is invalid
 */
export async function seedChartOfAccounts(
  userId: string
): Promise<ServiceResult<number>> {
  try {
    validateUserId(userId);

    // Check if already seeded
    const exists = await hasChartOfAccounts(userId);
    if (exists) {
      return { success: true, data: 0 };
    }

    const batch = writeBatch(firestore);
    const accountsRef = collection(firestore, getAccountsPath(userId));
    const defaultAccounts = getDefaultAccountsForSeeding();

    for (const account of defaultAccounts) {
      const docRef = doc(accountsRef);
      // Use null for optional fields (Firestore rejects undefined but accepts null)
      const accountData = {
        code: account.code,
        name: account.name,
        nameAr: account.nameAr,
        type: account.type,
        normalBalance: account.normalBalance,
        isActive: account.isActive,
        createdAt: Timestamp.fromDate(account.createdAt),
        parentCode: account.parentCode ?? null,
        description: account.description ?? null,
      };
      batch.set(docRef, accountData);
    }

    await batch.commit();
    return { success: true, data: defaultAccounts.length };
  } catch (error) {
    console.error('Error seeding chart of accounts:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to seed accounts',
    };
  }
}

/**
 * Get all accounts for a user
 * @throws {ValidationError} if userId is invalid
 */
export async function getAccounts(userId: string): Promise<ServiceResult<Account[]>> {
  try {
    validateUserId(userId);
    const accountsRef = collection(firestore, getAccountsPath(userId));
    const q = query(accountsRef, orderBy('code'));
    const snapshot = await getDocs(q);

    const accounts: Account[] = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        ...convertFirestoreDates(data),
      } as Account;
    });

    return { success: true, data: accounts };
  } catch (error) {
    console.error('Error getting accounts:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get accounts',
    };
  }
}

/**
 * Get account by code
 */
export async function getAccountByCode(
  userId: string,
  code: string
): Promise<ServiceResult<Account | null>> {
  try {
    const accountsRef = collection(firestore, getAccountsPath(userId));
    const q = query(accountsRef, where('code', '==', code));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      return { success: true, data: null };
    }

    const doc = snapshot.docs[0];
    const account: Account = {
      id: doc.id,
      ...convertFirestoreDates(doc.data()),
    } as Account;

    return { success: true, data: account };
  } catch (error) {
    console.error('Error getting account by code:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get account',
    };
  }
}

// ============================================================================
// Journal Entry Operations
// ============================================================================

/**
 * Create a journal entry with validation
 *
 * Validates inputs and that debits = credits before saving.
 * @throws {ValidationError} if inputs are invalid
 */
export async function createJournalEntry(
  userId: string,
  description: string,
  date: Date,
  lines: JournalLine[],
  linkedTransactionId?: string,
  linkedPaymentId?: string,
  linkedDocumentType?: JournalEntryDocument['linkedDocumentType']
): Promise<ServiceResult<JournalEntry>> {
  try {
    // Validate inputs
    validateUserId(userId);
    validateDescription(description);
    validateDate(date);

    if (!lines || lines.length === 0) {
      return { success: false, error: 'Journal entry must have at least one line' };
    }

    // Validate debits = credits
    const validation = validateJournalEntry(lines);
    if (!validation.isValid) {
      return {
        success: false,
        error: `Journal entry is unbalanced. Debits: ${validation.totalDebits}, Credits: ${validation.totalCredits}, Difference: ${validation.difference}`,
      };
    }

    // Ensure accounts exist (seed if needed)
    await seedChartOfAccounts(userId);

    const journalRef = collection(firestore, getJournalEntriesPath(userId));
    const entryNumber = generateJournalEntryNumber();
    const now = new Date();

    // Use null for optional fields (Firestore rejects undefined but accepts null)
    // This maintains type safety and consistent document structure
    // Include totalDebits and totalCredits for server-side validation in Firestore rules
    const docData = {
      entryNumber,
      date: Timestamp.fromDate(date),
      description,
      lines,
      totalDebits: validation.totalDebits,   // For server-side validation
      totalCredits: validation.totalCredits, // For server-side validation
      status: 'posted' as const, // Auto-post for simplicity
      linkedTransactionId: linkedTransactionId ?? null,
      linkedPaymentId: linkedPaymentId ?? null,
      linkedDocumentType: linkedDocumentType ?? null,
      createdAt: Timestamp.fromDate(now),
      postedAt: Timestamp.fromDate(now),
    };

    const docRef = await addDoc(journalRef, docData);

    const entry: JournalEntry = {
      id: docRef.id,
      entryNumber,
      date,
      description,
      lines,
      status: 'posted',
      linkedTransactionId,
      linkedPaymentId,
      linkedDocumentType,
      createdAt: now,
      postedAt: now,
    };

    return { success: true, data: entry };
  } catch (error) {
    console.error('Error creating journal entry:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create journal entry',
    };
  }
}

/**
 * Create journal entry for a ledger entry (income/expense)
 * Auto-determines debit/credit accounts based on category and type.
 * @throws {ValidationError} if amount is invalid
 */
export async function createJournalEntryForLedger(
  userId: string,
  transactionId: string,
  description: string,
  amount: number,
  type: string,
  category: string,
  subCategory: string,
  date: Date,
  isARAPEntry?: boolean,
  immediateSettlement?: boolean
): Promise<ServiceResult<JournalEntry>> {
  validateAmount(amount);
  const mapping = getAccountMappingForLedgerEntry(
    type, category, subCategory, isARAPEntry, immediateSettlement
  );
  const lines = createJournalLines(mapping, amount, description);
  return createJournalEntry(userId, description, date, lines, transactionId, undefined, 'ledger');
}

/**
 * Create journal entry for a payment
 * Receipt: DR Cash, CR AR | Disbursement: DR AP, CR Cash
 * @throws {ValidationError} if amount is invalid
 */
export async function createJournalEntryForPayment(
  userId: string,
  paymentId: string,
  description: string,
  amount: number,
  paymentType: 'قبض' | 'صرف',
  date: Date,
  linkedTransactionId?: string
): Promise<ServiceResult<JournalEntry>> {
  validateAmount(amount);
  const mapping = getAccountMappingForPayment(paymentType);
  const lines = createJournalLines(mapping, amount, description);
  return createJournalEntry(userId, description, date, lines, linkedTransactionId, paymentId, 'payment');
}

/**
 * Create journal entry for COGS (inventory exit)
 * DR COGS, CR Inventory
 * @throws {ValidationError} if amount is invalid
 */
export async function createJournalEntryForCOGS(
  userId: string,
  description: string,
  amount: number,
  date: Date,
  linkedTransactionId?: string
): Promise<ServiceResult<JournalEntry>> {
  validateAmount(amount);
  const mapping = getAccountMappingForCOGS();
  const lines = createJournalLines(mapping, amount, description);
  return createJournalEntry(userId, description, date, lines, linkedTransactionId, undefined, 'inventory');
}

/**
 * Create journal entry for depreciation
 * DR Depreciation Expense, CR Accumulated Depreciation
 * @throws {ValidationError} if amount is invalid
 */
export async function createJournalEntryForDepreciation(
  userId: string,
  description: string,
  amount: number,
  date: Date,
  linkedTransactionId?: string
): Promise<ServiceResult<JournalEntry>> {
  validateAmount(amount);
  const mapping = getAccountMappingForDepreciation();
  const lines = createJournalLines(mapping, amount, description);
  return createJournalEntry(userId, description, date, lines, linkedTransactionId, undefined, 'depreciation');
}

/**
 * Create journal entry for fixed asset purchase
 * DR Fixed Assets (1500), CR Cash (1100) or AP (2100)
 * @throws {ValidationError} if amount is invalid
 */
export async function createJournalEntryForFixedAssetPurchase(
  userId: string,
  description: string,
  amount: number,
  date: Date,
  isPaidImmediately: boolean,
  linkedTransactionId?: string
): Promise<ServiceResult<JournalEntry>> {
  validateAmount(amount);
  const mapping = getAccountMappingForFixedAssetPurchase(isPaidImmediately);
  const lines = createJournalLines(mapping, amount, description);
  return createJournalEntry(userId, description, date, lines, linkedTransactionId, undefined, 'fixed_asset');
}

/**
 * Create journal entry for bad debt writeoff
 * DR Bad Debt Expense, CR Accounts Receivable
 * @throws {ValidationError} if amount is invalid
 */
export async function createJournalEntryForBadDebt(
  userId: string,
  description: string,
  amount: number,
  date: Date,
  linkedTransactionId?: string
): Promise<ServiceResult<JournalEntry>> {
  validateAmount(amount);
  const mapping = getAccountMappingForBadDebt();
  const lines = createJournalLines(mapping, amount, description);
  return createJournalEntry(userId, description, date, lines, linkedTransactionId, undefined, 'ledger');
}

// ============================================================================
// Batch Operations (for atomic transactions with ledger)
// ============================================================================

/**
 * Data required for adding a journal entry to a batch
 */
export interface JournalEntryBatchData {
  transactionId: string;
  description: string;
  amount: number;
  type: string;
  category: string;
  subCategory: string;
  date: Date;
  isARAPEntry?: boolean;
  immediateSettlement?: boolean;
}

/**
 * Data required for adding a COGS journal entry to a batch
 */
export interface COGSJournalEntryBatchData {
  description: string;
  amount: number;
  date: Date;
  linkedTransactionId?: string;
}

/**
 * Internal helper to add a validated journal entry to a batch.
 * Reduces duplication between different batch entry types.
 */
function addValidatedJournalEntryToBatch(
  batch: WriteBatch,
  userId: string,
  lines: JournalLine[],
  description: string,
  date: Date,
  linkedTransactionId: string | null,
  linkedDocumentType: 'ledger' | 'inventory' | 'fixed_asset'
): void {
  const journalRef = collection(firestore, getJournalEntriesPath(userId));
  const docRef = doc(journalRef);
  const entryNumber = generateJournalEntryNumber();
  const now = new Date();

  batch.set(docRef, {
    entryNumber,
    date: Timestamp.fromDate(date),
    description,
    lines,
    status: 'posted' as const,
    linkedTransactionId,
    linkedPaymentId: null,
    linkedDocumentType,
    createdAt: Timestamp.fromDate(now),
    postedAt: Timestamp.fromDate(now),
  });
}

/**
 * Add a journal entry for a ledger entry to an existing WriteBatch.
 * Use this for atomic operations where ledger and journal must succeed together.
 *
 * @throws {ValidationError} if inputs are invalid or entry is unbalanced
 */
export function addJournalEntryToBatch(
  batch: WriteBatch,
  userId: string,
  data: JournalEntryBatchData
): void {
  validateUserId(userId);
  validateAmount(data.amount);
  validateDescription(data.description);
  validateDate(data.date);

  const mapping = getAccountMappingForLedgerEntry(
    data.type,
    data.category,
    data.subCategory,
    data.isARAPEntry,
    data.immediateSettlement
  );
  const lines = createJournalLines(mapping, data.amount, data.description);

  const validation = validateJournalEntry(lines);
  if (!validation.isValid) {
    throw new ValidationError(
      `Journal entry is unbalanced. Debits: ${validation.totalDebits}, Credits: ${validation.totalCredits}`
    );
  }

  addValidatedJournalEntryToBatch(
    batch,
    userId,
    lines,
    data.description,
    data.date,
    data.transactionId,
    'ledger'
  );
}

/**
 * Add a COGS journal entry to an existing WriteBatch.
 * Use this for atomic operations where inventory COGS and journal must succeed together.
 *
 * @throws {ValidationError} if inputs are invalid or entry is unbalanced
 */
export function addCOGSJournalEntryToBatch(
  batch: WriteBatch,
  userId: string,
  data: COGSJournalEntryBatchData
): void {
  validateUserId(userId);
  validateAmount(data.amount);
  validateDescription(data.description);
  validateDate(data.date);

  const mapping = getAccountMappingForCOGS();
  const lines = createJournalLines(mapping, data.amount, data.description);

  const validation = validateJournalEntry(lines);
  if (!validation.isValid) {
    throw new ValidationError(
      `COGS journal entry is unbalanced. Debits: ${validation.totalDebits}, Credits: ${validation.totalCredits}`
    );
  }

  addValidatedJournalEntryToBatch(
    batch,
    userId,
    lines,
    data.description,
    data.date,
    data.linkedTransactionId ?? null,
    'inventory'
  );
}

/**
 * Data required for adding a fixed asset purchase journal entry to a batch
 */
export interface FixedAssetPurchaseJournalEntryBatchData {
  description: string;
  amount: number;
  date: Date;
  linkedTransactionId?: string;
  isPaidImmediately: boolean;
}

/**
 * Add a Fixed Asset Purchase journal entry to an existing WriteBatch.
 * Use this when creating a fixed asset through the ledger to ensure correct capitalization.
 *
 * Creates: DR Fixed Assets (1500), CR Cash (1100) or AP (2100)
 *
 * @throws {ValidationError} if inputs are invalid or entry is unbalanced
 */
export function addFixedAssetPurchaseJournalEntryToBatch(
  batch: WriteBatch,
  userId: string,
  data: FixedAssetPurchaseJournalEntryBatchData
): void {
  validateUserId(userId);
  validateAmount(data.amount);
  validateDescription(data.description);
  validateDate(data.date);

  const mapping = getAccountMappingForFixedAssetPurchase(data.isPaidImmediately);
  const lines = createJournalLines(mapping, data.amount, data.description);

  const validation = validateJournalEntry(lines);
  if (!validation.isValid) {
    throw new ValidationError(
      `Fixed asset purchase journal entry is unbalanced. Debits: ${validation.totalDebits}, Credits: ${validation.totalCredits}`
    );
  }

  addValidatedJournalEntryToBatch(
    batch,
    userId,
    lines,
    data.description,
    data.date,
    data.linkedTransactionId ?? null,
    'fixed_asset'
  );
}

/**
 * Create a reversing journal entry
 *
 * Creates a new entry that reverses the debits/credits of the original.
 */
export async function reverseJournalEntry(
  userId: string,
  originalEntryId: string,
  reason: string
): Promise<ServiceResult<JournalEntry>> {
  try {
    const entryRef = doc(firestore, getJournalEntriesPath(userId), originalEntryId);
    const entryDoc = await getDoc(entryRef);

    if (!entryDoc.exists()) {
      return { success: false, error: 'Original entry not found' };
    }

    const original = convertFirestoreDates(entryDoc.data()) as JournalEntryDocument;

    if (original.status === 'reversed') {
      return { success: false, error: 'Entry has already been reversed' };
    }

    // Create reversing lines (swap debits and credits)
    const reversingLines: JournalLine[] = original.lines.map((line) => ({
      ...line,
      debit: line.credit,
      credit: line.debit,
    }));

    const description = `عكس قيد: ${original.description} - ${reason}`;
    const result = await createJournalEntry(
      userId,
      description,
      new Date(),
      reversingLines,
      original.linkedTransactionId,
      original.linkedPaymentId,
      original.linkedDocumentType
    );

    if (result.success && result.data) {
      // Mark original as reversed
      await updateDoc(entryRef, {
        status: 'reversed',
        reversedById: result.data.id,
        updatedAt: Timestamp.fromDate(new Date()),
      });

      // Mark reversing entry with reference
      const reversingRef = doc(firestore, getJournalEntriesPath(userId), result.data.id);
      await updateDoc(reversingRef, {
        reversesEntryId: originalEntryId,
      });
    }

    return result;
  } catch (error) {
    console.error('Error reversing journal entry:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to reverse entry',
    };
  }
}

/**
 * Get all journal entries (optionally filtered by date range)
 */
export async function getJournalEntries(
  userId: string,
  startDate?: Date,
  endDate?: Date
): Promise<ServiceResult<JournalEntry[]>> {
  try {
    const journalRef = collection(firestore, getJournalEntriesPath(userId));
    // Safety limit to prevent fetching unbounded data
    const q = query(journalRef, orderBy('date', 'desc'), limit(5000));

    const snapshot = await getDocs(q);
    let entries: JournalEntry[] = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...convertFirestoreDates(doc.data()),
    })) as JournalEntry[];

    // Filter by date range if provided
    if (startDate || endDate) {
      entries = entries.filter((entry) => {
        const entryDate = entry.date;
        if (startDate && entryDate < startDate) {
          return false;
        }
        if (endDate && entryDate > endDate) {
          return false;
        }
        return true;
      });
    }

    return { success: true, data: entries };
  } catch (error) {
    console.error('Error getting journal entries:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get entries',
    };
  }
}

// ============================================================================
// Account Balance Calculations
// ============================================================================

/**
 * Calculate balance for a single account from journal entries
 */
export async function getAccountBalance(
  userId: string,
  accountCode: string,
  asOfDate?: Date
): Promise<ServiceResult<AccountBalance>> {
  try {
    const entriesResult = await getJournalEntries(userId, undefined, asOfDate);
    if (!entriesResult.success || !entriesResult.data) {
      return { success: false, error: entriesResult.error };
    }

    let totalDebits = 0;
    let totalCredits = 0;

    // Only count posted entries
    const postedEntries = entriesResult.data.filter((e) => e.status === 'posted');

    for (const entry of postedEntries) {
      for (const line of entry.lines) {
        if (line.accountCode === accountCode) {
          totalDebits = safeAdd(totalDebits, line.debit);
          totalCredits = safeAdd(totalCredits, line.credit);
        }
      }
    }

    const accountType = getAccountTypeFromCode(accountCode);
    const normalBalance = getNormalBalance(accountType);
    const balance = calculateAccountBalance(totalDebits, totalCredits, normalBalance);

    // Handle contra-asset (accumulated depreciation)
    const isContraAsset = accountCode === ACCOUNT_CODES.ACCUMULATED_DEPRECIATION;
    const adjustedBalance = isContraAsset ? -balance : balance;

    return {
      success: true,
      data: {
        accountCode,
        accountName: accountCode,
        accountNameAr: getAccountNameAr(accountCode),
        accountType,
        totalDebits: roundCurrency(totalDebits),
        totalCredits: roundCurrency(totalCredits),
        balance: roundCurrency(adjustedBalance),
      },
    };
  } catch (error) {
    console.error('Error calculating account balance:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to calculate balance',
    };
  }
}

/**
 * Calculate trial balance (all accounts with balances)
 */
export async function getTrialBalance(
  userId: string,
  asOfDate?: Date
): Promise<ServiceResult<TrialBalanceSummary>> {
  try {
    // Ensure accounts exist
    await seedChartOfAccounts(userId);

    const accountsResult = await getAccounts(userId);
    if (!accountsResult.success || !accountsResult.data) {
      return { success: false, error: accountsResult.error };
    }

    const entriesResult = await getJournalEntries(userId, undefined, asOfDate);
    if (!entriesResult.success || !entriesResult.data) {
      return { success: false, error: entriesResult.error };
    }

    // Build account balances map
    const balanceMap = new Map<string, { debits: number; credits: number }>();

    // Initialize all accounts
    for (const account of accountsResult.data) {
      balanceMap.set(account.code, { debits: 0, credits: 0 });
    }

    // Sum up journal entry lines
    const postedEntries = entriesResult.data.filter((e) => e.status === 'posted');
    for (const entry of postedEntries) {
      for (const line of entry.lines) {
        const current = balanceMap.get(line.accountCode) || { debits: 0, credits: 0 };
        balanceMap.set(line.accountCode, {
          debits: safeAdd(current.debits, line.debit),
          credits: safeAdd(current.credits, line.credit),
        });
      }
    }

    // Build account balances array
    const accountBalances: AccountBalance[] = [];
    let totalDebits = 0;
    let totalCredits = 0;

    for (const account of accountsResult.data) {
      const totals = balanceMap.get(account.code);
      if (!totals || (totals.debits === 0 && totals.credits === 0)) {
        continue; // Skip accounts with no activity
      }

      const balance = calculateAccountBalance(
        totals.debits,
        totals.credits,
        account.normalBalance
      );

      // Handle contra-asset
      const isContraAsset = account.code === ACCOUNT_CODES.ACCUMULATED_DEPRECIATION;
      const adjustedBalance = isContraAsset ? -balance : balance;

      accountBalances.push({
        accountCode: account.code,
        accountName: account.name,
        accountNameAr: account.nameAr,
        accountType: account.type,
        totalDebits: roundCurrency(totals.debits),
        totalCredits: roundCurrency(totals.credits),
        balance: roundCurrency(adjustedBalance),
      });

      totalDebits = safeAdd(totalDebits, totals.debits);
      totalCredits = safeAdd(totalCredits, totals.credits);
    }

    // Sort by account code
    accountBalances.sort((a, b) => a.accountCode.localeCompare(b.accountCode));

    const difference = Math.abs(safeSubtract(totalDebits, totalCredits));
    const isBalanced = difference < 0.01;

    return {
      success: true,
      data: {
        accounts: accountBalances,
        totalDebits: roundCurrency(totalDebits),
        totalCredits: roundCurrency(totalCredits),
        isBalanced,
        difference: roundCurrency(difference),
        asOfDate: asOfDate || new Date(),
      },
    };
  } catch (error) {
    console.error('Error calculating trial balance:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to calculate trial balance',
    };
  }
}

/**
 * Calculate balance sheet
 */
export async function getBalanceSheet(
  userId: string,
  asOfDate?: Date
): Promise<ServiceResult<BalanceSheet>> {
  try {
    const trialResult = await getTrialBalance(userId, asOfDate);
    if (!trialResult.success || !trialResult.data) {
      return { success: false, error: trialResult.error };
    }

    const accounts = trialResult.data.accounts;

    // Group by type
    const assets = accounts.filter((a) => a.accountType === 'asset');
    const liabilities = accounts.filter((a) => a.accountType === 'liability');
    const equity = accounts.filter((a) => a.accountType === 'equity');

    // Calculate totals
    const totalAssets = assets.reduce((sum, a) => safeAdd(sum, a.balance), 0);
    const totalLiabilities = liabilities.reduce((sum, a) => safeAdd(sum, a.balance), 0);
    const totalEquity = equity.reduce((sum, a) => safeAdd(sum, a.balance), 0);

    // Add net income to equity (Revenue - Expenses)
    const revenues = accounts.filter((a) => a.accountType === 'revenue');
    const expenses = accounts.filter((a) => a.accountType === 'expense');
    const totalRevenue = revenues.reduce((sum, a) => safeAdd(sum, a.balance), 0);
    const totalExpenses = expenses.reduce((sum, a) => safeAdd(sum, a.balance), 0);
    const netIncome = safeSubtract(totalRevenue, totalExpenses);

    const totalEquityWithNetIncome = safeAdd(totalEquity, netIncome);
    const totalLiabilitiesAndEquity = safeAdd(totalLiabilities, totalEquityWithNetIncome);

    const difference = Math.abs(safeSubtract(totalAssets, totalLiabilitiesAndEquity));
    const isBalanced = difference < 0.01;

    // Add net income as a pseudo-account in equity section
    if (netIncome !== 0) {
      equity.push({
        accountCode: 'NET_INCOME',
        accountName: 'Net Income (Current Period)',
        accountNameAr: 'صافي الدخل (الفترة الحالية)',
        accountType: 'equity',
        totalDebits: 0,
        totalCredits: 0,
        balance: roundCurrency(netIncome),
      });
    }

    return {
      success: true,
      data: {
        asOfDate: asOfDate || new Date(),
        assets: {
          title: 'Assets',
          titleAr: 'الأصول',
          accounts: assets,
          total: roundCurrency(totalAssets),
        },
        liabilities: {
          title: 'Liabilities',
          titleAr: 'الالتزامات',
          accounts: liabilities,
          total: roundCurrency(totalLiabilities),
        },
        equity: {
          title: 'Equity',
          titleAr: 'حقوق الملكية',
          accounts: equity,
          total: roundCurrency(totalEquityWithNetIncome),
        },
        totalAssets: roundCurrency(totalAssets),
        totalLiabilitiesAndEquity: roundCurrency(totalLiabilitiesAndEquity),
        isBalanced,
        difference: roundCurrency(difference),
      },
    };
  } catch (error) {
    console.error('Error calculating balance sheet:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to calculate balance sheet',
    };
  }
}

/**
 * Delete journal entries linked to a transaction
 * Used when deleting a ledger entry
 */
export async function deleteJournalEntriesByTransaction(
  userId: string,
  transactionId: string
): Promise<ServiceResult<number>> {
  return deleteJournalEntriesByField(userId, 'linkedTransactionId', transactionId);
}

/**
 * Delete journal entries linked to a payment
 */
export async function deleteJournalEntriesByPayment(
  userId: string,
  paymentId: string
): Promise<ServiceResult<number>> {
  return deleteJournalEntriesByField(userId, 'linkedPaymentId', paymentId);
}

/**
 * Migrate existing fixed assets that were incorrectly recorded as expenses
 * Creates correcting journal entries: DR Fixed Assets (1500), CR Expense (5xxx)
 *
 * This function:
 * 1. Finds all fixed assets with linkedTransactionId
 * 2. Finds the related journal entry
 * 3. If the journal entry debits an expense account (5xxx), creates a correction
 *
 * @returns Array of corrected transaction IDs
 */
export async function migrateFixedAssetJournalEntries(
  userId: string
): Promise<ServiceResult<{ corrected: string[]; skipped: string[]; errors: string[] }>> {
  try {
    const fixedAssetsPath = `users/${userId}/fixed_assets`;
    const fixedAssetsRef = collection(firestore, fixedAssetsPath);
    const assetsSnapshot = await getDocs(query(fixedAssetsRef, where('linkedTransactionId', '!=', null)));

    const corrected: string[] = [];
    const skipped: string[] = [];
    const errors: string[] = [];

    for (const assetDoc of assetsSnapshot.docs) {
      const asset = assetDoc.data();
      const transactionId = asset.linkedTransactionId;

      if (!transactionId) {
        skipped.push(assetDoc.id);
        continue;
      }

      // Find journal entries linked to this transaction
      const journalRef = collection(firestore, getJournalEntriesPath(userId));
      const journalQuery = query(journalRef, where('linkedTransactionId', '==', transactionId));
      const journalSnapshot = await getDocs(journalQuery);

      if (journalSnapshot.empty) {
        skipped.push(assetDoc.id);
        continue;
      }

      // Check if the journal entry debits an expense account
      const journalDoc = journalSnapshot.docs[0];
      const journalData = journalDoc.data();
      const lines = journalData.lines || [];

      // Find the debit line
      const debitLine = lines.find((line: JournalLine) => line.debit > 0);
      if (!debitLine) {
        skipped.push(assetDoc.id);
        continue;
      }

      // Check if it's an expense account (starts with 5)
      const isExpenseAccount = debitLine.accountCode.startsWith('5');

      // Also check if Fixed Assets account is already correctly debited
      const isAlreadyFixedAsset = debitLine.accountCode === ACCOUNT_CODES.FIXED_ASSETS;

      if (isAlreadyFixedAsset) {
        skipped.push(assetDoc.id);
        continue;
      }

      if (!isExpenseAccount) {
        skipped.push(assetDoc.id);
        continue;
      }

      // Create correcting journal entry
      // DR Fixed Assets (1500), CR Expense (5xxx)
      const amount = asset.purchaseCost || debitLine.debit;
      const expenseAccountCode = debitLine.accountCode;

      const correctionLines: JournalLine[] = [
        {
          accountCode: ACCOUNT_CODES.FIXED_ASSETS,
          accountName: ACCOUNT_CODES.FIXED_ASSETS,
          accountNameAr: getAccountNameAr(ACCOUNT_CODES.FIXED_ASSETS),
          description: `تصحيح: شراء أصل ثابت - ${asset.assetName || 'غير معروف'}`,
          debit: amount,
          credit: 0,
        },
        {
          accountCode: expenseAccountCode,
          accountName: expenseAccountCode,
          accountNameAr: debitLine.accountNameAr || 'مصروفات',
          description: `تصحيح: عكس تسجيل مصروف خاطئ - ${asset.assetName || 'غير معروف'}`,
          debit: 0,
          credit: amount,
        },
      ];

      try {
        const result = await createJournalEntry(
          userId,
          `تصحيح قيد أصل ثابت: ${asset.assetName || transactionId}`,
          new Date(),
          correctionLines,
          transactionId,
          undefined,
          'fixed_asset_correction'
        );

        if (result.success) {
          corrected.push(assetDoc.id);
        } else {
          errors.push(`${assetDoc.id}: ${result.error}`);
        }
      } catch (err) {
        errors.push(`${assetDoc.id}: ${err instanceof Error ? err.message : 'Unknown error'}`);
      }
    }

    return {
      success: true,
      data: { corrected, skipped, errors },
    };
  } catch (error) {
    console.error('Error migrating fixed asset journal entries:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to migrate fixed asset journal entries',
    };
  }
}

// ============================================================================
// Orphaned Journal Entry Cleanup
// ============================================================================

export interface OrphanCleanupResult {
  orphanedByTransaction: string[];
  orphanedByPayment: string[];
  unlinkedEntries: string[];
  deleted: string[];
  errors: string[];
}

export interface JournalDiagnostics {
  totalEntries: number;
  linkedToTransaction: number;
  linkedToPayment: number;
  unlinked: number;
  orphanedByTransaction: number;
  orphanedByPayment: number;
  entriesByAccount: Record<string, { debits: number; credits: number; count: number }>;
}

export interface JournalMismatch {
  journalId: string;
  linkedId: string;
  linkType: 'transaction' | 'payment';
  journalCashAmount: number;
  sourceAmount: number;
  difference: number;
  description: string;
}

export interface JournalAuditResult {
  totalJournalCashDebits: number;
  totalJournalCashCredits: number;
  totalLedgerCashIn: number;
  totalLedgerCashOut: number;
  totalPaymentCashIn: number;
  totalPaymentCashOut: number;
  mismatches: JournalMismatch[];
  duplicates: { transactionId: string; count: number; journalIds: string[] }[];
}

/**
 * Diagnose journal entries to understand what's affecting the balance
 */
export async function diagnoseJournalEntries(
  userId: string
): Promise<ServiceResult<JournalDiagnostics>> {
  try {
    const journalRef = collection(firestore, getJournalEntriesPath(userId));
    const ledgerRef = collection(firestore, getLedgerPath(userId));
    const paymentsRef = collection(firestore, getPaymentsPath(userId));

    // Get all data
    const [journalSnapshot, ledgerSnapshot, paymentsSnapshot] = await Promise.all([
      getDocs(journalRef),
      getDocs(ledgerRef),
      getDocs(paymentsRef),
    ]);

    // Build valid ID sets
    const validTransactionIds = new Set<string>();
    ledgerSnapshot.docs.forEach((docSnap) => {
      const data = docSnap.data();
      if (data.transactionId) {
        validTransactionIds.add(data.transactionId);
      }
    });

    const validPaymentIds = new Set<string>();
    paymentsSnapshot.docs.forEach((docSnap) => {
      validPaymentIds.add(docSnap.id);
    });

    // Analyze entries
    let linkedToTransaction = 0;
    let linkedToPayment = 0;
    let unlinked = 0;
    let orphanedByTransaction = 0;
    let orphanedByPayment = 0;
    const entriesByAccount: Record<string, { debits: number; credits: number; count: number }> = {};

    journalSnapshot.docs.forEach((docSnap) => {
      const data = docSnap.data();
      const lines = data.lines || [];

      // Track links
      const hasTransactionLink = !!data.linkedTransactionId;
      const hasPaymentLink = !!data.linkedPaymentId;

      if (hasTransactionLink) {
        linkedToTransaction++;
        if (!validTransactionIds.has(data.linkedTransactionId)) {
          orphanedByTransaction++;
        }
      }

      if (hasPaymentLink) {
        linkedToPayment++;
        if (!validPaymentIds.has(data.linkedPaymentId)) {
          orphanedByPayment++;
        }
      }

      if (!hasTransactionLink && !hasPaymentLink) {
        unlinked++;
      }

      // Track by account
      lines.forEach((line: JournalLine) => {
        const code = line.accountCode;
        if (!entriesByAccount[code]) {
          entriesByAccount[code] = { debits: 0, credits: 0, count: 0 };
        }
        entriesByAccount[code].debits += line.debit || 0;
        entriesByAccount[code].credits += line.credit || 0;
        entriesByAccount[code].count++;
      });
    });

    return {
      success: true,
      data: {
        totalEntries: journalSnapshot.size,
        linkedToTransaction,
        linkedToPayment,
        unlinked,
        orphanedByTransaction,
        orphanedByPayment,
        entriesByAccount,
      },
    };
  } catch (error) {
    console.error('Error diagnosing journal entries:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to diagnose journal entries',
    };
  }
}

/**
 * Audit journal entries vs source data to find discrepancies
 * Compares journal entry cash amounts with ledger/payment amounts
 */
export async function auditJournalEntries(
  userId: string
): Promise<ServiceResult<JournalAuditResult>> {
  try {
    const journalRef = collection(firestore, getJournalEntriesPath(userId));
    const ledgerRef = collection(firestore, getLedgerPath(userId));
    const paymentsRef = collection(firestore, getPaymentsPath(userId));

    // Get all data
    const [journalSnapshot, ledgerSnapshot, paymentsSnapshot] = await Promise.all([
      getDocs(journalRef),
      getDocs(ledgerRef),
      getDocs(paymentsRef),
    ]);

    // Build ledger map by transactionId
    const ledgerByTransactionId = new Map<string, { amount: number; type: string; category: string; status: string }>();
    let totalLedgerCashIn = 0;
    let totalLedgerCashOut = 0;

    ledgerSnapshot.docs.forEach((docSnap) => {
      const data = docSnap.data();
      if (data.transactionId) {
        ledgerByTransactionId.set(data.transactionId, {
          amount: data.amount || 0,
          type: data.type || '',
          category: data.category || '',
          status: data.status || '',
        });
      }
      // Calculate cash totals from ledger (paid items only affect cash)
      if (data.status === 'مدفوع' || data.status === 'paid') {
        if (data.type === 'دخل') {
          totalLedgerCashIn += data.amount || 0;
        } else if (data.type === 'مصروف') {
          totalLedgerCashOut += data.amount || 0;
        }
      }
    });

    // Build payment map by ID
    const paymentsById = new Map<string, { amount: number; type: string }>();
    let totalPaymentCashIn = 0;
    let totalPaymentCashOut = 0;

    paymentsSnapshot.docs.forEach((docSnap) => {
      const data = docSnap.data();
      paymentsById.set(docSnap.id, {
        amount: data.amount || 0,
        type: data.type || '',
      });
      if (data.type === 'قبض') {
        totalPaymentCashIn += data.amount || 0;
      } else if (data.type === 'صرف') {
        totalPaymentCashOut += data.amount || 0;
      }
    });

    // Track journal entries by linked transaction for duplicate detection
    const journalsByTransaction = new Map<string, string[]>();

    let totalJournalCashDebits = 0;
    let totalJournalCashCredits = 0;
    const mismatches: JournalMismatch[] = [];

    // Analyze each journal entry
    journalSnapshot.docs.forEach((docSnap) => {
      const data = docSnap.data();
      const lines = data.lines || [];
      const linkedTransactionId = data.linkedTransactionId;
      const linkedPaymentId = data.linkedPaymentId;

      // Track cash movements in this journal entry
      let journalCashDebit = 0;
      let journalCashCredit = 0;

      lines.forEach((line: JournalLine) => {
        // Cash accounts: 1000 (النقدية) or 1100 (النقدية في الصندوق)
        if (line.accountCode === '1000' || line.accountCode === '1100') {
          journalCashDebit += line.debit || 0;
          journalCashCredit += line.credit || 0;
        }
      });

      totalJournalCashDebits += journalCashDebit;
      totalJournalCashCredits += journalCashCredit;

      // Track duplicates
      if (linkedTransactionId) {
        if (!journalsByTransaction.has(linkedTransactionId)) {
          journalsByTransaction.set(linkedTransactionId, []);
        }
        journalsByTransaction.get(linkedTransactionId)!.push(docSnap.id);
      }

      // Check for amount mismatches with ledger
      if (linkedTransactionId && ledgerByTransactionId.has(linkedTransactionId)) {
        const ledgerEntry = ledgerByTransactionId.get(linkedTransactionId)!;
        const journalCashAmount = journalCashDebit > 0 ? journalCashDebit : journalCashCredit;

        // Only compare cash amounts for paid transactions
        if ((ledgerEntry.status === 'مدفوع' || ledgerEntry.status === 'paid') &&
            Math.abs(journalCashAmount - ledgerEntry.amount) > 0.01) {
          mismatches.push({
            journalId: docSnap.id,
            linkedId: linkedTransactionId,
            linkType: 'transaction',
            journalCashAmount,
            sourceAmount: ledgerEntry.amount,
            difference: journalCashAmount - ledgerEntry.amount,
            description: data.description || '',
          });
        }
      }

      // Check for amount mismatches with payments
      if (linkedPaymentId && paymentsById.has(linkedPaymentId)) {
        const payment = paymentsById.get(linkedPaymentId)!;
        const journalCashAmount = journalCashDebit > 0 ? journalCashDebit : journalCashCredit;

        if (Math.abs(journalCashAmount - payment.amount) > 0.01) {
          mismatches.push({
            journalId: docSnap.id,
            linkedId: linkedPaymentId,
            linkType: 'payment',
            journalCashAmount,
            sourceAmount: payment.amount,
            difference: journalCashAmount - payment.amount,
            description: data.description || '',
          });
        }
      }
    });

    // Find duplicates
    const duplicates: { transactionId: string; count: number; journalIds: string[] }[] = [];
    journalsByTransaction.forEach((journalIds, transactionId) => {
      if (journalIds.length > 1) {
        duplicates.push({
          transactionId,
          count: journalIds.length,
          journalIds,
        });
      }
    });

    return {
      success: true,
      data: {
        totalJournalCashDebits,
        totalJournalCashCredits,
        totalLedgerCashIn,
        totalLedgerCashOut,
        totalPaymentCashIn,
        totalPaymentCashOut,
        mismatches,
        duplicates,
      },
    };
  } catch (error) {
    console.error('Error auditing journal entries:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to audit journal entries',
    };
  }
}

/**
 * Find and optionally delete orphaned journal entries
 * Orphaned entries are those linked to transactions/payments that no longer exist
 * Also includes entries with no links at all (created during development)
 */
export async function cleanupOrphanedJournalEntries(
  userId: string,
  dryRun: boolean = true,
  includeUnlinked: boolean = false
): Promise<ServiceResult<OrphanCleanupResult>> {
  try {
    const journalRef = collection(firestore, getJournalEntriesPath(userId));
    const ledgerRef = collection(firestore, getLedgerPath(userId));
    const paymentsRef = collection(firestore, getPaymentsPath(userId));

    // Get all journal entries
    const journalSnapshot = await getDocs(journalRef);

    // Get all ledger transaction IDs
    const ledgerSnapshot = await getDocs(ledgerRef);
    const validTransactionIds = new Set<string>();
    ledgerSnapshot.docs.forEach((docSnap) => {
      const data = docSnap.data();
      if (data.transactionId) {
        validTransactionIds.add(data.transactionId);
      }
    });

    // Get all payment IDs
    const paymentsSnapshot = await getDocs(paymentsRef);
    const validPaymentIds = new Set<string>();
    paymentsSnapshot.docs.forEach((docSnap) => {
      validPaymentIds.add(docSnap.id);
    });

    const orphanedByTransaction: string[] = [];
    const orphanedByPayment: string[] = [];
    const unlinkedEntries: string[] = [];
    const deleted: string[] = [];
    const errors: string[] = [];

    // Find orphaned entries
    for (const docSnap of journalSnapshot.docs) {
      const data = docSnap.data();
      const linkedTransactionId = data.linkedTransactionId;
      const linkedPaymentId = data.linkedPaymentId;

      let shouldDelete = false;

      // Check if linked transaction exists
      if (linkedTransactionId && !validTransactionIds.has(linkedTransactionId)) {
        shouldDelete = true;
        orphanedByTransaction.push(docSnap.id);
      }

      // Check if linked payment exists
      if (linkedPaymentId && !validPaymentIds.has(linkedPaymentId)) {
        shouldDelete = true;
        if (!orphanedByTransaction.includes(docSnap.id)) {
          orphanedByPayment.push(docSnap.id);
        }
      }

      // Check for unlinked entries (no transaction or payment link)
      if (!linkedTransactionId && !linkedPaymentId) {
        unlinkedEntries.push(docSnap.id);
        if (includeUnlinked) {
          shouldDelete = true;
        }
      }

      // Delete if not a dry run
      if (shouldDelete && !dryRun) {
        try {
          const batch = writeBatch(firestore);
          batch.delete(docSnap.ref);
          await batch.commit();
          deleted.push(docSnap.id);
        } catch (err) {
          errors.push(`Failed to delete ${docSnap.id}: ${err instanceof Error ? err.message : 'Unknown error'}`);
        }
      }
    }

    return {
      success: true,
      data: {
        orphanedByTransaction,
        orphanedByPayment,
        unlinkedEntries,
        deleted,
        errors,
      },
    };
  } catch (error) {
    console.error('Error cleaning up orphaned journal entries:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to cleanup orphaned journal entries',
    };
  }
}

/**
 * Result type for duplicate cleanup
 */
export interface DuplicateCleanupResult {
  duplicatesFound: number;
  entriesDeleted: number;
  transactionsAffected: string[];
  errors: string[];
}

/**
 * Clean up duplicate journal entries
 * Keeps the oldest entry for each transaction and deletes duplicates
 */
export async function cleanupDuplicateJournalEntries(
  userId: string,
  dryRun: boolean = true
): Promise<ServiceResult<DuplicateCleanupResult>> {
  try {
    const journalRef = collection(firestore, getJournalEntriesPath(userId));
    const journalSnapshot = await getDocs(journalRef);

    // Group journal entries by linkedTransactionId
    const entriesByTransaction = new Map<string, { id: string; createdAt: Date }[]>();

    journalSnapshot.docs.forEach((docSnap) => {
      const data = docSnap.data();
      const linkedTransactionId = data.linkedTransactionId;

      if (linkedTransactionId) {
        if (!entriesByTransaction.has(linkedTransactionId)) {
          entriesByTransaction.set(linkedTransactionId, []);
        }
        entriesByTransaction.get(linkedTransactionId)!.push({
          id: docSnap.id,
          createdAt: data.createdAt?.toDate?.() || new Date(0),
        });
      }
    });

    // Find duplicates (transactions with more than one journal entry)
    const duplicateTransactions: string[] = [];
    const entriesToDelete: string[] = [];

    entriesByTransaction.forEach((entries, transactionId) => {
      if (entries.length > 1) {
        duplicateTransactions.push(transactionId);
        // Sort by createdAt, keep the oldest (first), delete the rest
        entries.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
        // Skip the first (oldest), delete the rest
        for (let i = 1; i < entries.length; i++) {
          entriesToDelete.push(entries[i].id);
        }
      }
    });

    const errors: string[] = [];
    let entriesDeleted = 0;

    if (!dryRun && entriesToDelete.length > 0) {
      // Delete in batches of 500 (Firestore limit)
      const batchSize = 500;
      for (let i = 0; i < entriesToDelete.length; i += batchSize) {
        const batch = writeBatch(firestore);
        const batchEntries = entriesToDelete.slice(i, i + batchSize);

        for (const entryId of batchEntries) {
          const entryRef = doc(firestore, getJournalEntriesPath(userId), entryId);
          batch.delete(entryRef);
        }

        try {
          await batch.commit();
          entriesDeleted += batchEntries.length;
        } catch (err) {
          errors.push(`Batch delete failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
        }
      }
    }

    return {
      success: true,
      data: {
        duplicatesFound: entriesToDelete.length,
        entriesDeleted: dryRun ? 0 : entriesDeleted,
        transactionsAffected: duplicateTransactions,
        errors,
      },
    };
  } catch (error) {
    console.error('Error cleaning up duplicate journal entries:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to cleanup duplicate journal entries',
    };
  }
}

// ============================================================================
// Loan Journal Entry Migration
// ============================================================================

export interface LoanMigrationResult {
  corrected: string[];
  skipped: string[];
  errors: string[];
}

/**
 * Migrate loan journal entries from incorrect expense mapping to correct loan accounts
 *
 * Problem: Loan transactions (type "قرض") were falling through to default expense mapping
 * - DR Other Expenses (5530), CR Cash (1000)
 *
 * Correct mapping:
 * - Loan Given (قروض ممنوحة): DR Loans Receivable (1600), CR Cash (1000)
 * - Loan Received (قروض مستلمة): DR Cash (1000), CR Loans Payable (2300)
 *
 * This function creates correcting journal entries:
 * - For loan given wrongly recorded as expense: DR Loans Receivable (1600), CR Expense (5xxx)
 * - For loan received wrongly recorded as expense: DR Expense (5xxx), CR Loans Payable (2300)
 */
export async function migrateLoanJournalEntries(
  userId: string
): Promise<ServiceResult<LoanMigrationResult>> {
  try {
    const ledgerRef = collection(firestore, getLedgerPath(userId));
    const journalRef = collection(firestore, getJournalEntriesPath(userId));

    // Find all loan transactions (type = "قرض")
    const loanQuery = query(ledgerRef, where('type', '==', 'قرض'));
    const loanSnapshot = await getDocs(loanQuery);

    const corrected: string[] = [];
    const skipped: string[] = [];
    const errors: string[] = [];

    for (const ledgerDoc of loanSnapshot.docs) {
      const ledgerData = ledgerDoc.data();
      const transactionId = ledgerData.transactionId;
      const category = ledgerData.category || '';
      const amount = ledgerData.amount || 0;

      if (!transactionId) {
        skipped.push(ledgerDoc.id);
        continue;
      }

      // Find ALL journal entries linked to this transaction
      const journalQuery = query(journalRef, where('linkedTransactionId', '==', transactionId));
      const journalSnapshot = await getDocs(journalQuery);

      if (journalSnapshot.empty) {
        skipped.push(ledgerDoc.id);
        continue;
      }

      // Check ALL journal entries for this transaction to see if any has correct loan mapping
      // This prevents creating duplicate corrections
      let hasCorrectMapping = false;
      let originalWrongEntry: { doc: typeof journalSnapshot.docs[0], debitLine: JournalLine, isExpenseAccount: boolean } | null = null;

      for (const jDoc of journalSnapshot.docs) {
        const jData = jDoc.data();
        const jLines = jData.lines || [];

        // Check if this entry has loan accounts (correct mapping or correction entry)
        const hasLoansReceivable = jLines.some((line: JournalLine) =>
          line.debit > 0 && line.accountCode === ACCOUNT_CODES.LOANS_RECEIVABLE
        );
        const hasLoansPayable = jLines.some((line: JournalLine) =>
          line.credit > 0 && line.accountCode === ACCOUNT_CODES.LOANS_PAYABLE
        );

        if (hasLoansReceivable || hasLoansPayable) {
          hasCorrectMapping = true;
          break;
        }

        // Check if this is the original wrong entry (expense debit)
        const debitLine = jLines.find((line: JournalLine) => line.debit > 0);
        if (debitLine && debitLine.accountCode.startsWith('5') && !originalWrongEntry) {
          originalWrongEntry = { doc: jDoc, debitLine, isExpenseAccount: true };
        }
      }

      // Skip if already correctly recorded (has loan account in any entry)
      if (hasCorrectMapping) {
        skipped.push(ledgerDoc.id);
        continue;
      }

      // If no wrong entry found, skip
      if (!originalWrongEntry) {
        skipped.push(ledgerDoc.id);
        continue;
      }

      const { debitLine, isExpenseAccount } = originalWrongEntry;

      // Determine correct correction based on loan category
      const isLoanGiven = category === 'قروض ممنوحة';
      const isLoanReceived = category === 'قروض مستلمة';

      if (!isLoanGiven && !isLoanReceived) {
        // Unknown category, skip
        skipped.push(ledgerDoc.id);
        continue;
      }

      let correctionLines: JournalLine[];
      let description: string;

      if (isLoanGiven && isExpenseAccount) {
        // Wrong: DR Expense (5xxx), CR Cash
        // Correction: DR Loans Receivable (1600), CR Expense (5xxx)
        description = `تصحيح قيد قرض ممنوح: ${ledgerData.description || transactionId}`;
        correctionLines = [
          {
            accountCode: ACCOUNT_CODES.LOANS_RECEIVABLE,
            accountName: 'Loans Receivable',
            accountNameAr: getAccountNameAr(ACCOUNT_CODES.LOANS_RECEIVABLE),
            description: `تصحيح: قرض ممنوح - ${ledgerData.description || ''}`,
            debit: amount,
            credit: 0,
          },
          {
            accountCode: debitLine.accountCode,
            accountName: debitLine.accountCode,
            accountNameAr: debitLine.accountNameAr || 'مصروفات',
            description: `تصحيح: عكس تسجيل مصروف خاطئ`,
            debit: 0,
            credit: amount,
          },
        ];
      } else if (isLoanReceived && isExpenseAccount) {
        // Wrong: DR Expense (5xxx), CR Cash (for loan received this makes no sense)
        // Correct should be: DR Cash, CR Loans Payable
        // Correction: DR Expense (reverse), CR Loans Payable (correct)
        description = `تصحيح قيد قرض مستلم: ${ledgerData.description || transactionId}`;
        correctionLines = [
          {
            accountCode: debitLine.accountCode,
            accountName: debitLine.accountCode,
            accountNameAr: debitLine.accountNameAr || 'مصروفات',
            description: `تصحيح: عكس تسجيل مصروف خاطئ`,
            debit: amount,
            credit: 0,
          },
          {
            accountCode: ACCOUNT_CODES.LOANS_PAYABLE,
            accountName: 'Loans Payable',
            accountNameAr: getAccountNameAr(ACCOUNT_CODES.LOANS_PAYABLE),
            description: `تصحيح: قرض مستلم - ${ledgerData.description || ''}`,
            debit: 0,
            credit: amount,
          },
        ];
      } else {
        // Unknown case, skip
        skipped.push(ledgerDoc.id);
        continue;
      }

      try {
        const result = await createJournalEntry(
          userId,
          description,
          new Date(),
          correctionLines,
          transactionId,
          undefined,
          'ledger' // Link as ledger correction
        );

        if (result.success) {
          corrected.push(ledgerDoc.id);
        } else {
          errors.push(`${ledgerDoc.id}: ${result.error}`);
        }
      } catch (err) {
        errors.push(`${ledgerDoc.id}: ${err instanceof Error ? err.message : 'Unknown error'}`);
      }
    }

    return {
      success: true,
      data: { corrected, skipped, errors },
    };
  } catch (error) {
    console.error('Error migrating loan journal entries:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to migrate loan journal entries',
    };
  }
}
