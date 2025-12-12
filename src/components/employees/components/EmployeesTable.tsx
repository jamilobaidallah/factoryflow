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
import { Edit, Trash2, History } from "lucide-react";
import { PermissionGate } from "@/components/auth";
import { Employee } from "../types/employees";

interface EmployeesTableProps {
  employees: Employee[];
  onEdit: (employee: Employee) => void;
  onDelete: (employeeId: string) => void;
  onViewHistory: (employeeId: string) => void;
}

export function EmployeesTable({
  employees,
  onEdit,
  onDelete,
  onViewHistory,
}: EmployeesTableProps) {
  if (employees.length === 0) {
    return (
      <p className="text-slate-500 text-center py-12">
        لا يوجد موظفين. اضغط &quot;إضافة موظف&quot; للبدء.
      </p>
    );
  }

  return (
    <div className="card-modern overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-slate-50/80 hover:bg-slate-50/80">
            <TableHead className="text-right font-semibold text-slate-700">الاسم</TableHead>
            <TableHead className="text-right font-semibold text-slate-700">المسمى الوظيفي</TableHead>
            <TableHead className="text-right font-semibold text-slate-700">الراتب الحالي</TableHead>
            <TableHead className="text-right font-semibold text-slate-700">الوقت الإضافي</TableHead>
            <TableHead className="text-right font-semibold text-slate-700">تاريخ التعيين</TableHead>
            <TableHead className="text-right font-semibold text-slate-700">الإجراءات</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {employees.map((employee) => (
            <TableRow key={employee.id} className="table-row-hover">
              <TableCell className="font-medium">{employee.name}</TableCell>
              <TableCell>{employee.position || "-"}</TableCell>
              <TableCell>
                <span className="font-semibold text-slate-900">
                  {employee.currentSalary.toLocaleString()} دينار
                </span>
              </TableCell>
              <TableCell>
                {employee.overtimeEligible ? (
                  <span className="badge-success" role="status" aria-label="مؤهل للوقت الإضافي">
                    مؤهل
                  </span>
                ) : (
                  <span className="badge-neutral" role="status" aria-label="غير مؤهل للوقت الإضافي">
                    غير مؤهل
                  </span>
                )}
              </TableCell>
              <TableCell>
                {new Date(employee.hireDate).toLocaleDateString("ar-EG")}
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-1" role="group" aria-label="إجراءات الموظف">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-slate-400 hover:text-blue-600 hover:bg-blue-50"
                    onClick={() => onViewHistory(employee.id)}
                    aria-label={`عرض سجل رواتب ${employee.name}`}
                  >
                    <History className="h-4 w-4" aria-hidden="true" />
                  </Button>
                  <PermissionGate action="update" module="employees">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                      onClick={() => onEdit(employee)}
                      aria-label={`تعديل ${employee.name}`}
                    >
                      <Edit className="h-4 w-4" aria-hidden="true" />
                    </Button>
                  </PermissionGate>
                  <PermissionGate action="delete" module="employees">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-slate-400 hover:text-red-600 hover:bg-red-50"
                      onClick={() => onDelete(employee.id)}
                      aria-label={`حذف ${employee.name}`}
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
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
