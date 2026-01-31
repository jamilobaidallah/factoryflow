"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DepreciationRun } from "../types/fixed-assets";
import { formatShortDate, formatNumber } from "@/lib/date-utils";

interface DepreciationHistoryTableProps {
  runs: DepreciationRun[];
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
  const [year, month] = period.split("-");
  const monthIndex = parseInt(month, 10) - 1;
  if (monthIndex >= 0 && monthIndex < 12) {
    return `${ARABIC_MONTHS[monthIndex]} ${year}`;
  }
  return period;
}

export function DepreciationHistoryTable({
  runs,
}: DepreciationHistoryTableProps) {
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
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedRuns.map((run) => (
            <TableRow key={run.id} className="table-row-hover">
              <TableCell className="font-medium">
                {formatPeriodLabel(run.period)}
              </TableCell>
              <TableCell>{formatShortDate(run.runDate)}</TableCell>
              <TableCell>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                  {run.assetsCount} أصل
                </span>
              </TableCell>
              <TableCell>
                <span className="font-semibold text-orange-600">
                  {formatNumber(run.totalDepreciation)} د
                </span>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
