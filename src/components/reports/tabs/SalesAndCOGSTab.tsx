/**
 * SalesAndCOGSTab - Displays sales and cost of goods sold analysis
 * Extracted from reports-page.tsx for better maintainability
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface SalesAndCOGSData {
  totalSales: number;
  totalCOGS: number;
  grossProfit: number;
  grossMargin: number;
}

interface SalesAndCOGSTabProps {
  salesAndCOGS: SalesAndCOGSData;
}

export function SalesAndCOGSTab({ salesAndCOGS }: SalesAndCOGSTabProps) {
  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">
              إجمالي المبيعات
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {salesAndCOGS.totalSales.toFixed(2)} د.أ
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">
              تكلفة البضاعة المباعة
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {salesAndCOGS.totalCOGS.toFixed(2)} د.أ
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">
              إجمالي الربح
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {salesAndCOGS.grossProfit.toFixed(2)} د.أ
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">
              هامش الربح الإجمالي
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">
              {salesAndCOGS.grossMargin.toFixed(2)}%
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Profitability Analysis */}
      <Card>
        <CardHeader>
          <CardTitle>تحليل الربحية</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex justify-between items-center p-4 bg-green-50 rounded-lg">
              <span className="font-medium">إجمالي إيرادات المبيعات</span>
              <span className="text-xl font-bold text-green-700">
                {salesAndCOGS.totalSales.toFixed(2)} د.أ
              </span>
            </div>
            <div className="flex justify-between items-center p-4 bg-orange-50 rounded-lg">
              <span className="font-medium">تكلفة البضاعة المباعة (COGS)</span>
              <span className="text-xl font-bold text-orange-700">
                - {salesAndCOGS.totalCOGS.toFixed(2)} د.أ
              </span>
            </div>
            <div className="flex justify-between items-center p-4 bg-blue-50 rounded-lg border-2 border-blue-200">
              <span className="font-bold text-lg">إجمالي الربح</span>
              <span className="text-2xl font-bold text-blue-700">
                {salesAndCOGS.grossProfit.toFixed(2)} د.أ
              </span>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600">
                💡 هامش الربح الإجمالي = (إجمالي الربح ÷ المبيعات) × 100 ={" "}
                <span className="font-bold text-purple-600">
                  {salesAndCOGS.grossMargin.toFixed(2)}%
                </span>
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
