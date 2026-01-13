"use client";

import { memo, useMemo } from "react";
import { AlertCircle } from "lucide-react";
import { LedgerEntry } from "../utils/ledger-constants";
import { isEquityTransaction } from "../utils/ledger-helpers";
import { formatNumber } from "@/lib/date-utils";

interface LedgerStatsProps {
  entries: LedgerEntry[];
  onUnpaidClick?: () => void;
}

/** Format number with thousands separator */
const formatAmount = (amount: number): string => {
  return formatNumber(amount);
};

function LedgerStatsComponent({ entries, onUnpaidClick }: LedgerStatsProps) {
  // Calculate unpaid receivables only (other stats are shown on Dashboard/Reports)
  const stats = useMemo(() => {
    let unpaidCount = 0;
    let unpaidAmount = 0;

    entries.forEach((entry) => {
      // Count unpaid/partial ARAP entries (excludes equity only)
      // Advances use standard AR/AP tracking (totalPaid, remainingBalance)
      // so they ARE included in unpaid receivables - they represent unfulfilled obligations
      const isEquity = isEquityTransaction(entry.type, entry.category);
      if (entry.isARAPEntry && entry.paymentStatus !== "paid" && !isEquity) {
        unpaidCount++;
        unpaidAmount += entry.remainingBalance || 0;
      }
    });

    return {
      unpaidCount,
      unpaidAmount,
    };
  }, [entries]);

  return (
    <div className="max-w-sm">
      {/* Unpaid Receivables Card - Clickable */}
      <article
        onClick={onUnpaidClick}
        className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl p-5 border border-amber-200 transition-all duration-300 hover:shadow-lg hover:-translate-y-1 cursor-pointer"
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onUnpaidClick?.();
          }
        }}
        aria-label={`عرض ${stats.unpaidCount} ذمم غير محصلة`}
      >
        <div className="flex items-center justify-between mb-3">
          <span className="text-slate-500 text-sm">ذمم غير محصلة</span>
          <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center relative">
            <AlertCircle className="w-5 h-5 text-amber-600" aria-hidden="true" />
            {stats.unpaidCount > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-amber-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                {stats.unpaidCount}
              </span>
            )}
          </div>
        </div>
        <p className="text-2xl font-bold text-amber-700">
          {formatAmount(stats.unpaidAmount)}
        </p>
        <p className="text-xs text-amber-600 mt-1">
          {stats.unpaidCount > 0 ? "اضغط للعرض ←" : "لا توجد ذمم"}
        </p>
      </article>
    </div>
  );
}

export const LedgerStats = memo(LedgerStatsComponent);
