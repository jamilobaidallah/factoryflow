"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ArrowLeft,
  Copy,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Calendar as CalendarIcon,
  FileText,
  Download,
  Landmark,
} from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { useUser } from "@/firebase/provider";
import { useToast } from "@/hooks/use-toast";
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  where,
  orderBy,
} from "firebase/firestore";
import { firestore } from "@/firebase/config";
import { formatShortDate } from "@/lib/date-utils";
import { safeAdd, safeSubtract } from "@/lib/currency";
import { exportStatementToPDF } from "@/lib/export-statement-pdf";
import { exportStatementToExcel } from "@/lib/export-statement-excel";
import {
  formatCurrency,
  formatStatementDate,
  getDateRange,
  extractPaymentMethod
} from "@/lib/statement-format";
import { CHEQUE_STATUS_AR } from "@/lib/constants";
import {
  isLoanTransaction,
  isInitialLoan,
  getLoanType,
  LOAN_CATEGORIES,
  LOAN_SUBCATEGORIES,
} from "@/components/ledger/utils/ledger-helpers";

// Aliases for backward compatibility with existing code
const formatNumber = formatCurrency;
const formatDateAr = formatStatementDate;

interface Client {
  id: string;
  name: string;
  phone: string;
  email: string;
  address: string;
  balance: number;
  createdAt: Date;
}

interface LedgerEntry {
  id: string;
  transactionId?: string;
  type: string;
  amount: number;
  date: Date;
  category: string;
  subCategory?: string;
  description: string;
  associatedParty?: string;
  remainingBalance?: number;
  totalDiscount?: number;        // Settlement discounts (خصم تسوية)
  writeoffAmount?: number;       // Bad debt write-offs (ديون معدومة)
  totalPaidFromAdvances?: number; // Amount paid from customer/supplier advances
  // Advance allocation fields
  totalUsedFromAdvance?: number;  // Total amount consumed from this advance
  advanceAllocations?: Array<{    // Which invoices used this advance
    invoiceId: string;
    invoiceTransactionId: string;
    amount: number;
    date: Date | string;
    description?: string;
  }>;
}

interface Payment {
  id: string;
  type: string;
  amount: number;
  date: Date;
  description: string;
  paymentMethod: string;
  notes: string;  // Payment method info is stored in notes field
  associatedParty?: string;
  discountAmount?: number;  // Settlement discount applied with this payment
  isEndorsement?: boolean;  // True if payment is from cheque endorsement
  noCashMovement?: boolean; // True if no actual cash moved (endorsements)
  endorsementChequeId?: string; // Links payment to the endorsed cheque
  linkedTransactionId?: string; // Links payment to its ledger entry
  category?: string;  // Category for filtering (e.g., سلفة عميل, سلفة مورد)
}

interface Cheque {
  id: string;
  chequeNumber: string;
  amount: number;
  issueDate: Date;
  dueDate?: Date;
  bankName: string;
  status: string;
  type: string;
  associatedParty?: string;
  // Endorsement fields
  endorsedTo?: string;        // Name of party cheque was endorsed to
  endorsedDate?: Date;        // When the cheque was endorsed
  chequeType?: string;        // "عادي" (normal) or "مجير" (endorsed)
  isEndorsedCheque?: boolean; // Flag for endorsed cheques
  endorsedFromId?: string;    // Reference to original incoming cheque
}

interface StatementItem {
  id: string;
  transactionId?: string;
  source: 'ledger' | 'payment';
  date: Date;
  isPayment: boolean;
  entryType: string;
  description: string;
  debit: number;
  credit: number;
  balance?: number;
  // Ledger-specific
  category?: string;
  subCategory?: string;
  // Payment-specific
  notes?: string;
  isEndorsement?: boolean; // True if this is an endorsement-based payment
}

