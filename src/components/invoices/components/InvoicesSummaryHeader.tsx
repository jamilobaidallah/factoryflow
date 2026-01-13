"use client";

import { memo, ReactNode } from "react";
import { FileText, CheckCircle, AlertCircle, Calculator } from "lucide-react";
import { formatNumber } from "@/lib/date-utils";

interface InvoicesSummaryHeaderProps {
  stats: {
    total: number;
    paidCount: number;
    overdueCount: number;
    totalValue: number;
  };
  loading: boolean;
  /** Action buttons to render (wrapped in PermissionGate) */
  actions?: ReactNode;
}

function InvoicesSummaryHeaderComponent({
  stats,
  loading,
  actions,
}: InvoicesSummaryHeaderProps) {
  return (
    <div className="space-y-4">
      {/* Unified Header Bar */}
      <div className="flex flex-col gap-4 p-4 bg-gradient-to-l from-slate-50/90 to-white rounded-xl border border-slate-200/60 shadow-sm">
        {/* Top Row: Title + Stats + Actions */}
        <div className="flex flex-col xl:flex-row xl:items-center gap-4">
          {/* Title Section */}
          <div className="flex-shrink-0">
            <h1 className="text-2xl font-bold text-slate-800">الفواتير</h1>
            <p className="text-sm text-slate-500">إنشاء وإدارة فواتير العملاء</p>
          </div>

          {/* Divider - Desktop only */}
          <div className="hidden xl:block w-px h-12 bg-slate-200 mx-2" />

          {/* Stats - Readable Size */}
          <div className="flex items-center gap-3 flex-wrap">
            {loading ? (
              <>
                <div className="h-14 w-32 bg-slate-200 rounded-lg animate-pulse" />
                <div className="h-14 w-28 bg-slate-200 rounded-lg animate-pulse" />
                <div className="h-14 w-28 bg-slate-200 rounded-lg animate-pulse" />
                <div className="h-14 w-36 bg-slate-200 rounded-lg animate-pulse" />
              </>
            ) : (
              <>
                {/* Total Invoices */}
                <div className="flex items-center gap-3 px-4 py-2.5 bg-slate-50/80 rounded-lg border border-slate-200">
                  <div className="flex items-center justify-center w-10 h-10 bg-slate-100 rounded-lg">
                    <FileText className="w-5 h-5 text-slate-600" strokeWidth={2} />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs text-slate-500 font-medium">إجمالي الفواتير</span>
                    <span className="text-lg font-bold text-slate-700 tabular-nums leading-tight">
                      {stats.total}
                    </span>
                  </div>
                </div>

                {/* Paid */}
                <div className="flex items-center gap-3 px-4 py-2.5 bg-emerald-50/80 rounded-lg border border-emerald-100">
                  <div className="flex items-center justify-center w-10 h-10 bg-emerald-100 rounded-lg">
                    <CheckCircle className="w-5 h-5 text-emerald-600" strokeWidth={2} />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs text-emerald-600/80 font-medium">المدفوعة</span>
                    <span className="text-lg font-bold text-emerald-700 tabular-nums leading-tight">
                      {stats.paidCount}
                    </span>
                  </div>
                </div>

                {/* Overdue */}
                <div className="flex items-center gap-3 px-4 py-2.5 bg-rose-50/80 rounded-lg border border-rose-100">
                  <div className="flex items-center justify-center w-10 h-10 bg-rose-100 rounded-lg">
                    <AlertCircle className="w-5 h-5 text-rose-600" strokeWidth={2} />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs text-rose-600/80 font-medium">المتأخرة</span>
                    <span className="text-lg font-bold text-rose-700 tabular-nums leading-tight">
                      {stats.overdueCount}
                    </span>
                  </div>
                </div>

                {/* Total Value */}
                <div className="flex items-center gap-3 px-4 py-2.5 bg-blue-50/80 rounded-lg border border-blue-100">
                  <div className="flex items-center justify-center w-10 h-10 bg-blue-100 rounded-lg">
                    <Calculator className="w-5 h-5 text-blue-600" strokeWidth={2} />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs text-blue-600/80 font-medium">القيمة الكلية</span>
                    <span className="text-lg font-bold text-blue-700 tabular-nums leading-tight">
                      {formatNumber(stats.totalValue)} د.أ
                    </span>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Spacer */}
          <div className="flex-1 hidden xl:block" />

          {/* Action Buttons */}
          {actions && (
            <div className="flex items-center gap-2">
              {actions}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export const InvoicesSummaryHeader = memo(InvoicesSummaryHeaderComponent);
