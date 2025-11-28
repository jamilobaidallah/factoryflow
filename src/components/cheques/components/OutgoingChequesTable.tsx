"use client";

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
import { Edit, Trash2, Image as ImageIcon, Link } from "lucide-react";
import { Cheque } from "../types/cheques";
import { CHEQUE_STATUS_AR } from "@/lib/constants";

interface OutgoingChequesTableProps {
  cheques: Cheque[];
  onEdit: (cheque: Cheque) => void;
  onDelete: (chequeId: string) => void;
  onViewImage: (imageUrl: string) => void;
  onLinkTransaction: (cheque: Cheque) => void;
}

export function OutgoingChequesTable({
  cheques,
  onEdit,
  onDelete,
  onViewImage,
  onLinkTransaction,
}: OutgoingChequesTableProps) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case CHEQUE_STATUS_AR.CASHED:
        return "bg-green-100 text-green-700";
      case CHEQUE_STATUS_AR.PENDING:
        return "bg-yellow-100 text-yellow-700";
      case CHEQUE_STATUS_AR.RETURNED:
        return "bg-orange-100 text-orange-700";
      case CHEQUE_STATUS_AR.CANCELLED:
        return "bg-red-100 text-red-700";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  // Calculate summary statistics
  const pendingCheques = cheques.filter(c => c.status === CHEQUE_STATUS_AR.PENDING);
  const cashedCheques = cheques.filter(c => c.status === CHEQUE_STATUS_AR.CASHED);
  const bouncedCheques = cheques.filter(c => c.status === CHEQUE_STATUS_AR.RETURNED);
  const cancelledCheques = cheques.filter(c => c.status === CHEQUE_STATUS_AR.CANCELLED);
  const endorsedCheques = cheques.filter(c => c.isEndorsedCheque);

  const totalPendingValue = pendingCheques.reduce((sum, c) => sum + c.amount, 0);
  const totalCashedValue = cashedCheques.reduce((sum, c) => sum + c.amount, 0);
  const totalBouncedValue = bouncedCheques.reduce((sum, c) => sum + c.amount, 0);
  const totalEndorsedValue = endorsedCheques.reduce((sum, c) => sum + c.amount, 0);

  return (
    <>
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">قيد الانتظار</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{pendingCheques.length}</div>
            <p className="text-xs text-gray-500 mt-1">{totalPendingValue.toFixed(2)} دينار</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">تم الصرف</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{cashedCheques.length}</div>
            <p className="text-xs text-gray-500 mt-1">{totalCashedValue.toFixed(2)} دينار</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">مرتجع</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{bouncedCheques.length}</div>
            <p className="text-xs text-gray-500 mt-1">{totalBouncedValue.toFixed(2)} دينار</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">شيكات مظهرة</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">{endorsedCheques.length}</div>
            <p className="text-xs text-gray-500 mt-1">{totalEndorsedValue.toFixed(2)} دينار</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">ملغي</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{cancelledCheques.length}</div>
            <p className="text-xs text-gray-500 mt-1">شيكات ملغاة</p>
          </CardContent>
        </Card>
      </div>

      {/* Cheques Table */}
      <Card>
        <CardHeader>
          <CardTitle>سجل الشيكات الصادرة ({cheques.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {cheques.length === 0 ? (
            <p className="text-gray-500 text-center py-12">
              لا توجد شيكات صادرة مسجلة. اضغط على &quot;إضافة شيك صادر&quot; للبدء.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>رقم الشيك</TableHead>
                  <TableHead>اسم المستفيد</TableHead>
                  <TableHead>البنك</TableHead>
                  <TableHead>المبلغ</TableHead>
                  <TableHead>الحالة</TableHead>
                  <TableHead>تاريخ الاستحقاق</TableHead>
                  <TableHead>رقم المعاملة</TableHead>
                  <TableHead>صورة</TableHead>
                  <TableHead>الإجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cheques.map((cheque) => (
                  <TableRow key={cheque.id}>
                    <TableCell className="font-medium">
                      <div className="space-y-1">
                        <div>{cheque.chequeNumber}</div>
                        {cheque.isEndorsedCheque && (
                          <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded text-xs font-medium">
                            شيك مظهر
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="font-medium">{cheque.clientName}</div>
                        {cheque.notes && cheque.isEndorsedCheque && (
                          <div className="text-xs text-gray-500">{cheque.notes}</div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{cheque.bankName}</TableCell>
                    <TableCell>{cheque.amount || 0} دينار</TableCell>
                    <TableCell>
                      <span
                        className={`px-2 py-1 rounded-full text-xs ${getStatusColor(
                          cheque.status
                        )}`}
                      >
                        {cheque.status}
                      </span>
                    </TableCell>
                    <TableCell>
                      {new Date(cheque.dueDate).toLocaleDateString("ar-EG")}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {cheque.linkedTransactionId ? (
                        <span className="px-2 py-1 bg-green-50 text-green-700 rounded border border-green-200">
                          {cheque.linkedTransactionId}
                        </span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {cheque.chequeImageUrl ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onViewImage(cheque.chequeImageUrl!)}
                          title="عرض صورة الشيك"
                        >
                          <ImageIcon className="w-4 h-4 text-blue-600" />
                        </Button>
                      ) : (
                        <span className="text-xs text-gray-400">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        {!cheque.isEndorsedCheque ? (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => onEdit(cheque)}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => onDelete(cheque.id)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onLinkTransaction(cheque)}
                            title="ربط بفاتورة"
                            className="border-blue-300 text-blue-700 hover:bg-blue-50"
                          >
                            <Link className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </>
  );
}
