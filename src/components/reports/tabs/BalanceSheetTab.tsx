/**
 * BalanceSheetTab - Displays balance sheet report (financial position)
 *
 * Shows:
 * - Assets (Cash, AR, Inventory, Fixed Assets)
 * - Liabilities (AP, Accrued Expenses)
 * - Equity (Owner's Capital, Retained Earnings, Net Income)
 *
 * Verifies: Assets = Liabilities + Equity
 */

import { useState } from "react";
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
import { Badge } from "@/components/ui/badge";
import { Download, RefreshCw, CheckCircle2, XCircle, Loader2, Trash2, Search, AlertTriangle, ChevronDown, ChevronUp } from "lucide-react";
import {
  useBalanceSheet,
  formatBalanceSheetAmount,
} from "../hooks/useBalanceSheet";
import { formatDate, formatNumber } from "@/lib/date-utils";
import { useUser } from "@/firebase/provider";
import { useToast } from "@/hooks/use-toast";
import { cleanupOrphanedJournalEntries, diagnoseJournalEntries, auditJournalEntries, JournalAuditResult } from "@/services/journalService";

interface BalanceSheetTabProps {
  asOfDate?: Date;
  onExportCSV?: () => void;
}

export function BalanceSheetTab({ asOfDate, onExportCSV }: BalanceSheetTabProps) {
  const { user } = useUser();
  const { toast } = useToast();
  const { balanceSheet, loading, error, refresh, isBalanced } = useBalanceSheet(asOfDate);
  const [cleaningUp, setCleaningUp] = useState(false);
  const [auditing, setAuditing] = useState(false);
  const [auditResult, setAuditResult] = useState<JournalAuditResult | null>(null);
  const [showAuditDetails, setShowAuditDetails] = useState(false);

  const handleCleanupOrphanedEntries = async () => {
    if (!user) return;

    setCleaningUp(true);
    try {
      // First get diagnostics to understand the situation
      const diagResult = await diagnoseJournalEntries(user.dataOwnerId);

      if (diagResult.success && diagResult.data) {
        const diag = diagResult.data;
        const cashAccount = diag.entriesByAccount['1000'] || diag.entriesByAccount['1100'];

        // Show diagnostic info
        const diagMsg = `تشخيص القيود المحاسبية:
- إجمالي القيود: ${diag.totalEntries}
- مرتبطة بمعاملات: ${diag.linkedToTransaction}
- مرتبطة بمدفوعات: ${diag.linkedToPayment}
- بدون ارتباط: ${diag.unlinked}
- يتيمة (معاملات محذوفة): ${diag.orphanedByTransaction}
- يتيمة (مدفوعات محذوفة): ${diag.orphanedByPayment}
${cashAccount ? `\nحساب النقدية: مدين ${cashAccount.debits.toFixed(2)} - دائن ${cashAccount.credits.toFixed(2)} = ${(cashAccount.debits - cashAccount.credits).toFixed(2)}` : ''}

هل تريد حذف القيود اليتيمة؟`;

        if (!window.confirm(diagMsg)) {
          setCleaningUp(false);
          return;
        }
      }

      // Do a dry run to see what will be deleted
      const dryRunResult = await cleanupOrphanedJournalEntries(user.dataOwnerId, true, false);

      if (dryRunResult.success && dryRunResult.data) {
        const { orphanedByTransaction, orphanedByPayment, unlinkedEntries } = dryRunResult.data;
        const totalOrphaned = orphanedByTransaction.length + orphanedByPayment.length;

        if (totalOrphaned === 0 && unlinkedEntries.length === 0) {
          toast({
            title: "لا توجد قيود يتيمة",
            description: "جميع القيود المحاسبية مرتبطة بمعاملات صحيحة.",
          });
          setCleaningUp(false);
          return;
        }

        // Ask about unlinked entries if any
        let includeUnlinked = false;
        if (unlinkedEntries.length > 0) {
          includeUnlinked = window.confirm(
            `يوجد ${unlinkedEntries.length} قيد بدون ارتباط (تم إنشاؤها يدوياً أو أثناء التطوير).\n\nهل تريد حذفها أيضاً؟`
          );
        }

        // Now actually delete them
        const deleteResult = await cleanupOrphanedJournalEntries(user.dataOwnerId, false, includeUnlinked);

        if (deleteResult.success && deleteResult.data) {
          toast({
            title: "تم التنظيف بنجاح",
            description: `تم حذف ${deleteResult.data.deleted.length} قيد.`,
          });
          // Refresh the balance sheet to show updated numbers
          refresh();
        } else {
          toast({
            title: "خطأ",
            description: deleteResult.error || "فشل حذف القيود اليتيمة",
            variant: "destructive",
          });
        }
      } else {
        toast({
          title: "خطأ",
          description: dryRunResult.error || "فشل البحث عن القيود اليتيمة",
          variant: "destructive",
        });
      }
    } catch (err) {
      console.error("Cleanup failed:", err);
      toast({
        title: "خطأ",
        description: "حدث خطأ أثناء التنظيف",
        variant: "destructive",
      });
    } finally {
      setCleaningUp(false);
    }
  };

  const handleAuditJournalEntries = async () => {
    if (!user) return;

    setAuditing(true);
    setAuditResult(null);
    try {
      const result = await auditJournalEntries(user.dataOwnerId);

      if (result.success && result.data) {
        setAuditResult(result.data);
        setShowAuditDetails(true);

        const { mismatches, duplicates } = result.data;
        const totalIssues = mismatches.length + duplicates.length;

        if (totalIssues === 0) {
          toast({
            title: "لا توجد مشاكل",
            description: "جميع القيود المحاسبية متطابقة مع المعاملات المصدرية.",
          });
        } else {
          toast({
            title: "تم العثور على مشاكل",
            description: `${mismatches.length} قيد غير متطابق، ${duplicates.length} قيد مكرر`,
            variant: "destructive",
          });
        }
      } else {
        toast({
          title: "خطأ",
          description: result.error || "فشل تدقيق القيود المحاسبية",
          variant: "destructive",
        });
      }
    } catch (err) {
      console.error("Audit failed:", err);
      toast({
        title: "خطأ",
        description: "حدث خطأ أثناء التدقيق",
        variant: "destructive",
      });
    } finally {
      setAuditing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
        <span className="mr-2 text-gray-500">جاري تحميل الميزانية العمومية...</span>
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center text-red-500">
            <XCircle className="w-12 h-12 mx-auto mb-2" />
            <p>حدث خطأ: {error}</p>
            <Button variant="outline" onClick={refresh} className="mt-4">
              <RefreshCw className="w-4 h-4 ml-2" />
              إعادة المحاولة
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!balanceSheet) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center text-gray-500">
            <p>لا توجد بيانات متاحة</p>
            <p className="text-sm mt-2">قم بإضافة معاملات مالية لعرض الميزانية العمومية</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                الميزانية العمومية (Balance Sheet)
                {isBalanced ? (
                  <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                    <CheckCircle2 className="w-3 h-3 ml-1" />
                    متوازنة
                  </Badge>
                ) : (
                  <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                    <XCircle className="w-3 h-3 ml-1" />
                    غير متوازنة
                  </Badge>
                )}
              </CardTitle>
              <p className="text-sm text-gray-500 mt-1">
                كما في {formatDate(balanceSheet.asOfDate)}
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleAuditJournalEntries}
                disabled={auditing}
                title="تدقيق القيود المحاسبية ومقارنتها بالمعاملات"
              >
                <Search className="w-4 h-4 ml-2" />
                {auditing ? "جاري التدقيق..." : "تدقيق القيود"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCleanupOrphanedEntries}
                disabled={cleaningUp}
                title="حذف القيود المحاسبية المرتبطة بمعاملات محذوفة"
              >
                <Trash2 className="w-4 h-4 ml-2" />
                {cleaningUp ? "جاري التنظيف..." : "تنظيف القيود اليتيمة"}
              </Button>
              <Button variant="outline" size="sm" onClick={refresh}>
                <RefreshCw className="w-4 h-4 ml-2" />
                تحديث
              </Button>
              {onExportCSV && (
                <Button variant="outline" size="sm" onClick={onExportCSV}>
                  <Download className="w-4 h-4 ml-2" />
                  تصدير CSV
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Assets Section */}
            <div>
              <h3 className="text-lg font-semibold mb-3 text-blue-700 border-b pb-2">
                {balanceSheet.assets.titleAr} (Assets)
              </h3>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>الحساب</TableHead>
                    <TableHead className="text-left">الرصيد</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {balanceSheet.assets.accounts.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={2} className="text-center text-gray-400">
                        لا توجد أصول
                      </TableCell>
                    </TableRow>
                  ) : (
                    balanceSheet.assets.accounts.map((account) => (
                      <TableRow key={account.accountCode}>
                        <TableCell>
                          <span className="text-sm text-gray-500 ml-2">
                            {account.accountCode}
                          </span>
                          {account.accountNameAr}
                        </TableCell>
                        <TableCell className="text-left font-mono">
                          {formatBalanceSheetAmount(account.balance)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                  <TableRow className="bg-blue-50 font-bold">
                    <TableCell>إجمالي الأصول</TableCell>
                    <TableCell className="text-left font-mono">
                      {formatBalanceSheetAmount(balanceSheet.totalAssets)}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>

            {/* Liabilities & Equity Section */}
            <div className="space-y-6">
              {/* Liabilities */}
              <div>
                <h3 className="text-lg font-semibold mb-3 text-red-700 border-b pb-2">
                  {balanceSheet.liabilities.titleAr} (Liabilities)
                </h3>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>الحساب</TableHead>
                      <TableHead className="text-left">الرصيد</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {balanceSheet.liabilities.accounts.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={2} className="text-center text-gray-400">
                          لا توجد التزامات
                        </TableCell>
                      </TableRow>
                    ) : (
                      balanceSheet.liabilities.accounts.map((account) => (
                        <TableRow key={account.accountCode}>
                          <TableCell>
                            <span className="text-sm text-gray-500 ml-2">
                              {account.accountCode}
                            </span>
                            {account.accountNameAr}
                          </TableCell>
                          <TableCell className="text-left font-mono">
                            {formatBalanceSheetAmount(account.balance)}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                    <TableRow className="bg-red-50 font-bold">
                      <TableCell>إجمالي الالتزامات</TableCell>
                      <TableCell className="text-left font-mono">
                        {formatBalanceSheetAmount(balanceSheet.liabilities.total)}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>

              {/* Equity */}
              <div>
                <h3 className="text-lg font-semibold mb-3 text-green-700 border-b pb-2">
                  {balanceSheet.equity.titleAr} (Equity)
                </h3>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>الحساب</TableHead>
                      <TableHead className="text-left">الرصيد</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {balanceSheet.equity.accounts.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={2} className="text-center text-gray-400">
                          لا توجد حقوق ملكية
                        </TableCell>
                      </TableRow>
                    ) : (
                      balanceSheet.equity.accounts.map((account) => (
                        <TableRow key={account.accountCode}>
                          <TableCell>
                            {account.accountCode !== 'NET_INCOME' && (
                              <span className="text-sm text-gray-500 ml-2">
                                {account.accountCode}
                              </span>
                            )}
                            {account.accountNameAr}
                            {account.accountCode === 'NET_INCOME' && (
                              <span className="text-xs text-gray-400 mr-2">(محسوب)</span>
                            )}
                          </TableCell>
                          <TableCell className={`text-left font-mono ${
                            account.accountCode === 'NET_INCOME'
                              ? account.balance >= 0 ? 'text-green-600' : 'text-red-600'
                              : ''
                          }`}>
                            {formatBalanceSheetAmount(account.balance)}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                    <TableRow className="bg-green-50 font-bold">
                      <TableCell>إجمالي حقوق الملكية</TableCell>
                      <TableCell className="text-left font-mono">
                        {formatBalanceSheetAmount(balanceSheet.equity.total)}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>

          {/* Verification Section */}
          <div className="mt-6 pt-4 border-t">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="bg-blue-50">
                <CardContent className="pt-4 text-center">
                  <p className="text-sm text-gray-600">إجمالي الأصول</p>
                  <p className="text-xl font-bold text-blue-700">
                    {formatBalanceSheetAmount(balanceSheet.totalAssets)}
                  </p>
                </CardContent>
              </Card>
              <Card className={isBalanced ? "bg-green-50" : "bg-red-50"}>
                <CardContent className="pt-4 text-center">
                  <p className="text-sm text-gray-600">=</p>
                  <p className={`text-lg font-bold ${isBalanced ? 'text-green-700' : 'text-red-700'}`}>
                    {isBalanced ? 'متطابق' : `فرق: ${formatBalanceSheetAmount(balanceSheet.difference)}`}
                  </p>
                </CardContent>
              </Card>
              <Card className="bg-purple-50">
                <CardContent className="pt-4 text-center">
                  <p className="text-sm text-gray-600">الالتزامات + حقوق الملكية</p>
                  <p className="text-xl font-bold text-purple-700">
                    {formatBalanceSheetAmount(balanceSheet.totalLiabilitiesAndEquity)}
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Audit Results Section */}
      {auditResult && (
        <Card className="border-amber-200">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-amber-700">
                <AlertTriangle className="w-5 h-5" />
                نتائج تدقيق القيود المحاسبية
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowAuditDetails(!showAuditDetails)}
              >
                {showAuditDetails ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              <div className="bg-blue-50 p-3 rounded-lg text-center">
                <p className="text-xs text-gray-600">إجمالي مدين النقدية (القيود)</p>
                <p className="text-lg font-bold text-blue-700">
                  {formatNumber(auditResult.totalJournalCashDebits)}
                </p>
              </div>
              <div className="bg-red-50 p-3 rounded-lg text-center">
                <p className="text-xs text-gray-600">إجمالي دائن النقدية (القيود)</p>
                <p className="text-lg font-bold text-red-700">
                  {formatNumber(auditResult.totalJournalCashCredits)}
                </p>
              </div>
              <div className="bg-green-50 p-3 rounded-lg text-center">
                <p className="text-xs text-gray-600">إجمالي النقد الداخل (السجل)</p>
                <p className="text-lg font-bold text-green-700">
                  {formatNumber(auditResult.totalLedgerCashIn + auditResult.totalPaymentCashIn)}
                </p>
              </div>
              <div className="bg-orange-50 p-3 rounded-lg text-center">
                <p className="text-xs text-gray-600">إجمالي النقد الخارج (السجل)</p>
                <p className="text-lg font-bold text-orange-700">
                  {formatNumber(auditResult.totalLedgerCashOut + auditResult.totalPaymentCashOut)}
                </p>
              </div>
            </div>

            {/* Expected vs Actual */}
            <div className="bg-gray-50 p-3 rounded-lg mb-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-600">رصيد النقدية من القيود: </span>
                  <span className="font-bold">
                    {formatNumber(auditResult.totalJournalCashDebits - auditResult.totalJournalCashCredits)}
                  </span>
                </div>
                <div>
                  <span className="text-gray-600">رصيد النقدية المتوقع: </span>
                  <span className="font-bold">
                    {formatNumber(
                      (auditResult.totalLedgerCashIn + auditResult.totalPaymentCashIn) -
                      (auditResult.totalLedgerCashOut + auditResult.totalPaymentCashOut)
                    )}
                  </span>
                </div>
              </div>
            </div>

            {showAuditDetails && (
              <div className="space-y-4">
                {/* Mismatches */}
                {auditResult.mismatches.length > 0 && (
                  <div>
                    <h4 className="font-semibold text-red-700 mb-2 flex items-center gap-2">
                      <XCircle className="w-4 h-4" />
                      قيود غير متطابقة ({auditResult.mismatches.length})
                    </h4>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>الوصف</TableHead>
                            <TableHead>النوع</TableHead>
                            <TableHead className="text-left">مبلغ القيد</TableHead>
                            <TableHead className="text-left">مبلغ المصدر</TableHead>
                            <TableHead className="text-left">الفرق</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {auditResult.mismatches.slice(0, 20).map((mismatch, idx) => (
                            <TableRow key={idx} className="bg-red-50/50">
                              <TableCell className="text-sm">
                                {mismatch.description || mismatch.linkedId.substring(0, 8) + "..."}
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline" className="text-xs">
                                  {mismatch.linkType === 'transaction' ? 'معاملة' : 'دفعة'}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-left font-mono">
                                {formatNumber(mismatch.journalCashAmount)}
                              </TableCell>
                              <TableCell className="text-left font-mono">
                                {formatNumber(mismatch.sourceAmount)}
                              </TableCell>
                              <TableCell className="text-left font-mono text-red-600">
                                {mismatch.difference > 0 ? '+' : ''}{formatNumber(mismatch.difference)}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                      {auditResult.mismatches.length > 20 && (
                        <p className="text-sm text-gray-500 mt-2 text-center">
                          عرض أول 20 من {auditResult.mismatches.length} قيد غير متطابق
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* Duplicates */}
                {auditResult.duplicates.length > 0 && (
                  <div>
                    <h4 className="font-semibold text-amber-700 mb-2 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4" />
                      قيود مكررة ({auditResult.duplicates.length})
                    </h4>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>معرف المعاملة</TableHead>
                            <TableHead className="text-left">عدد القيود</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {auditResult.duplicates.slice(0, 10).map((dup, idx) => (
                            <TableRow key={idx} className="bg-amber-50/50">
                              <TableCell className="font-mono text-sm">
                                {dup.transactionId.substring(0, 16)}...
                              </TableCell>
                              <TableCell className="text-left font-bold text-amber-700">
                                {dup.count}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                      {auditResult.duplicates.length > 10 && (
                        <p className="text-sm text-gray-500 mt-2 text-center">
                          عرض أول 10 من {auditResult.duplicates.length} معاملة مكررة
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* No issues */}
                {auditResult.mismatches.length === 0 && auditResult.duplicates.length === 0 && (
                  <div className="text-center py-4 bg-green-50 rounded-lg">
                    <CheckCircle2 className="w-8 h-8 mx-auto text-green-600 mb-2" />
                    <p className="text-green-700 font-medium">جميع القيود متطابقة مع المعاملات المصدرية</p>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