interface ClientDetailPageProps {
  clientId: string;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Check if a ledger entry is an advance (سلفة)
 * Advances are informational only - they explain where overpayment sits
 * but should NOT affect running balance (the payment already captured the money flow)
 */
function isAdvanceEntry(entry: LedgerEntry): boolean {
  return entry.category === "سلفة عميل" || entry.category === "سلفة مورد";
}

/**
 * Filter pending cheques, excluding endorsed cheques
 * Endorsed cheques are already accounted for in the statement as endorsement payments
 * Including them would double-count the amount
 */
function filterPendingCheques(cheques: Cheque[]): Cheque[] {
  return cheques.filter(c => c.status === "قيد الانتظار" && !c.isEndorsedCheque);
}

/**
 * Calculate expected balance after pending cheques clear
 * - Incoming (وارد): We receive money → reduces what they owe us
 * - Outgoing (صادر): We pay money → reduces what we owe them
 */
function calculateBalanceAfterCheques(
  currentBalance: number,
  pendingCheques: Cheque[]
): { incomingTotal: number; outgoingTotal: number; balanceAfterCheques: number } {
  const incomingTotal = pendingCheques
    .filter(c => c.type === "وارد")
    .reduce((sum, c) => sum + (c.amount || 0), 0);
  const outgoingTotal = pendingCheques
    .filter(c => c.type === "صادر")
    .reduce((sum, c) => sum + (c.amount || 0), 0);
  const balanceAfterCheques = currentBalance - incomingTotal + outgoingTotal;

  return { incomingTotal, outgoingTotal, balanceAfterCheques };
}

interface ExportTransaction {
  date: Date;
  type?: "Invoice" | "Payment";
  description: string;
  debit: number;
  credit: number;
  balance: number;
}

interface ExportData {
  transactions: ExportTransaction[];
  totalDebit: number;
  totalCredit: number;
  finalBalance: number;
  pendingCheques: Array<{
    chequeNumber: string;
    bankName: string;
    dueDate: Date;
    amount: number;
    type: string;
  }>;
  balanceAfterCheques: number;
}

/**
 * Build export data from ledger entries, payments, and cheques
 * This shared function is used by both Excel and PDF exports
 */
function buildExportData(
  ledgerEntries: LedgerEntry[],
  payments: Payment[],
  cheques: Cheque[],
  clientInitialBalance: number
): ExportData {
  // Build transaction rows from ledger entries (including discounts and writeoffs)
  const allTxns: ExportTransaction[] = [
    ...ledgerEntries.flatMap((e) => {
      const rows: ExportTransaction[] = [];
      const isAdvance = isAdvanceEntry(e);
      const isLoan = isLoanTransaction(e.type, e.category);

      // Calculate debit/credit based on transaction type
      let debit = 0;
      let credit = 0;
      if (isAdvance) {
        debit = 0;
        credit = 0;
      } else if (isLoan) {
        const loanType = getLoanType(e.category);
        if (isInitialLoan(e.subCategory)) {
          if (loanType === "receivable") {
            debit = e.amount;
          } else if (loanType === "payable") {
            credit = e.amount;
          }
        } else {
          if (loanType === "receivable") {
            credit = e.amount;
          } else if (loanType === "payable") {
            debit = e.amount;
          }
        }
      } else if (e.type === "دخل" || e.type === "إيراد") {
        debit = e.amount;
      } else if (e.type === "مصروف") {
        credit = e.amount;
      }

      // Row 1: The invoice/loan itself
      rows.push({
        date: e.date,
        type: "Invoice" as const,
        description: isAdvance
          ? `${e.description} (${e.amount.toFixed(2)} - لا يؤثر على الرصيد)`
          : e.description,
        debit,
        credit,
        balance: 0,
      });

      // Row 2: Discount (if any) - reduces what client owes
      if (e.totalDiscount && e.totalDiscount > 0 && (e.type === "دخل" || e.type === "إيراد")) {
        rows.push({
          date: e.date,
          type: "Payment" as const,
          description: "خصم تسوية",
          debit: 0,
          credit: e.totalDiscount,
          balance: 0,
        });
      }

      // Row 3: Writeoff (if any) - reduces what client owes
      if (e.writeoffAmount && e.writeoffAmount > 0 && (e.type === "دخل" || e.type === "إيراد")) {
        rows.push({
          date: e.date,
          type: "Payment" as const,
          description: "شطب دين معدوم",
          debit: 0,
          credit: e.writeoffAmount,
          balance: 0,
        });
      }

      return rows;
    }),
    ...payments.map((p) => ({
      date: p.date,
      type: "Payment" as const,
      description: p.notes || p.description || '',
      debit: p.type === "صرف" ? p.amount : 0,
      credit: p.type === "قبض" ? p.amount : 0,
      balance: 0,
    })),
  ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // Calculate running balances
  let runningBalance = clientInitialBalance;
  let totalDebit = 0;
  let totalCredit = 0;

  const txnsWithBalance = allTxns.map((t) => {
    totalDebit += t.debit;
    totalCredit += t.credit;
    runningBalance += t.debit - t.credit;
    return { ...t, balance: runningBalance };
  });

  // Get pending cheques
  const pending = filterPendingCheques(cheques);
  const pendingChequeData = pending.map((c) => ({
    chequeNumber: c.chequeNumber,
    bankName: c.bankName,
    dueDate: c.dueDate || c.issueDate,
    amount: c.amount,
    type: c.type,
  }));

  // Calculate balance after cheques
  const { balanceAfterCheques } = calculateBalanceAfterCheques(runningBalance, pending);

  return {
    transactions: txnsWithBalance,
    totalDebit,
    totalCredit,
    finalBalance: runningBalance,
    pendingCheques: pendingChequeData,
    balanceAfterCheques,
  };
}

export default function ClientDetailPage({ clientId }: ClientDetailPageProps) {
  const router = useRouter();
  const { user } = useUser();
  const { toast } = useToast();

  const [client, setClient] = useState<Client | null>(null);
  const [ledgerEntries, setLedgerEntries] = useState<LedgerEntry[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [cheques, setCheques] = useState<Cheque[]>([]);
  const [loading, setLoading] = useState(true);

  // Financial metrics
  const [totalSales, setTotalSales] = useState(0);
  const [totalPurchases, setTotalPurchases] = useState(0);
  const [totalPaymentsReceived, setTotalPaymentsReceived] = useState(0);
  const [totalPaymentsMade, setTotalPaymentsMade] = useState(0);
  const [currentBalance, setCurrentBalance] = useState(0);
  // Discounts and writeoffs from ledger entries - split by entry type
  const [totalIncomeDiscounts, setTotalIncomeDiscounts] = useState(0);
  const [totalIncomeWriteoffs, setTotalIncomeWriteoffs] = useState(0);
  const [totalExpenseDiscounts, setTotalExpenseDiscounts] = useState(0);
  const [totalExpenseWriteoffs, setTotalExpenseWriteoffs] = useState(0);
  // Advance payments - amounts paid from customer/supplier advances
  const [totalIncomeAdvancePayments, setTotalIncomeAdvancePayments] = useState(0);
  const [totalExpenseAdvancePayments, setTotalExpenseAdvancePayments] = useState(0);
  // Advance balances - outstanding advances (not yet consumed by invoices)
  const [customerAdvances, setCustomerAdvances] = useState(0);  // سلفة عميل - we owe them (liability)
  const [supplierAdvances, setSupplierAdvances] = useState(0);  // سلفة مورد - they owe us (asset)

  // Loan balances
  const [loansReceivable, setLoansReceivable] = useState(0);  // Loans we gave to this party (they owe us)
  const [loansPayable, setLoansPayable] = useState(0);        // Loans this party gave us (we owe them)

  // Modal state for transaction details
  const [selectedTransaction, setSelectedTransaction] = useState<StatementItem | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Date filter state for statement
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined);
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined);

  // Memoize allTransactions - expensive computation that combines ledger entries and payments
  const allTransactions = useMemo((): StatementItem[] => {
    return [
      // Ledger entries (invoices) plus their discounts and writeoffs
      ...ledgerEntries.flatMap((e) => {
        const rows: StatementItem[] = [];
        const isAdvance = isAdvanceEntry(e);
        const isLoan = isLoanTransaction(e.type, e.category);

        // Determine debit/credit based on entry type
        let debit = 0;
        let credit = 0;
        if (isLoan) {
          // Loans: direction based on subcategory
          const loanType = getLoanType(e.category);
          if (isInitialLoan(e.subCategory)) {
            // Initial loans:
            // - Loan Given (قروض ممنوحة / منح قرض): We lent money → debit (they owe us)
            // - Loan Received (قروض مستلمة / استلام قرض): We borrowed → credit (we owe them)
            if (loanType === "receivable") {
              debit = e.amount; // We lent money, they owe us
            } else if (loanType === "payable") {
              credit = e.amount; // We borrowed, we owe them
            }
          } else {
            // Loan repayments/collections:
            // - Loan Collection (تحصيل قرض): They paid us back → credit (reduces what they owe)
            // - Loan Repayment (سداد قرض): We paid back → debit (reduces what we owe)
            if (loanType === "receivable") {
              credit = e.amount; // They paid back
            } else if (loanType === "payable") {
              debit = e.amount; // We paid back
            }
          }
        } else if (isAdvance) {
          // Advances have INVERTED debit/credit vs their entry type
          // Customer advance (سلفة عميل): We received cash, but we OWE them goods → credit (لنا)
          // Supplier advance (سلفة مورد): We paid cash, they OWE us goods → debit (عليه)
          // Show FULL amount - the "مدفوع من سلفة" row on invoices is informational only
          if (e.category === "سلفة عميل") {
            credit = e.amount; // We owe them (liability) - full amount received
          } else if (e.category === "سلفة مورد") {
            debit = e.amount; // They owe us (asset) - full amount paid
          }
        } else if (e.type === "دخل" || e.type === "إيراد") {
          debit = e.amount;
        } else if (e.type === "مصروف") {
          credit = e.amount;
        }

        rows.push({
          id: e.id,
          transactionId: e.transactionId,
          source: 'ledger' as const,
          date: e.date,
          isPayment: false,
          entryType: isAdvance ? 'سلفة' : (isLoan ? 'قرض' : e.type),
          description: e.description,
          category: e.category,
          subCategory: e.subCategory,
          debit,
          credit,
        });

        // Row 2: Discount from ledger entry (if any) - reduces what client owes
        if (e.totalDiscount && e.totalDiscount > 0 && (e.type === "دخل" || e.type === "إيراد")) {
          rows.push({
            id: `${e.id}-discount`,
            transactionId: e.transactionId,
            source: 'ledger' as const,
            date: e.date,
            isPayment: true,  // Display as payment-like row
            entryType: 'خصم',
            description: 'خصم تسوية',
            category: e.category,
            debit: 0,
            credit: e.totalDiscount,  // Credit reduces debt
          });
        }

        // Row 3: Writeoff from ledger entry (if any) - reduces what client owes
        if (e.writeoffAmount && e.writeoffAmount > 0 && (e.type === "دخل" || e.type === "إيراد")) {
          rows.push({
            id: `${e.id}-writeoff`,
            transactionId: e.transactionId,
            source: 'ledger' as const,
            date: e.date,
            isPayment: true,  // Display as payment-like row
            entryType: 'شطب',
            description: 'شطب دين معدوم',
            category: e.category,
            debit: 0,
            credit: e.writeoffAmount,  // Credit reduces debt
          });
        }

        // Row 4: Expense discount (if any) - reduces what we owe supplier (DEBIT)
        if (e.totalDiscount && e.totalDiscount > 0 && e.type === "مصروف") {
          rows.push({
            id: `${e.id}-discount`,
            transactionId: e.transactionId,
            source: 'ledger' as const,
            date: e.date,
            isPayment: true,
            entryType: 'خصم مورد',
            description: 'خصم من المورد',
            category: e.category,
            debit: e.totalDiscount,  // DEBIT reduces liability (opposite of income)
            credit: 0,
          });
        }

        // Row 5: Expense writeoff (if any) - reduces what we owe supplier (DEBIT)
        if (e.writeoffAmount && e.writeoffAmount > 0 && e.type === "مصروف") {
          rows.push({
            id: `${e.id}-writeoff`,
            transactionId: e.transactionId,
            source: 'ledger' as const,
            date: e.date,
            isPayment: true,
            entryType: 'إعفاء مورد',
            description: 'إعفاء من المورد',
            category: e.category,
            debit: e.writeoffAmount,  // DEBIT reduces liability
            credit: 0,
          });
        }

        // Row 6: Paid from advance (if any) - INFORMATIONAL ONLY
        // Shows that invoice was paid using customer/supplier advance, but doesn't affect balance
        // The advance entry shows FULL amount, so this row is just for clarity
        if (e.totalPaidFromAdvances && e.totalPaidFromAdvances > 0) {
          const isIncome = e.type === "دخل" || e.type === "إيراد";
          rows.push({
            id: `${e.id}-advance-payment`,
            transactionId: e.transactionId,
            source: 'ledger' as const,
            date: e.date,
            isPayment: true,
            entryType: 'معلومات',
            description: isIncome
              ? `مدفوع من سلفة عميل (${e.totalPaidFromAdvances})`
              : `مخصوم من سلفة مورد (${e.totalPaidFromAdvances})`,
            category: e.category,
            debit: 0,   // Informational only - no balance impact
            credit: 0,  // The advance entry already shows full amount
          });
        }

        return rows;
      }),
      // Payments (cash/cheque payments only - discounts/writeoffs come from ledger)
      // Note: Don't include payment.discountAmount here as it's already in ledger.totalDiscount
      ...payments.flatMap((p) => {
        // Only show payments with actual amount (skip discount-only records)
        if (p.amount <= 0) {
          return [];
        }

        // Skip payments linked to advance entries (already shown as سلفة)
        if (p.linkedTransactionId) {
          // linkedTransactionId stores the transactionId, not the document id
          const linkedEntry = ledgerEntries.find(e => e.transactionId === p.linkedTransactionId);
          if (linkedEntry && isAdvanceEntry(linkedEntry)) {
            return []; // Skip advance-related payments
          }
        }

        return [{
          id: p.id,
          source: 'payment' as const,
          date: p.date,
          isPayment: true,
          entryType: p.type,
          description: p.notes || p.description || '',
          notes: p.notes,
          isEndorsement: p.isEndorsement || false, // Track endorsement payments
          // Payment received (قبض): goes in دائن (reduces what they owe us)
          // Payment made (صرف): goes in مدين (reduces what we owe them)
          debit: p.type === "صرف" ? p.amount : 0,
          credit: p.type === "قبض" ? p.amount : 0,
        }];
      }),
    ].sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [ledgerEntries, payments]);

  // Memoize date range calculation
  const dateRange = useMemo(() => getDateRange(allTransactions), [allTransactions]);

  // Memoize filtered transactions and balance calculations
  const statementData = useMemo(() => {
    // Calculate opening balance
    // Start with client's initial balance (الرصيد الافتتاحي) from their record
    const clientInitialBalance = client?.balance || 0;
    let openingBalance = clientInitialBalance;

    // If date filter is applied, add all transactions BEFORE the "from" date
    if (dateFrom) {
      const fromDate = new Date(dateFrom);
      fromDate.setHours(0, 0, 0, 0);
      allTransactions.forEach((item) => {
        const itemDate = new Date(item.date);
        itemDate.setHours(0, 0, 0, 0);
        if (itemDate < fromDate) {
          openingBalance += item.debit - item.credit;
        }
      });
    }

    // Filter transactions by date range
    const filteredTransactions = allTransactions.filter((item) => {
      const itemDate = new Date(item.date);
      itemDate.setHours(0, 0, 0, 0);

      if (dateFrom) {
        const fromDate = new Date(dateFrom);
        fromDate.setHours(0, 0, 0, 0);
        if (itemDate < fromDate) {
          return false;
        }
      }
      if (dateTo) {
        const toDate = new Date(dateTo);
        toDate.setHours(23, 59, 59, 999);
        if (itemDate > toDate) {
          return false;
        }
      }
      return true;
    });

    // Calculate totals from filtered transactions
    // Running balance starts from opening balance
    let totalDebit = 0;
    let totalCredit = 0;
    let runningBalance = openingBalance;
    const rowsWithBalance = filteredTransactions.map((t) => {
      totalDebit += t.debit;
      totalCredit += t.credit;
      runningBalance += t.debit - t.credit;
      return { ...t, balance: runningBalance };
    });

    const finalBalance = runningBalance;

    return {
      openingBalance,
      filteredTransactions,
      rowsWithBalance,
      totalDebit,
      totalCredit,
      finalBalance,
    };
  }, [allTransactions, dateFrom, dateTo, client?.balance]);

  // Load client data
  useEffect(() => {
    if (!user || !clientId) {return;}

    const clientRef = doc(firestore, `users/${user.dataOwnerId}/clients`, clientId);
    getDoc(clientRef)
      .then((docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          setClient({
            id: docSnap.id,
            ...data,
            createdAt: data.createdAt?.toDate?.() || new Date(),
          } as Client);
        } else {
          toast({
            title: "خطأ",
            description: "العميل غير موجود",
            variant: "destructive",
          });
          router.push("/clients");
        }
        setLoading(false);
      })
      .catch((error) => {
        console.error("Error loading client:", error);
        toast({
          title: "خطأ",
          description: "حدث خطأ أثناء تحميل بيانات العميل",
          variant: "destructive",
        });
        setLoading(false);
      });
  }, [user, clientId, router, toast]);

  // Load ledger entries for this client
  useEffect(() => {
    if (!user || !client) {return;}

    const ledgerRef = collection(firestore, `users/${user.dataOwnerId}/ledger`);
    const q = query(
      ledgerRef,
      where("associatedParty", "==", client.name)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const entries: LedgerEntry[] = [];
        let sales = 0;
        let purchases = 0;
        // Split discount tracking by entry type
        let incomeDiscounts = 0;
        let incomeWriteoffs = 0;
        let expenseDiscounts = 0;
        let expenseWriteoffs = 0;
        // Advance payments tracking
        let incomeAdvancePayments = 0;
        let expenseAdvancePayments = 0;
        // Advance balances (outstanding amount not yet consumed)
        let custAdvances = 0;  // سلفة عميل - we owe them
        let suppAdvances = 0;  // سلفة مورد - they owe us
        let loanReceivable = 0;  // Loans we gave (قروض ممنوحة)
        let loanPayable = 0;     // Loans we received (قروض مستلمة)

        snapshot.forEach((doc) => {
          const data = doc.data();
          const entry = {
            id: doc.id,
            ...data,
            date: data.date?.toDate?.() || new Date(),
          } as LedgerEntry;
          entries.push(entry);

          // Track loan balances (separate from regular income/expense)
          if (isLoanTransaction(entry.type, entry.category)) {
            // Only count initial loans for outstanding balance
            if (isInitialLoan(entry.subCategory)) {
              const loanType = getLoanType(entry.category);
              if (loanType === "receivable") {
                // Loans Given - we lent money, they owe us
                loanReceivable += entry.remainingBalance ?? entry.amount ?? 0;
              } else if (loanType === "payable") {
                // Loans Received - they lent to us, we owe them
                loanPayable += entry.remainingBalance ?? entry.amount ?? 0;
              }
            }
          } else if (isAdvanceEntry(entry)) {
            // Track advance balances - use FULL amount (not remaining)
            // The "مدفوع من سلفة" row on invoices is informational only
            // Balance formula will NOT subtract totalIncomeAdvancePayments since we use full advance
            if (entry.category === "سلفة عميل") {
              custAdvances += entry.amount; // Customer advance - we owe them (full amount)
            } else if (entry.category === "سلفة مورد") {
              suppAdvances += entry.amount; // Supplier advance - they owe us (full amount)
            }
          } else {
            // Calculate regular totals (exclude advances and loans - they are not income/expense)
            if ((entry.type === "دخل" || entry.type === "إيراد") && !isAdvanceEntry(entry)) {
              sales += entry.amount;
              // Track discounts/writeoffs for income entries (customer discounts)
              incomeDiscounts += data.totalDiscount || 0;
              incomeWriteoffs += data.writeoffAmount || 0;
              // Track advance payments for income entries (customer advance used)
              incomeAdvancePayments += data.totalPaidFromAdvances || 0;
            } else if (entry.type === "مصروف" && !isAdvanceEntry(entry)) {
              purchases += entry.amount;
              // Track discounts/writeoffs for expense entries (supplier discounts)
              expenseDiscounts += data.totalDiscount || 0;
              expenseWriteoffs += data.writeoffAmount || 0;
              // Track advance payments for expense entries (supplier advance used)
              expenseAdvancePayments += data.totalPaidFromAdvances || 0;
            }
          }
        });

        // Sort by date in JavaScript instead of Firestore
        entries.sort((a, b) => b.date.getTime() - a.date.getTime());

        setLedgerEntries(entries);
        setTotalSales(sales);
        setTotalPurchases(purchases);
        setTotalIncomeDiscounts(incomeDiscounts);
        setTotalIncomeWriteoffs(incomeWriteoffs);
        setTotalExpenseDiscounts(expenseDiscounts);
        setTotalExpenseWriteoffs(expenseWriteoffs);
        setTotalIncomeAdvancePayments(incomeAdvancePayments);
        setTotalExpenseAdvancePayments(expenseAdvancePayments);
        setCustomerAdvances(custAdvances);
        setSupplierAdvances(suppAdvances);
        setLoansReceivable(loanReceivable);
        setLoansPayable(loanPayable);
      },
      (error) => {
        console.error("Error loading ledger entries:", error);
      }
    );

    return () => unsubscribe();
  }, [user, client]);

