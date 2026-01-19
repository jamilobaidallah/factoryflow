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
  getAccountMappingForAdvance,
  getAccountMappingForFixedAssetPurchase,
  isAdvanceCategory,
  isFixedAssetCategory,
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
  linkedDocumentType: 'ledger' | 'inventory'
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

// ============================================================================
// JOURNAL REBUILD FUNCTIONS
// ============================================================================

import {
  isEquityTransaction,
  isLoanTransaction,
  isCapitalContribution,
  isOwnerDrawing,
  LOAN_CATEGORIES,
  LOAN_SUBCATEGORIES,
} from '@/components/ledger/utils/ledger-helpers';

/**
 * Non-cash expense categories that should NOT hit the Cash account
 * These are inventory adjustments/write-offs, not cash movements
 */
const NON_CASH_EXPENSE_CATEGORIES = [
  'هدر',      // Waste
  'عينات',    // Samples
  'كسر',      // Breakage
];

/**
 * Result of the journal rebuild operation
 */
export interface JournalRebuildResult {
  backupFileName: string;
  backupData: JournalEntry[];
  deletedCount: number;
  createdFromLedger: number;
  createdFromPayments: number;
  skippedNonCash: number;
  skippedEndorsed: number;
  errors: string[];
}

/**
 * Export all journal entries to JSON for backup
 */
export async function exportJournalToJSON(
  userId: string
): Promise<ServiceResult<{ fileName: string; data: JournalEntry[] }>> {
  try {
    validateUserId(userId);

    const entriesResult = await getJournalEntries(userId);
    if (!entriesResult.success || !entriesResult.data) {
      return { success: false, error: entriesResult.error };
    }

    const now = new Date();
    const fileName = `journal_backup_${now.toISOString().replace(/[:.]/g, '-')}.json`;

    return {
      success: true,
      data: {
        fileName,
        data: entriesResult.data,
      },
    };
  } catch (error) {
    console.error('Error exporting journal:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to export journal',
    };
  }
}

/**
 * Delete all journal entries for a user
 * DANGEROUS: Only use as part of rebuild process with backup
 */
async function deleteAllJournalEntries(
  userId: string
): Promise<ServiceResult<number>> {
  try {
    validateUserId(userId);

    const journalRef = collection(firestore, getJournalEntriesPath(userId));
    const snapshot = await getDocs(query(journalRef, limit(5000)));

    if (snapshot.empty) {
      return { success: true, data: 0 };
    }

    // Delete in batches of 400 (Firestore limit is 500)
    const BATCH_SIZE = 400;
    let deletedCount = 0;
    const docs = snapshot.docs;

    for (let i = 0; i < docs.length; i += BATCH_SIZE) {
      const batch = writeBatch(firestore);
      const batchDocs = docs.slice(i, i + BATCH_SIZE);

      batchDocs.forEach((docSnap) => {
        batch.delete(docSnap.ref);
      });

      await batch.commit();
      deletedCount += batchDocs.length;
    }

    return { success: true, data: deletedCount };
  } catch (error) {
    console.error('Error deleting all journal entries:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete entries',
    };
  }
}

/**
 * Determine the correct account mapping for a ledger entry during rebuild
 *
 * This implements the CORRECT logic:
 * - AR/AP entries ALWAYS use AR/AP accounts (payments handle Cash separately)
 * - Equity transactions use Cash vs Capital/Drawings
 * - Loan transactions use appropriate loan accounts
 * - Non-cash expenses (waste/samples/breakage) don't hit Cash
 */
