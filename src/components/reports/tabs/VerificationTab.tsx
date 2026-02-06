/**
 * VerificationTab - Data integrity verification report
 * Checks that every ledger entry has corresponding balanced journal entries
 */

import React, { memo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { AlertTriangle, CheckCircle2, Search, RefreshCw } from "lucide-react";
import { useUser } from "@/firebase/provider";
import {
  verifyDataIntegrity,
  getDiscrepancyTypeLabel,
  type VerificationPhase,
  type Discrepancy,
} from "@/services/verificationService";
import { formatNumber } from "@/lib/date-utils";

function VerificationTabComponent() {
  const { user } = useUser();
  const [phase, setPhase] = useState<VerificationPhase>({ phase: 'idle' });

  const runVerification = async () => {
    if (!user?.dataOwnerId) { return; }

    setPhase({ phase: 'loading', message: 'جارٍ تحميل القيود...' });

    try {
      const result = await verifyDataIntegrity(user.dataOwnerId, setPhase);
      setPhase({ phase: 'complete', result });
    } catch (error) {
      console.error('Verification failed:', error);
      setPhase({ phase: 'idle' });
    }
  };

  const isRunning = phase.phase === 'loading' || phase.phase === 'indexing' || phase.phase === 'verifying';

  return (
    <Card className="border-0 shadow-none">
      <CardContent className="p-6 space-y-6" dir="rtl">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-lg font-semibold text-slate-800">التحقق من سلامة البيانات</h2>
            <p className="text-sm text-slate-500">فحص تطابق القيود المحاسبية مع دفتر الأستاذ</p>
          </div>
          <Button
            onClick={runVerification}
            disabled={isRunning}
            className="gap-2"
          >
            {isRunning ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                جارٍ التحقق...
              </>
            ) : (
              <>
                <Search className="w-4 h-4" />
                تشغيل التحقق
              </>
            )}
          </Button>
        </div>

        {/* Progress States */}
        {phase.phase === 'loading' && (
          <div className="p-4 bg-slate-50 rounded-lg">
            <p className="text-sm text-slate-600">{phase.message}</p>
          </div>
        )}

        {phase.phase === 'indexing' && (
          <div className="p-4 bg-slate-50 rounded-lg">
            <p className="text-sm text-slate-600">{phase.message}</p>
          </div>
        )}

        {phase.phase === 'verifying' && (
          <div className="p-4 bg-slate-50 rounded-lg space-y-2">
            <p className="text-sm text-slate-600">
              جارٍ التحقق: {phase.current.toLocaleString('ar-SA')} / {phase.total.toLocaleString('ar-SA')}
            </p>
            <Progress value={(phase.current / phase.total) * 100} />
          </div>
        )}

        {/* Results */}
        {phase.phase === 'complete' && (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Card>
                <CardContent className="p-4">
                  <p className="text-sm text-slate-500">القيود المحققة</p>
                  <p className="text-2xl font-bold text-slate-800">
                    {phase.result.ledgerEntriesChecked.toLocaleString('ar-SA')}
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    قيود يومية: {phase.result.journalEntriesChecked.toLocaleString('ar-SA')}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <p className="text-sm text-slate-500">الفروقات</p>
                  <p className={`text-2xl font-bold ${
                    phase.result.discrepanciesFound > 0 ? 'text-red-600' : 'text-green-600'
                  }`}>
                    {phase.result.discrepanciesFound.toLocaleString('ar-SA')}
                  </p>
                  {phase.result.discrepanciesFound > 0 && (
                    <p className="text-xs text-red-500 mt-1">تحتاج مراجعة</p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <p className="text-sm text-slate-500">ميزان المراجعة</p>
                  <p className={`text-2xl font-bold ${
                    phase.result.trialBalanceStatus.isBalanced ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {phase.result.trialBalanceStatus.isBalanced ? 'متوازن ✓' : 'غير متوازن ✗'}
                  </p>
                  {!phase.result.trialBalanceStatus.isBalanced && (
                    <p className="text-xs text-red-500 mt-1">
                      فرق: {formatNumber(Math.abs(phase.result.trialBalanceStatus.difference), 2)} د.أ
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Timing Note */}
            <p className="text-sm text-slate-500">
              آخر تحقق: {phase.result.timestamp.toLocaleString('ar-JO')}
              {' • '}
              قد تكون هناك معاملات قيد المعالجة لم يتم التحقق منها
            </p>

            {/* Query Limit Warning */}
            {phase.result.queryLimitReached && (
              <div className="bg-amber-50 text-amber-700 p-4 rounded-lg flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 shrink-0" />
                <span>تم الوصول للحد الأقصى (10,000 قيد). قد تكون هناك قيود إضافية لم يتم التحقق منها.</span>
              </div>
            )}

            {/* Discrepancy Table */}
            {phase.result.discrepancies.length > 0 && (
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50">
                      <TableHead className="text-right">النوع</TableHead>
                      <TableHead className="text-right">رقم المعاملة</TableHead>
                      <TableHead className="text-right">الوصف</TableHead>
                      <TableHead className="text-right">الخطورة</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {phase.result.discrepancies.slice(0, 100).map((d: Discrepancy, i: number) => (
                      <TableRow key={i}>
                        <TableCell className="font-medium">
                          {getDiscrepancyTypeLabel(d.type)}
                        </TableCell>
                        <TableCell className="font-mono text-xs text-slate-600">
                          {d.transactionId || d.journalId || '-'}
                        </TableCell>
                        <TableCell className="text-sm">
                          {d.message}
                        </TableCell>
                        <TableCell>
                          <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            d.severity === 'error'
                              ? 'bg-red-100 text-red-700'
                              : 'bg-yellow-100 text-yellow-700'
                          }`}>
                            {d.severity === 'error' ? 'خطأ' : 'تحذير'}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {phase.result.discrepancies.length > 100 && (
                  <p className="text-sm text-slate-500 p-3 bg-slate-50 text-center">
                    يتم عرض أول 100 فرق فقط من أصل {phase.result.discrepancies.length}
                  </p>
                )}
              </div>
            )}

            {/* Success Message */}
            {phase.result.discrepancies.length === 0 && (
              <div className="bg-green-50 text-green-700 p-4 rounded-lg flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 shrink-0" />
                <span>جميع القيود سليمة. لم يتم العثور على أي فروقات.</span>
              </div>
            )}
          </>
        )}

        {/* Initial State */}
        {phase.phase === 'idle' && (
          <div className="text-center py-12 text-slate-500">
            <Search className="w-12 h-12 mx-auto mb-4 text-slate-300" />
            <p>اضغط على &ldquo;تشغيل التحقق&rdquo; لفحص سلامة البيانات المحاسبية</p>
            <p className="text-sm mt-2">سيتم التحقق من تطابق جميع القيود مع اليوميات</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export const VerificationTab = memo(VerificationTabComponent);