  // Load payments for this client
  useEffect(() => {
    if (!user || !client) {return;}

    const paymentsRef = collection(firestore, `users/${user.dataOwnerId}/payments`);
    const q = query(
      paymentsRef,
      where("clientName", "==", client.name)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const paymentsList: Payment[] = [];
        let received = 0;
        let made = 0;

        snapshot.forEach((doc) => {
          const data = doc.data();
          const payment = {
            id: doc.id,
            ...data,
            date: data.date?.toDate?.() || new Date(),
          } as Payment;
          paymentsList.push(payment);

          // Calculate totals - EXCLUDE advance payments
          // Advance payments are tracked separately via customerAdvances/supplierAdvances
          const isAdvancePayment = payment.category === "سلفة عميل" || payment.category === "سلفة مورد";
          if (!isAdvancePayment) {
            if (payment.type === "قبض") {
              received += payment.amount;
            } else if (payment.type === "صرف") {
              made += payment.amount;
            }
          }
        });

        // Sort by date in JavaScript
        paymentsList.sort((a, b) => b.date.getTime() - a.date.getTime());

        setPayments(paymentsList);
        setTotalPaymentsReceived(received);
        setTotalPaymentsMade(made);
      },
      (error) => {
        console.error("Error loading payments:", error);
      }
    );

    return () => unsubscribe();
  }, [user, client]);

  // Load cheques for this client
  useEffect(() => {
    if (!user || !client) {return;}

    const chequesRef = collection(firestore, `users/${user.dataOwnerId}/cheques`);
    const q = query(
      chequesRef,
      where("clientName", "==", client.name)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const chequesList: Cheque[] = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          chequesList.push({
            id: doc.id,
            ...data,
            issueDate: data.issueDate?.toDate?.() || new Date(),
            dueDate: data.dueDate?.toDate?.() || data.issueDate?.toDate?.() || new Date(),
          } as Cheque);
        });
        // Sort by issue date in JavaScript
        chequesList.sort((a, b) => b.issueDate.getTime() - a.issueDate.getTime());
        setCheques(chequesList);
      },
      (error) => {
        console.error("Error loading cheques:", error);
      }
    );

    return () => unsubscribe();
  }, [user, client]);

  // Calculate current balance using Decimal.js for precision
  // Formula: balance = (sales - purchases) - (payments received - payments made) - income discounts/writeoffs + expense discounts/writeoffs - customer advances + supplier advances
  // Income discounts/writeoffs reduce what the customer owes us (subtract)
  // Expense discounts/writeoffs reduce what we owe the supplier (add back to make balance less negative)
  // Customer advances (سلفة عميل): We received cash, owe them goods → subtract (we owe them) - FULL amount
  // Supplier advances (سلفة مورد): We paid cash, they owe us goods → add (they owe us) - FULL amount
  // NOTE: Advance payments (amount used from advance) are NOT in this formula - they're informational only
  useEffect(() => {
    // Use Decimal.js via safeAdd/safeSubtract for money precision
    // NOTE: Advance payments (totalIncomeAdvancePayments, totalExpenseAdvancePayments) are NOT in formula
    // because advances are tracked at FULL amount via customerAdvances/supplierAdvances
    // The "مدفوع من سلفة" row on invoices is informational only (debit=0, credit=0)
    let balance = safeSubtract(totalSales, totalPurchases);
    balance = safeSubtract(balance, totalPaymentsReceived);
    balance = safeAdd(balance, totalPaymentsMade);
    balance = safeSubtract(balance, totalIncomeDiscounts);
    balance = safeSubtract(balance, totalIncomeWriteoffs);
    balance = safeAdd(balance, totalExpenseDiscounts);
    balance = safeAdd(balance, totalExpenseWriteoffs);
    // Include advance balances at FULL amount
    balance = safeSubtract(balance, customerAdvances);  // We owe customer (liability)
    balance = safeAdd(balance, supplierAdvances);       // Supplier owes us (asset)
    setCurrentBalance(balance);
  }, [totalSales, totalPurchases, totalPaymentsReceived, totalPaymentsMade, totalIncomeDiscounts, totalIncomeWriteoffs, totalExpenseDiscounts, totalExpenseWriteoffs, customerAdvances, supplierAdvances]);

  // Export statement to Excel
  const exportStatement = async () => {
    if (!client) return;

    const clientInitialBalance = client.balance || 0;
    const exportData = buildExportData(ledgerEntries, payments, cheques, clientInitialBalance);

    try {
      await exportStatementToExcel({
        clientName: client.name,
        clientPhone: client.phone,
        clientEmail: client.email,
        openingBalance: clientInitialBalance,
        transactions: exportData.transactions,
        totalDebit: exportData.totalDebit,
        totalCredit: exportData.totalCredit,
        finalBalance: exportData.finalBalance,
        pendingCheques: exportData.pendingCheques.length > 0 ? exportData.pendingCheques : undefined,
        expectedBalanceAfterCheques: exportData.pendingCheques.length > 0 ? exportData.balanceAfterCheques : undefined,
      });

      toast({
        title: "تم التصدير",
        description: "تم تصدير كشف الحساب بنجاح",
      });
    } catch (error) {
      console.error('Excel export error:', error);
      toast({
        title: "خطأ",
        description: "فشل تصدير الملف",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="text-xl">جاري التحميل...</div>
        </div>
      </div>
    );
  }

  if (!client) {
    return null;
  }

  return (
    <div className="container mx-auto p-6 space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push("/clients")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">{client.name}</h1>
            <p className="text-gray-500">{client.phone}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button onClick={exportStatement} variant="outline">
            <Download className="w-4 h-4 ml-2" />
            Excel
          </Button>
          <Button
            onClick={async () => {
              if (!client) return;

              const clientInitialBalance = client.balance || 0;
              const exportData = buildExportData(ledgerEntries, payments, cheques, clientInitialBalance);

              try {
                await exportStatementToPDF({
                  clientName: client.name,
                  clientPhone: client.phone,
                  clientEmail: client.email,
                  openingBalance: clientInitialBalance,
                  transactions: exportData.transactions,
                  totalDebit: exportData.totalDebit,
                  totalCredit: exportData.totalCredit,
                  finalBalance: exportData.finalBalance,
                  pendingCheques: exportData.pendingCheques.length > 0 ? exportData.pendingCheques : undefined,
                  expectedBalanceAfterCheques: exportData.pendingCheques.length > 0 ? exportData.balanceAfterCheques : undefined,
                });

                toast({
                  title: "تم التصدير",
                  description: "تم تصدير كشف الحساب بنجاح",
                });
              } catch (error) {
                console.error('PDF export error:', error);
                toast({
                  title: "خطأ",
                  description: "فشل تصدير الملف",
                  variant: "destructive",
                });
              }
            }}
            variant="outline"
          >
            <FileText className="w-4 h-4 ml-2" />
            PDF
          </Button>
        </div>
      </div>

      {/* Financial Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              إجمالي المبيعات
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {totalSales.toFixed(2)} د.أ
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {ledgerEntries.filter((e) => e.type === "دخل" || e.type === "إيراد").length} معاملة
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
              <TrendingDown className="w-4 h-4" />
              إجمالي المشتريات
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {totalPurchases.toFixed(2)} د.أ
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {ledgerEntries.filter((e) => e.type === "مصروف").length} معاملة
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
              <DollarSign className="w-4 h-4" />
              المدفوعات
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-semibold text-gray-700">
              <span className="text-green-600">قبض: {totalPaymentsReceived.toFixed(2)}</span>
            </div>
            <div className="text-lg font-semibold text-gray-700">
              <span className="text-red-600">صرف: {totalPaymentsMade.toFixed(2)}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
              <FileText className="w-4 h-4" />
              الرصيد الحالي
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl font-bold ${
                currentBalance >= 0 ? "text-red-600" : "text-green-600"
              }`}
            >
              {formatNumber(Math.abs(currentBalance))} د.أ
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {currentBalance > 0 ? "عليه" : currentBalance < 0 ? "له" : "(مسدد)"}
            </p>
          </CardContent>
        </Card>

        {/* Loan Balance Card - Only show if there are loans */}
        {(loansReceivable > 0 || loansPayable > 0) && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
                <Landmark className="w-4 h-4" />
                رصيد القروض
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loansReceivable > 0 && (
                <div className="text-lg font-semibold text-green-600">
                  له (قرض ممنوح): {loansReceivable.toFixed(2)} د.أ
                </div>
              )}
              {loansPayable > 0 && (
                <div className="text-lg font-semibold text-red-600">
                  عليه (قرض مستلم): {loansPayable.toFixed(2)} د.أ
                </div>
              )}
              <p className="text-xs text-gray-500 mt-1">
                {loansReceivable > 0 && loansPayable > 0
                  ? "قروض متبادلة"
                  : loansReceivable > 0
                  ? "قرض ممنوح للعميل"
                  : "قرض من العميل"}
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Client Info Card */}
      <Card>
        <CardHeader>
          <CardTitle>معلومات العميل</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-gray-500">الهاتف</p>
              <p className="font-medium">{client.phone}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">البريد الإلكتروني</p>
              <p className="font-medium">{client.email || "-"}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">العنوان</p>
              <p className="font-medium">{client.address || "-"}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">تاريخ التسجيل</p>
              <p className="font-medium">{formatShortDate(client.createdAt)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs Section */}
      <Tabs defaultValue="transactions" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="transactions">المعاملات المالية</TabsTrigger>
          <TabsTrigger value="payments">الدفعات</TabsTrigger>
          <TabsTrigger value="cheques">الشيكات</TabsTrigger>
          <TabsTrigger value="statement">كشف الحساب</TabsTrigger>
        </TabsList>

        {/* Transactions Tab */}
        <TabsContent value="transactions">
          <Card>
            <CardHeader>
              <CardTitle>المعاملات المالية</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>التاريخ</TableHead>
                    <TableHead>النوع</TableHead>
                    <TableHead>الفئة</TableHead>
                    <TableHead>الوصف</TableHead>
                    <TableHead className="text-left">المبلغ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ledgerEntries.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-gray-500">
                        لا توجد معاملات مالية
                      </TableCell>
                    </TableRow>
                  ) : (
                    ledgerEntries.map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell>{formatShortDate(entry.date)}</TableCell>
                        <TableCell>
                          <span
                            className={`px-2 py-1 rounded text-xs ${
                              entry.type === "دخل" || entry.type === "إيراد"
                                ? "bg-green-100 text-green-800"
                                : "bg-red-100 text-red-800"
                            }`}
                          >
                            {entry.type}
                          </span>
                        </TableCell>
                        <TableCell>{entry.category}</TableCell>
                        <TableCell>{entry.description}</TableCell>
                        <TableCell className="text-left font-medium">
                          {entry.amount.toFixed(2)} د.أ
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Payments Tab */}
        <TabsContent value="payments">
          <Card>
            <CardHeader>
              <CardTitle>الدفعات</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>التاريخ</TableHead>
                    <TableHead>النوع</TableHead>
                    <TableHead>طريقة الدفع</TableHead>
                    <TableHead>الوصف</TableHead>
                    <TableHead className="text-left">المبلغ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-gray-500">
                        لا توجد دفعات
                      </TableCell>
                    </TableRow>
                  ) : (
                    payments.map((payment) => (
                      <TableRow key={payment.id}>
                        <TableCell>{formatShortDate(payment.date)}</TableCell>
                        <TableCell>
                          <span
                            className={`px-2 py-1 rounded text-xs ${
                              payment.type === "قبض"
                                ? "bg-green-100 text-green-800"
                                : "bg-red-100 text-red-800"
                            }`}
                          >
                            {payment.type}
                          </span>
                        </TableCell>
                        <TableCell>{payment.paymentMethod}</TableCell>
                        <TableCell>{payment.description}</TableCell>
                        <TableCell className="text-left font-medium">
                          {payment.amount.toFixed(2)} د.أ
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Cheques Tab */}
        <TabsContent value="cheques">
          <Card>
            <CardHeader>
              <CardTitle>الشيكات</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>رقم الشيك</TableHead>
                    <TableHead>تاريخ الإصدار</TableHead>
                    <TableHead>البنك</TableHead>
                    <TableHead>النوع</TableHead>
                    <TableHead>الحالة</TableHead>
                    <TableHead className="text-left">المبلغ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cheques.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-gray-500">
                        لا توجد شيكات
                      </TableCell>
                    </TableRow>
                  ) : (
                    cheques.map((cheque) => (
                      <TableRow key={cheque.id}>
                        <TableCell>{cheque.chequeNumber}</TableCell>
                        <TableCell>{formatShortDate(cheque.issueDate)}</TableCell>
                        <TableCell>{cheque.bankName}</TableCell>
                        <TableCell>{cheque.type}</TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            <span
                              className={`px-2 py-1 rounded text-xs inline-block w-fit ${
                                cheque.status === CHEQUE_STATUS_AR.PENDING
                                  ? "bg-yellow-100 text-yellow-800"
                                  : cheque.status === CHEQUE_STATUS_AR.CASHED || cheque.status === CHEQUE_STATUS_AR.COLLECTED
                                  ? "bg-green-100 text-green-800"
                                  : cheque.status === CHEQUE_STATUS_AR.ENDORSED
                                  ? "bg-purple-100 text-purple-800"
                                  : cheque.status === CHEQUE_STATUS_AR.BOUNCED
                                  ? "bg-red-100 text-red-800"
                                  : cheque.status === CHEQUE_STATUS_AR.RETURNED
                                  ? "bg-orange-100 text-orange-800"
                                  : "bg-gray-100 text-gray-800"
                              }`}
                            >
                              {cheque.status}
                            </span>
                            {/* Show endorsement info if cheque is endorsed */}
                            {cheque.endorsedTo && (
                              <span className="text-xs text-purple-600">
                                ← {cheque.endorsedTo}
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-left font-medium">
                          {cheque.amount.toFixed(2)} د.أ
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Statement Tab - Redesigned Account Statement */}
        <TabsContent value="statement">
          <Card>
            <CardContent className="p-0">
              <div>
                {/* Statement Header */}
                <div className="bg-gradient-to-l from-blue-600 to-blue-800 text-white p-5 rounded-t-lg">
                  <h3 className="text-lg mb-1">كشف حساب</h3>
                  <div className="text-2xl font-bold mb-2">{client?.name}</div>
                  {allTransactions.length > 0 && (
                    <div className="text-sm opacity-90">
                      الفترة: من {dateFrom ? format(dateFrom, "dd/MM/yyyy") : formatDateAr(dateRange.oldest)} إلى {dateTo ? format(dateTo, "dd/MM/yyyy") : formatDateAr(dateRange.newest)}
                    </div>
                  )}
                </div>

                {/* Date Range Filter Bar */}
                <div className="flex flex-wrap items-center gap-4 p-4 bg-gray-50 border-b" dir="rtl">
                  <span className="text-sm font-medium text-gray-600">تصفية حسب التاريخ:</span>

                  {/* From Date */}
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-500">من</span>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={`w-[140px] justify-start text-right font-normal ${
                            !dateFrom && "text-muted-foreground"
                          }`}
                        >
                          <CalendarIcon className="ml-2 h-4 w-4" />
                          {dateFrom ? format(dateFrom, "dd/MM/yyyy") : "اختر تاريخ"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={dateFrom}
                          onSelect={setDateFrom}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>

                  {/* To Date */}
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-500">إلى</span>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={`w-[140px] justify-start text-right font-normal ${
                            !dateTo && "text-muted-foreground"
                          }`}
                        >
                          <CalendarIcon className="ml-2 h-4 w-4" />
                          {dateTo ? format(dateTo, "dd/MM/yyyy") : "اختر تاريخ"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={dateTo}
                          onSelect={setDateTo}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>

                  {/* Clear Filter Button */}
                  {(dateFrom || dateTo) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setDateFrom(undefined);
                        setDateTo(undefined);
                      }}
                      className="text-gray-500 hover:text-gray-700"
                    >
                      مسح الفلتر
                    </Button>
                  )}

                  {/* Show filtered count */}
                  {(dateFrom || dateTo) && (
                    <span className="text-sm text-gray-500 mr-auto">
                      ({statementData.filteredTransactions.length} من {allTransactions.length} معاملة)
                    </span>
                  )}
                </div>

                {/* Statement Table - RTL column order: الرصيد | دائن | مدين | البيان | التاريخ */}
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-gray-50 border-b-2 border-gray-200">
                        <th colSpan={2} className="px-4 py-3 text-right text-sm font-semibold text-gray-600">الرصيد</th>
                        <th className="px-4 py-3 text-right text-sm font-semibold text-gray-600">دائن</th>
                        <th className="px-4 py-3 text-right text-sm font-semibold text-gray-600">مدين</th>
                        <th className="px-4 py-3 text-right text-sm font-semibold text-gray-600">البيان</th>
                        <th className="px-4 py-3 text-right text-sm font-semibold text-gray-600">التاريخ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {/* Opening Balance Row */}
                      <tr className="bg-gray-100">
                        <td className={`pl-1 pr-2 py-3 font-medium ${statementData.openingBalance > 0 ? 'text-red-600' : statementData.openingBalance < 0 ? 'text-green-600' : ''}`}>
                          د.أ {statementData.openingBalance > 0 ? 'عليه' : statementData.openingBalance < 0 ? 'له' : ''}
                        </td>
                        <td className={`pl-0 pr-4 py-3 font-medium text-left ${statementData.openingBalance > 0 ? 'text-red-600' : statementData.openingBalance < 0 ? 'text-green-600' : ''}`}>
                          {formatNumber(Math.abs(statementData.openingBalance))}
                        </td>
                        <td className="px-4 py-3"></td>
                        <td className="px-4 py-3"></td>
                        <td colSpan={2} className="px-4 py-3 text-right font-medium text-gray-600">رصيد افتتاحي</td>
                      </tr>

                      {/* Transaction Rows */}
                      {statementData.rowsWithBalance.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                            لا توجد معاملات
                          </td>
                        </tr>
                      ) : (
                        statementData.rowsWithBalance.map((transaction, index) => (
                          <tr
                            key={index}
                            onClick={() => {
                              setSelectedTransaction(transaction);
                              setIsModalOpen(true);
                            }}
                            className="border-b border-gray-100 hover:bg-blue-50 cursor-pointer transition-colors"
                          >
                            <td className={`pl-1 pr-2 py-3 text-sm font-semibold ${transaction.balance >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                              د.أ {transaction.balance > 0 ? 'عليه' : transaction.balance < 0 ? 'له' : ''}
                            </td>
                            <td className={`pl-0 pr-4 py-3 text-sm font-semibold text-left ${transaction.balance >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                              {formatNumber(Math.abs(transaction.balance))}
                            </td>
                            <td className="px-4 py-3 text-sm text-green-600 font-medium">
                              {transaction.credit > 0 ? formatNumber(transaction.credit) : ''}
                            </td>
                            <td className="px-4 py-3 text-sm text-red-600 font-medium">
                              {transaction.debit > 0 ? formatNumber(transaction.debit) : ''}
                            </td>
                            <td className="px-4 py-3 text-sm text-right">
                              <div className="flex items-center gap-2 justify-end">
                                <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium shrink-0 ${
                                  transaction.entryType === 'سلفة'
                                    ? 'bg-orange-100 text-orange-800'
                                    : transaction.entryType === 'قرض'
                                    ? 'bg-indigo-100 text-indigo-800'
                                    : transaction.isEndorsement
                                    ? 'bg-purple-100 text-purple-800'
                                    : transaction.isPayment
                                    ? 'bg-green-100 text-green-800'
                                    : 'bg-blue-100 text-blue-800'
                                }`}>
                                  {transaction.entryType === 'سلفة' ? 'سلفة' : transaction.entryType === 'قرض' ? 'قرض' : transaction.isEndorsement ? 'تظهير' : transaction.isPayment ? 'دفعة' : 'فاتورة'}
                                </span>
                                <span>
                                  {transaction.isPayment
                                    ? extractPaymentMethod(transaction.description)
                                    : transaction.description}
                                </span>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-sm">{formatDateAr(transaction.date)}</td>
                          </tr>
                        ))
                      )}

                      {/* Totals Row */}
                      {statementData.rowsWithBalance.length > 0 && (
                        <tr className="bg-blue-800 text-white font-semibold">
                          <td className="pl-1 pr-0 py-4"></td>
                          <td className="pl-0 pr-4 py-4"></td>
                          <td className="px-4 py-4">{formatNumber(statementData.totalCredit)}</td>
                          <td className="px-4 py-4">{formatNumber(statementData.totalDebit)}</td>
                          <td className="px-4 py-4">المجموع</td>
                          <td className="px-4 py-4"></td>
                        </tr>
                      )}

                      {/* Final Balance Row */}
                      {statementData.rowsWithBalance.length > 0 && (
                        <tr className="bg-green-50">
                          <td className={`pl-1 pr-2 py-4 font-bold ${statementData.finalBalance >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                            د.أ {statementData.finalBalance > 0 ? 'عليه' : statementData.finalBalance < 0 ? 'له' : '(مسدد)'}
                          </td>
                          <td className={`pl-0 pr-4 py-4 font-bold text-lg text-left ${statementData.finalBalance >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                            {formatNumber(Math.abs(statementData.finalBalance))}
                          </td>
                          <td className="px-4 py-4 font-bold text-gray-800" colSpan={3}>
                            الرصيد المستحق
                          </td>
                          <td className="px-4 py-4"></td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Pending Cheques Section */}
                {(() => {
                  const pendingCheques = filterPendingCheques(cheques);
                  if (pendingCheques.length === 0) return null;

                  const totalPendingCheques = pendingCheques.reduce((sum, c) => sum + (c.amount || 0), 0);
                  const { balanceAfterCheques } = calculateBalanceAfterCheques(statementData.finalBalance, pendingCheques);

                  return (
                    <div className="mt-6 border-t-2 border-gray-200 pt-6 px-4" dir="rtl">
                      <h3 className="text-lg font-semibold text-gray-700 mb-4 flex items-center gap-2">
                        <span>شيكات قيد الانتظار</span>
                        <span className="bg-yellow-100 text-yellow-800 text-sm px-2 py-1 rounded-full">
                          {pendingCheques.length}
                        </span>
                      </h3>

                      <div className="bg-yellow-50 rounded-lg overflow-hidden">
                        <table className="w-full">
                          <thead>
                            <tr className="bg-yellow-100">
                              <th className="px-4 py-3 text-right text-sm font-semibold text-yellow-800">رقم الشيك</th>
                              <th className="px-4 py-3 text-right text-sm font-semibold text-yellow-800">النوع</th>
                              <th className="px-4 py-3 text-right text-sm font-semibold text-yellow-800">البنك</th>
                              <th className="px-4 py-3 text-right text-sm font-semibold text-yellow-800">تاريخ الاستحقاق</th>
                              <th className="px-4 py-3 text-right text-sm font-semibold text-yellow-800">المبلغ</th>
                            </tr>
                          </thead>
                          <tbody>
                            {pendingCheques.map((cheque, index) => (
                              <tr key={cheque.id} className={index % 2 === 0 ? 'bg-yellow-50' : 'bg-white'}>
                                <td className="px-4 py-3 text-sm">{cheque.chequeNumber}</td>
                                <td className="px-4 py-3 text-sm">{cheque.type}</td>
                                <td className="px-4 py-3 text-sm">{cheque.bankName}</td>
                                <td className="px-4 py-3 text-sm">
                                  {cheque.dueDate ? formatDateAr(cheque.dueDate) : '-'}
                                </td>
                                <td className="px-4 py-3 text-sm font-medium">
                                  {formatNumber(cheque.amount)} د.أ
                                </td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot>
                            <tr className="bg-yellow-200 font-semibold">
                              <td colSpan={4} className="px-4 py-3 text-right">إجمالي الشيكات المعلقة</td>
                              <td className="px-4 py-3">
                                {formatNumber(totalPendingCheques)} د.أ
                              </td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>

                      {/* Balance After Cheques Clear */}
                      <div className="mt-4 p-4 bg-gray-100 rounded-lg flex justify-between items-center">
                        <span className="font-medium text-gray-600">الرصيد المتوقع بعد صرف الشيكات:</span>
                        <span className={`text-lg font-bold ${
                          balanceAfterCheques > 0 ? 'text-red-600' : balanceAfterCheques < 0 ? 'text-green-600' : ''
                        }`}>
                          {formatNumber(Math.abs(balanceAfterCheques))} د.أ
                          {balanceAfterCheques > 0 ? ' عليه' : balanceAfterCheques < 0 ? ' له' : ' (مسدد)'}
                        </span>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </CardContent>
          </Card>

          {/* Transaction Detail Modal */}
          <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
            <DialogContent className="sm:max-w-xl" dir="rtl">
              <DialogHeader>
                <DialogTitle className="text-right">
                  تفاصيل المعاملة
                </DialogTitle>
              </DialogHeader>

              {selectedTransaction && (
                <div className="px-4 py-2 space-y-5 text-right">
                  {/* Transaction Type Badge */}
                  <div className="flex justify-end mb-4">
                    <span className={`px-4 py-1.5 rounded-full text-sm font-medium ${
                      selectedTransaction.isPayment
                        ? 'bg-green-100 text-green-800'
                        : 'bg-blue-100 text-blue-800'
                    }`}>
                      {selectedTransaction.isPayment ? 'دفعة' : 'فاتورة'}
                    </span>
                  </div>

                  {/* Details Grid */}
                  <div className="grid gap-4 text-sm px-2">
                    <div className="flex justify-between items-start border-b pb-3">
                      <span className="font-medium">
                        {new Date(selectedTransaction.date).toLocaleDateString('en-GB')}
                      </span>
                      <span className="text-gray-500 mr-4">:التاريخ</span>
                    </div>

                    <div className="flex justify-between items-start border-b pb-3">
                      <span className="font-medium">{selectedTransaction.description || '-'}</span>
                      <span className="text-gray-500 mr-4">:الوصف</span>
                    </div>

                    <div className="flex justify-between items-start border-b pb-3">
                      <span className={`font-bold ${
                        selectedTransaction.debit > 0 ? 'text-red-600' : 'text-green-600'
                      }`}>
                        {formatNumber(selectedTransaction.debit || selectedTransaction.credit || 0)} د.أ
                      </span>
                      <span className="text-gray-500 mr-4">:المبلغ</span>
                    </div>

                    {/* Show category for ledger entries */}
                    {!selectedTransaction.isPayment && selectedTransaction.category && (
                      <div className="flex justify-between items-start border-b pb-3">
                        <span className="font-medium">
                          {selectedTransaction.subCategory || selectedTransaction.category}
                        </span>
                        <span className="text-gray-500 mr-4">:الفئة</span>
                      </div>
                    )}

                    {/* Show payment method for payments */}
                    {selectedTransaction.isPayment && selectedTransaction.notes && (
                      <div className="flex justify-between items-start border-b pb-3">
                        <span className="font-medium">
                          {selectedTransaction.notes.split(' - ')[0]}
                        </span>
                        <span className="text-gray-500 mr-4">:طريقة الدفع</span>
                      </div>
                    )}

                    {/* Transaction ID with Copy Button (for ledger entries) */}
                    {!selectedTransaction.isPayment && selectedTransaction.transactionId && (
                      <div className="flex justify-between items-center border-b pb-3">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs text-gray-600 break-all">
                            {selectedTransaction.transactionId}
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              navigator.clipboard.writeText(selectedTransaction.transactionId || '');
                              toast({
                                title: "تم النسخ",
                                description: "تم نسخ رقم المعاملة",
                              });
                            }}
                            className="p-1 hover:bg-gray-100 rounded transition-colors"
                            title="نسخ"
                          >
                            <Copy className="h-4 w-4 text-gray-400 hover:text-gray-600" />
                          </button>
                        </div>
                        <span className="text-gray-500 mr-4 shrink-0">:رقم المعاملة</span>
                      </div>
                    )}
                  </div>

                  {/* Action Button */}
                  <div className="pt-4 px-2">
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => {
                        const searchId = selectedTransaction.transactionId || selectedTransaction.id;
                        if (selectedTransaction.isPayment) {
                          router.push(`/payments?search=${encodeURIComponent(searchId)}`);
                        } else {
                          router.push(`/ledger?search=${encodeURIComponent(searchId)}`);
                        }
                        setIsModalOpen(false);
                      }}
                    >
                      {selectedTransaction.isPayment ? 'عرض في المدفوعات' : 'عرض في دفتر الأستاذ'}
                    </Button>
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>
        </TabsContent>
      </Tabs>
    </div>
  );
}
