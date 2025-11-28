"use client";

import { motion } from "framer-motion";
import { Phone, Check, Calendar, Banknote, User, CreditCard, Building2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useSwipe } from "@/hooks/use-swipe";
import { useState } from "react";

/**
 * واجهة بيانات الشيك - Cheque data interface
 */
export interface Cheque {
  id: string;
  chequeNumber: string;
  clientName: string;
  clientPhone?: string;
  amount: number;
  type: string;
  chequeType?: string;
  status: string;
  chequeImageUrl?: string;
  endorsedTo?: string;
  endorsedDate?: Date;
  linkedTransactionId: string;
  issueDate: Date;
  dueDate: Date;
  bankName: string;
  notes: string;
  createdAt: Date;
}

/**
 * خصائص مكون بطاقة الشيك - ChequeCard props
 */
interface ChequeCardProps {
  cheque: Cheque;
  onMarkCleared: (cheque: Cheque) => void;
  onMarkBounced: (cheque: Cheque) => void;
  onEdit: (cheque: Cheque) => void;
  onCall?: (phoneNumber: string) => void;
}

/**
 * تحديد لون الحالة - Get status badge variant
 */
function getStatusVariant(status: string): "pending" | "cleared" | "bounced" | "endorsed" | "default" {
  switch (status) {
    case "تم الصرف":
    case "cleared":
    case "cashed":
      return "cleared";
    case "قيد الانتظار":
    case "pending":
      return "pending";
    case "مرفوض":
    case "bounced":
      return "bounced";
    case "مجيّر":
    case "endorsed":
      return "endorsed";
    default:
      return "default";
  }
}

/**
 * التحقق من تأخر الشيك - Check if cheque is overdue
 */
