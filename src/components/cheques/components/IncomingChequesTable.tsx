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

  const getStatusColor = (status: string) => {
    switch (status) {
      case "تم الصرف":
        return "bg-green-100 text-green-700";
      case "قيد الانتظار":
        return "bg-yellow-100 text-yellow-700";
      case "مجيّر":
        return "bg-purple-100 text-purple-700";
      case "مرفوض":
        return "bg-red-100 text-red-700";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  if (cheques.length === 0) {
    return (
      <p className="text-gray-500 text-center py-12">
        لا توجد شيكات واردة مسجلة. اضغط على &quot;إضافة شيك وارد&quot; للبدء.
      </p>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>رقم الشيك</TableHead>
          <TableHead>اسم العميل</TableHead>
          <TableHead>البنك</TableHead>
          <TableHead>المبلغ</TableHead>
          <TableHead>تصنيف الشيك</TableHead>
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
              {cheque.chequeNumber}
            </TableCell>
            <TableCell>
              <div className="space-y-1">
                <div className="font-medium">{cheque.clientName}</div>
                {cheque.endorsedTo && (
                  <div className="flex items-center gap-1">
                    <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded text-xs font-medium">
                      ← مظهر إلى: {cheque.endorsedTo}
                    </span>
                  </div>
                )}
              </div>
            </TableCell>
            <TableCell>{cheque.bankName}</TableCell>
            <TableCell>{cheque.amount || 0} دينار</TableCell>
            <TableCell>
              <span className="text-sm">
                {cheque.chequeType === "مجير" ? "شيك مجير" : "عادي"}
              </span>
            </TableCell>
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
              <div className="space-y-1">
                {cheque.linkedTransactionId && (
                  <div className="flex items-center gap-1" title="رقم المعاملة المرتبطة">
                    <span>{cheque.linkedTransactionId}</span>
                    <button
                      onClick={() => copyToClipboard(cheque.linkedTransactionId)}
                      className="p-0.5 hover:bg-gray-100 rounded"
                      title="نسخ"
                    >
                      <Copy className="w-3 h-3 text-gray-400 hover:text-gray-600" />
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
                {!cheque.linkedTransactionId && (!cheque.paidTransactionIds || cheque.paidTransactionIds.length === 0) && "-"}
              </div>
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
                {/* Show endorse button only for pending cheques that are not endorsed */}
                {cheque.status === "قيد الانتظار" &&
                  cheque.chequeType !== "مجير" && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => onEndorse(cheque)}
                      title="تظهير الشيك"
                    >
                      <RefreshCw className="w-4 h-4" />
                    </Button>
                  )}
                {/* Show cancel endorsement button for endorsed cheques */}
                {cheque.status === "مجيّر" &&
                  cheque.chequeType === "مجير" && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onCancelEndorsement(cheque)}
                      title="إلغاء التظهير"
                      className="border-purple-300 text-purple-700 hover:bg-purple-50"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  )}
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
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
