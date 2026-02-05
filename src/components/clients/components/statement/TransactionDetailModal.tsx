import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Copy } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/statement-format";
import type { StatementItem } from '../../hooks';

interface TransactionDetailModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  transaction: StatementItem | null;
}

export function TransactionDetailModal({
  isOpen,
  onOpenChange,
  transaction,
}: TransactionDetailModalProps) {
  const router = useRouter();
  const { toast } = useToast();

  if (!transaction) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-right">
            تفاصيل المعاملة
          </DialogTitle>
        </DialogHeader>

        <div className="px-4 py-2 space-y-5 text-right">
          {/* Transaction Type Badge */}
          <div className="flex justify-end mb-4">
            <span className={`px-4 py-1.5 rounded-full text-sm font-medium ${
              transaction.isPayment
                ? 'bg-green-100 text-green-800'
                : 'bg-blue-100 text-blue-800'
            }`}>
              {transaction.isPayment ? 'دفعة' : 'فاتورة'}
            </span>
          </div>

          {/* Details Grid */}
          <div className="grid gap-4 text-sm px-2">
            <div className="flex justify-between items-start border-b pb-3">
              <span className="font-medium">
                {new Date(transaction.date).toLocaleDateString('en-GB')}
              </span>
              <span className="text-gray-500 mr-4">:التاريخ</span>
            </div>

            <div className="flex justify-between items-start border-b pb-3">
              <span className="font-medium">{transaction.description || '-'}</span>
              <span className="text-gray-500 mr-4">:الوصف</span>
            </div>

            <div className="flex justify-between items-start border-b pb-3">
              <span className={`font-bold ${
                transaction.debit > 0 ? 'text-red-600' : 'text-green-600'
              }`}>
                {formatCurrency(transaction.debit || transaction.credit || 0)} د.أ
              </span>
              <span className="text-gray-500 mr-4">:المبلغ</span>
            </div>

            {/* Show category for ledger entries */}
            {!transaction.isPayment && transaction.category && (
              <div className="flex justify-between items-start border-b pb-3">
                <span className="font-medium">
                  {transaction.subCategory || transaction.category}
                </span>
                <span className="text-gray-500 mr-4">:الفئة</span>
              </div>
            )}

            {/* Show payment method for payments */}
            {transaction.isPayment && transaction.notes && (
              <div className="flex justify-between items-start border-b pb-3">
                <span className="font-medium">
                  {transaction.notes.split(' - ')[0]}
                </span>
                <span className="text-gray-500 mr-4">:طريقة الدفع</span>
              </div>
            )}

            {/* Transaction ID with Copy Button (for ledger entries) */}
            {!transaction.isPayment && transaction.transactionId && (
              <div className="flex justify-between items-center border-b pb-3">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-gray-600 break-all">
                    {transaction.transactionId}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      navigator.clipboard.writeText(transaction.transactionId || '');
                      toast({
                        title: "تم النسخ",
                        description: "تم نسخ رقم المعاملة",
                      });
                    }}
                    className="p-1 hover:bg-gray-100 rounded transition-colors"
                    title="نسخ"
                  >
                    <Copy className="h-4 w-4 text-gray-400 hover:text-gray-600" />
                  </button>
                </div>
                <span className="text-gray-500 mr-4 shrink-0">:رقم المعاملة</span>
              </div>
            )}
          </div>

          {/* Action Button */}
          <div className="pt-4 px-2">
            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                const searchId = transaction.transactionId || transaction.id;
                if (transaction.isPayment) {
                  router.push(`/payments?search=${encodeURIComponent(searchId)}`);
                } else {
                  router.push(`/ledger?search=${encodeURIComponent(searchId)}`);
                }
                onOpenChange(false);
              }}
            >
              {transaction.isPayment ? 'عرض في المدفوعات' : 'عرض في دفتر الأستاذ'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
