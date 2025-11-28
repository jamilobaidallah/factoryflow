"use client";

import { useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { RefreshCw, Loader2, Edit, Trash2, Image as ImageIcon, X, Check } from "lucide-react";
import { ChequeCard, type Cheque } from "./cheque-card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { CHEQUE_TYPES, CHEQUE_STATUS_AR } from "@/lib/constants";

/**
 * خصائص مكون قائمة الشيكات - ChequesList props
 */
interface ChequesListProps {
  cheques: Cheque[];
  loading?: boolean;
  onRefresh?: () => Promise<void>;
  onMarkCleared: (cheque: Cheque) => void;
  onMarkBounced: (cheque: Cheque) => void;
  onEdit: (cheque: Cheque) => void;
  onDelete: (chequeId: string) => void;
  onEndorse?: (cheque: Cheque) => void;
  onViewImage?: (imageUrl: string) => void;
}

/**
 * تحديد لون الحالة للجدول - Get status color for table
 */
function getStatusColor(status: string): string {
  switch (status) {
    case CHEQUE_STATUS_AR.CASHED:
      return "bg-green-100 text-green-700";
    case CHEQUE_STATUS_AR.PENDING:
      return "bg-yellow-100 text-yellow-700";
    case CHEQUE_STATUS_AR.ENDORSED:
      return "bg-purple-100 text-purple-700";
    case CHEQUE_STATUS_AR.BOUNCED:
      return "bg-red-100 text-red-700";
    default:
      return "bg-gray-100 text-gray-700";
  }
}

/**
 * التحقق من تأخر الشيك - Check if cheque is overdue
 */
function isOverdue(cheque: Cheque): boolean {
  if (cheque.status !== CHEQUE_STATUS_AR.PENDING) {
    return false;
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dueDate = new Date(cheque.dueDate);
  dueDate.setHours(0, 0, 0, 0);
  return dueDate < today;
}

/**
 * الحد الأدنى للسحب لتفعيل التحديث - Minimum pull distance to trigger refresh
 */
const PULL_THRESHOLD = 80;

/**
 * مكون قائمة الشيكات - يعرض بطاقات على الموبايل وجدول على سطح المكتب
 *
 * ChequesList component - displays cards on mobile and table on desktop
 */
export function ChequesList({
  cheques,
  loading = false,
  onRefresh,
  onMarkCleared,
  onMarkBounced,
  onEdit,
  onDelete,
  onEndorse,
  onViewImage,
}: ChequesListProps) {
  // حالة السحب للتحديث - Pull-to-refresh state
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isPulling, setIsPulling] = useState(false);

  // مراجع للتتبع - Tracking refs
  const containerRef = useRef<HTMLDivElement>(null);
  const startYRef = useRef<number | null>(null);
  const isAtTopRef = useRef(true);

  /**
   * معالجة بداية اللمس - Handle touch start
   */
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (containerRef.current) {
      isAtTopRef.current = containerRef.current.scrollTop <= 0;
    }
    startYRef.current = e.touches[0].clientY;
    setIsPulling(true);
  }, []);

  /**
   * معالجة حركة اللمس - Handle touch move
   */
  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!startYRef.current || !isAtTopRef.current || isRefreshing) {
      return;
    }

    const currentY = e.touches[0].clientY;
    const diff = currentY - startYRef.current;

    // فقط السحب للأسفل عندما نكون في الأعلى - Only pull down when at top
    if (diff > 0 && containerRef.current && containerRef.current.scrollTop <= 0) {
      // تطبيق مقاومة للسحب - Apply resistance to pull
      const resistance = 0.4;
      const pullValue = Math.min(diff * resistance, PULL_THRESHOLD * 1.5);
      setPullDistance(pullValue);
    }
  }, [isRefreshing]);

  /**
   * معالجة نهاية اللمس - Handle touch end
   */
  const handleTouchEnd = useCallback(async () => {
    setIsPulling(false);
    startYRef.current = null;

    // تحقق مما إذا كان السحب كافياً للتحديث - Check if pull was enough to refresh
    if (pullDistance >= PULL_THRESHOLD && onRefresh && !isRefreshing) {
      setIsRefreshing(true);
      try {
        await onRefresh();
      } finally {
        setIsRefreshing(false);
      }
    }

    setPullDistance(0);
  }, [pullDistance, onRefresh, isRefreshing]);

  /**
   * معالجة الاتصال بالعميل - Handle calling client
   */
  const handleCall = useCallback((phoneNumber: string) => {
    window.location.href = `tel:${phoneNumber}`;
  }, []);

  // حساب ما إذا كان يجب إظهار مؤشر التحديث - Calculate if should show refresh indicator
  const showRefreshIndicator = pullDistance > 0 || isRefreshing;
  const isReadyToRefresh = pullDistance >= PULL_THRESHOLD;

  return (
    <div className="relative">
      {/* مؤشر السحب للتحديث (الموبايل فقط) - Pull-to-refresh indicator (mobile only) */}
      <AnimatePresence>
        {showRefreshIndicator && (
          <motion.div
            className="md:hidden absolute top-0 left-0 right-0 flex items-center justify-center z-10 pointer-events-none"
            initial={{ opacity: 0, y: -20 }}
            animate={{
              opacity: 1,
              y: Math.min(pullDistance, PULL_THRESHOLD) - 40,
            }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.2 }}
          >
            <div
              className={`flex items-center gap-2 px-4 py-2 rounded-full shadow-lg ${
                isReadyToRefresh || isRefreshing
                  ? "bg-blue-500 text-white"
                  : "bg-white text-gray-600"
              }`}
            >
              {isRefreshing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-sm">جاري التحديث...</span>
                </>
              ) : (
                <>
                  <motion.div
                    animate={{ rotate: isReadyToRefresh ? 180 : 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <RefreshCw className="w-4 h-4" />
                  </motion.div>
                  <span className="text-sm">
                    {isReadyToRefresh ? "اترك للتحديث" : "اسحب للتحديث"}
                  </span>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* عرض البطاقات للموبايل - Mobile cards view */}
      <div
        ref={containerRef}
        className="md:hidden space-y-3 overflow-y-auto"
        style={{
          transform: `translateY(${pullDistance}px)`,
          transition: isPulling ? "none" : "transform 0.2s ease-out",
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {cheques.length === 0 ? (
          <div className="text-gray-500 text-center py-12">
            لا توجد شيكات مسجلة
          </div>
        ) : (
          <AnimatePresence mode="popLayout">
            {cheques.map((cheque, index) => (
              <motion.div
                key={cheque.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -100 }}
                transition={{ delay: index * 0.05 }}
              >
                <ChequeCard
                  cheque={cheque}
                  onMarkCleared={onMarkCleared}
                  onMarkBounced={onMarkBounced}
                  onEdit={onEdit}
                  onCall={handleCall}
                />
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>

      {/* عرض الجدول لسطح المكتب - Desktop table view */}
      <div className="hidden md:block">
        {cheques.length === 0 ? (
          <p className="text-gray-500 text-center py-12">
            لا توجد شيكات مسجلة. اضغط على &quot;إضافة شيك&quot; للبدء.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>رقم الشيك</TableHead>
                <TableHead>اسم العميل</TableHead>
                <TableHead>البنك</TableHead>
                <TableHead>المبلغ</TableHead>
                <TableHead>النوع</TableHead>
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
                <TableRow
                  key={cheque.id}
                  className={isOverdue(cheque) ? "bg-red-50" : ""}
                >
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      {cheque.chequeNumber}
                      {isOverdue(cheque) && (
                        <span className="text-xs bg-red-500 text-white px-2 py-0.5 rounded-full">
                          متأخر
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div>
                      <div>{cheque.clientName}</div>
                      {cheque.endorsedTo && (
                        <div className="text-xs text-purple-600 mt-1">
                          ← مظهر إلى: {cheque.endorsedTo}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{cheque.bankName}</TableCell>
                  <TableCell>{cheque.amount || 0} دينار</TableCell>
                  <TableCell>
                    <span
                      className={`px-2 py-1 rounded-full text-xs ${
                        cheque.type === CHEQUE_TYPES.INCOMING
                          ? "bg-blue-100 text-blue-700"
                          : "bg-purple-100 text-purple-700"
                      }`}
                    >
                      {cheque.type}
                    </span>
                  </TableCell>
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
                    {cheque.linkedTransactionId || "-"}
                  </TableCell>
                  <TableCell>
                    {cheque.chequeImageUrl ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onViewImage?.(cheque.chequeImageUrl!)}
                        title="عرض صورة الشيك"
                      >
                        <ImageIcon className="w-4 h-4 text-blue-600" />
                      </Button>
                    ) : (
                      <span className="text-xs text-gray-400">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2 flex-wrap">
                      {/* زر التحصيل للشيكات قيد الانتظار - Clear button for pending cheques */}
                      {cheque.status === CHEQUE_STATUS_AR.PENDING && (
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => onMarkCleared(cheque)}
                          title="تأكيد التحصيل"
                          className="bg-green-600 hover:bg-green-700"
                        >
                          <Check className="w-4 h-4" />
                        </Button>
                      )}
                      {/* زر الارتجاع للشيكات قيد الانتظار - Bounce button for pending cheques */}
                      {cheque.status === CHEQUE_STATUS_AR.PENDING && (
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => onMarkBounced(cheque)}
                          title="شيك مرتجع"
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      )}
                      {/* زر التظهير للشيكات الواردة قيد الانتظار غير المظهرة - Endorse button for pending incoming non-endorsed cheques */}
                      {cheque.type === CHEQUE_TYPES.INCOMING &&
                        cheque.status === CHEQUE_STATUS_AR.PENDING &&
                        cheque.chequeType !== "مجير" &&
                        onEndorse && (
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => onEndorse(cheque)}
                            title="تظهير الشيك"
                          >
                            <RefreshCw className="w-4 h-4" />
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
        )}
      </div>

      {/* مؤشر التحميل - Loading indicator */}
      {loading && (
        <div className="absolute inset-0 bg-white/50 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        </div>
      )}
    </div>
  );
}