function isOverdue(cheque: Cheque): boolean {
  if (cheque.status !== "قيد الانتظار" && cheque.status !== "pending") {
    return false;
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dueDate = new Date(cheque.dueDate);
  dueDate.setHours(0, 0, 0, 0);
  return dueDate < today;
}

/**
 * تنسيق التاريخ - Format date for display
 */
function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString("ar-EG", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/**
 * تنسيق المبلغ - Format amount for display
 */
function formatAmount(amount: number): string {
  return new Intl.NumberFormat("ar-EG", {
    style: "decimal",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function ChequeCard({
  cheque,
  onMarkCleared,
  onMarkBounced,
  onEdit,
  onCall,
}: ChequeCardProps) {
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const isPending = cheque.status === "قيد الانتظار" || cheque.status === "pending";

  // إعداد السحب - Swipe configuration
  const [swipeState, swipeHandlers] = useSwipe({
    threshold: 60,
    maxSwipeDistance: 100,
    enableLeftSwipe: isPending, // السحب لليسار للتحصيل
    enableRightSwipe: !!cheque.clientPhone, // السحب لليمين للاتصال
    onSwipeLeft: () => {
      if (isPending) {
        onMarkCleared(cheque);
      }
    },
    onSwipeRight: () => {
      if (cheque.clientPhone && onCall) {
        onCall(cheque.clientPhone);
      }
    },
  });

  const overdue = isOverdue(cheque);

  return (
    <>
      {/* بطاقة الشيك مع دعم السحب - Cheque card with swipe support */}
      <div className="relative overflow-hidden rounded-lg">
        {/* طبقة إجراء السحب لليسار (تحصيل) - Left swipe action layer (clear) */}
        <motion.div
          className="absolute inset-y-0 right-0 flex items-center justify-end px-4 bg-green-500"
          style={{
            width: Math.abs(Math.min(swipeState.swipeOffset, 0)),
            opacity: swipeState.isLeftActionActive ? 1 : 0.7,
          }}
        >
          <div className="flex items-center gap-2 text-white">
            <Check className="w-5 h-5" />
            <span className="text-sm font-medium">تحصيل</span>
          </div>
        </motion.div>

        {/* طبقة إجراء السحب لليمين (اتصال) - Right swipe action layer (call) */}
        <motion.div
          className="absolute inset-y-0 left-0 flex items-center justify-start px-4 bg-blue-500"
          style={{
            width: Math.max(swipeState.swipeOffset, 0),
            opacity: swipeState.isRightActionActive ? 1 : 0.7,
          }}
        >
          <div className="flex items-center gap-2 text-white">
            <Phone className="w-5 h-5" />
            <span className="text-sm font-medium">اتصال</span>
          </div>
        </motion.div>

        {/* المحتوى الرئيسي للبطاقة - Main card content */}
        <motion.div
          className={`relative bg-white border rounded-lg p-4 shadow-sm cursor-pointer touch-pan-y ${
            overdue ? "border-red-300 bg-red-50" : "border-gray-200"
          }`}
          style={{
            transform: `translateX(${swipeState.swipeOffset}px)`,
          }}
          onClick={() => !swipeState.isSwiping && setIsDetailOpen(true)}
          {...swipeHandlers}
        >
          {/* الصف العلوي: اسم العميل والحالة - Top row: client name and status */}
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-gray-400" />
              <span className="font-semibold text-gray-900">{cheque.clientName}</span>
              {overdue && (
                <span className="text-xs bg-red-500 text-white px-2 py-0.5 rounded-full">
                  متأخر
                </span>
              )}
            </div>
            <Badge variant={getStatusVariant(cheque.status)}>{cheque.status}</Badge>
          </div>

          {/* الصف الأوسط: المبلغ - Middle row: amount */}
          <div className="flex items-center gap-2 mb-3">
            <Banknote className="w-4 h-4 text-gray-400" />
            <span className="text-xl font-bold text-gray-900">
              {formatAmount(cheque.amount)} <span className="text-sm font-normal">دينار</span>
            </span>
          </div>

          {/* الصف السفلي: تاريخ الاستحقاق ورقم الشيك - Bottom row: due date and cheque number */}
          <div className="flex items-center justify-between text-sm text-gray-500">
            <div className="flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" />
              <span>{formatDate(cheque.dueDate)}</span>
            </div>
            <div className="flex items-center gap-1">
              <CreditCard className="w-3.5 h-3.5" />
              <span className="font-mono">{cheque.chequeNumber}</span>
            </div>
          </div>

          {/* المظهر له (إن وجد) - Endorsed to (if any) */}
          {cheque.endorsedTo && (
            <div className="mt-2 text-xs text-purple-600">
              ← مظهر إلى: {cheque.endorsedTo}
            </div>
          )}
        </motion.div>
      </div>

      {/* ورقة التفاصيل من الأسفل - Bottom detail sheet */}
      <Sheet open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <SheetContent className="max-h-[85vh] overflow-y-auto">
          <SheetHeader className="text-right pt-4">
            <SheetTitle className="text-xl">تفاصيل الشيك</SheetTitle>
            <SheetDescription>
              شيك رقم {cheque.chequeNumber}
            </SheetDescription>
          </SheetHeader>

          {/* تفاصيل الشيك - Cheque details */}
          <div className="py-6 space-y-4">
            {/* العميل - Client */}
            <div className="flex items-center justify-between py-2 border-b">
              <div className="flex items-center gap-2 text-gray-500">
                <User className="w-4 h-4" />
                <span>العميل</span>
              </div>
              <span className="font-medium">{cheque.clientName}</span>
            </div>

            {/* المبلغ - Amount */}
            <div className="flex items-center justify-between py-2 border-b">
              <div className="flex items-center gap-2 text-gray-500">
                <Banknote className="w-4 h-4" />
                <span>المبلغ</span>
              </div>
              <span className="font-bold text-lg">{formatAmount(cheque.amount)} دينار</span>
            </div>

            {/* البنك - Bank */}
            <div className="flex items-center justify-between py-2 border-b">
              <div className="flex items-center gap-2 text-gray-500">
                <Building2 className="w-4 h-4" />
                <span>البنك</span>
              </div>
              <span className="font-medium">{cheque.bankName || "-"}</span>
            </div>

            {/* رقم الشيك - Cheque number */}
            <div className="flex items-center justify-between py-2 border-b">
              <div className="flex items-center gap-2 text-gray-500">
                <CreditCard className="w-4 h-4" />
                <span>رقم الشيك</span>
              </div>
              <span className="font-mono">{cheque.chequeNumber}</span>
            </div>

            {/* تاريخ الاستحقاق - Due date */}
            <div className="flex items-center justify-between py-2 border-b">
              <div className="flex items-center gap-2 text-gray-500">
                <Calendar className="w-4 h-4" />
                <span>تاريخ الاستحقاق</span>
              </div>
              <span className={overdue ? "text-red-600 font-medium" : ""}>
                {formatDate(cheque.dueDate)}
                {overdue && " (متأخر)"}
              </span>
            </div>

            {/* تاريخ الإصدار - Issue date */}
            <div className="flex items-center justify-between py-2 border-b">
              <div className="flex items-center gap-2 text-gray-500">
                <Calendar className="w-4 h-4" />
                <span>تاريخ الإصدار</span>
              </div>
              <span>{formatDate(cheque.issueDate)}</span>
            </div>

            {/* الحالة - Status */}
            <div className="flex items-center justify-between py-2 border-b">
              <span className="text-gray-500">الحالة</span>
              <Badge variant={getStatusVariant(cheque.status)}>{cheque.status}</Badge>
            </div>

            {/* النوع - Type */}
            <div className="flex items-center justify-between py-2 border-b">
              <span className="text-gray-500">النوع</span>
              <Badge variant={cheque.type === "وارد" ? "incoming" : "outgoing"}>
                {cheque.type}
              </Badge>
            </div>

            {/* رقم المعاملة - Transaction ID */}
            {cheque.linkedTransactionId && (
              <div className="flex items-center justify-between py-2 border-b">
                <span className="text-gray-500">رقم المعاملة</span>
                <span className="font-mono text-xs">{cheque.linkedTransactionId}</span>
              </div>
            )}

            {/* المظهر له - Endorsed to */}
            {cheque.endorsedTo && (
              <div className="flex items-center justify-between py-2 border-b">
                <span className="text-gray-500">مظهر إلى</span>
                <span className="text-purple-600">{cheque.endorsedTo}</span>
              </div>
            )}

            {/* ملاحظات - Notes */}
            {cheque.notes && (
              <div className="py-2 border-b">
                <span className="text-gray-500 block mb-1">ملاحظات</span>
                <p className="text-gray-700">{cheque.notes}</p>
              </div>
            )}
          </div>

          {/* أزرار الإجراءات - Action buttons */}
          <SheetFooter className="flex-col gap-2 sm:flex-col">
            <div className="grid grid-cols-2 gap-2 w-full">
              {/* تم الصرف - Mark Cleared */}
              {isPending && (
                <Button
                  onClick={() => {
                    setIsDetailOpen(false);
                    onMarkCleared(cheque);
                  }}
                  className="bg-green-600 hover:bg-green-700 gap-2"
                >
                  <Check className="w-4 h-4" />
                  تم الصرف
                </Button>
              )}

              {/* مرتجع - Mark Bounced */}
              {isPending && (
                <Button
                  variant="destructive"
                  onClick={() => {
                    setIsDetailOpen(false);
                    onMarkBounced(cheque);
                  }}
                  className="gap-2"
                >
                  مرتجع
                </Button>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2 w-full">
              {/* اتصال - Call */}
              {cheque.clientPhone && (
                <Button
                  variant="outline"
                  className="gap-2"
                  asChild
                >
                  <a href={`tel:${cheque.clientPhone}`}>
                    <Phone className="w-4 h-4" />
                    اتصال
                  </a>
                </Button>
              )}

              {/* تعديل - Edit */}
              <Button
                variant="outline"
                onClick={() => {
                  setIsDetailOpen(false);
                  onEdit(cheque);
                }}
                className="gap-2"
              >
                تعديل
              </Button>
            </div>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  );
}
