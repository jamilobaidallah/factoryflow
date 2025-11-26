/**
 * ARAPAgingTab - Displays accounts receivable and payable aging report
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

interface ARAPEntry {
  id: string;
  transactionId: string;
  description: string;
  associatedParty: string;
  amount: number;
  totalPaid?: number;
  remainingBalance?: number;
  date: Date;
}

interface ARAPAgingData {
  totalReceivables: number;
  totalPayables: number;
  receivables: ARAPEntry[];
  payables: ARAPEntry[];
  getAgingBucket: (date: Date) => string;
}

interface ARAPAgingTabProps {
  arapAging: ARAPAgingData;
  onExportReceivablesCSV: () => void;
  onExportPayablesCSV: () => void;
}

export function ARAPAgingTab({
  arapAging,
  onExportReceivablesCSV,
  onExportPayablesCSV,
}: ARAPAgingTabProps) {
  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">
              إجمالي المستحقات (حسابات القبض)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {arapAging.totalReceivables.toFixed(2)} د.أ
            </div>
            <p className="text-sm text-gray-500 mt-1">
              {arapAging.receivables.length} معاملة
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">
              إجمالي المدفوعات (حسابات الدفع)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {arapAging.totalPayables.toFixed(2)} د.أ
            </div>
            <p className="text-sm text-gray-500 mt-1">
              {arapAging.payables.length} معاملة
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Accounts Receivable */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>حسابات القبض (المستحقات لنا)</CardTitle>
              <Button variant="outline" size="sm" onClick={onExportReceivablesCSV}>
                <Download className="w-4 h-4 ml-2" />
                تصدير
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>الطرف</TableHead>
                  <TableHead>المتبقي</TableHead>
                  <TableHead>العمر</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {arapAging.receivables.map((receivable) => (
                  <TableRow key={receivable.id}>
                    <TableCell>{receivable.associatedParty}</TableCell>
                    <TableCell className="font-medium">
                      {(receivable.remainingBalance || 0).toFixed(2)} د.أ
                    </TableCell>
                    <TableCell>
                      <span className="text-xs px-2 py-1 bg-yellow-100 text-yellow-800 rounded">
                        {arapAging.getAgingBucket(receivable.date)}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Accounts Payable */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>حسابات الدفع (المستحقات علينا)</CardTitle>
              <Button variant="outline" size="sm" onClick={onExportPayablesCSV}>
                <Download className="w-4 h-4 ml-2" />
                تصدير
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>الطرف</TableHead>
                  <TableHead>المتبقي</TableHead>
                  <TableHead>العمر</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {arapAging.payables.map((payable) => (
                  <TableRow key={payable.id}>
                    <TableCell>{payable.associatedParty}</TableCell>
                    <TableCell className="font-medium">
                      {(payable.remainingBalance || 0).toFixed(2)} د.أ
                    </TableCell>
                    <TableCell>
                      <span className="text-xs px-2 py-1 bg-orange-100 text-orange-800 rounded">
                        {arapAging.getAgingBucket(payable.date)}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
