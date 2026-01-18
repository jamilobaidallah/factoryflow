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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Download, RefreshCw, CheckCircle2, XCircle, Loader2, Wrench } from "lucide-react";
import {
  useBalanceSheet,
  formatBalanceSheetAmount,
} from "../hooks/useBalanceSheet";
import { formatDate } from "@/lib/date-utils";
import { rebuildJournalFromSources, JournalRebuildResult } from "@/services/journalService";
import { useUser } from "@/firebase/provider";
import { useToast } from "@/hooks/use-toast";

interface BalanceSheetTabProps {
  asOfDate?: Date;
  onExportCSV?: () => void;
}

export function BalanceSheetTab({ asOfDate, onExportCSV }: BalanceSheetTabProps) {
  const { balanceSheet, loading, error, refresh, isBalanced } = useBalanceSheet(asOfDate);
  const { user } = useUser();
  const { toast } = useToast();
  const [rebuilding, setRebuilding] = useState(false);
  const [rebuildResult, setRebuildResult] = useState<JournalRebuildResult | null>(null);

  const handleRebuild = async () => {
    if (!user?.dataOwnerId) {
      toast({
        title: "خطأ",
        description: "خطأ في المصادقة",
        variant: "destructive",
      });
      return;
    }

    setRebuilding(true);
    try {
      const result = await rebuildJournalFromSources(user.dataOwnerId);
      if (result.success && result.data) {
        setRebuildResult(result.data);
        toast({
          title: "تم بنجاح",
          description: `تم إعادة بناء القيود المحاسبية: ${result.data.createdFromLedger} من الدفتر، ${result.data.createdFromPayments} من المدفوعات`,
        });
        // Refresh balance sheet after rebuild
        refresh();
      } else {
        toast({
          title: "خطأ",
          description: `فشل إعادة البناء: ${result.error}`,
          variant: "destructive",
        });
      }
    } catch (err) {
      toast({
        title: "خطأ",
        description: "حدث خطأ أثناء إعادة البناء",
        variant: "destructive",
      });
      console.error(err);
    } finally {
      setRebuilding(false);
    }
  };

  const downloadBackup = () => {
    if (!rebuildResult?.backupData) return;
    const blob = new Blob([JSON.stringify(rebuildResult.backupData, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = rebuildResult.backupFileName || "journal_backup.json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
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
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-orange-600 border-orange-200 hover:bg-orange-50"
                    disabled={rebuilding}
                  >
                    {rebuilding ? (
                      <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                    ) : (
                      <Wrench className="w-4 h-4 ml-2" />
                    )}
                    إعادة بناء القيود
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent dir="rtl">
                  <AlertDialogHeader>
                    <AlertDialogTitle>إعادة بناء القيود المحاسبية</AlertDialogTitle>
                    <AlertDialogDescription className="text-right space-y-2">
                      <p>
                        سيتم حذف جميع القيود المحاسبية الحالية وإعادة إنشائها من:
                      </p>
                      <ul className="list-disc list-inside space-y-1 mr-4">
                        <li>دفتر الأستاذ (الإيرادات والمصروفات)</li>
                        <li>سجل المدفوعات (القبض والصرف)</li>
                      </ul>
                      <p className="text-orange-600 font-medium">
                        ⚠️ هذا الإجراء لا يمكن التراجع عنه. سيتم حفظ نسخة احتياطية.
                      </p>
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter className="flex-row-reverse gap-2">
                    <AlertDialogCancel>إلغاء</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleRebuild}
                      className="bg-orange-600 hover:bg-orange-700"
                    >
                      إعادة البناء
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
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

          {/* Rebuild Results Section */}
          {rebuildResult && (
            <div className="mt-6 pt-4 border-t">
              <Card className="bg-orange-50 border-orange-200">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base text-orange-700">
                    نتائج إعادة البناء
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                    <div className="text-center">
                      <p className="text-2xl font-bold text-orange-700">
                        {rebuildResult.deletedCount}
                      </p>
                      <p className="text-sm text-gray-600">قيود محذوفة</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-blue-700">
                        {rebuildResult.createdFromLedger}
                      </p>
                      <p className="text-sm text-gray-600">من الدفتر</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-green-700">
                        {rebuildResult.createdFromPayments}
                      </p>
                      <p className="text-sm text-gray-600">من المدفوعات</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-gray-500">
                        {rebuildResult.skippedEndorsed + rebuildResult.skippedNonCash}
                      </p>
                      <p className="text-sm text-gray-600">تم تخطيها</p>
                    </div>
                  </div>
                  {rebuildResult.errors.length > 0 && (
                    <div className="mt-4 p-3 bg-red-50 rounded border border-red-200">
                      <p className="text-sm text-red-700 font-medium mb-2">
                        أخطاء ({rebuildResult.errors.length}):
                      </p>
                      <ul className="text-xs text-red-600 space-y-1 max-h-32 overflow-y-auto">
                        {rebuildResult.errors.slice(0, 10).map((err, i) => (
                          <li key={i}>{err}</li>
                        ))}
                        {rebuildResult.errors.length > 10 && (
                          <li>... و {rebuildResult.errors.length - 10} أخطاء أخرى</li>
                        )}
                      </ul>
                    </div>
                  )}
                  <div className="mt-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={downloadBackup}
                      className="text-orange-600"
                    >
                      <Download className="w-4 h-4 ml-2" />
                      تحميل النسخة الاحتياطية
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
