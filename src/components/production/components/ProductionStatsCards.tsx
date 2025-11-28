"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ProductionOrder } from "../types/production";

interface ProductionStatsCardsProps {
  orders: ProductionOrder[];
}

export function ProductionStatsCards({ orders }: ProductionStatsCardsProps) {
  const totalOrders = orders.length;
  const completedOrders = orders.filter(o => o.status === "مكتمل").length;
  const pendingOrders = orders.filter(o => o.status === "قيد التنفيذ").length;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <Card>
        <CardHeader>
          <CardTitle>إجمالي الأوامر</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-blue-600">
            {totalOrders}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>قيد التنفيذ</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-orange-600">
            {pendingOrders}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>المكتملة</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-green-600">
            {completedOrders}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