function getAccountMappingForRebuild(
  entry: {
    type: string;
    category: string;
    subCategory?: string;
    clientId?: string;
    paymentStatus?: string;
  }
): { debitAccount: string; creditAccount: string; skipEntry: boolean; reason?: string } {
  const { type, category, subCategory, clientId, paymentStatus } = entry;

  // 1. Check for non-cash expenses (waste, samples, breakage)
  if (NON_CASH_EXPENSE_CATEGORIES.some(cat =>
    category?.includes(cat) || subCategory?.includes(cat)
  )) {
    // These are inventory write-offs: DR Expense, CR Inventory (NOT Cash)
    return {
      debitAccount: ACCOUNT_CODES.OTHER_EXPENSES,
      creditAccount: ACCOUNT_CODES.INVENTORY,
      skipEntry: false,
    };
  }

  // 2. Handle equity transactions
  if (isEquityTransaction(type, category)) {
    if (isOwnerDrawing(subCategory)) {
      // Owner withdrawal: DR Drawings, CR Cash
      return {
        debitAccount: ACCOUNT_CODES.OWNER_DRAWINGS,
        creditAccount: ACCOUNT_CODES.CASH,
        skipEntry: false,
      };
    } else if (isCapitalContribution(subCategory)) {
      // Capital contribution: DR Cash, CR Capital
      return {
        debitAccount: ACCOUNT_CODES.CASH,
        creditAccount: ACCOUNT_CODES.OWNER_CAPITAL,
        skipEntry: false,
      };
    }
  }

  // 3. Handle advance transactions (Balance Sheet, NOT P&L)
  if (isAdvanceCategory(category)) {
    const mapping = getAccountMappingForAdvance(category as 'سلفة عميل' | 'سلفة مورد');
    return {
      debitAccount: mapping.debitAccount,
      creditAccount: mapping.creditAccount,
      skipEntry: false,
    };
  }

  // 3.5. Handle fixed asset purchases (Balance Sheet, NOT P&L expense)
  // Fixed assets should be capitalized: DR Fixed Assets, CR Cash/AP
  if (isFixedAssetCategory(category, subCategory)) {
    // Check if this is an AR/AP tracked entry (has clientId = credit purchase)
    const isPaidImmediately = !clientId;
    const mapping = getAccountMappingForFixedAssetPurchase(isPaidImmediately);
    return {
      debitAccount: mapping.debitAccount,
      creditAccount: mapping.creditAccount,
      skipEntry: false,
    };
  }

  // 4. Handle loan transactions
  if (isLoanTransaction(type, category)) {
    if (category === LOAN_CATEGORIES.RECEIVED) {
      if (subCategory === LOAN_SUBCATEGORIES.LOAN_RECEIPT) {
        // Receive loan: DR Cash, CR Loans Payable
        return {
          debitAccount: ACCOUNT_CODES.CASH,
          creditAccount: ACCOUNT_CODES.LOANS_PAYABLE,
          skipEntry: false,
        };
      } else if (subCategory === LOAN_SUBCATEGORIES.LOAN_REPAYMENT) {
        // Repay loan: DR Loans Payable, CR Cash
        return {
          debitAccount: ACCOUNT_CODES.LOANS_PAYABLE,
          creditAccount: ACCOUNT_CODES.CASH,
          skipEntry: false,
        };
      }
    } else if (category === LOAN_CATEGORIES.GIVEN) {
      if (subCategory === LOAN_SUBCATEGORIES.LOAN_GIVEN) {
        // Give loan: DR Loans Receivable, CR Cash
        return {
          debitAccount: ACCOUNT_CODES.LOANS_RECEIVABLE,
          creditAccount: ACCOUNT_CODES.CASH,
          skipEntry: false,
        };
      } else if (subCategory === LOAN_SUBCATEGORIES.LOAN_COLLECTION) {
        // Collect loan: DR Cash, CR Loans Receivable
        return {
          debitAccount: ACCOUNT_CODES.CASH,
          creditAccount: ACCOUNT_CODES.LOANS_RECEIVABLE,
          skipEntry: false,
        };
      }
    }
  }

  // 5. Handle income transactions
  if (type === 'دخل' || type === 'إيراد') {
    // Check if this is an AR/AP tracked entry (has clientId)
    const isARAPEntry = !!clientId;

    if (isARAPEntry) {
      // ALWAYS use AR for tracked entries - payment journal handles Cash
      return {
        debitAccount: ACCOUNT_CODES.ACCOUNTS_RECEIVABLE,
        creditAccount: ACCOUNT_CODES.SALES_REVENUE,
        skipEntry: false,
      };
    } else {
      // No client = immediate cash transaction
      return {
        debitAccount: ACCOUNT_CODES.CASH,
        creditAccount: ACCOUNT_CODES.SALES_REVENUE,
        skipEntry: false,
      };
    }
  }

  // 6. Handle expense transactions
  if (type === 'مصروف') {
    // Check if this is an AR/AP tracked entry (has clientId)
    const isARAPEntry = !!clientId;

    if (isARAPEntry) {
      // ALWAYS use AP for tracked entries - payment journal handles Cash
      return {
        debitAccount: ACCOUNT_CODES.OTHER_EXPENSES,
        creditAccount: ACCOUNT_CODES.ACCOUNTS_PAYABLE,
        skipEntry: false,
      };
    } else {
      // No client = immediate cash transaction
      return {
        debitAccount: ACCOUNT_CODES.OTHER_EXPENSES,
        creditAccount: ACCOUNT_CODES.CASH,
        skipEntry: false,
      };
    }
  }

  // Default fallback
  return {
    debitAccount: ACCOUNT_CODES.OTHER_EXPENSES,
    creditAccount: ACCOUNT_CODES.CASH,
    skipEntry: false,
  };
}

