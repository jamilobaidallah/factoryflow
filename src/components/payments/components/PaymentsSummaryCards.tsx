"use client";

import { memo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCardSkeleton } from "@/components/ui/loading-skeleton";

interface PaymentsSummaryCardsProps {
  totalReceived: number;
  totalPaid: number;
  loading: boolean;
}

function PaymentsSummaryCardsComponent({
  totalReceived,
  totalPaid,
  loading,
}: PaymentsSummaryCardsProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <StatCardSkeleton />
        <StatCardSkeleton />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <Card>
        <CardHeader>
          <CardTitle>إجمالي المقبوضات</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-green-600">
            {totalReceived} دينار
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>إجمالي المصروفات</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-red-600">
            {totalPaid} دينار
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export const PaymentsSummaryCards = memo(PaymentsSummaryCardsComponent);
