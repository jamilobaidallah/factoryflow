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

interface CashFlowTabProps {
  cashFlow: CashFlowData;
  payments: Payment[];
  onExportCSV: () => void;
}

export function CashFlowTab({ cashFlow, payments, onExportCSV }: CashFlowTabProps) {
  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">
              النقد الوارد
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {cashFlow.cashIn.toFixed(2)} د.أ
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">
              النقد الصادر
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {cashFlow.cashOut.toFixed(2)} د.أ
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">
              صافي التدفق النقدي
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl font-bold ${
                cashFlow.netCashFlow >= 0 ? "text-green-600" : "text-red-600"
              }`}
            >
              {cashFlow.netCashFlow.toFixed(2)} د.أ
            </div>
          </CardContent>
        </Card>
      </div>

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
                    {payment.date.toLocaleDateString("ar-JO")}
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
