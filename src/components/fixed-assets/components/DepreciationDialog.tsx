"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FixedAsset, DepreciationPeriod } from "../types/fixed-assets";

interface DepreciationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  loading: boolean;
  period: DepreciationPeriod;
  setPeriod: (period: DepreciationPeriod) => void;
  assets: FixedAsset[];
  onRunDepreciation: () => void;
}

export function DepreciationDialog({
  isOpen,
  onClose,
  loading,
  period,
  setPeriod,
  assets,
  onRunDepreciation,
}: DepreciationDialogProps) {
  const activeAssets = assets.filter(a => a.status === "active");
  const expectedDepreciation = activeAssets.reduce((sum, a) => sum + a.monthlyDepreciation, 0);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>تسجيل استهلاك شهري</DialogTitle>
          <DialogDescription>
            اختر الشهر والسنة لتسجيل الاستهلاك لجميع الأصول النشطة
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 px-6 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="month">الشهر</Label>
              <select
                id="month"
                value={period.month}
                onChange={(e) =>
                  setPeriod({ ...period, month: parseInt(e.target.value) })
                }
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="year">السنة</Label>
              <Input
                id="year"
                type="number"
                value={period.year}
                onChange={(e) =>
                  setPeriod({ ...period, year: parseInt(e.target.value) })
                }
              />
            </div>
          </div>

          <div className="bg-gray-50 p-4 rounded-lg space-y-2">
            <div className="text-sm text-gray-600">
              <strong>عدد الأصول النشطة:</strong> {activeAssets.length}
            </div>
            <div className="text-sm text-gray-600">
              <strong>إجمالي الاستهلاك المتوقع:</strong>{" "}
              {expectedDepreciation.toFixed(2)} دينار
            </div>
            <div className="text-xs text-gray-500 mt-2">
              سيتم إضافة قيد تلقائي في دفتر الأستاذ
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
          >
            إلغاء
          </Button>
          <Button onClick={onRunDepreciation} disabled={loading}>
            {loading ? "جاري التسجيل..." : "تسجيل الاستهلاك"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
