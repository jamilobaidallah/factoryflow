"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SalaryHistory } from "../types/employees";
import { formatShortDate } from "@/lib/date-utils";

interface SalaryHistoryDialogProps {
  isOpen: boolean;
  onClose: () => void;
  history: SalaryHistory[];
}

export function SalaryHistoryDialog({
  isOpen,
  onClose,
  history,
}: SalaryHistoryDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>سجل الرواتب</DialogTitle>
          <DialogDescription>تاريخ التغييرات على الراتب</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 px-6">
          {history.length === 0 ? (
            <p className="text-gray-500 text-center py-4">لا يوجد سجل تغييرات</p>
          ) : (
            <div className="space-y-3">
              {history.map((item) => (
                <div key={item.id} className="border-b pb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">
                        {item.oldSalary} ← {item.newSalary} دينار
                      </div>
                      <div className="text-sm text-gray-500">
                        {formatShortDate(item.effectiveDate)}
                      </div>
                    </div>
                    <div
                      className={`px-2 py-1 rounded-full text-xs ${
                        item.incrementPercentage > 0
                          ? "bg-green-100 text-green-700"
                          : "bg-red-100 text-red-700"
                      }`}
                    >
                      {item.incrementPercentage > 0 ? "+" : ""}
                      {item.incrementPercentage.toFixed(2)}%
                    </div>
                  </div>
                  {item.notes && (
                    <div className="text-sm text-gray-600 mt-1">{item.notes}</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button onClick={onClose}>إغلاق</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
