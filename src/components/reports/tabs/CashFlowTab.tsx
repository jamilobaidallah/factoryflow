/**
 * CashFlowTab - Displays cash flow summary and payment details
 * Extracted from reports-page.tsx for better maintainability
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Download } from "lucide-react";
import { formatShortDate } from "@/lib/date-utils";

interface Payment {
  id: string;
  amount: number;
  type: string;
  date: Date;
}

interface CashFlowData {
  cashIn: number;
  cashOut: number;
  netCashFlow: number;
}

interface FinancingActivitiesData {
  capitalIn: number;
  capitalOut: number;
  netFinancing: number;
}

interface CashFlowTabProps {
  cashFlow: CashFlowData;
  financingActivities: FinancingActivitiesData;
  payments: Payment[];
  onExportCSV: () => void;
}

export function CashFlowTab({ cashFlow, financingActivities, payments, onExportCSV }: CashFlowTabProps) {
  // Total cash = Operating (payments) + Financing (equity)
  const totalCashBalance = cashFlow.netCashFlow + financingActivities.netFinancing;

  return (
    <div className="space-y-4">
      {/* Operating Activities - من المدفوعات */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold text-gray-700">
            الأنشطة التشغيلية
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-3 bg-green-50 rounded-lg">
              <p className="text-sm text-gray-600 mb-1">النقد الوارد</p>
              <p className="text-xl font-bold text-green-600">
                {cashFlow.cashIn.toFixed(2)} د.أ
              </p>
            </div>
            <div className="p-3 bg-red-50 rounded-lg">
              <p className="text-sm text-gray-600 mb-1">النقد الصادر</p>
              <p className="text-xl font-bold text-red-600">
                {cashFlow.cashOut.toFixed(2)} د.أ
              </p>
            </div>
            <div className={`p-3 rounded-lg ${cashFlow.netCashFlow >= 0 ? "bg-blue-50" : "bg-red-50"}`}>
              <p className="text-sm text-gray-600 mb-1">صافي التدفق التشغيلي</p>
              <p className={`text-xl font-bold ${cashFlow.netCashFlow >= 0 ? "text-blue-600" : "text-red-600"}`}>
                {cashFlow.netCashFlow.toFixed(2)} د.أ
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Financing Activities - من دفتر الأستاذ */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold text-gray-700">
            الأنشطة التمويلية
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-3 bg-green-50 rounded-lg">
              <p className="text-sm text-gray-600 mb-1">رأس مال مالك (وارد)</p>
              <p className="text-xl font-bold text-green-600">
                {financingActivities.capitalIn.toFixed(2)} د.أ
              </p>
            </div>
            <div className="p-3 bg-red-50 rounded-lg">
              <p className="text-sm text-gray-600 mb-1">سحوبات المالك (صادر)</p>
              <p className="text-xl font-bold text-red-600">
                {financingActivities.capitalOut.toFixed(2)} د.أ
              </p>
            </div>
            <div className={`p-3 rounded-lg ${financingActivities.netFinancing >= 0 ? "bg-purple-50" : "bg-red-50"}`}>
              <p className="text-sm text-gray-600 mb-1">صافي التدفق التمويلي</p>
              <p className={`text-xl font-bold ${financingActivities.netFinancing >= 0 ? "text-purple-600" : "text-red-600"}`}>
                {financingActivities.netFinancing.toFixed(2)} د.أ
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Total Cash Balance */}
      <Card className="border-2 border-slate-200">
        <CardContent className="pt-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">إجمالي الرصيد النقدي</p>
              <p className="text-xs text-gray-400">(تشغيلي + تمويلي)</p>
            </div>
            <p className={`text-3xl font-bold ${totalCashBalance >= 0 ? "text-slate-800" : "text-red-600"}`}>
              {totalCashBalance.toFixed(2)} د.أ
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Payments Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>تفصيل المدفوعات</CardTitle>
            <Button variant="outline" size="sm" onClick={onExportCSV}>
              <Download className="w-4 h-4 ml-2" />
              تصدير CSV
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>التاريخ</TableHead>
                <TableHead>النوع</TableHead>
                <TableHead className="text-left">المبلغ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payments.slice(0, 20).map((payment) => (
                <TableRow key={payment.id}>
                  <TableCell>
                    {formatShortDate(payment.date)}
                  </TableCell>
                  <TableCell>
                    <span
                      className={`px-2 py-1 rounded text-xs ${
                        payment.type === "قبض"
                          ? "bg-green-100 text-green-800"
                          : "bg-red-100 text-red-800"
                      }`}
                    >
                      {payment.type}
                    </span>
                  </TableCell>
                  <TableCell className="text-left font-medium">
                    {payment.amount.toFixed(2)} د.أ
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {payments.length > 20 && (
            <p className="text-sm text-gray-500 mt-3 text-center">
              عرض 20 من {payments.length} معاملة
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
