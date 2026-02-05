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
import { CHEQUE_STATUS_AR } from "@/lib/constants";
import type { Cheque } from '../hooks';

interface ChequesTabProps {
  cheques: Cheque[];
}

export function ChequesTab({ cheques }: ChequesTabProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>الشيكات</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>رقم الشيك</TableHead>
              <TableHead>تاريخ الإصدار</TableHead>
              <TableHead>البنك</TableHead>
              <TableHead>النوع</TableHead>
              <TableHead>الحالة</TableHead>
              <TableHead className="text-left">المبلغ</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {cheques.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-gray-500">
                  لا توجد شيكات
                </TableCell>
              </TableRow>
            ) : (
              cheques.map((cheque) => (
                <TableRow key={cheque.id}>
                  <TableCell>{cheque.chequeNumber}</TableCell>
                  <TableCell>{formatShortDate(cheque.issueDate)}</TableCell>
                  <TableCell>{cheque.bankName}</TableCell>
                  <TableCell>{cheque.type}</TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      <span
                        className={`px-2 py-1 rounded text-xs inline-block w-fit ${
                          cheque.status === CHEQUE_STATUS_AR.PENDING
                            ? "bg-yellow-100 text-yellow-800"
                            : cheque.status === CHEQUE_STATUS_AR.CASHED || cheque.status === CHEQUE_STATUS_AR.COLLECTED
                            ? "bg-green-100 text-green-800"
                            : cheque.status === CHEQUE_STATUS_AR.ENDORSED
                            ? "bg-purple-100 text-purple-800"
                            : cheque.status === CHEQUE_STATUS_AR.BOUNCED
                            ? "bg-red-100 text-red-800"
                            : cheque.status === CHEQUE_STATUS_AR.RETURNED
                            ? "bg-orange-100 text-orange-800"
                            : "bg-gray-100 text-gray-800"
                        }`}
                      >
                        {cheque.status}
                      </span>
                      {/* Show endorsement info if cheque is endorsed */}
                      {cheque.endorsedTo && (
                        <span className="text-xs text-purple-600">
                          ← {cheque.endorsedTo}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-left font-medium">
                    {cheque.amount.toFixed(2)} د.أ
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
