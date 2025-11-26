"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LedgerEntry } from "../utils/ledger-constants";

interface LedgerStatsProps {
  entries: LedgerEntry[];
}

export function LedgerStats({ entries }: LedgerStatsProps) {
  // Calculate totals
  const totalIncome = entries
    .filter((e) => e.type === "دخل")
    .reduce((sum, e) => sum + (e.amount || 0), 0);

  const totalExpenses = entries
    .filter((e) => e.type === "مصروف")
    .reduce((sum, e) => sum + (e.amount || 0), 0);

  const netBalance = totalIncome - totalExpenses;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <Card>
        <CardHeader>
          <CardTitle>إجمالي الدخل</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-green-600">
            {totalIncome.toFixed(2)} دينار
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>إجمالي المصروفات</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-red-600">
            {totalExpenses.toFixed(2)} دينار
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>الرصيد الصافي</CardTitle>
        </CardHeader>
        <CardContent>
          <div
            className={`text-3xl font-bold ${
              netBalance >= 0 ? "text-blue-600" : "text-orange-600"
            }`}
          >
            {netBalance.toFixed(2)} دينار
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
