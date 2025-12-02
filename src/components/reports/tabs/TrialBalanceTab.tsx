/**
 * TrialBalanceTab - Displays trial balance report with debit/credit verification
 * Uses double-entry journal entries for accurate balances
 */

import React from "react";
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
import { Download, RefreshCw, AlertTriangle, CheckCircle2 } from "lucide-react";
import { useTrialBalance } from "../hooks/useTrialBalance";
import { AccountBalance } from "@/types/accounting";

interface TrialBalanceTabProps {
  ledgerEntries?: unknown[];
  payments?: unknown[];
  onExportCSV: () => void;
}

export function TrialBalanceTab({
  onExportCSV,
}: TrialBalanceTabProps) {
  const { trialBalance, loading, error, refresh, isBalanced } = useTrialBalance();

  // Group accounts by type for display
  const groupAccountsByType = (accounts: AccountBalance[]) => {
    const groups: Record<string, AccountBalance[]> = {
      asset: [],
      liability: [],
      equity: [],
      revenue: [],
      expense: [],
    };

    accounts.forEach((account) => {
      if (groups[account.accountType]) {
        groups[account.accountType].push(account);
      }
    });

    return groups;
  };

  const formatAmount = (amount: number): string => {
    if (amount === 0) return "-";
    return `${amount.toLocaleString('ar-JO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} د.أ`;
  };

  const getAccountTypeLabel = (type: string): string => {
    const labels: Record<string, string> = {
      asset: "الأصول",
      liability: "الالتزامات",
      equity: "حقوق الملكية",
      revenue: "الإيرادات",
      expense: "المصروفات",
    };
    return labels[type] || type;
  };

  const handleExportCSV = () => {
    if (!trialBalance) {
      onExportCSV();
      return;
    }

    // Export using journal-based trial balance
    const csvData = trialBalance.accounts.map((account) => ({
      'رمز الحساب': account.accountCode,
      'اسم الحساب': account.accountNameAr,
      'النوع': getAccountTypeLabel(account.accountType),
      'المدين': account.totalDebits,
      'الدائن': account.totalCredits,
      'الرصيد': account.balance,
    }));

    // Add totals row
    csvData.push({
      'رمز الحساب': '',
      'اسم الحساب': 'المجموع الكلي',
      'النوع': '',
      'المدين': trialBalance.totalDebits,
      'الدائن': trialBalance.totalCredits,
      'الرصيد': trialBalance.totalDebits - trialBalance.totalCredits,
    });

    // Convert to CSV
    const headers = Object.keys(csvData[0]).join(',');
    const rows = csvData.map((row) => Object.values(row).join(','));
    const csv = [headers, ...rows].join('\n');

    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `ميزان_المراجعة_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

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
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={refresh} disabled={loading}>
                <RefreshCw className={`w-4 h-4 ml-2 ${loading ? 'animate-spin' : ''}`} />
                تحديث
              </Button>
              <Button variant="outline" size="sm" onClick={handleExportCSV}>
                <Download className="w-4 h-4 ml-2" />
                تصدير CSV
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading && (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="w-6 h-6 animate-spin text-gray-400" />
              <span className="mr-2 text-gray-500">جاري التحميل...</span>
            </div>
          )}

          {error && (
            <div className="bg-red-50 text-red-700 p-4 rounded-lg flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" />
              <span>{error}</span>
            </div>
          )}

          {!loading && !error && trialBalance && (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-24">رمز الحساب</TableHead>
                    <TableHead>اسم الحساب</TableHead>
                    <TableHead className="text-right w-32">المدين (Debit)</TableHead>
                    <TableHead className="text-right w-32">الدائن (Credit)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(() => {
                    const groups = groupAccountsByType(trialBalance.accounts);
                    const typeOrder = ['asset', 'liability', 'equity', 'revenue', 'expense'];

                    return typeOrder.map((type) => {
                      const accounts = groups[type];
                      if (accounts.length === 0) return null;

                      return (
                        <React.Fragment key={type}>
                          {/* Section Header */}
                          <TableRow className="bg-gray-50">
                            <TableCell colSpan={4} className="font-bold text-gray-700">
                              {getAccountTypeLabel(type)}
                            </TableCell>
                          </TableRow>

                          {/* Account Rows */}
                          {accounts.map((account) => (
                            <TableRow key={account.accountCode}>
                              <TableCell className="text-gray-500 font-mono text-sm">
                                {account.accountCode}
                              </TableCell>
                              <TableCell className="font-medium">
                                {account.accountNameAr}
                              </TableCell>
                              <TableCell className="text-right">
                                {formatAmount(account.totalDebits)}
                              </TableCell>
                              <TableCell className="text-right">
                                {formatAmount(account.totalCredits)}
                              </TableCell>
                            </TableRow>
                          ))}
                        </React.Fragment>
                      );
                    });
                  })()}

                  {/* Totals Row */}
                  <TableRow className="bg-gray-100 font-bold border-t-2">
                    <TableCell colSpan={2}>المجموع الكلي</TableCell>
                    <TableCell className="text-right text-blue-700">
                      {formatAmount(trialBalance.totalDebits)}
                    </TableCell>
                    <TableCell className="text-right text-blue-700">
                      {formatAmount(trialBalance.totalCredits)}
                    </TableCell>
                  </TableRow>

                  {/* Balance Verification */}
                  <TableRow className={isBalanced ? "bg-green-50" : "bg-red-50"}>
                    <TableCell colSpan={4} className="text-center py-4">
                      {isBalanced ? (
                        <span className="text-green-700 font-semibold flex items-center justify-center gap-2">
                          <CheckCircle2 className="w-5 h-5" />
                          الميزان متوازن - المدين = الدائن
                        </span>
                      ) : (
                        <span className="text-red-700 font-semibold flex items-center justify-center gap-2">
                          <AlertTriangle className="w-5 h-5" />
                          فرق في الميزان: {formatAmount(trialBalance.difference)}
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>

              {trialBalance.accounts.length === 0 && (
                <p className="text-center text-gray-500 py-8">
                  لا توجد قيود محاسبية لعرض ميزان المراجعة
                </p>
              )}
            </>
          )}

          {!loading && !error && !trialBalance && (
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
          <div className="bg-green-50 p-3 rounded-lg mt-3">
            <p className="font-medium text-green-900">مصدر البيانات:</p>
            <p className="text-green-800">
              يتم احتساب ميزان المراجعة من القيود المحاسبية (Journal Entries) التي تُنشأ
              تلقائياً عند تسجيل المعاملات المالية.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
