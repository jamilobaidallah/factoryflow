/**
 * IncomeStatementTab - Displays income statement with revenue/expense breakdown
 * Extracted from reports-page.tsx for better maintainability
 */

import { Fragment } from "react";
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

interface CategoryBreakdown {
  total: number;
  subcategories: { [key: string]: number };
}

interface IncomeStatementData {
  totalRevenue: number;
  totalExpenses: number;
  netProfit: number;
  profitMargin: number;
  revenueByCategory: Record<string, CategoryBreakdown>;
  expensesByCategory: Record<string, CategoryBreakdown>;
}

interface OwnerEquityData {
  ownerInvestments: number;
  ownerWithdrawals: number;
  netOwnerEquity: number;
}

interface IncomeStatementTabProps {
  incomeStatement: IncomeStatementData;
  ownerEquity: OwnerEquityData;
  onExportCSV: () => void;
  onExportExcel: () => void;
  onExportPDFArabic: () => void;
  onExportPDFEnglish: () => void;
}

export function IncomeStatementTab({
  incomeStatement,
  ownerEquity,
  onExportCSV,
  onExportExcel,
  onExportPDFArabic,
  onExportPDFEnglish,
}: IncomeStatementTabProps) {
  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">
              إجمالي الإيرادات
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {incomeStatement.totalRevenue.toFixed(2)} د.أ
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">
              إجمالي المصروفات
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {incomeStatement.totalExpenses.toFixed(2)} د.أ
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">
              صافي الربح/الخسارة
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl font-bold ${
                incomeStatement.netProfit >= 0 ? "text-green-600" : "text-red-600"
              }`}
            >
              {incomeStatement.netProfit.toFixed(2)} د.أ
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">
              هامش الربح
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {incomeStatement.profitMargin.toFixed(2)}%
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Owner Equity Section - Separate from P&L */}
      {(ownerEquity.ownerInvestments > 0 || ownerEquity.ownerWithdrawals > 0) && (
        <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-blue-900 mb-4">
            رأس المال (منفصل عن الأرباح والخسائر)
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="bg-white">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-gray-600">
                  استثمارات المالك
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">
                  {ownerEquity.ownerInvestments.toFixed(2)} د.أ
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-gray-600">
                  سحوبات المالك
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">
                  {ownerEquity.ownerWithdrawals.toFixed(2)} د.أ
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-gray-600">
                  صافي رأس المال
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div
                  className={`text-2xl font-bold ${
                    ownerEquity.netOwnerEquity >= 0 ? "text-blue-600" : "text-red-600"
                  }`}
                >
                  {ownerEquity.netOwnerEquity.toFixed(2)} د.أ
                </div>
              </CardContent>
            </Card>
          </div>
          <p className="text-sm text-blue-700 mt-3 text-center">
            ⓘ رأس المال لا يُحتسب ضمن الأرباح أو الخسائر التشغيلية
          </p>
        </div>
      )}

      {/* Revenue & Expenses Breakdown */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>تفصيل الإيرادات والمصروفات</CardTitle>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={onExportCSV}>
                <Download className="w-4 h-4 ml-2" />
                CSV
              </Button>
              <Button variant="outline" size="sm" onClick={onExportExcel}>
                <Download className="w-4 h-4 ml-2" />
                Excel
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={onExportPDFArabic}
                title="طباعة باللغة العربية"
              >
                <Download className="w-4 h-4 ml-2" />
                PDF عربي
              </Button>
              <Button variant="outline" size="sm" onClick={onExportPDFEnglish}>
                <Download className="w-4 h-4 ml-2" />
                PDF (EN)
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Revenue Breakdown */}
            <div>
              <h3 className="font-semibold text-lg mb-3 text-green-700">
                الإيرادات حسب الفئة
              </h3>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>الفئة / الفئة الفرعية</TableHead>
                    <TableHead className="text-left">المبلغ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Object.entries(incomeStatement.revenueByCategory).map(
                    ([category, breakdown]) => (
                      <Fragment key={category}>
                        <TableRow className="bg-green-50/50">
                          <TableCell className="font-semibold">{category}</TableCell>
                          <TableCell className="text-left font-semibold">
                            {breakdown.total.toFixed(2)} د.أ
                          </TableCell>
                        </TableRow>
                        {Object.entries(breakdown.subcategories).map(
                          ([subCategory, amount]) => (
                            <TableRow key={`${category}-${subCategory}`}>
                              <TableCell className="pr-8 text-gray-600">
                                ↳ {subCategory}
                              </TableCell>
                              <TableCell className="text-left font-medium text-gray-600">
                                {amount.toFixed(2)} د.أ
                              </TableCell>
                            </TableRow>
                          )
                        )}
                      </Fragment>
                    )
                  )}
                  <TableRow className="bg-green-100">
                    <TableCell className="font-bold">المجموع</TableCell>
                    <TableCell className="text-left font-bold text-green-700">
                      {incomeStatement.totalRevenue.toFixed(2)} د.أ
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>

            {/* Expenses Breakdown */}
            <div>
              <h3 className="font-semibold text-lg mb-3 text-red-700">
                المصروفات حسب الفئة
              </h3>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>الفئة / الفئة الفرعية</TableHead>
                    <TableHead className="text-left">المبلغ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Object.entries(incomeStatement.expensesByCategory).map(
                    ([category, breakdown]) => (
                      <Fragment key={category}>
                        <TableRow className="bg-red-50/50">
                          <TableCell className="font-semibold">{category}</TableCell>
                          <TableCell className="text-left font-semibold">
                            {breakdown.total.toFixed(2)} د.أ
                          </TableCell>
                        </TableRow>
                        {Object.entries(breakdown.subcategories).map(
                          ([subCategory, amount]) => (
                            <TableRow key={`${category}-${subCategory}`}>
                              <TableCell className="pr-8 text-gray-600">
                                ↳ {subCategory}
                              </TableCell>
                              <TableCell className="text-left font-medium text-gray-600">
                                {amount.toFixed(2)} د.أ
                              </TableCell>
                            </TableRow>
                          )
                        )}
                      </Fragment>
                    )
                  )}
                  <TableRow className="bg-red-100">
                    <TableCell className="font-bold">المجموع</TableCell>
                    <TableCell className="text-left font-bold text-red-700">
                      {incomeStatement.totalExpenses.toFixed(2)} د.أ
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
