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
import { Edit, Trash2, Image as ImageIcon, Link, Copy } from "lucide-react";
import { PermissionGate } from "@/components/auth";
import { Cheque } from "../types/cheques";
import { CHEQUE_STATUS_AR } from "@/lib/constants";
import { useToast } from "@/hooks/use-toast";
import { formatShortDate, formatNumber } from "@/lib/date-utils";

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
  const { toast } = useToast();

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: "تم النسخ",
        description: "تم نسخ رقم المعاملة",
      });
    } catch {
      toast({
        title: "خطأ",
        description: "فشل في النسخ",
        variant: "destructive",
      });
    }
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case CHEQUE_STATUS_AR.CASHED:
        return "badge-success";
      case CHEQUE_STATUS_AR.PENDING:
        return "badge-warning";
      case CHEQUE_STATUS_AR.RETURNED:
        return "badge-danger";
      case CHEQUE_STATUS_AR.CANCELLED:
        return "badge-neutral";
      default:
        return "badge-neutral";
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
        <Card className="card-modern">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">قيد الانتظار</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{pendingCheques.length}</div>
            <p className="text-xs text-slate-500 mt-1">{formatNumber(totalPendingValue)} دينار</p>
          </CardContent>
        </Card>
        <Card className="card-modern">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">تم الصرف</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{cashedCheques.length}</div>
            <p className="text-xs text-slate-500 mt-1">{formatNumber(totalCashedValue)} دينار</p>
          </CardContent>
        </Card>
        <Card className="card-modern">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">مرتجع</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{bouncedCheques.length}</div>
            <p className="text-xs text-slate-500 mt-1">{formatNumber(totalBouncedValue)} دينار</p>
          </CardContent>
        </Card>
        <Card className="card-modern">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">شيكات مظهرة</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">{endorsedCheques.length}</div>
            <p className="text-xs text-slate-500 mt-1">{formatNumber(totalEndorsedValue)} دينار</p>
          </CardContent>
        </Card>
        <Card className="card-modern">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">ملغي</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{cancelledCheques.length}</div>
            <p className="text-xs text-slate-500 mt-1">شيكات ملغاة</p>
          </CardContent>
        </Card>
      </div>

      {/* Cheques Table */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-slate-800">سجل الشيكات الصادرة ({cheques.length})</h2>
        {cheques.length === 0 ? (
          <p className="text-slate-500 text-center py-12">
            لا توجد شيكات صادرة مسجلة. اضغط على &quot;إضافة شيك صادر&quot; للبدء.
          </p>
        ) : (
          <div className="card-modern overflow-hidden">
            <Table>
              <TableHeader sticky className="bg-slate-50">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="text-right font-semibold text-slate-700">رقم الشيك</TableHead>
                  <TableHead className="text-right font-semibold text-slate-700">اسم المستفيد</TableHead>
                  <TableHead className="text-right font-semibold text-slate-700">البنك</TableHead>
                  <TableHead className="text-right font-semibold text-slate-700">المبلغ</TableHead>
                  <TableHead className="text-right font-semibold text-slate-700">الحالة</TableHead>
                  <TableHead className="text-right font-semibold text-slate-700">تاريخ الاستحقاق</TableHead>
                  <TableHead className="text-right font-semibold text-slate-700">رقم المعاملة</TableHead>
                  <TableHead className="text-right font-semibold text-slate-700">صورة</TableHead>
                  <TableHead className="text-right font-semibold text-slate-700">الإجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cheques.map((cheque) => (
                  <TableRow key={cheque.id} className="table-row-hover">
                    <TableCell className="font-medium">
                      <div className="space-y-1">
                        <div>{cheque.chequeNumber}</div>
                        {cheque.isEndorsedCheque && (
                          <span className="badge-primary">
                            شيك مظهر
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="font-medium">{cheque.clientName}</div>
                        {cheque.notes && cheque.isEndorsedCheque && (
                          <div className="text-xs text-slate-500">{cheque.notes}</div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{cheque.bankName}</TableCell>
                    <TableCell>
                      <span className="font-semibold text-slate-900">
                        {formatNumber(cheque.amount || 0)} دينار
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className={getStatusBadgeClass(cheque.status)}>
                        {cheque.status}
                      </span>
                    </TableCell>
                    <TableCell>
                      {formatShortDate(cheque.dueDate)}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      <div className="space-y-1">
                        {cheque.linkedTransactionId && (
                          <div className="flex items-center gap-1 px-2 py-1 bg-green-50 text-green-700 rounded border border-green-200" title="رقم المعاملة المرتبطة">
                            <span className="flex-1">{cheque.linkedTransactionId}</span>
                            <button
                              onClick={() => copyToClipboard(cheque.linkedTransactionId)}
                              className="p-0.5 hover:bg-green-100 rounded"
                              title="نسخ"
                            >
                              <Copy className="w-3 h-3 text-green-500 hover:text-green-700" />
                            </button>
                          </div>
                        )}
                        {cheque.paidTransactionIds && cheque.paidTransactionIds.length > 0 && (
                          <div className="space-y-0.5">
                            {cheque.paidTransactionIds.map((txnId, idx) => (
                              <div
                                key={idx}
                                className="flex items-center gap-1 px-2 py-0.5 bg-green-50 text-green-700 rounded border border-green-200 text-xs"
                                title="معاملة مدفوعة"
                              >
                                <span className="flex-1">{txnId}</span>
                                <button
                                  onClick={() => copyToClipboard(txnId)}
                                  className="p-0.5 hover:bg-green-100 rounded"
                                  title="نسخ"
                                >
                                  <Copy className="w-3 h-3 text-green-500 hover:text-green-700" />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                        {!cheque.linkedTransactionId && (!cheque.paidTransactionIds || cheque.paidTransactionIds.length === 0) && (
                          <span className="text-slate-400">-</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {cheque.chequeImageUrl ? (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-slate-400 hover:text-blue-600 hover:bg-blue-50"
                          onClick={() => onViewImage(cheque.chequeImageUrl!)}
                          title="عرض صورة الشيك"
                        >
                          <ImageIcon className="h-4 w-4" />
                        </Button>
                      ) : (
                        <span className="text-xs text-slate-400">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {!cheque.isEndorsedCheque ? (
                          <>
                            <PermissionGate action="update" module="cheques">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                                onClick={() => onEdit(cheque)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                            </PermissionGate>
                            <PermissionGate action="delete" module="cheques">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-slate-400 hover:text-red-600 hover:bg-red-50"
                                onClick={() => onDelete(cheque.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </PermissionGate>
                          </>
                        ) : (
                          <PermissionGate action="update" module="cheques">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-slate-400 hover:text-blue-600 hover:bg-blue-50"
                              onClick={() => onLinkTransaction(cheque)}
                              title="ربط بفاتورة"
                            >
                              <Link className="h-4 w-4" />
                            </Button>
                          </PermissionGate>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </>
  );
}
