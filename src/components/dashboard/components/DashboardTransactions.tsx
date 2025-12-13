"use client";

import { memo } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatNumber, formatDate } from "@/lib/date-utils";
import { DASHBOARD_LABELS } from "../constants/dashboard.constants";
import type { DashboardTransactionsProps, DashboardLedgerEntry } from "../types/dashboard.types";

/**
 * Recent transactions list component
 * Displays the last 5 transactions with staggered animation
 */
function DashboardTransactionsComponent({ transactions, isLoaded }: DashboardTransactionsProps) {
  return (
    <Card className="border-slate-200">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold text-slate-700">
            {DASHBOARD_LABELS.recentTransactions}
          </CardTitle>
          <Link
            href="/ledger"
            className="text-sm text-slate-500 hover:text-slate-700 transition-colors"
          >
            {DASHBOARD_LABELS.viewAll}
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        {transactions.length === 0 ? (
          <EmptyState />
        ) : (
          <TransactionList transactions={transactions} isLoaded={isLoaded} />
        )}
      </CardContent>
    </Card>
  );
}

/** Empty state when no transactions */
function EmptyState() {
  return (
    <p className="text-slate-500 text-center py-8">{DASHBOARD_LABELS.noTransactions}</p>
  );
}

/** Transaction list with animations */
function TransactionList({
  transactions,
  isLoaded,
}: {
  transactions: DashboardLedgerEntry[];
  isLoaded: boolean;
}) {
  return (
    <div className="space-y-2">
      {transactions.map((tx, index) => (
        <TransactionItem key={tx.id} transaction={tx} index={index} isLoaded={isLoaded} />
      ))}
    </div>
  );
}

/** Single transaction item */
function TransactionItem({
  transaction,
  index,
  isLoaded,
}: {
  transaction: DashboardLedgerEntry;
  index: number;
  isLoaded: boolean;
}) {
  const isIncome = transaction.type === "دخل";
  const amountColor = isIncome ? "text-emerald-600" : "text-slate-600";
  const amountPrefix = isIncome ? "+" : "-";

  return (
    <div
      className="flex items-center justify-between p-3 rounded-lg hover:bg-slate-50 transition-all duration-300"
      style={{
        opacity: isLoaded ? 1 : 0,
        transform: isLoaded ? "translateX(0)" : "translateX(20px)",
        transitionDelay: `${index * 100}ms`,
      }}
    >
      <div className="flex items-center gap-3">
        <TransactionIcon type={transaction.type} />
        <div>
          <p className="text-sm font-medium text-slate-700">{transaction.category}</p>
          <p className="text-xs text-slate-400">
            {transaction.description || transaction.associatedParty || "-"}
          </p>
        </div>
      </div>
      <div className="text-left">
        <p className={`text-sm font-semibold ${amountColor}`}>
          {amountPrefix}
          {formatNumber(transaction.amount)}
        </p>
        <p className="text-xs text-slate-400">{formatDate(transaction.date)}</p>
      </div>
    </div>
  );
}

/** Transaction type icon */
function TransactionIcon({ type }: { type: string }) {
  const isIncome = type === "دخل";

  return (
    <div
      className={`w-10 h-10 rounded-full flex items-center justify-center ${
        isIncome ? "bg-emerald-100" : "bg-slate-100"
      }`}
    >
      {isIncome ? (
        <svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
        </svg>
      ) : (
        <svg className="w-5 h-5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
        </svg>
      )}
    </div>
  );
}

export const DashboardTransactions = memo(DashboardTransactionsComponent);
