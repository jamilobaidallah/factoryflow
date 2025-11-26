/**
 * TrialBalanceTab - Displays trial balance report with debit/credit verification
 * Extracted from reports-page.tsx for better maintainability
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Download } from "lucide-react";

interface LedgerEntry {
  id: string;
  category: string;
  type: string;
  amount: number;
  isARAPEntry?: boolean;
  remainingBalance?: number;
}

interface Payment {
  id: string;
  amount: number;
  type: string;
}

interface TrialBalanceTabProps {
  ledgerEntries: LedgerEntry[];
  payments: Payment[];
  onExportCSV: () => void;
}

export function TrialBalanceTab({
  ledgerEntries,
  payments,
  onExportCSV,
}: TrialBalanceTabProps) {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>ميزان المراجعة (Trial Balance)</CardTitle>
              <p className="text-sm text-gray-500 mt-1">
                التحقق من توازن الحسابات - المدين = الدائن
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={onExportCSV}>
              <Download className="w-4 h-4 ml-2" />
              تصدير CSV
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-1/2">اسم الحساب</TableHead>
                <TableHead className="text-right">المدين (Debit)</TableHead>
                <TableHead className="text-right">الدائن (Credit)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(() => {
                const categoryTotals: {
                  [key: string]: { debit: number; credit: number };
                } = {};
                let totalDebit = 0;
                let totalCredit = 0;
                let accountsReceivable = 0;
                let accountsPayable = 0;

                // Calculate totals by category and AR/AP
                ledgerEntries.forEach((entry) => {
                  const category = entry.category || "غير مصنف";
                  if (!categoryTotals[category]) {
                    categoryTotals[category] = { debit: 0, credit: 0 };
                  }

                  if (entry.type === "دخل" || entry.type === "إيراد") {
                    categoryTotals[category].credit += entry.amount;
                    totalCredit += entry.amount;

                    // Track accounts receivable (unpaid income)
                    if (
                      entry.isARAPEntry &&
                      entry.remainingBalance &&
                      entry.remainingBalance > 0
                    ) {
                      accountsReceivable += entry.remainingBalance;
                    }
                  } else if (entry.type === "مصروف") {
                    categoryTotals[category].debit += entry.amount;
                    totalDebit += entry.amount;

                    // Track accounts payable (unpaid expenses)
                    if (
                      entry.isARAPEntry &&
                      entry.remainingBalance &&
                      entry.remainingBalance > 0
                    ) {
                      accountsPayable += entry.remainingBalance;
                    }
                  }
                });

                // Calculate net cash from payments
                let cashBalance = 0;
                payments.forEach((payment) => {
                  if (payment.type === "قبض") {
                    cashBalance += payment.amount;
                  } else if (payment.type === "صرف") {
                    cashBalance -= payment.amount;
                  }
                });

                // Add cash to trial balance (debit if positive, credit if negative)
                if (cashBalance > 0) {
                  totalDebit += cashBalance;
                } else if (cashBalance < 0) {
                  totalCredit += Math.abs(cashBalance);
                }

                // Add AR to debit
                if (accountsReceivable > 0) {
                  totalDebit += accountsReceivable;
                }

                // Add AP to credit
                if (accountsPayable > 0) {
                  totalCredit += accountsPayable;
                }

                const difference = Math.abs(totalDebit - totalCredit);
                const isBalanced = difference < 0.01; // Allow for rounding errors

                return (
                  <>
                    {/* Cash Account */}
                    {cashBalance !== 0 && (
                      <TableRow>
                        <TableCell className="font-medium">الصندوق (النقدية)</TableCell>
                        <TableCell className="text-right">
                          {cashBalance > 0 ? `${cashBalance.toFixed(2)} د.أ` : "-"}
                        </TableCell>
                        <TableCell className="text-right">
                          {cashBalance < 0
                            ? `${Math.abs(cashBalance).toFixed(2)} د.أ`
                            : "-"}
                        </TableCell>
                      </TableRow>
                    )}

                    {/* Accounts Receivable */}
                    {accountsReceivable > 0 && (
                      <TableRow>
                        <TableCell className="font-medium">
                          حسابات مدينة (ذمم عملاء)
                        </TableCell>
                        <TableCell className="text-right">
                          {accountsReceivable.toFixed(2)} د.أ
                        </TableCell>
                        <TableCell className="text-right">-</TableCell>
                      </TableRow>
                    )}

                    {/* Accounts Payable */}
                    {accountsPayable > 0 && (
                      <TableRow>
                        <TableCell className="font-medium">
                          حسابات دائنة (ذمم موردين)
                        </TableCell>
                        <TableCell className="text-right">-</TableCell>
                        <TableCell className="text-right">
                          {accountsPayable.toFixed(2)} د.أ
                        </TableCell>
                      </TableRow>
                    )}

                    {/* Category Accounts */}
                    {Object.entries(categoryTotals)
                      .sort(([a], [b]) => a.localeCompare(b, "ar"))
                      .map(([category, totals]) => (
                        <TableRow key={category}>
                          <TableCell className="font-medium">{category}</TableCell>
                          <TableCell className="text-right">
                            {totals.debit > 0 ? `${totals.debit.toFixed(2)} د.أ` : "-"}
                          </TableCell>
                          <TableCell className="text-right">
                            {totals.credit > 0 ? `${totals.credit.toFixed(2)} د.أ` : "-"}
                          </TableCell>
                        </TableRow>
                      ))}

                    {/* Totals Row */}
                    <TableRow className="bg-gray-100 font-bold">
                      <TableCell>المجموع الكلي</TableCell>
                      <TableCell className="text-right text-blue-700">
                        {totalDebit.toFixed(2)} د.أ
                      </TableCell>
                      <TableCell className="text-right text-blue-700">
                        {totalCredit.toFixed(2)} د.أ
                      </TableCell>
                    </TableRow>

                    {/* Balance Verification */}
                    <TableRow className={isBalanced ? "bg-green-50" : "bg-red-50"}>
                      <TableCell colSpan={3} className="text-center">
                        {isBalanced ? (
                          <span className="text-green-700 font-semibold flex items-center justify-center gap-2">
                            ✓ الميزان متوازن - المدين = الدائن
                          </span>
                        ) : (
                          <span className="text-red-700 font-semibold flex items-center justify-center gap-2">
                            ⚠ فرق في الميزان: {difference.toFixed(2)} د.أ
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  </>
                );
              })()}
            </TableBody>
          </Table>

          {ledgerEntries.length === 0 && payments.length === 0 && (
            <p className="text-center text-gray-500 py-8">
              لا توجد بيانات لعرض ميزان المراجعة
            </p>
          )}
        </CardContent>
      </Card>

      {/* Explanation Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">ما هو ميزان المراجعة؟</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-gray-600">
          <p>
            <strong>ميزان المراجعة (Trial Balance)</strong> هو تقرير محاسبي يعرض جميع
            الحسابات مع أرصدتها المدينة والدائنة في نهاية فترة معينة.
          </p>
          <p>
            <strong>الهدف الرئيسي:</strong> التحقق من أن مجموع المبالغ المدينة = مجموع
            المبالغ الدائنة (القيد المزدوج).
          </p>
          <div className="bg-blue-50 p-3 rounded-lg mt-3">
            <p className="font-medium text-blue-900">القاعدة الذهبية:</p>
            <p className="text-blue-800">
              • <strong>المدين (Debit):</strong> المصروفات، الأصول، المسحوبات
            </p>
            <p className="text-blue-800">
              • <strong>الدائن (Credit):</strong> الإيرادات، الخصوم، رأس المال
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
