/**
 * FixedAssetsTab - Displays fixed assets summary and depreciation details
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

interface FixedAsset {
  id: string;
  assetName: string;
  category: string;
  purchaseCost: number;
  accumulatedDepreciation: number;
  bookValue: number;
  monthlyDepreciation: number;
}

interface FixedAssetsSummaryData {
  totalCost: number;
  totalAccumulatedDepreciation: number;
  totalBookValue: number;
  monthlyDepreciation: number;
  activeAssets: FixedAsset[];
}

interface FixedAssetsTabProps {
  fixedAssetsSummary: FixedAssetsSummaryData;
  onExportCSV: () => void;
}

export function FixedAssetsTab({ fixedAssetsSummary, onExportCSV }: FixedAssetsTabProps) {
  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">
              إجمالي التكلفة الأصلية
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {fixedAssetsSummary.totalCost.toFixed(2)} د.أ
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">
              مجمع الاستهلاك
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {fixedAssetsSummary.totalAccumulatedDepreciation.toFixed(2)} د.أ
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">
              صافي القيمة الدفترية
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {fixedAssetsSummary.totalBookValue.toFixed(2)} د.أ
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">
              الاستهلاك الشهري
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">
              {fixedAssetsSummary.monthlyDepreciation.toFixed(2)} د.أ
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Assets Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>تفصيل الأصول الثابتة</CardTitle>
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
                <TableHead>الأصل</TableHead>
                <TableHead>الفئة</TableHead>
                <TableHead>التكلفة الأصلية</TableHead>
                <TableHead>مجمع الاستهلاك</TableHead>
                <TableHead className="text-left">القيمة الدفترية</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {fixedAssetsSummary.activeAssets.map((asset) => (
                <TableRow key={asset.id}>
                  <TableCell className="font-medium">{asset.assetName}</TableCell>
                  <TableCell>{asset.category}</TableCell>
                  <TableCell>{asset.purchaseCost.toFixed(2)} د.أ</TableCell>
                  <TableCell>
                    {asset.accumulatedDepreciation.toFixed(2)} د.أ
                  </TableCell>
                  <TableCell className="text-left font-medium">
                    {asset.bookValue.toFixed(2)} د.أ
                  </TableCell>
                </TableRow>
              ))}
              <TableRow className="bg-blue-50">
                <TableCell colSpan={4} className="font-bold">
                  المجموع الكلي
                </TableCell>
                <TableCell className="text-left font-bold text-blue-700">
                  {fixedAssetsSummary.totalBookValue.toFixed(2)} د.أ
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
