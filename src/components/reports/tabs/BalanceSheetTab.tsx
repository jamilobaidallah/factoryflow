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
import { Download, RefreshCw, CheckCircle2, XCircle, Loader2, Trash2 } from "lucide-react";
import {
  useBalanceSheet,
  formatBalanceSheetAmount,
} from "../hooks/useBalanceSheet";
import { formatDate } from "@/lib/date-utils";
import { useUser } from "@/firebase/provider";
import { useToast } from "@/hooks/use-toast";
import { cleanupOrphanedJournalEntries } from "@/services/journalService";

interface BalanceSheetTabProps {
  asOfDate?: Date;
  onExportCSV?: () => void;
}

export function BalanceSheetTab({ asOfDate, onExportCSV }: BalanceSheetTabProps) {
  const { user } = useUser();
  const { toast } = useToast();
  const { balanceSheet, loading, error, refresh, isBalanced } = useBalanceSheet(asOfDate);
  const [cleaningUp, setCleaningUp] = useState(false);

  const handleCleanupOrphanedEntries = async () => {
    if (!user) return;

    setCleaningUp(true);
    try {
      // First do a dry run to see what will be deleted
      const dryRunResult = await cleanupOrphanedJournalEntries(user.dataOwnerId, true);

      if (dryRunResult.success && dryRunResult.data) {
        const { orphanedByTransaction, orphanedByPayment } = dryRunResult.data;
        const totalOrphaned = orphanedByTransaction.length + orphanedByPayment.length;

        if (totalOrphaned === 0) {
          toast({
            title: "لا توجد قيود يتيمة",
            description: "جميع القيود المحاسبية مرتبطة بمعاملات صحيحة.",
          });
          setCleaningUp(false);
          return;
        }

        // Confirm before deleting
        if (!window.confirm(`تم العثور على ${totalOrphaned} قيد يتيم. هل تريد حذفها؟`)) {
          setCleaningUp(false);
          return;
        }

        // Now actually delete them
        const deleteResult = await cleanupOrphanedJournalEntries(user.dataOwnerId, false);

        if (deleteResult.success && deleteResult.data) {
          toast({
            title: "تم التنظيف بنجاح",
            description: `تم حذف ${deleteResult.data.deleted.length} قيد يتيم.`,
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
    </div>
  );
}
