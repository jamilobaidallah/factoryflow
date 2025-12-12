"use client";

import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Edit, Trash2, Image as ImageIcon, RefreshCw, X, Copy } from "lucide-react";
import { PermissionGate } from "@/components/auth";
import { Cheque } from "../types/cheques";
import { useToast } from "@/hooks/use-toast";

interface IncomingChequesTableProps {
  cheques: Cheque[];
  onEdit: (cheque: Cheque) => void;
  onDelete: (chequeId: string) => void;
  onEndorse: (cheque: Cheque) => void;
  onCancelEndorsement: (cheque: Cheque) => void;
  onViewImage: (imageUrl: string) => void;
}

export function IncomingChequesTable({
  cheques,
  onEdit,
  onDelete,
  onEndorse,
  onCancelEndorsement,
  onViewImage,
}: IncomingChequesTableProps) {
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
      case "تم الصرف":
        return "badge-success";
      case "قيد الانتظار":
        return "badge-warning";
      case "مجيّر":
        return "badge-primary";
      case "مرفوض":
        return "badge-danger";
      default:
        return "badge-neutral";
    }
  };

  if (cheques.length === 0) {
    return (
      <p className="text-slate-500 text-center py-12">
        لا توجد شيكات واردة مسجلة. اضغط على &quot;إضافة شيك وارد&quot; للبدء.
      </p>
    );
  }

  return (
    <div className="card-modern overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-slate-50/80 hover:bg-slate-50/80">
            <TableHead className="text-right font-semibold text-slate-700">رقم الشيك</TableHead>
            <TableHead className="text-right font-semibold text-slate-700">اسم العميل</TableHead>
            <TableHead className="text-right font-semibold text-slate-700">البنك</TableHead>
            <TableHead className="text-right font-semibold text-slate-700">المبلغ</TableHead>
            <TableHead className="text-right font-semibold text-slate-700">تصنيف الشيك</TableHead>
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
                {cheque.chequeNumber}
              </TableCell>
              <TableCell>
                <div className="space-y-1">
                  <div className="font-medium">{cheque.clientName}</div>
                  {cheque.endorsedTo && (
                    <div className="flex items-center gap-1">
                      <span className="badge-primary">
                        ← مظهر إلى: {cheque.endorsedTo}
                      </span>
                    </div>
                  )}
                </div>
              </TableCell>
              <TableCell>{cheque.bankName}</TableCell>
              <TableCell>
                <span className="font-semibold text-slate-900">
                  {(cheque.amount || 0).toLocaleString()} دينار
                </span>
              </TableCell>
              <TableCell>
                <span className="text-sm text-slate-600">
                  {cheque.chequeType === "مجير" ? "شيك مجير" : "عادي"}
                </span>
              </TableCell>
              <TableCell>
                <span className={getStatusBadgeClass(cheque.status)}>
                  {cheque.status}
                </span>
              </TableCell>
              <TableCell>
                {new Date(cheque.dueDate).toLocaleDateString("ar-EG")}
              </TableCell>
              <TableCell className="font-mono text-xs">
                <div className="space-y-1">
                  {cheque.linkedTransactionId && (
                    <div className="flex items-center gap-1" title="رقم المعاملة المرتبطة">
                      <span>{cheque.linkedTransactionId}</span>
                      <button
                        onClick={() => copyToClipboard(cheque.linkedTransactionId)}
                        className="p-0.5 hover:bg-slate-100 rounded"
                        title="نسخ"
                      >
                        <Copy className="w-3 h-3 text-slate-400 hover:text-slate-600" />
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
                  {/* Show endorse button only for pending cheques that are not endorsed */}
                  <PermissionGate action="update" module="cheques">
                    {cheque.status === "قيد الانتظار" &&
                      cheque.chequeType !== "مجير" && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-slate-400 hover:text-purple-600 hover:bg-purple-50"
                          onClick={() => onEndorse(cheque)}
                          title="تظهير الشيك"
                        >
                          <RefreshCw className="h-4 w-4" />
                        </Button>
                      )}
                  </PermissionGate>
                  {/* Show cancel endorsement button for endorsed cheques */}
                  <PermissionGate action="update" module="cheques">
                    {cheque.status === "مجيّر" &&
                      cheque.chequeType === "مجير" && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-purple-500 hover:text-purple-700 hover:bg-purple-50"
                          onClick={() => onCancelEndorsement(cheque)}
                          title="إلغاء التظهير"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                  </PermissionGate>
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
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
