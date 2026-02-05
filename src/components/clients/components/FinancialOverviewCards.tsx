import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Landmark } from "lucide-react";

interface FinancialOverviewCardsProps {
  totalSales: number;
  totalPurchases: number;
  loansReceivable: number;
  loansPayable: number;
  salesCount: number;
  purchasesCount: number;
}

export function FinancialOverviewCards({
  totalSales,
  totalPurchases,
  loansReceivable,
  loansPayable,
  salesCount,
  purchasesCount,
}: FinancialOverviewCardsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
            <TrendingUp className="w-4 h-4" />
            إجمالي المبيعات
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-green-600">
            {totalSales.toFixed(2)} د.أ
          </div>
          <p className="text-xs text-gray-500 mt-1">
            {salesCount} معاملة
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
            <TrendingDown className="w-4 h-4" />
            إجمالي المشتريات
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-orange-600">
            {totalPurchases.toFixed(2)} د.أ
          </div>
          <p className="text-xs text-gray-500 mt-1">
            {purchasesCount} معاملة
          </p>
        </CardContent>
      </Card>

      {/* Loan Balance Card - Only show if there are loans */}
      {(loansReceivable > 0 || loansPayable > 0) && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
              <Landmark className="w-4 h-4" />
              رصيد القروض
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loansReceivable > 0 && (
              <div className="text-lg font-semibold text-green-600">
                له (قرض ممنوح): {loansReceivable.toFixed(2)} د.أ
              </div>
            )}
            {loansPayable > 0 && (
              <div className="text-lg font-semibold text-red-600">
                عليه (قرض مستلم): {loansPayable.toFixed(2)} د.أ
              </div>
            )}
            <p className="text-xs text-gray-500 mt-1">
              {loansReceivable > 0 && loansPayable > 0
                ? "قروض متبادلة"
                : loansReceivable > 0
                ? "قرض ممنوح للعميل"
                : "قرض من العميل"}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
