"use client";

import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Trash2 } from "lucide-react";
import { DepreciationRun } from "../types/fixed-assets";
import { formatShortDate, formatNumber } from "@/lib/date-utils";

interface DepreciationHistoryTableProps {
  runs: DepreciationRun[];
  onDelete?: (run: DepreciationRun) => Promise<void>;
}

// Helper to format period label (2025-01 → يناير 2025)
const ARABIC_MONTHS = [
  "يناير",
  "فبراير",
  "مارس",
  "أبريل",
  "مايو",
  "يونيو",
  "يوليو",
  "أغسطس",
  "سبتمبر",
  "أكتوبر",
  "نوفمبر",
  "ديسمبر",
];

function formatPeriodLabel(period: string): string {
  // Per-asset compound key: "assetId:YYYY-MM" → extract the YYYY-MM part
  const periodPart = period.includes(":") ? period.split(":")[1] : period;
  const [year, month] = periodPart.split("-");
  const monthIndex = parseInt(month, 10) - 1;
  if (monthIndex >= 0 && monthIndex < 12) {
    return `${ARABIC_MONTHS[monthIndex]} ${year}`;
  }
  return periodPart;
}

export function DepreciationHistoryTable({
  runs,
  onDelete,
}: DepreciationHistoryTableProps) {
  const [runToDelete, setRunToDelete] = useState<DepreciationRun | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleConfirmDelete = async () => {
    if (!runToDelete || !onDelete) return;
    setIsDeleting(true);
    await onDelete(runToDelete);
    setIsDeleting(false);
    setRunToDelete(null);
  };

  if (runs.length === 0) {
    return (
      <p className="text-slate-500 text-center py-12">
        لا يوجد سجل استهلاك. قم بتسجيل الاستهلاك الشهري للبدء.
      </p>
    );
  }

  // Sort runs by period (newest first for display)
  const sortedRuns = [...runs].sort((a, b) => b.period.localeCompare(a.period));

  return (
    <>
      <div className="card-modern overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50/80 hover:bg-slate-50/80">
              <TableHead className="text-right font-semibold text-slate-700">
                الفترة
              </TableHead>
              <TableHead className="text-right font-semibold text-slate-700">
                تاريخ التسجيل
              </TableHead>
              <TableHead className="text-right font-semibold text-slate-700">
                عدد الأصول
              </TableHead>
              <TableHead className="text-right font-semibold text-slate-700">
                إجمالي الاستهلاك
              </TableHead>
              {onDelete && (
                <TableHead className="text-center font-semibold text-slate-700 w-16">
                  حذف
                </TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedRuns.map((run) => {
              const isPerAsset = run.runType === "per-asset" || run.period.includes(":");
              return (
              <TableRow key={run.id} className="table-row-hover">
                <TableCell className="font-medium">
                  <div>{formatPeriodLabel(run.period)}</div>
                  {isPerAsset && run.assetName && (
                    <div className="text-xs text-slate-500 mt-0.5">{run.assetName}</div>
                  )}
                </TableCell>
                <TableCell>{formatShortDate(run.runDate)}</TableCell>
                <TableCell>
                  {isPerAsset ? (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
                      أصل واحد
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                      {run.assetsCount} أصل
                    </span>
                  )}
                </TableCell>
                <TableCell>
                  <span className="font-semibold text-orange-600">
                    {formatNumber(run.totalDepreciation)} د
                  </span>
                </TableCell>
                {onDelete && (
                  <TableCell className="text-center">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 text-slate-400 hover:text-red-600 hover:bg-red-50"
                      onClick={() => setRunToDelete(run)}
                      aria-label="حذف سجل الاستهلاك"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                )}
              </TableRow>
            );
})}
          </TableBody>
        </Table>
      </div>

      {/* Delete confirmation dialog */}
      <AlertDialog open={!!runToDelete} onOpenChange={() => !isDeleting && setRunToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>تأكيد حذف سجل الاستهلاك</AlertDialogTitle>
            <AlertDialogDescription>
              سيتم حذف سجل استهلاك{" "}
              <strong>{runToDelete ? formatPeriodLabel(runToDelete.period) : ""}</strong>{" "}
              وعكس قيمة الاستهلاك ({runToDelete ? formatNumber(runToDelete.totalDepreciation) : ""} دينار)
              على الأصول المرتبطة. كما سيتم حذف القيد المحاسبي المرتبط.
              <br />
              <br />
              هذا الإجراء لا يمكن التراجع عنه.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {isDeleting ? "جاري الحذف..." : "حذف"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
