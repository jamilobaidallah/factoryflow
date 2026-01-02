"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Employee } from "../types/employees";
import { OvertimeEntry, OvertimeFormData } from "../types/overtime";
import { formatNumber } from "@/lib/date-utils";
import { safeDivide } from "@/lib/currency";

interface OvertimeFormDialogProps {
  isOpen: boolean;
  onClose: () => void;
  employees: Employee[];
  formData: OvertimeFormData;
  setFormData: (data: OvertimeFormData) => void;
  onSubmit: () => void;
  loading: boolean;
  editingEntry?: OvertimeEntry | null;
}

export function OvertimeFormDialog({
  isOpen,
  onClose,
  employees,
  formData,
  setFormData,
  onSubmit,
  loading,
  editingEntry,
}: OvertimeFormDialogProps) {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit();
  };

  // Only show overtime-eligible employees
  const eligibleEmployees = employees.filter((e) => e.overtimeEligible);
  const selectedEmployee = employees.find((e) => e.id === formData.employeeId);

  // Calculate hourly rate for preview (salary / 208 hours)
  const hourlyRate = selectedEmployee
    ? safeDivide(selectedEmployee.currentSalary, 208)
    : 0;
  const hours = parseFloat(formData.hours) || 0;
  const estimatedPay = hours * hourlyRate;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px] p-6">
        <DialogHeader className="pb-4">
          <DialogTitle className="text-xl">
            {editingEntry ? "تعديل وقت إضافي" : "تسجيل وقت إضافي"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-5 py-4 px-2">
            <div className="grid gap-2">
              <Label htmlFor="employee">الموظف *</Label>
              <Select
                value={formData.employeeId}
                onValueChange={(value) =>
                  setFormData({ ...formData, employeeId: value })
                }
                disabled={!!editingEntry}
              >
                <SelectTrigger>
                  <SelectValue placeholder="اختر الموظف" />
                </SelectTrigger>
                <SelectContent>
                  {eligibleEmployees.length === 0 ? (
                    <div className="p-2 text-sm text-muted-foreground text-center">
                      لا يوجد موظفين مؤهلين للوقت الإضافي
                    </div>
                  ) : (
                    eligibleEmployees.map((employee) => (
                      <SelectItem key={employee.id} value={employee.id}>
                        {employee.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              {eligibleEmployees.length === 0 && (
                <p className="text-xs text-warning-600">
                  لم يتم تعيين أي موظف كمؤهل للوقت الإضافي
                </p>
              )}
            </div>

            {selectedEmployee && (
              <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                <p className="text-blue-700 text-sm">
                  الراتب: {formatNumber(selectedEmployee.currentSalary)} دينار/شهر
                </p>
                <p className="text-blue-600 text-xs mt-1">
                  سعر الساعة: {formatNumber(hourlyRate)} دينار
                </p>
              </div>
            )}

            <div className="grid gap-2">
              <Label htmlFor="date">التاريخ *</Label>
              <Input
                id="date"
                type="date"
                value={formData.date}
                max={new Date().toISOString().split("T")[0]}
                onChange={(e) =>
                  setFormData({ ...formData, date: e.target.value })
                }
                required
              />
              <p className="text-xs text-muted-foreground">
                لا يمكن تسجيل وقت إضافي بتاريخ مستقبلي
              </p>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="hours">عدد الساعات *</Label>
              <Input
                id="hours"
                type="number"
                step="0.5"
                min="0.5"
                max="24"
                value={formData.hours}
                onChange={(e) =>
                  setFormData({ ...formData, hours: e.target.value })
                }
                placeholder="0"
                required
              />
              {hours > 0 && selectedEmployee && (
                <p className="text-xs text-success-600">
                  القيمة التقديرية: {formatNumber(estimatedPay)} دينار
                </p>
              )}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="notes">ملاحظات</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) =>
                  setFormData({ ...formData, notes: e.target.value })
                }
                placeholder="سبب الوقت الإضافي..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter className="pt-4 px-2 gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              إلغاء
            </Button>
            <Button
              type="submit"
              disabled={loading || !formData.employeeId || !formData.hours}
            >
              {loading
                ? "جاري الحفظ..."
                : editingEntry
                ? "حفظ التعديلات"
                : "تسجيل الوقت الإضافي"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
