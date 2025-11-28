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
import { Employee, EmployeeFormData } from "../types/employees";

interface EmployeeFormDialogProps {
  isOpen: boolean;
  onClose: () => void;
  editingEmployee: Employee | null;
  formData: EmployeeFormData;
  setFormData: (data: EmployeeFormData) => void;
  loading: boolean;
  onSubmit: (e: React.FormEvent) => void;
}

export function EmployeeFormDialog({
  isOpen,
  onClose,
  editingEmployee,
  formData,
  setFormData,
  loading,
  onSubmit,
}: EmployeeFormDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {editingEmployee ? "تعديل بيانات الموظف" : "إضافة موظف جديد"}
          </DialogTitle>
          <DialogDescription>
            {editingEmployee
              ? "قم بتعديل البيانات أدناه. تغيير الراتب سيتم تسجيله تلقائياً."
              : "أدخل بيانات الموظف الجديد"}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit}>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">الاسم</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="position">المسمى الوظيفي</Label>
              <Input
                id="position"
                value={formData.position}
                onChange={(e) =>
                  setFormData({ ...formData, position: e.target.value })
                }
                placeholder="مثال: عامل، مشرف، فني"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="currentSalary">الراتب الشهري (دينار)</Label>
              <Input
                id="currentSalary"
                type="number"
                step="0.01"
                value={formData.currentSalary}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    currentSalary: e.target.value,
                  })
                }
                required
              />
              {editingEmployee && parseFloat(formData.currentSalary) !== editingEmployee.currentSalary && (
                <p className="text-sm text-blue-600">
                  التغيير: {editingEmployee.currentSalary} ← {formData.currentSalary} دينار
                  {" "}
                  ({(((parseFloat(formData.currentSalary) - editingEmployee.currentSalary) / editingEmployee.currentSalary) * 100).toFixed(2)}%)
                </p>
              )}
            </div>
            <div className="flex items-center space-x-2 space-x-reverse">
              <input
                type="checkbox"
                id="overtimeEligible"
                checked={formData.overtimeEligible}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    overtimeEligible: e.target.checked,
                  })
                }
                className="h-4 w-4 rounded border-gray-300"
              />
              <Label htmlFor="overtimeEligible" className="cursor-pointer font-normal">
                مؤهل للوقت الإضافي (1.5x)
              </Label>
            </div>
            <div className="space-y-2">
              <Label htmlFor="hireDate">تاريخ التعيين</Label>
              <Input
                id="hireDate"
                type="date"
                value={formData.hireDate}
                onChange={(e) =>
                  setFormData({ ...formData, hireDate: e.target.value })
                }
                required
              />
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
            <Button type="submit" disabled={loading}>
              {loading ? "جاري الحفظ..." : editingEmployee ? "تحديث" : "إضافة"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
