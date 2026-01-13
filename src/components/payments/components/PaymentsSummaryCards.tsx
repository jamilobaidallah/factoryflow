"use client";

import { memo, ReactNode } from "react";
import { Search, X, ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { formatNumber } from "@/lib/date-utils";

interface PaymentsSummaryCardsProps {
  totalReceived: number;
  totalPaid: number;
  loading: boolean;
  searchTerm?: string;
  onSearchChange?: (value: string) => void;
  /** Action buttons to render (wrapped in PermissionGate) */
  actions?: ReactNode;
}

function PaymentsSummaryCardsComponent({
  totalReceived,
  totalPaid,
  loading,
  searchTerm = "",
  onSearchChange,
  actions,
}: PaymentsSummaryCardsProps) {
  return (
    <div className="space-y-4">
      {/* Unified Header Bar */}
      <div className="flex flex-col gap-4 p-4 bg-gradient-to-l from-slate-50/90 to-white rounded-xl border border-slate-200/60 shadow-sm">
        {/* Top Row: Title + Stats + Actions */}
        <div className="flex flex-col lg:flex-row lg:items-center gap-4">
          {/* Title Section */}
          <div className="flex-shrink-0">
            <h1 className="text-2xl font-bold text-slate-800">المدفوعات</h1>
            <p className="text-sm text-slate-500">تتبع عمليات القبض والصرف</p>
          </div>

          {/* Divider - Desktop only */}
          <div className="hidden lg:block w-px h-12 bg-slate-200 mx-2" />

          {/* Stats - Fill Available Width */}
          <div className="flex items-center gap-3 flex-1 flex-wrap lg:flex-nowrap">
            {loading ? (
              <>
                <div className="h-14 flex-1 min-w-[140px] bg-slate-200 rounded-lg animate-pulse" />
                <div className="h-14 flex-1 min-w-[140px] bg-slate-200 rounded-lg animate-pulse" />
              </>
            ) : (
              <>
                {/* Total Received */}
                <div className="flex items-center gap-3 px-5 py-2.5 bg-emerald-50/80 rounded-lg border border-emerald-100 flex-1 min-w-[160px]">
                  <div className="flex items-center justify-center w-10 h-10 bg-emerald-100 rounded-lg flex-shrink-0">
                    <ArrowDownLeft className="w-5 h-5 text-emerald-600" strokeWidth={2.5} />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs text-emerald-600/80 font-medium">المقبوضات</span>
                    <span className="text-lg font-bold text-emerald-700 tabular-nums leading-tight">
                      {formatNumber(totalReceived)}
                    </span>
                  </div>
                </div>

                {/* Total Paid */}
                <div className="flex items-center gap-3 px-5 py-2.5 bg-rose-50/80 rounded-lg border border-rose-100 flex-1 min-w-[160px]">
                  <div className="flex items-center justify-center w-10 h-10 bg-rose-100 rounded-lg flex-shrink-0">
                    <ArrowUpRight className="w-5 h-5 text-rose-600" strokeWidth={2.5} />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs text-rose-600/80 font-medium">المصروفات</span>
                    <span className="text-lg font-bold text-rose-700 tabular-nums leading-tight">
                      {formatNumber(totalPaid)}
                    </span>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Search + Actions */}
          <div className="flex items-center gap-3 flex-wrap sm:flex-nowrap">
            {/* Search Input */}
            {onSearchChange && (
              <div className="relative w-full sm:w-52 lg:w-56">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  type="text"
                  placeholder="بحث..."
                  value={searchTerm}
                  onChange={(e) => onSearchChange(e.target.value)}
                  className="pr-9 pl-8 h-9 bg-white border-slate-200 focus:border-slate-300 focus:ring-slate-200 text-sm placeholder:text-slate-400"
                />
                {searchTerm && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute left-1 top-1/2 -translate-y-1/2 h-6 w-6 hover:bg-slate-100"
                    onClick={() => onSearchChange("")}
                  >
                    <X className="h-3 w-3 text-slate-400" />
                  </Button>
                )}
              </div>
            )}

            {/* Action Buttons */}
            {actions && (
              <div className="flex items-center gap-2">
                {actions}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export const PaymentsSummaryCards = memo(PaymentsSummaryCardsComponent);
