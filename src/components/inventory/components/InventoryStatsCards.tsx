"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCardSkeleton } from "@/components/ui/loading-skeleton";
import { InventoryItem } from "../types/inventory.types";

interface InventoryStatsCardsProps {
  items: InventoryItem[];
  loading: boolean;
}

export function InventoryStatsCards({ items, loading }: InventoryStatsCardsProps) {
  const totalItems = items.length;
  const lowStockItems = items.filter(item => {
    const minStock = item.minStock || 0;
    return minStock > 0 && item.quantity <= minStock;
  }).length;
  const totalValue = items.reduce((sum, item) => {
    const quantity = item.quantity || 0;
    const unitPrice = item.unitPrice || 0;
    return sum + (quantity * unitPrice);
  }, 0);

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCardSkeleton />
        <StatCardSkeleton />
        <StatCardSkeleton />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <Card>
        <CardHeader>
          <CardTitle>إجمالي العناصر</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-blue-600">
            {totalItems}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>عناصر منخفضة المخزون</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-orange-600">
            {lowStockItems}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>القيمة الإجمالية</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-green-600">
            {totalValue.toFixed(2)} دينار
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
