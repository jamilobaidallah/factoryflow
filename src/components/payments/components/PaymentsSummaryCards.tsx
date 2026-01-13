"use client";

import { memo } from "react";
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
}

function PaymentsSummaryCardsComponent({
  totalReceived,
  totalPaid,
  loading,
  searchTerm = "",
  onSearchChange,
}: PaymentsSummaryCardsProps) {
  // Compact skeleton for loading state
  if (loading) {
    return (
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 p-3 bg-slate-50/80 rounded-xl border border-slate-200/60">
        <div className="flex items-center gap-4 flex-1">
          <div className="h-12 w-36 bg-slate-200 rounded-lg animate-pulse" />
          <div className="h-12 w-36 bg-slate-200 rounded-lg animate-pulse" />
        </div>
        <div className="h-10 flex-1 max-w-xs bg-slate-200 rounded-lg animate-pulse" />
      </div>
    );
  }

  return (
    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 p-3 bg-gradient-to-l from-slate-50/90 to-white rounded-xl border border-slate-200/60 shadow-sm">
      {/* Compact Stats Row */}
      <div className="flex items-center gap-3 sm:gap-4 flex-wrap sm:flex-nowrap">
        {/* Total Received - Compact */}
        <div className="flex items-center gap-2.5 px-3 py-2 bg-emerald-50/80 rounded-lg border border-emerald-100">
          <div className="flex items-center justify-center w-8 h-8 bg-emerald-100 rounded-md">
            <ArrowDownLeft className="w-4 h-4 text-emerald-600" strokeWidth={2.5} />
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] uppercase tracking-wide text-emerald-600/80 font-medium">المقبوضات</span>
            <span className="text-base font-bold text-emerald-700 tabular-nums leading-tight">
              {formatNumber(totalReceived)}
            </span>
          </div>
        </div>

        {/* Divider */}
        <div className="hidden sm:block w-px h-8 bg-slate-200" />

        {/* Total Paid - Compact */}
        <div className="flex items-center gap-2.5 px-3 py-2 bg-rose-50/80 rounded-lg border border-rose-100">
          <div className="flex items-center justify-center w-8 h-8 bg-rose-100 rounded-md">
            <ArrowUpRight className="w-4 h-4 text-rose-600" strokeWidth={2.5} />
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] uppercase tracking-wide text-rose-600/80 font-medium">المصروفات</span>
            <span className="text-base font-bold text-rose-700 tabular-nums leading-tight">
              {formatNumber(totalPaid)}
            </span>
          </div>
        </div>
      </div>

      {/* Spacer */}
      <div className="flex-1 hidden sm:block" />

      {/* Search Input - Integrated */}
      {onSearchChange && (
        <div className="relative w-full sm:w-64 lg:w-72">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            type="text"
            placeholder="بحث في المدفوعات..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pr-10 pl-9 h-10 bg-white border-slate-200 focus:border-slate-300 focus:ring-slate-200 text-sm placeholder:text-slate-400"
          />
          {searchTerm && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute left-1 top-1/2 -translate-y-1/2 h-7 w-7 hover:bg-slate-100"
              onClick={() => onSearchChange("")}
            >
              <X className="h-3.5 w-3.5 text-slate-400" />
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

export const PaymentsSummaryCards = memo(PaymentsSummaryCardsComponent);
