"use client";

import { memo } from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatNumber } from "@/lib/date-utils";
import { DASHBOARD_CONFIG, DASHBOARD_LABELS } from "../constants/dashboard.constants";
import type { DashboardAlertsProps, AlertData } from "../types/dashboard.types";

/**
 * Alerts section showing items that need attention
 * Displays cheques due soon and unpaid receivables
 */
function DashboardAlertsComponent({ chequesDueSoon, unpaidReceivables }: DashboardAlertsProps) {
  const hasChequesAlert = chequesDueSoon.count > 0;
  const hasReceivablesAlert = unpaidReceivables.count > 0;
  const hasAnyAlert = hasChequesAlert || hasReceivablesAlert;

  return (
    <Card className="border-slate-200">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold text-slate-700">
          {DASHBOARD_LABELS.needsAttention}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Cheques due soon alert */}
        {hasChequesAlert && <ChequesAlert data={chequesDueSoon} />}

        {/* Unpaid receivables alert */}
        {hasReceivablesAlert && <ReceivablesAlert data={unpaidReceivables} />}

        {/* All good indicator when no alerts */}
        {!hasAnyAlert && <AllGoodIndicator />}

        {/* Secondary indicator when only one alert */}
        {hasAnyAlert && !(hasChequesAlert && hasReceivablesAlert) && (
          <NoOverdueIndicator />
        )}
      </CardContent>
    </Card>
  );
}

/** Alert for cheques due soon */
function ChequesAlert({ data }: { data: AlertData }) {
  return (
    <Link href={`/cheques?dueSoon=${DASHBOARD_CONFIG.CHEQUE_DUE_DAYS}`} className="block">
      <article className="flex items-center justify-between p-3 bg-rose-50 rounded-lg border border-rose-100 transition-all duration-200 hover:shadow-md cursor-pointer">
        <div className="flex items-center gap-3">
          <PulsingDot color="rose" />
          <div>
            <p className="font-medium text-slate-700 text-sm">
              {DASHBOARD_LABELS.chequesDueSoon}
            </p>
            <p className="text-xs text-slate-500">
              {data.count} {DASHBOARD_LABELS.chequesWithinDays}
            </p>
          </div>
        </div>
        <div className="text-left">
          <p className="font-semibold text-rose-700 text-sm">
            {formatNumber(data.total)} {DASHBOARD_LABELS.currency}
          </p>
        </div>
      </article>
    </Link>
  );
}

/** Alert for unpaid receivables */
function ReceivablesAlert({ data }: { data: AlertData }) {
  return (
    <Link href="/ledger?paymentStatus=outstanding" className="block">
      <article className="flex items-center justify-between p-3 bg-amber-50 rounded-lg border border-amber-100 transition-all duration-200 hover:shadow-md cursor-pointer">
        <div className="flex items-center gap-3">
          <div className="w-2.5 h-2.5 bg-amber-500 rounded-full" aria-hidden="true" />
          <div>
            <p className="font-medium text-slate-700 text-sm">
              {DASHBOARD_LABELS.unpaidReceivables}
            </p>
            <p className="text-xs text-slate-500">
              {data.count} {DASHBOARD_LABELS.overdueInvoices}
            </p>
          </div>
        </div>
        <div className="text-left">
          <p className="font-semibold text-amber-700 text-sm">
            {formatNumber(data.total)} {DASHBOARD_LABELS.currency}
          </p>
        </div>
      </article>
    </Link>
  );
}

/** Indicator when all is good */
function AllGoodIndicator() {
  return (
    <div className="flex items-center gap-3 p-3 bg-emerald-50 rounded-lg border border-emerald-100">
      <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full" aria-hidden="true" />
      <p className="text-slate-600 text-sm">{DASHBOARD_LABELS.noAlerts}</p>
      <Check className="w-4 h-4 text-emerald-600 mr-auto" aria-hidden="true" />
    </div>
  );
}

/** Secondary indicator for no overdue payments */
function NoOverdueIndicator() {
  return (
    <div className="flex items-center gap-3 p-3 bg-emerald-50 rounded-lg border border-emerald-100">
      <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full" aria-hidden="true" />
      <p className="text-slate-600 text-sm">{DASHBOARD_LABELS.noOverduePayments}</p>
      <Check className="w-4 h-4 text-emerald-600 mr-auto" aria-hidden="true" />
    </div>
  );
}

/** Pulsing dot indicator for urgent alerts */
function PulsingDot({ color }: { color: "rose" | "amber" }) {
  const colorClass = color === "rose" ? "bg-rose-500" : "bg-amber-500";

  return (
    <div className="relative" aria-hidden="true">
      <div className={`w-2.5 h-2.5 ${colorClass} rounded-full`} />
      <div className={`absolute inset-0 w-2.5 h-2.5 ${colorClass} rounded-full animate-ping`} />
    </div>
  );
}

export const DashboardAlerts = memo(DashboardAlertsComponent);
