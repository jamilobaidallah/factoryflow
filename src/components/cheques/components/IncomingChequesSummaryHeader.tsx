"use client";

import { memo, ReactNode } from "react";
import { Clock, CheckCircle, ArrowLeftRight, XCircle } from "lucide-react";
import { formatNumber } from "@/lib/date-utils";

interface IncomingChequesSummaryHeaderProps {
  stats: {
    pendingCount: number;
    pendingValue: number;
    clearedCount: number;
    clearedValue: number;
    endorsedCount: number;
    bouncedCount: number;
  };
  loading: boolean;
  /** Action buttons to render (wrapped in PermissionGate) */
  actions?: ReactNode;
}

function IncomingChequesSummaryHeaderComponent({
  stats,
  loading,
  actions,
}: IncomingChequesSummaryHeaderProps) {
  return (
    <div className="space-y-4">
      {/* Unified Header Bar */}
      <div className="flex flex-col gap-4 p-4 bg-gradient-to-l from-slate-50/90 to-white rounded-xl border border-slate-200/60 shadow-sm">
        {/* Top Row: Title + Stats + Actions */}
        <div className="flex flex-col xl:flex-row xl:items-center gap-4">
          {/* Title Section */}
          <div className="flex-shrink-0">
            <h1 className="text-2xl font-bold text-slate-800">الشيكات الواردة</h1>
            <p className="text-sm text-slate-500">إدارة الشيكات الواردة من العملاء</p>
          </div>

          {/* Divider - Desktop only */}
          <div className="hidden xl:block w-px h-12 bg-slate-200 mx-2" />

          {/* Stats - Fill Available Width */}
          <div className="flex items-center gap-3 flex-1 flex-wrap xl:flex-nowrap">
            {loading ? (
              <>
                <div className="h-14 flex-1 min-w-[120px] bg-slate-200 rounded-lg animate-pulse" />
                <div className="h-14 flex-1 min-w-[120px] bg-slate-200 rounded-lg animate-pulse" />
                <div className="h-14 flex-1 min-w-[100px] bg-slate-200 rounded-lg animate-pulse" />
                <div className="h-14 flex-1 min-w-[100px] bg-slate-200 rounded-lg animate-pulse" />
              </>
            ) : (
              <>
                {/* Pending */}
                <div className="flex items-center gap-3 px-4 py-2.5 bg-amber-50/80 rounded-lg border border-amber-100 flex-1 min-w-[130px]">
                  <div className="flex items-center justify-center w-10 h-10 bg-amber-100 rounded-lg flex-shrink-0">
                    <Clock className="w-5 h-5 text-amber-600" strokeWidth={2} />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs text-amber-600/80 font-medium">قيد الانتظار</span>
                    <span className="text-lg font-bold text-amber-700 tabular-nums leading-tight">
                      {stats.pendingCount}
                    </span>
                    <span className="text-[10px] text-amber-600/60 tabular-nums">
                      {formatNumber(stats.pendingValue)} د.أ
                    </span>
                  </div>
                </div>

                {/* Cleared */}
                <div className="flex items-center gap-3 px-4 py-2.5 bg-emerald-50/80 rounded-lg border border-emerald-100 flex-1 min-w-[130px]">
                  <div className="flex items-center justify-center w-10 h-10 bg-emerald-100 rounded-lg flex-shrink-0">
                    <CheckCircle className="w-5 h-5 text-emerald-600" strokeWidth={2} />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs text-emerald-600/80 font-medium">تم الصرف</span>
                    <span className="text-lg font-bold text-emerald-700 tabular-nums leading-tight">
                      {stats.clearedCount}
                    </span>
                    <span className="text-[10px] text-emerald-600/60 tabular-nums">
                      {formatNumber(stats.clearedValue)} د.أ
                    </span>
                  </div>
                </div>

                {/* Endorsed */}
                <div className="flex items-center gap-3 px-4 py-2.5 bg-purple-50/80 rounded-lg border border-purple-100 flex-1 min-w-[110px]">
                  <div className="flex items-center justify-center w-10 h-10 bg-purple-100 rounded-lg flex-shrink-0">
                    <ArrowLeftRight className="w-5 h-5 text-purple-600" strokeWidth={2} />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs text-purple-600/80 font-medium">مجيّر</span>
                    <span className="text-lg font-bold text-purple-700 tabular-nums leading-tight">
                      {stats.endorsedCount}
                    </span>
                  </div>
                </div>

                {/* Bounced */}
                <div className="flex items-center gap-3 px-4 py-2.5 bg-rose-50/80 rounded-lg border border-rose-100 flex-1 min-w-[110px]">
                  <div className="flex items-center justify-center w-10 h-10 bg-rose-100 rounded-lg flex-shrink-0">
                    <XCircle className="w-5 h-5 text-rose-600" strokeWidth={2} />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs text-rose-600/80 font-medium">مرفوض</span>
                    <span className="text-lg font-bold text-rose-700 tabular-nums leading-tight">
                      {stats.bouncedCount}
                    </span>
                  </div>
                </div>
              </>
            )}
          </div>

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

export const IncomingChequesSummaryHeader = memo(IncomingChequesSummaryHeaderComponent);
