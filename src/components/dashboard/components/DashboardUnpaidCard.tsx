"use client";

import { memo } from "react";
import Link from "next/link";
import { AlertCircle } from "lucide-react";
import { formatNumber } from "@/lib/date-utils";
import type { AlertData } from "../types/dashboard.types";

interface DashboardUnpaidCardProps {
  unpaidReceivables: AlertData;
  unpaidPayables: AlertData;
}

/**
 * Prominent card showing combined unpaid receivables and payables
 * Displays on Dashboard with amber styling for high visibility
 */
function DashboardUnpaidCardComponent({ unpaidReceivables, unpaidPayables }: DashboardUnpaidCardProps) {
  const totalUnpaidCount = unpaidReceivables.count + unpaidPayables.count;
  const totalUnpaidAmount = unpaidReceivables.total + unpaidPayables.total;

  return (
    <div className="max-w-sm">
      <Link href="/ledger?paymentStatus=outstanding" className="block">
        <article
          className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl p-5 border border-amber-200 transition-all duration-300 hover:shadow-lg hover:-translate-y-1 cursor-pointer"
          role="button"
          tabIndex={0}
          aria-label={`عرض ${totalUnpaidCount} ذمم غير محصلة`}
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-slate-500 text-sm">ذمم غير محصلة</span>
            <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center relative">
              <AlertCircle className="w-5 h-5 text-amber-600" aria-hidden="true" />
              {totalUnpaidCount > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-amber-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                  {totalUnpaidCount}
                </span>
              )}
            </div>
          </div>
          <p className="text-2xl font-bold text-amber-700">
            {formatNumber(totalUnpaidAmount)}
          </p>
          <p className="text-xs text-amber-600 mt-1">
            {totalUnpaidCount > 0 ? "اضغط للعرض ←" : "لا توجد ذمم"}
          </p>
        </article>
      </Link>
    </div>
  );
}

export const DashboardUnpaidCard = memo(DashboardUnpaidCardComponent);
