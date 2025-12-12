"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Check, X, MessageSquare } from "lucide-react";
import { useConfirmation } from "@/components/ui/confirmation-dialog";
import { useToast } from "@/hooks/use-toast";
import { RoleSelector } from "./RoleSelector";
import { approveRequest, rejectRequest } from "@/services/userService";
import { USER_ROLE_LABELS } from "@/lib/constants";
import type { AccessRequest, UserRole } from "@/types/rbac";

interface PendingRequestsListProps {
  requests: AccessRequest[];
  ownerId: string;
  onRequestProcessed: () => void;
}

export function PendingRequestsList({
  requests,
  ownerId,
  onRequestProcessed,
}: PendingRequestsListProps) {
  const { toast } = useToast();
  const { confirm, dialog: confirmationDialog } = useConfirmation();
  const [processingRequestId, setProcessingRequestId] = useState<string | null>(null);

  // Approval dialog state
  const [approvalDialogOpen, setApprovalDialogOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<AccessRequest | null>(null);
  const [selectedRole, setSelectedRole] = useState<UserRole>("accountant");

  const openApprovalDialog = (request: AccessRequest) => {
    setSelectedRequest(request);
    setSelectedRole("accountant");
    setApprovalDialogOpen(true);
  };

  const handleApprove = async () => {
    if (!selectedRequest) return;

    setProcessingRequestId(selectedRequest.id);
    setApprovalDialogOpen(false);

    const result = await approveRequest(selectedRequest.id, ownerId, selectedRole);

    if (result.success) {
      toast({
        title: "تم قبول الطلب",
        description: `تم منح ${selectedRequest.displayName || selectedRequest.email} دور ${USER_ROLE_LABELS[selectedRole]}`,
      });
      onRequestProcessed();
    } else {
      toast({
        title: "خطأ",
        description: result.error || "حدث خطأ أثناء قبول الطلب",
        variant: "destructive",
      });
    }

    setProcessingRequestId(null);
    setSelectedRequest(null);
  };

  const handleReject = (request: AccessRequest) => {
    confirm(
      "رفض الطلب",
      `هل أنت متأكد من رفض طلب ${request.displayName || request.email}؟`,
      async () => {
        setProcessingRequestId(request.id);

        const result = await rejectRequest(request.id, ownerId);

        if (result.success) {
          toast({
            title: "تم رفض الطلب",
            description: "تم رفض طلب الوصول",
          });
          onRequestProcessed();
        } else {
          toast({
            title: "خطأ",
            description: result.error || "حدث خطأ أثناء رفض الطلب",
            variant: "destructive",
          });
        }

        setProcessingRequestId(null);
      },
      "destructive"
    );
  };

  if (requests.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-500">لا توجد طلبات معلقة</p>
        <p className="text-sm text-slate-400 mt-1">
          ستظهر طلبات الوصول الجديدة هنا
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="card-modern overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50/80 hover:bg-slate-50/80">
              <TableHead className="text-right font-semibold text-slate-700">الاسم</TableHead>
              <TableHead className="text-right font-semibold text-slate-700">البريد الإلكتروني</TableHead>
              <TableHead className="text-right font-semibold text-slate-700">الرسالة</TableHead>
              <TableHead className="text-right font-semibold text-slate-700">تاريخ الطلب</TableHead>
              <TableHead className="text-right font-semibold text-slate-700">الإجراءات</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {requests.map((request) => {
              const isProcessing = processingRequestId === request.id;

              return (
                <TableRow key={request.id} className="table-row-hover">
                  <TableCell className="font-medium">
                    {request.displayName || "-"}
                  </TableCell>
                  <TableCell dir="ltr" className="text-left">
                    {request.email}
                  </TableCell>
                  <TableCell>
                    {request.message ? (
                      <div className="flex items-center gap-1 text-slate-600">
                        <MessageSquare className="w-4 h-4" />
                        <span className="text-sm truncate max-w-[200px]" title={request.message}>
                          {request.message}
                        </span>
                      </div>
                    ) : (
                      <span className="text-slate-400">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {new Date(request.requestedAt).toLocaleDateString("ar-EG")}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-slate-400 hover:text-green-600 hover:bg-green-50"
                        onClick={() => openApprovalDialog(request)}
                        disabled={isProcessing}
                        title="قبول"
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-slate-400 hover:text-red-600 hover:bg-red-50"
                        onClick={() => handleReject(request)}
                        disabled={isProcessing}
                        title="رفض"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Approval Dialog */}
      <Dialog open={approvalDialogOpen} onOpenChange={setApprovalDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>قبول طلب الوصول</DialogTitle>
            <DialogDescription>
              اختر الدور الذي تريد منحه لـ {selectedRequest?.displayName || selectedRequest?.email}
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-slate-700">الدور</label>
                <div className="mt-2">
                  <RoleSelector
                    value={selectedRole}
                    onChange={setSelectedRole}
                    excludeOwner={true}
                  />
                </div>
                <p className="text-xs text-slate-500 mt-2">
                  {selectedRole === "accountant"
                    ? "المحاسب: يمكنه إضافة وتعديل وحذف البيانات"
                    : "المشاهد: يمكنه عرض البيانات فقط"}
                </p>
              </div>

              {selectedRequest?.message && (
                <div>
                  <label className="text-sm font-medium text-slate-700">رسالة المتقدم</label>
                  <p className="text-sm text-slate-600 mt-1 p-3 bg-slate-50 rounded-lg">
                    {selectedRequest.message}
                  </p>
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setApprovalDialogOpen(false)}
            >
              إلغاء
            </Button>
            <Button onClick={handleApprove} className="gap-2">
              <Check className="w-4 h-4" />
              قبول
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {confirmationDialog}
    </>
  );
}
