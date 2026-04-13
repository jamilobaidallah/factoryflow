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
  runTransaction,
  startAfter,
  Timestamp,
  WriteBatch,
  Query,
  QueryDocumentSnapshot,
  DocumentData,
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
  getAccountMappingForSettlementDiscount,
  getAccountNameAr,
} from '@/lib/account-mapping';
import { roundCurrency, safeAdd, safeSubtract } from '@/lib/currency';
import { QUERY_LIMITS, ACCOUNTING_TOLERANCE } from '@/lib/constants';
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
  warning?: string;
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
      // Chart exists - check for and add any missing accounts (e.g., new accounts added to defaults)
      const missingResult = await ensureMissingAccounts(userId);
      return { success: true, data: missingResult.data || 0 };
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
        isSystemAccount: true,
        isContraAccount: account.isContraAccount ?? false,
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
 * Ensure all default accounts exist in the user's Chart of Accounts
 * This adds any missing accounts that were added to the default chart after initial seeding.
 * Useful when new account codes are added to the system (e.g., TRAVEL_EXPENSE 5445).
 */
export async function ensureMissingAccounts(
  userId: string
): Promise<ServiceResult<number>> {
  try {
    validateUserId(userId);

    // Get existing accounts
    const existingResult = await getAccounts(userId);
    if (!existingResult.success || !existingResult.data) {
      return { success: false, error: existingResult.error };
    }

    const existingCodes = new Set(existingResult.data.map(a => a.code));
    const defaultAccounts = getDefaultAccountsForSeeding();

    // Find accounts that don't exist yet
    const missingAccounts = defaultAccounts.filter(a => !existingCodes.has(a.code));

    if (missingAccounts.length === 0) {
      return { success: true, data: 0 };
    }

    // Add missing accounts
    const batch = writeBatch(firestore);
    const accountsRef = collection(firestore, getAccountsPath(userId));

    for (const account of missingAccounts) {
      const docRef = doc(accountsRef);
      const accountData = {
        code: account.code,
        name: account.name,
        nameAr: account.nameAr,
        type: account.type,
        normalBalance: account.normalBalance,
        isActive: account.isActive,
        isSystemAccount: true,
        isContraAccount: account.isContraAccount ?? false,
        createdAt: Timestamp.fromDate(account.createdAt),
        parentCode: account.parentCode ?? null,
        description: account.description ?? null,
      };
      batch.set(docRef, accountData);
    }

    await batch.commit();
    return { success: true, data: missingAccounts.length };
  } catch (error) {
    console.error('Error ensuring missing accounts:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to add missing accounts',
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
    const q = query(accountsRef, orderBy('code'), limit(QUERY_LIMITS.ACCOUNTS));
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

/**
 * Get all active accounts for a user
 * Uses getDocs (one-time fetch) — accounts are quasi-static
 */
export async function getAccountsActive(userId: string): Promise<ServiceResult<Account[]>> {
  try {
    validateUserId(userId);
    // Filter isActive client-side to avoid needing a composite index
    // (isActive == true + orderBy('code') on different fields requires one)
    const accountsRef = collection(firestore, getAccountsPath(userId));
    const q = query(accountsRef, orderBy('code'), limit(QUERY_LIMITS.ACCOUNTS));
    const snapshot = await getDocs(q);

    const accounts: Account[] = snapshot.docs
      .map((docSnap) => ({ id: docSnap.id, ...convertFirestoreDates(docSnap.data()) }) as Account)
      .filter((a) => a.isActive !== false); // treat missing field as active (backward compat)

    return { success: true, data: accounts };
  } catch (error) {
    console.error('Error getting active accounts:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get accounts',
    };
  }
}

/**
 * Get journal entries that touch a specific account
 * Uses accountCodes[] denormalized array for indexed query
 * Date filtering applied client-side after fetch
 */
export async function getJournalEntriesByAccount(
  userId: string,
  accountCode: string,
  startDate?: Date,
  endDate?: Date
): Promise<ServiceResult<JournalEntry[]>> {
  try {
    validateUserId(userId);
    if (!accountCode) {
      return { success: false, error: 'كود الحساب مطلوب' };
    }

    const journalRef = collection(firestore, getJournalEntriesPath(userId));
    const q = query(
      journalRef,
      where('accountCodes', 'array-contains', accountCode),
      orderBy('date', 'desc'),
      limit(QUERY_LIMITS.JOURNAL_ENTRIES)
    );

    const snapshot = await getDocs(q);
    let entries: JournalEntry[] = snapshot.docs.map((docSnap) => ({
      id: docSnap.id,
      ...convertFirestoreDates(docSnap.data()),
    })) as JournalEntry[];

    // Filter out reversed entries
    entries = entries.filter((entry) => {
      const status = (entry as JournalEntry & { status?: string }).status;
      return !status || status === 'posted';
    });

    // Apply date filters client-side
    if (startDate || endDate) {
      entries = entries.filter((entry) => {
        const entryDate = entry.date;
        if (startDate && entryDate < startDate) return false;
        if (endDate && entryDate > endDate) return false;
        return true;
      });
    }

    let warning: string | undefined;
    if (snapshot.size >= QUERY_LIMITS.JOURNAL_ENTRIES) {
      warning = `تحذير: تم الوصول للحد الأقصى (${QUERY_LIMITS.JOURNAL_ENTRIES.toLocaleString()} قيد). قد تكون البيانات غير مكتملة.`;
    }

    return { success: true, data: entries, warning };
  } catch (error) {
    console.error('Error getting journal entries by account:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get entries',
    };
  }
}

/**
 * Input for creating a new account
 */
export interface CreateAccountInput {
  code: string;
  name: string;
  nameAr: string;
  type: Account['type'];
  normalBalance: Account['normalBalance'];
  parentCode?: string;
  description?: string;
}

/**
 * Create a new account with atomic uniqueness guarantee
 * Uses a lock document (`account_code_locks/{code}`) inside a transaction
 * so two simultaneous creates with the same code cannot both succeed
 */
export async function createAccount(
  userId: string,
  input: CreateAccountInput
): Promise<ServiceResult<Account>> {
  try {
    validateUserId(userId);

    if (!/^\d{4}$/.test(input.code)) {
      return { success: false, error: 'كود الحساب يجب أن يكون 4 أرقام' };
    }
    if (!input.nameAr.trim()) {
      return { success: false, error: 'الاسم العربي مطلوب' };
    }

    const accountsRef = collection(firestore, getAccountsPath(userId));
    const lockRef = doc(firestore, `users/${userId}/account_code_locks`, input.code);
    const accountRef = doc(accountsRef);
    const now = new Date();

    const accountData = {
      code: input.code,
      name: input.name || input.nameAr,
      nameAr: input.nameAr,
      type: input.type,
      normalBalance: input.normalBalance,
      isActive: true,
      isSystemAccount: false,
      isContraAccount: false,
      parentCode: input.parentCode ?? null,
      description: input.description ?? null,
      createdAt: Timestamp.fromDate(now),
    };

    await runTransaction(firestore, async (transaction) => {
      const lockSnap = await transaction.get(lockRef);
      if (lockSnap.exists()) {
        throw new Error(`الكود ${input.code} مستخدم بالفعل`);
      }
      transaction.set(lockRef, { accountId: accountRef.id, createdAt: Timestamp.fromDate(now) });
      transaction.set(accountRef, accountData);
    });

    const newAccount: Account = {
      id: accountRef.id,
      code: input.code,
      name: input.name || input.nameAr,
      nameAr: input.nameAr,
      type: input.type,
      normalBalance: input.normalBalance,
      isActive: true,
      isSystemAccount: false,
      isContraAccount: false,
      parentCode: input.parentCode,
      description: input.description,
      createdAt: now,
    };

    return { success: true, data: newAccount };
  } catch (error) {
    console.error('Error creating account:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'فشل إنشاء الحساب',
    };
  }
}

/**
 * Update mutable fields of an account
 * Code, type, and normalBalance are immutable after creation
 */
export async function updateAccount(
  userId: string,
  accountId: string,
  updates: Pick<Account, 'name' | 'nameAr' | 'description'>
): Promise<ServiceResult> {
  try {
    validateUserId(userId);
    if (!accountId) {
      return { success: false, error: 'معرف الحساب مطلوب' };
    }

    const docRef = doc(firestore, getAccountsPath(userId), accountId);
    await updateDoc(docRef, {
      name: updates.name,
      nameAr: updates.nameAr,
      description: updates.description ?? null,
      updatedAt: Timestamp.fromDate(new Date()),
    });

    return { success: true };
  } catch (error) {
    console.error('Error updating account:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'فشل تعديل الحساب',
    };
  }
}

/**
 * Deactivate an account (soft delete — sets isActive: false)
 */
export async function deactivateAccount(
  userId: string,
  accountId: string
): Promise<ServiceResult> {
  try {
    validateUserId(userId);
    if (!accountId) {
      return { success: false, error: 'معرف الحساب مطلوب' };
    }

    const docRef = doc(firestore, getAccountsPath(userId), accountId);
    await updateDoc(docRef, {
      isActive: false,
      updatedAt: Timestamp.fromDate(new Date()),
    });

    return { success: true };
  } catch (error) {
    console.error('Error deactivating account:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'فشل تعطيل الحساب',
    };
  }
}

/**
 * Permanently delete an account
 * Blocked if: isSystemAccount=true, or account has any journal entries
 */
export async function deleteAccount(
  userId: string,
  accountId: string
): Promise<ServiceResult> {
  try {
    validateUserId(userId);
    if (!accountId) {
      return { success: false, error: 'معرف الحساب مطلوب' };
    }

    const docRef = doc(firestore, getAccountsPath(userId), accountId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return { success: false, error: 'الحساب غير موجود' };
    }

    const accountData = docSnap.data();
    if (accountData.isSystemAccount) {
      return { success: false, error: 'لا يمكن حذف الحسابات الافتراضية للنظام' };
    }

    const accountCode = accountData.code as string;
    const journalRef = collection(firestore, getJournalEntriesPath(userId));

    // Check indexed entries (modern entries with accountCodes[] populated)
    const indexedQuery = query(
      journalRef,
      where('accountCodes', 'array-contains', accountCode),
      limit(1)
    );
    const indexedSnapshot = await getDocs(indexedQuery);
    if (!indexedSnapshot.empty) {
      return { success: false, error: 'لا يمكن حذف حساب له قيود محاسبية' };
    }

    // Check legacy entries without accountCodes field (full scan bounded by limit)
    const legacyQuery = query(
      journalRef,
      orderBy('date', 'desc'),
      limit(QUERY_LIMITS.JOURNAL_ENTRIES)
    );
    const legacySnapshot = await getDocs(legacyQuery);
    const hasLegacyEntry = legacySnapshot.docs.some((snap) => {
      const data = snap.data();
      if (data.accountCodes && (data.accountCodes as string[]).length > 0) return false;
      const lines = data.lines as Array<{ accountCode: string }> | undefined;
      return lines?.some((line) => line.accountCode === accountCode) ?? false;
    });

    if (hasLegacyEntry) {
      return { success: false, error: 'لا يمكن حذف حساب له قيود محاسبية' };
    }

    const batch = writeBatch(firestore);
    batch.delete(docRef);
    await batch.commit();

    return { success: true };
  } catch (error) {
    console.error('Error deleting account:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'فشل حذف الحساب',
    };
  }
}

/**
 * Migration: Add accountCodes[] to journal entries missing it
 * Processes in 500-doc batches (Firestore WriteBatch limit)
 */
export async function backfillJournalAccountCodes(
  userId: string
): Promise<ServiceResult<number>> {
  try {
    validateUserId(userId);

    const journalRef = collection(firestore, getJournalEntriesPath(userId));
    let totalUpdated = 0;
    let lastDocSnap: QueryDocumentSnapshot<DocumentData> | null = null;
    let hasMore = true;

    while (hasMore) {
      const batchQuery: Query<DocumentData> = lastDocSnap
        ? query(journalRef, orderBy('date', 'desc'), startAfter(lastDocSnap), limit(500))
        : query(journalRef, orderBy('date', 'desc'), limit(500));

      const snapshot = await getDocs(batchQuery);

      if (snapshot.empty) {
        hasMore = false;
        break;
      }

      const toUpdate = snapshot.docs.filter((snap) => {
        const data = snap.data();
        return !data.accountCodes || (data.accountCodes as string[]).length === 0;
      });

      if (toUpdate.length > 0) {
        const writeBatchOp = writeBatch(firestore);
        for (const snap of toUpdate) {
          const lines = snap.data().lines as Array<{ accountCode: string }> | undefined;
          if (!lines) continue;
          const codes = Array.from(new Set(lines.map((l) => l.accountCode)));
          writeBatchOp.update(snap.ref, { accountCodes: codes });
        }
        await writeBatchOp.commit();
        totalUpdated += toUpdate.length;
      }

      lastDocSnap = snapshot.docs[snapshot.docs.length - 1];
      hasMore = snapshot.docs.length === 500;
    }

    return { success: true, data: totalUpdated };
  } catch (error) {
    console.error('Error backfilling journal account codes:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'فشل تحديث القيود',
    };
  }
}

/**
 * Migration: Set isSystemAccount: true on accounts matching DEFAULT_ACCOUNTS codes
 * Skips custom accounts (codes not in the default list)
 */
export async function backfillSystemAccountFlags(
  userId: string
): Promise<ServiceResult<number>> {
  try {
    validateUserId(userId);

    const defaultAccounts = getDefaultAccountsForSeeding();
    const defaultCodes = new Set(defaultAccounts.map((a) => a.code));

    const accountsResult = await getAccounts(userId);
    if (!accountsResult.success || !accountsResult.data) {
      return { success: false, error: accountsResult.error };
    }

    const toUpdate = accountsResult.data.filter(
      (a) => defaultCodes.has(a.code) && !a.isSystemAccount
    );

    if (toUpdate.length === 0) {
      return { success: true, data: 0 };
    }

    const accountsRef = collection(firestore, getAccountsPath(userId));
    const batch = writeBatch(firestore);
    for (const account of toUpdate) {
      const docRef = doc(accountsRef, account.id);
      batch.update(docRef, { isSystemAccount: true });
    }
    await batch.commit();

    return { success: true, data: toUpdate.length };
  } catch (error) {
    console.error('Error backfilling system account flags:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'فشل تحديث الحسابات',
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

    if (!lines || lines.length < 2) {
      return { success: false, error: 'يجب أن يحتوي القيد على سطرين على الأقل' };
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

    // Denormalized account codes for indexed queries (getJournalEntriesByAccount)
    const accountCodes = Array.from(new Set(lines.map(line => line.accountCode)));

    // Sanitize lines: Firestore rejects undefined values — replace with null
    const sanitizedLines = lines.map(line => ({
      ...line,
      description: line.description ?? null,
    }));

    // Use null for optional fields (Firestore rejects undefined but accepts null)
    // This maintains type safety and consistent document structure
    // Include totalDebits and totalCredits for server-side validation in Firestore rules
    const docData = {
      entryNumber,
      date: Timestamp.fromDate(date),
      description,
      lines: sanitizedLines,
      accountCodes,
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

// ============================================================================
// DEPRECATED: Old Journal Creation Functions
// These have been replaced by the JournalPostingEngine in src/services/journal/
// The functions below are kept for reference during transition period.
// Use createJournalPostingEngine().post() instead.
// ============================================================================

// ============================================================================
// Batch Operations (for atomic transactions with ledger)
// ============================================================================

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
  linkedDocumentType: 'ledger' | 'inventory' | 'payment',
  linkedPaymentId: string | null = null
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
    linkedPaymentId,
    linkedDocumentType,
    createdAt: Timestamp.fromDate(now),
    postedAt: Timestamp.fromDate(now),
  });
}

/**
 * Data required for adding a payment journal entry to a batch
 */
export interface PaymentJournalEntryBatchData {
  paymentId: string;
  description: string;
  amount: number;
  paymentType: 'قبض' | 'صرف';
  date: Date;
  linkedTransactionId?: string;
}

/**
 * Add a payment journal entry to an existing WriteBatch.
 * Receipt: DR Cash, CR AR | Disbursement: DR AP, CR Cash
 * Use this for atomic operations where payment and journal must succeed together.
 *
 * @throws {ValidationError} if inputs are invalid or entry is unbalanced
 */
export function addPaymentJournalEntryToBatch(
  batch: WriteBatch,
  userId: string,
  data: PaymentJournalEntryBatchData
): void {
  validateUserId(userId);
  validateAmount(data.amount);
  validateDescription(data.description);
  validateDate(data.date);

  const mapping = getAccountMappingForPayment(data.paymentType);
  const lines = createJournalLines(mapping, data.amount, data.description);

  const validation = validateJournalEntry(lines);
  if (!validation.isValid) {
    throw new ValidationError(
      `Payment journal entry is unbalanced. Debits: ${validation.totalDebits}, Credits: ${validation.totalCredits}`
    );
  }

  addValidatedJournalEntryToBatch(
    batch,
    userId,
    lines,
    data.description,
    data.date,
    data.linkedTransactionId ?? null,
    'payment',
    data.paymentId
  );
}

// DEPRECATED: reverseJournalEntry has been replaced by JournalPostingEngine.reverse()
// Use: const engine = createJournalPostingEngine(userId); await engine.reverse(entryId, reason);

/**
 * Get all journal entries (optionally filtered by date range and status)
 *
 * By default, only returns 'posted' entries (excludes reversed entries).
 * This is the correct behavior for the immutable ledger design where
 * reversed entries remain in the database but should not affect reports.
 *
 * @param userId - User/owner ID
 * @param startDate - Optional start date filter
 * @param endDate - Optional end date filter
 * @param includeReversed - If true, also returns reversed entries (default: false)
 */
export async function getJournalEntries(
  userId: string,
  startDate?: Date,
  endDate?: Date,
  includeReversed: boolean = false
): Promise<ServiceResult<JournalEntry[]>> {
  try {
    const journalRef = collection(firestore, getJournalEntriesPath(userId));

    // Query all entries ordered by date, filter status client-side
    // This avoids requiring a composite index (status + date) in Firestore
    // and maintains backward compatibility with existing data without status field
    const q = query(journalRef, orderBy('date', 'desc'), limit(QUERY_LIMITS.JOURNAL_ENTRIES));

    const snapshot = await getDocs(q);
    let entries: JournalEntry[] = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...convertFirestoreDates(doc.data()),
    })) as JournalEntry[];

    // Filter out reversed entries unless explicitly requested
    // Entries without status field (legacy) are treated as 'posted'
    if (!includeReversed) {
      entries = entries.filter((entry) => {
        const status = (entry as JournalEntry & { status?: string }).status;
        return !status || status === 'posted';
      });
    }

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

    // Check if we hit the query limit - warn about potential data truncation
    let warning: string | undefined;
    if (snapshot.size >= QUERY_LIMITS.JOURNAL_ENTRIES) {
      warning = `تحذير: تم الوصول للحد الأقصى (${QUERY_LIMITS.JOURNAL_ENTRIES.toLocaleString()} قيد). قد تكون البيانات غير مكتملة.`;
    }

    return { success: true, data: entries, warning };
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
 *
 * Only considers 'posted' entries (reversed entries are excluded by getJournalEntries).
 */
export async function getAccountBalance(
  userId: string,
  accountCode: string,
  asOfDate?: Date
): Promise<ServiceResult<AccountBalance>> {
  try {
    // getJournalEntries now filters by status='posted' at Firestore level by default
    const entriesResult = await getJournalEntries(userId, undefined, asOfDate);
    if (!entriesResult.success || !entriesResult.data) {
      return { success: false, error: entriesResult.error };
    }

    let totalDebits = 0;
    let totalCredits = 0;

    // All entries are already 'posted' (reversed excluded at query level)
    for (const entry of entriesResult.data) {
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

    // Note: Contra-assets (like Accumulated Depreciation) are handled correctly by
    // calculateAccountBalance - it returns negative when credits > debits for a
    // debit-normal account. No additional adjustment needed.

    return {
      success: true,
      data: {
        accountCode,
        accountName: accountCode,
        accountNameAr: getAccountNameAr(accountCode),
        accountType,
        totalDebits: roundCurrency(totalDebits),
        totalCredits: roundCurrency(totalCredits),
        balance: roundCurrency(balance),
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
 *
 * Only considers 'posted' entries (reversed entries are excluded by getJournalEntries).
 * This ensures the trial balance reflects the true financial state after reversals.
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

    // getJournalEntries now filters by status='posted' at Firestore level by default
    const entriesResult = await getJournalEntries(userId, undefined, asOfDate);
    if (!entriesResult.success || !entriesResult.data) {
      return { success: false, error: entriesResult.error };
    }

    // Capture any warnings from the journal entries query (e.g., query limit reached)
    const queryWarning = entriesResult.warning;

    // Build account balances map
    const balanceMap = new Map<string, { debits: number; credits: number }>();

    // Initialize all accounts
    for (const account of accountsResult.data) {
      balanceMap.set(account.code, { debits: 0, credits: 0 });
    }

    // Sum up journal entry lines (all entries are 'posted' - reversed excluded at query level)
    for (const entry of entriesResult.data) {
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

      // Note: Contra-assets (like Accumulated Depreciation) are handled correctly by
      // calculateAccountBalance - it returns negative when credits > debits for a
      // debit-normal account. No additional adjustment needed.

      accountBalances.push({
        accountCode: account.code,
        accountName: account.name,
        accountNameAr: account.nameAr,
        accountType: account.type,
        totalDebits: roundCurrency(totals.debits),
        totalCredits: roundCurrency(totals.credits),
        balance: roundCurrency(balance),
      });

      totalDebits = safeAdd(totalDebits, totals.debits);
      totalCredits = safeAdd(totalCredits, totals.credits);
    }

    // Sort by account code
    accountBalances.sort((a, b) => a.accountCode.localeCompare(b.accountCode));

    const difference = Math.abs(safeSubtract(totalDebits, totalCredits));
    const isBalanced = difference < ACCOUNTING_TOLERANCE;

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
      warning: queryWarning,
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
 * Reclassify contra-balances for balance sheet presentation
 *
 * Per GAAP/IFRS, accounts with contra-balances should be reclassified:
 * - Negative AR (credit balance from customer overpayment) → Customer Advances (liability)
 * - Negative AP (debit balance from supplier prepayment) → Supplier Advances (asset)
 *
 * This is a presentational reclassification only - Trial Balance remains unchanged.
 */
interface ReclassificationResult {
  assets: AccountBalance[];
  liabilities: AccountBalance[];
  reclassifications: Array<{
    fromAccount: string;
    toAccount: string;
    amount: number;
  }>;
}

function reclassifyContraBalances(
  assets: AccountBalance[],
  liabilities: AccountBalance[]
): ReclassificationResult {
  const reclassifiedAssets: AccountBalance[] = [];
  const reclassifiedLiabilities: AccountBalance[] = [];
  const reclassifications: ReclassificationResult['reclassifications'] = [];

  // Process assets - find negative AR (credit balance = customer overpaid)
  for (const account of assets) {
    if (
      account.accountCode === ACCOUNT_CODES.ACCOUNTS_RECEIVABLE &&
      account.balance < 0
    ) {
      const reclassAmount = Math.abs(account.balance);

      // Find existing Customer Advances or create new entry
      const existingIdx = reclassifiedLiabilities.findIndex(
        (l) => l.accountCode === ACCOUNT_CODES.CUSTOMER_ADVANCES
      );

      if (existingIdx >= 0) {
        // Add to existing Customer Advances balance
        reclassifiedLiabilities[existingIdx] = {
          ...reclassifiedLiabilities[existingIdx],
          balance: safeAdd(reclassifiedLiabilities[existingIdx].balance, reclassAmount),
        };
      } else {
        // Create new Customer Advances entry
        reclassifiedLiabilities.push({
          accountCode: ACCOUNT_CODES.CUSTOMER_ADVANCES,
          accountName: 'Customer Advances (Reclassified AR)',
          accountNameAr: 'سلفات عملاء (ذمم مدينة دائنة)',
          accountType: 'liability',
          totalDebits: 0,
          totalCredits: reclassAmount,
          balance: reclassAmount,
        });
      }

      reclassifications.push({
        fromAccount: ACCOUNT_CODES.ACCOUNTS_RECEIVABLE,
        toAccount: ACCOUNT_CODES.CUSTOMER_ADVANCES,
        amount: reclassAmount,
      });
      // Don't add negative AR to assets - it's been reclassified
    } else if (account.balance !== 0) {
      reclassifiedAssets.push(account);
    }
  }

  // Process liabilities - find negative AP (debit balance = we prepaid supplier)
  for (const account of liabilities) {
    if (
      account.accountCode === ACCOUNT_CODES.ACCOUNTS_PAYABLE &&
      account.balance < 0
    ) {
      const reclassAmount = Math.abs(account.balance);

      // Find existing Supplier Advances or create new entry
      const existingIdx = reclassifiedAssets.findIndex(
        (a) => a.accountCode === ACCOUNT_CODES.SUPPLIER_ADVANCES
      );

      if (existingIdx >= 0) {
        // Add to existing Supplier Advances balance
        reclassifiedAssets[existingIdx] = {
          ...reclassifiedAssets[existingIdx],
          balance: safeAdd(reclassifiedAssets[existingIdx].balance, reclassAmount),
        };
      } else {
        // Create new Supplier Advances entry
        reclassifiedAssets.push({
          accountCode: ACCOUNT_CODES.SUPPLIER_ADVANCES,
          accountName: 'Supplier Advances (Reclassified AP)',
          accountNameAr: 'سلفات موردين (ذمم دائنة مدينة)',
          accountType: 'asset',
          totalDebits: reclassAmount,
          totalCredits: 0,
          balance: reclassAmount,
        });
      }

      reclassifications.push({
        fromAccount: ACCOUNT_CODES.ACCOUNTS_PAYABLE,
        toAccount: ACCOUNT_CODES.SUPPLIER_ADVANCES,
        amount: reclassAmount,
      });
      // Don't add negative AP to liabilities - it's been reclassified
    } else if (account.balance !== 0) {
      reclassifiedLiabilities.push(account);
    }
  }

  return {
    assets: reclassifiedAssets,
    liabilities: reclassifiedLiabilities,
    reclassifications,
  };
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

    // Capture any warnings from the trial balance (e.g., query limit reached)
    const queryWarning = trialResult.warning;

    const accounts = trialResult.data.accounts;

    // Group by type (raw grouping before reclassification)
    const rawAssets = accounts.filter((a) => a.accountType === 'asset');
    const rawLiabilities = accounts.filter((a) => a.accountType === 'liability');
    const equity = accounts.filter((a) => a.accountType === 'equity');

    // Apply contra-balance reclassification for proper balance sheet presentation
    // Negative AR → Customer Advances (liability)
    // Negative AP → Supplier Advances (asset)
    const { assets, liabilities } = reclassifyContraBalances(rawAssets, rawLiabilities);

    // Calculate totals using reclassified accounts
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
    const isBalanced = difference < ACCOUNTING_TOLERANCE;

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
      warning: queryWarning,
    };
  } catch (error) {
    console.error('Error calculating balance sheet:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to calculate balance sheet',
    };
  }
}

// DEPRECATED: deleteJournalEntriesByTransaction and deleteJournalEntriesByPayment
// have been replaced by JournalPostingEngine.reverse() for the immutable ledger pattern.
// Use: const engine = createJournalPostingEngine(userId); await engine.reverse(entryId, reason);

