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
import type { Payment } from '../hooks';

interface PaymentsTabProps {
  payments: Payment[];
}

export function PaymentsTab({ payments }: PaymentsTabProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>الدفعات</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>التاريخ</TableHead>
              <TableHead>النوع</TableHead>
              <TableHead>طريقة الدفع</TableHead>
              <TableHead>الوصف</TableHead>
              <TableHead className="text-left">المبلغ</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {payments.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-gray-500">
                  لا توجد دفعات
                </TableCell>
              </TableRow>
            ) : (
              payments.map((payment) => (
                <TableRow key={payment.id}>
                  <TableCell>{formatShortDate(payment.date)}</TableCell>
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
                  <TableCell>{payment.paymentMethod}</TableCell>
                  <TableCell>{payment.description}</TableCell>
                  <TableCell className="text-left font-medium">
                    {payment.amount.toFixed(2)} د.أ
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
