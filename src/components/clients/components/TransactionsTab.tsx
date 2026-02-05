import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatShortDate } from "@/lib/date-utils";
import type { LedgerEntry } from '../hooks';

interface TransactionsTabProps {
  ledgerEntries: LedgerEntry[];
}

export function TransactionsTab({ ledgerEntries }: TransactionsTabProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>المعاملات المالية</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>التاريخ</TableHead>
              <TableHead>النوع</TableHead>
              <TableHead>الفئة</TableHead>
              <TableHead>الوصف</TableHead>
              <TableHead className="text-left">المبلغ</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {ledgerEntries.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-gray-500">
                  لا توجد معاملات مالية
                </TableCell>
              </TableRow>
            ) : (
              ledgerEntries.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell>{formatShortDate(entry.date)}</TableCell>
                  <TableCell>
                    <span
                      className={`px-2 py-1 rounded text-xs ${
                        entry.type === "دخل" || entry.type === "إيراد"
                          ? "bg-green-100 text-green-800"
                          : "bg-red-100 text-red-800"
                      }`}
                    >
                      {entry.type}
                    </span>
                  </TableCell>
                  <TableCell>{entry.category}</TableCell>
                  <TableCell>{entry.description}</TableCell>
                  <TableCell className="text-left font-medium">
                    {entry.amount.toFixed(2)} د.أ
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
