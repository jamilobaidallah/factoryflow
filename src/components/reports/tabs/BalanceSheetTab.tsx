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
import { Download, RefreshCw, CheckCircle2, XCircle, Loader2, Trash2, Search, AlertTriangle, ChevronDown, ChevronUp, Wrench } from "lucide-react";
import {
  useBalanceSheet,
  formatBalanceSheetAmount,
} from "../hooks/useBalanceSheet";
import { formatDate, formatNumber } from "@/lib/date-utils";
import { useUser } from "@/firebase/provider";
import { useToast } from "@/hooks/use-toast";
import { cleanupOrphanedJournalEntries, diagnoseJournalEntries, auditJournalEntries, cleanupDuplicateJournalEntries, JournalAuditResult, migrateLoanJournalEntries, migrateEndorsedChequeJournalEntries, findUnmatchedCashJournalEntries, UnmatchedCashEntry, deleteUnmatchedCashJournalEntries } from "@/services/journalService";

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
  const [cleaningDuplicates, setCleaningDuplicates] = useState(false);
  const [migratingLoans, setMigratingLoans] = useState(false);
  const [migratingEndorsements, setMigratingEndorsements] = useState(false);
  const [findingUnmatched, setFindingUnmatched] = useState(false);
  const [unmatchedEntries, setUnmatchedEntries] = useState<UnmatchedCashEntry[] | null>(null);
  const [unmatchedSummary, setUnmatchedSummary] = useState<{
    totalJournalCashDebits: number;
    totalMatchedCashDebits: number;
    discrepancy: number;
  } | null>(null);
  const [deletingUnmatched, setDeletingUnmatched] = useState(false);

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

  const handleCleanupDuplicates = async () => {
    if (!user || !auditResult || auditResult.duplicates.length === 0) return;

    const confirmed = window.confirm(
      `سيتم حذف ${auditResult.duplicates.reduce((sum, d) => sum + d.count - 1, 0)} قيد مكرر من ${auditResult.duplicates.length} معاملة.\n\nسيتم الاحتفاظ بالقيد الأقدم لكل معاملة وحذف القيود المكررة.\n\nهل تريد المتابعة؟`
    );

    if (!confirmed) return;

    setCleaningDuplicates(true);
    try {
      const result = await cleanupDuplicateJournalEntries(user.dataOwnerId, false);

      if (result.success && result.data) {
        toast({
          title: "تم حذف القيود المكررة",
          description: `تم حذف ${result.data.entriesDeleted} قيد مكرر من ${result.data.transactionsAffected.length} معاملة.`,
        });
        // Clear audit result and refresh
        setAuditResult(null);
        refresh();
      } else {
        toast({
          title: "خطأ",
          description: result.error || "فشل حذف القيود المكررة",
          variant: "destructive",
        });
      }
    } catch (err) {
      console.error("Cleanup duplicates failed:", err);
      toast({
        title: "خطأ",
        description: "حدث خطأ أثناء حذف القيود المكررة",
        variant: "destructive",
      });
    } finally {
      setCleaningDuplicates(false);
    }
  };

  const handleMigrateLoanEntries = async () => {
    if (!user) return;

    const confirmed = window.confirm(
      `سيتم تصحيح قيود القروض التي تم تسجيلها كمصروفات.\n\nالقروض الممنوحة (قروض ممنوحة) يجب أن تكون أصل (1600)\nالقروض المستلمة (قروض مستلمة) يجب أن تكون التزام (2300)\n\nهل تريد المتابعة؟`
    );

    if (!confirmed) return;

    setMigratingLoans(true);
    try {
      const result = await migrateLoanJournalEntries(user.dataOwnerId);

      if (result.success && result.data) {
        const { corrected, skipped, errors } = result.data;

        if (corrected.length > 0) {
          toast({
            title: "تم تصحيح قيود القروض",
            description: `تم تصحيح ${corrected.length} قيد. تم تخطي ${skipped.length} قيد (صحيح بالفعل).`,
          });
          refresh();
        } else if (skipped.length > 0) {
          toast({
            title: "لا حاجة للتصحيح",
            description: `جميع قيود القروض صحيحة (${skipped.length} قيد).`,
          });
        } else {
          toast({
            title: "لا توجد قيود للتصحيح",
            description: "لم يتم العثور على قيود قروض تحتاج تصحيح.",
          });
        }

        if (errors.length > 0) {
          console.error("Loan migration errors:", errors);
        }
      } else {
        toast({
          title: "خطأ",
          description: result.error || "فشل تصحيح قيود القروض",
          variant: "destructive",
        });
      }
    } catch (err) {
      console.error("Loan migration failed:", err);
      toast({
        title: "خطأ",
        description: "حدث خطأ أثناء تصحيح قيود القروض",
        variant: "destructive",
      });
    } finally {
      setMigratingLoans(false);
    }
  };

  const handleMigrateEndorsedCheques = async () => {
    if (!user) return;

    const confirmed = window.confirm(
      `سيتم تصحيح قيود الشيكات المظهرة التي تم تسجيلها بشكل خاطئ.\n\nالشيكات المظهرة لا تحرك النقدية الفعلية - الشيك ينتقل مباشرة للجهة الثالثة.\nسيتم عكس قيود النقدية الخاطئة.\n\nهل تريد المتابعة؟`
    );

    if (!confirmed) return;

    setMigratingEndorsements(true);
    try {
      const result = await migrateEndorsedChequeJournalEntries(user.dataOwnerId);

      if (result.success && result.data) {
        const { corrected, skipped, errors } = result.data;

        if (corrected.length > 0) {
          toast({
            title: "تم تصحيح قيود الشيكات المظهرة",
            description: `تم تصحيح ${corrected.length} قيد. تم تخطي ${skipped.length} قيد (صحيح بالفعل).`,
          });
          refresh();
        } else if (skipped.length > 0) {
          toast({
            title: "لا حاجة للتصحيح",
            description: `جميع قيود الشيكات المظهرة صحيحة (${skipped.length} قيد).`,
          });
        } else {
          toast({
            title: "لا توجد قيود للتصحيح",
            description: "لم يتم العثور على قيود شيكات مظهرة تحتاج تصحيح.",
          });
        }

        if (errors.length > 0) {
          console.error("Endorsed cheque migration errors:", errors);
        }
      } else {
        toast({
          title: "خطأ",
          description: result.error || "فشل تصحيح قيود الشيكات المظهرة",
          variant: "destructive",
        });
      }
    } catch (err) {
      console.error("Endorsed cheque migration failed:", err);
      toast({
        title: "خطأ",
        description: "حدث خطأ أثناء تصحيح قيود الشيكات المظهرة",
        variant: "destructive",
      });
    } finally {
      setMigratingEndorsements(false);
    }
  };

  const handleFindUnmatchedCashEntries = async () => {
    if (!user) return;

    setFindingUnmatched(true);
    setUnmatchedEntries(null);
    setUnmatchedSummary(null);

    try {
      const result = await findUnmatchedCashJournalEntries(user.dataOwnerId);

      if (result.success && result.data) {
        setUnmatchedEntries(result.data.unmatchedEntries);
        setUnmatchedSummary(result.data.summary);

        if (result.data.unmatchedEntries.length === 0) {
          toast({
            title: "لا توجد قيود غير متطابقة",
            description: "جميع قيود النقدية متطابقة مع معاملات السجل.",
          });
        } else {
          toast({
            title: `تم العثور على ${result.data.unmatchedEntries.length} قيد`,
            description: `إجمالي الفرق في النقدية: ${formatNumber(result.data.totalUnmatchedCashDebit)} دينار`,
            variant: "destructive",
          });
        }
      } else {
        toast({
          title: "خطأ",
          description: result.error || "فشل البحث عن القيود غير المتطابقة",
          variant: "destructive",
        });
      }
    } catch (err) {
      console.error("Find unmatched entries failed:", err);
      toast({
        title: "خطأ",
        description: "حدث خطأ أثناء البحث",
        variant: "destructive",
      });
    } finally {
      setFindingUnmatched(false);
    }
  };

  const handleDeleteUnmatchedCashEntries = async () => {
    if (!user || !unmatchedEntries || unmatchedEntries.length === 0) return;

    const confirmed = window.confirm(
      `سيتم حذف ${unmatchedEntries.length} قيد محاسبي غير متطابق.\n\nهذه القيود تم إنشاؤها لمعاملات غير مدفوعة ولا يجب أن تؤثر على رصيد النقدية.\n\nإجمالي مدين النقدية الذي سيتم إزالته: ${formatNumber(unmatchedSummary?.discrepancy || 0)} دينار\n\nهل تريد المتابعة؟`
    );

    if (!confirmed) return;

    setDeletingUnmatched(true);
    try {
      const result = await deleteUnmatchedCashJournalEntries(user.dataOwnerId, false);

      if (result.success && result.data) {
        toast({
          title: "تم حذف القيود غير المتطابقة",
          description: `تم حذف ${result.data.deleted} قيد. تم إزالة ${formatNumber(result.data.totalCashDebitRemoved)} من مدين النقدية.`,
        });
        // Clear the unmatched entries list and refresh
        setUnmatchedEntries(null);
        setUnmatchedSummary(null);
        refresh();
      } else {
        toast({
          title: "خطأ",
          description: result.error || "فشل حذف القيود غير المتطابقة",
          variant: "destructive",
        });
      }
    } catch (err) {
      console.error("Delete unmatched entries failed:", err);
      toast({
        title: "خطأ",
        description: "حدث خطأ أثناء الحذف",
        variant: "destructive",
      });
    } finally {
      setDeletingUnmatched(false);
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
              <Button
                variant="outline"
                size="sm"
                onClick={handleMigrateLoanEntries}
                disabled={migratingLoans}
                title="تصحيح قيود القروض التي تم تسجيلها كمصروفات"
              >
                <Wrench className="w-4 h-4 ml-2" />
                {migratingLoans ? "جاري التصحيح..." : "تصحيح قيود القروض"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleMigrateEndorsedCheques}
                disabled={migratingEndorsements}
                title="تصحيح قيود الشيكات المظهرة التي تم تسجيلها بشكل خاطئ"
              >
                <Wrench className="w-4 h-4 ml-2" />
                {migratingEndorsements ? "جاري التصحيح..." : "تصحيح قيود التظهير"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleFindUnmatchedCashEntries}
                disabled={findingUnmatched}
                title="البحث عن قيود النقدية التي لا تتطابق مع معاملات السجل"
                className="border-amber-300 hover:bg-amber-50"
              >
                <AlertTriangle className="w-4 h-4 ml-2 text-amber-600" />
                {findingUnmatched ? "جاري البحث..." : "قيود نقدية غير متطابقة"}
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
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-semibold text-amber-700 flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4" />
                        قيود مكررة ({auditResult.duplicates.length})
                      </h4>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={handleCleanupDuplicates}
                        disabled={cleaningDuplicates}
                      >
                        <Trash2 className="w-4 h-4 ml-2" />
                        {cleaningDuplicates ? "جاري الحذف..." : "حذف القيود المكررة"}
                      </Button>
                    </div>
                    <p className="text-sm text-gray-600 mb-2">
                      سيتم الاحتفاظ بالقيد الأقدم لكل معاملة وحذف {auditResult.duplicates.reduce((sum, d) => sum + d.count - 1, 0)} قيد مكرر
                    </p>
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

      {/* Unmatched Cash Entries Section */}
      {unmatchedEntries && (
        <Card className="border-red-200">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-red-700">
                <XCircle className="w-5 h-5" />
                قيود النقدية غير المتطابقة ({unmatchedEntries.length})
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setUnmatchedEntries(null)}
              >
                إغلاق
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {/* Summary */}
            {unmatchedSummary && (
              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="bg-blue-50 p-3 rounded-lg text-center">
                  <p className="text-xs text-gray-600">إجمالي مدين النقدية</p>
                  <p className="text-lg font-bold text-blue-700">
                    {formatNumber(unmatchedSummary.totalJournalCashDebits)}
                  </p>
                </div>
                <div className="bg-green-50 p-3 rounded-lg text-center">
                  <p className="text-xs text-gray-600">المطابق</p>
                  <p className="text-lg font-bold text-green-700">
                    {formatNumber(unmatchedSummary.totalMatchedCashDebits)}
                  </p>
                </div>
                <div className="bg-red-50 p-3 rounded-lg text-center">
                  <p className="text-xs text-gray-600">الفرق (غير متطابق)</p>
                  <p className="text-lg font-bold text-red-700">
                    {formatNumber(unmatchedSummary.discrepancy)}
                  </p>
                </div>
              </div>
            )}

            {unmatchedEntries.length === 0 ? (
              <div className="text-center py-4 bg-green-50 rounded-lg">
                <CheckCircle2 className="w-8 h-8 mx-auto text-green-600 mb-2" />
                <p className="text-green-700 font-medium">جميع قيود النقدية متطابقة!</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>التاريخ</TableHead>
                      <TableHead>الوصف</TableHead>
                      <TableHead className="text-left">مدين النقدية</TableHead>
                      <TableHead>السبب</TableHead>
                      <TableHead>تفاصيل السجل</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {unmatchedEntries.map((entry, idx) => (
                      <TableRow key={idx} className="bg-red-50/50">
                        <TableCell className="text-sm whitespace-nowrap">
                          {formatDate(entry.date)}
                        </TableCell>
                        <TableCell className="text-sm max-w-[200px] truncate" title={entry.description}>
                          {entry.description || entry.entryNumber}
                        </TableCell>
                        <TableCell className="text-left font-mono font-bold text-red-600">
                          {formatNumber(entry.cashDebit)}
                        </TableCell>
                        <TableCell className="text-xs max-w-[250px]">
                          <span className="text-amber-700">{entry.reason}</span>
                        </TableCell>
                        <TableCell className="text-xs">
                          {entry.ledgerDetails ? (
                            <div>
                              <Badge variant="outline" className="text-xs mb-1">
                                {entry.ledgerDetails.type}
                              </Badge>
                              <div className="text-gray-500">
                                الحالة: {entry.ledgerDetails.status || 'غير محدد'}
                              </div>
                            </div>
                          ) : (
                            <span className="text-gray-400">
                              {entry.linkedDocumentType || 'غير مرتبط'}
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            {unmatchedEntries.length > 0 && (
              <div className="mt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-amber-800">
                    <strong>ملاحظة:</strong> هذه القيود تم إنشاؤها لمعاملات غير مدفوعة - يمكن حذفها بأمان.
                  </p>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleDeleteUnmatchedCashEntries}
                    disabled={deletingUnmatched}
                  >
                    <Trash2 className="w-4 h-4 ml-2" />
                    {deletingUnmatched ? "جاري الحذف..." : `حذف ${unmatchedEntries.length} قيد`}
                  </Button>
                </div>
                <div className="p-3 bg-amber-50 rounded-lg">
                  <p className="text-sm text-amber-700">
                    سيتم حذف القيود المحاسبية التي تم إنشاؤها خطأً لمعاملات غير مدفوعة.
                    هذا سيخفض رصيد النقدية في الميزانية العمومية بمقدار {formatNumber(unmatchedSummary?.discrepancy || 0)} دينار.
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