/**
 * Rebuild all journal entries from source data (ledger + payments)
 *
 * This function:
 * 1. Backs up existing journal entries to JSON
 * 2. Deletes all existing journal entries
 * 3. Recreates entries from ledger with CORRECT account mapping
 * 4. Creates entries for all payments (AR/AP -> Cash movements)
 *
 * @param userId - The data owner's user ID
 * @returns Result with backup data and statistics
 */
export async function rebuildJournalFromSources(
  userId: string
): Promise<ServiceResult<JournalRebuildResult>> {
  try {
    validateUserId(userId);

    const result: JournalRebuildResult = {
      backupFileName: '',
      backupData: [],
      deletedCount: 0,
      createdFromLedger: 0,
      createdFromPayments: 0,
      skippedNonCash: 0,
      skippedEndorsed: 0,
      errors: [],
    };

    // Step 1: Export backup
    console.log('Step 1: Exporting journal backup...');
    const backupResult = await exportJournalToJSON(userId);
    if (!backupResult.success || !backupResult.data) {
      return { success: false, error: `Backup failed: ${backupResult.error}` };
    }
    result.backupFileName = backupResult.data.fileName;
    result.backupData = backupResult.data.data;
    console.log(`Backed up ${result.backupData.length} journal entries`);

    // Step 2: Delete all existing journal entries
    console.log('Step 2: Deleting existing journal entries...');
    const deleteResult = await deleteAllJournalEntries(userId);
    if (!deleteResult.success) {
      return { success: false, error: `Delete failed: ${deleteResult.error}` };
    }
    result.deletedCount = deleteResult.data || 0;
    console.log(`Deleted ${result.deletedCount} journal entries`);

    // Step 3: Fetch ledger entries
    console.log('Step 3: Fetching ledger entries...');
    const ledgerRef = collection(firestore, `users/${userId}/ledger`);
    const ledgerSnapshot = await getDocs(query(ledgerRef, limit(5000)));
    console.log(`Found ${ledgerSnapshot.docs.length} ledger entries`);

    // Step 4: Create journal entries from ledger
    console.log('Step 4: Creating journal entries from ledger...');
    const BATCH_SIZE = 400;
    let ledgerBatch = writeBatch(firestore);
    let batchCount = 0;

    for (const docSnap of ledgerSnapshot.docs) {
      const ledgerEntry = docSnap.data();
      const entryId = docSnap.id;

      try {
        // Skip endorsed cheques (no cash movement)
        if (ledgerEntry.chequeDetails?.endorsedTo) {
          result.skippedEndorsed++;
          continue;
        }

        const mapping = getAccountMappingForRebuild({
          type: ledgerEntry.type,
          category: ledgerEntry.category,
          subCategory: ledgerEntry.subCategory,
          clientId: ledgerEntry.clientId,
          paymentStatus: ledgerEntry.paymentStatus,
        });

        if (mapping.skipEntry) {
          result.skippedNonCash++;
          continue;
        }

        const amount = ledgerEntry.amount || 0;
        if (amount <= 0) continue;

        const description = ledgerEntry.description || ledgerEntry.category || 'قيد محاسبي';
        const date = ledgerEntry.date?.toDate?.() || new Date();

        const lines: JournalLine[] = [
          {
            accountCode: mapping.debitAccount,
            accountName: mapping.debitAccount,
            accountNameAr: getAccountNameAr(mapping.debitAccount),
            debit: roundCurrency(amount),
            credit: 0,
          },
          {
            accountCode: mapping.creditAccount,
            accountName: mapping.creditAccount,
            accountNameAr: getAccountNameAr(mapping.creditAccount),
            debit: 0,
            credit: roundCurrency(amount),
          },
        ];

        // Add to batch
        const journalRef = collection(firestore, getJournalEntriesPath(userId));
        const journalDocRef = doc(journalRef);
        const entryNumber = generateJournalEntryNumber();
        const now = new Date();

        ledgerBatch.set(journalDocRef, {
          entryNumber,
          date: Timestamp.fromDate(date),
          description,
          lines,
          totalDebits: roundCurrency(amount),
          totalCredits: roundCurrency(amount),
          status: 'posted',
          linkedTransactionId: entryId,
          linkedPaymentId: null,
          linkedDocumentType: 'ledger',
          createdAt: Timestamp.fromDate(now),
          postedAt: Timestamp.fromDate(now),
        });

        batchCount++;
        result.createdFromLedger++;

        // Commit batch if it reaches the limit
        if (batchCount >= BATCH_SIZE) {
          await ledgerBatch.commit();
          ledgerBatch = writeBatch(firestore);
          batchCount = 0;
        }
      } catch (error) {
        result.errors.push(`Ledger entry ${entryId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    // Commit remaining ledger entries
    if (batchCount > 0) {
      await ledgerBatch.commit();
    }
    console.log(`Created ${result.createdFromLedger} journal entries from ledger`);

    // Step 5: Fetch payment records
    console.log('Step 5: Fetching payment records...');
    const paymentsRef = collection(firestore, `users/${userId}/payments`);
    const paymentsSnapshot = await getDocs(query(paymentsRef, limit(5000)));
    console.log(`Found ${paymentsSnapshot.docs.length} payment records`);

    // Build a map of ledger entries that used AR/AP (have clientId)
    // Only payments for these entries should create Cash journal entries
    const ledgerEntriesWithARAPMap = new Map<string, boolean>();
    for (const docSnap of ledgerSnapshot.docs) {
      const ledgerEntry = docSnap.data();
      // Entry uses AR/AP if it has a clientId AND is income/expense type
      const isARAPEntry = !!ledgerEntry.clientId &&
        (ledgerEntry.type === 'دخل' || ledgerEntry.type === 'إيراد' || ledgerEntry.type === 'مصروف');
      ledgerEntriesWithARAPMap.set(docSnap.id, isARAPEntry);
    }

    // Step 6: Create journal entries from payments
    console.log('Step 6: Creating journal entries from payments...');
    let paymentBatch = writeBatch(firestore);
    batchCount = 0;
    let skippedNonARAPPayments = 0;

    for (const docSnap of paymentsSnapshot.docs) {
      const payment = docSnap.data();
      const paymentId = docSnap.id;

      try {
        // Skip endorsed payments (no cash movement)
        if (payment.isEndorsement) {
          result.skippedEndorsed++;
          continue;
        }

        // Skip payments with noCashMovement flag
        if (payment.noCashMovement) {
          result.skippedEndorsed++;
          continue;
        }

        // CRITICAL FIX: Only create payment journal entries for AR/AP tracked transactions
        // If the linked ledger entry didn't use AR/AP (no clientId), then the ledger entry
        // already hit Cash directly, and we shouldn't create another Cash entry
        const linkedLedgerId = payment.ledgerEntryId;
        if (linkedLedgerId) {
          const isARAPEntry = ledgerEntriesWithARAPMap.get(linkedLedgerId);
          if (isARAPEntry === false) {
            // Linked ledger entry didn't use AR/AP, skip this payment
            skippedNonARAPPayments++;
            continue;
          }
        }

        const amount = payment.amount || 0;
        if (amount <= 0) continue;

        const paymentType = payment.type as 'قبض' | 'صرف';
        const description = payment.notes || `${paymentType === 'قبض' ? 'قبض من' : 'صرف إلى'} ${payment.clientName || 'عميل'}`;
        const date = payment.date?.toDate?.() || new Date();

        // Payment accounting:
        // Receipt (قبض): DR Cash, CR AR
        // Disbursement (صرف): DR AP, CR Cash
        const debitAccount = paymentType === 'قبض'
          ? ACCOUNT_CODES.CASH
          : ACCOUNT_CODES.ACCOUNTS_PAYABLE;
        const creditAccount = paymentType === 'قبض'
          ? ACCOUNT_CODES.ACCOUNTS_RECEIVABLE
          : ACCOUNT_CODES.CASH;

        const lines: JournalLine[] = [
          {
            accountCode: debitAccount,
            accountName: debitAccount,
            accountNameAr: getAccountNameAr(debitAccount),
            debit: roundCurrency(amount),
            credit: 0,
          },
          {
            accountCode: creditAccount,
            accountName: creditAccount,
            accountNameAr: getAccountNameAr(creditAccount),
            debit: 0,
            credit: roundCurrency(amount),
          },
        ];

        // Add to batch
        const journalRef = collection(firestore, getJournalEntriesPath(userId));
        const journalDocRef = doc(journalRef);
        const entryNumber = generateJournalEntryNumber();
        const now = new Date();

        paymentBatch.set(journalDocRef, {
          entryNumber,
          date: Timestamp.fromDate(date),
          description,
          lines,
          totalDebits: roundCurrency(amount),
          totalCredits: roundCurrency(amount),
          status: 'posted',
          linkedTransactionId: payment.ledgerEntryId || null,
          linkedPaymentId: paymentId,
          linkedDocumentType: 'payment',
          createdAt: Timestamp.fromDate(now),
          postedAt: Timestamp.fromDate(now),
        });

        batchCount++;
        result.createdFromPayments++;

        // Commit batch if it reaches the limit
        if (batchCount >= BATCH_SIZE) {
          await paymentBatch.commit();
          paymentBatch = writeBatch(firestore);
          batchCount = 0;
        }
      } catch (error) {
        result.errors.push(`Payment ${paymentId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    // Commit remaining payment entries
    if (batchCount > 0) {
      await paymentBatch.commit();
    }
    console.log(`Created ${result.createdFromPayments} journal entries from payments`);

    console.log('Journal rebuild complete!');
    console.log(`Summary: ${result.createdFromLedger} from ledger, ${result.createdFromPayments} from payments`);
    console.log(`Skipped: ${result.skippedEndorsed} endorsed, ${result.skippedNonCash} non-cash, ${skippedNonARAPPayments} non-AR/AP payments`);
    if (result.errors.length > 0) {
      console.log(`Errors: ${result.errors.length}`);
    }

    return { success: true, data: result };
  } catch (error) {
    console.error('Error rebuilding journal:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to rebuild journal',
    };
  }
}
