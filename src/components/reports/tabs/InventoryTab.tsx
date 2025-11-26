/**
 * InventoryTab - Displays inventory valuation report
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

interface InventoryItem {
  id: string;
  itemName: string;
  category: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  totalValue: number;
}

interface InventoryValuationData {
  totalValue: number;
  totalItems: number;
  lowStockItems: number;
  valuedInventory: InventoryItem[];
}

interface InventoryTabProps {
  inventoryValuation: InventoryValuationData;
  onExportCSV: () => void;
}

export function InventoryTab({ inventoryValuation, onExportCSV }: InventoryTabProps) {
  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">
              إجمالي قيمة المخزون
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {inventoryValuation.totalValue.toFixed(2)} د.أ
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">
              عدد الأصناف
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-700">
              {inventoryValuation.totalItems}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">
              أصناف منخفضة المخزون
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {inventoryValuation.lowStockItems}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Inventory Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>تفصيل المخزون</CardTitle>
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
                <TableHead>الصنف</TableHead>
                <TableHead>الفئة</TableHead>
                <TableHead>الكمية</TableHead>
                <TableHead>سعر الوحدة</TableHead>
                <TableHead className="text-left">القيمة الإجمالية</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {inventoryValuation.valuedInventory.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.itemName}</TableCell>
                  <TableCell>{item.category}</TableCell>
                  <TableCell>
                    {item.quantity} {item.unit}
                  </TableCell>
                  <TableCell>{item.unitPrice.toFixed(2)} د.أ</TableCell>
                  <TableCell className="text-left font-medium">
                    {item.totalValue.toFixed(2)} د.أ
                  </TableCell>
                </TableRow>
              ))}
              <TableRow className="bg-blue-50">
                <TableCell colSpan={4} className="font-bold">
                  المجموع الكلي
                </TableCell>
                <TableCell className="text-left font-bold text-blue-700">
                  {inventoryValuation.totalValue.toFixed(2)} د.أ
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
