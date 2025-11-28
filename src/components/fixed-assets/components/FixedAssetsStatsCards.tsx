"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FixedAsset } from "../types/fixed-assets";

interface FixedAssetsStatsCardsProps {
  assets: FixedAsset[];
}

export function FixedAssetsStatsCards({ assets }: FixedAssetsStatsCardsProps) {
  const activeAssets = assets.filter(a => a.status === "active");
  const totalOriginalCost = activeAssets.reduce((sum, a) => sum + (a.purchaseCost || 0), 0);
  const totalAccumulatedDepreciation = activeAssets.reduce((sum, a) => sum + (a.accumulatedDepreciation || 0), 0);
  const totalBookValue = activeAssets.reduce((sum, a) => sum + (a.bookValue || 0), 0);

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
      <Card>
        <CardHeader>
          <CardTitle>عدد الأصول النشطة</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-blue-600">
            {activeAssets.length}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>التكلفة الأصلية</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-green-600">
            {totalOriginalCost.toFixed(0)} د
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>الاستهلاك المتراكم</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-orange-600">
            {totalAccumulatedDepreciation.toFixed(0)} د
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>القيمة الدفترية</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-purple-600">
            {totalBookValue.toFixed(0)} د
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
