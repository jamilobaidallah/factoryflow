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
      <p className="text-gray-500 text-center py-12">
        لا يوجد موظفين. اضغط &quot;إضافة موظف&quot; للبدء.
      </p>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>الاسم</TableHead>
          <TableHead>المسمى الوظيفي</TableHead>
          <TableHead>الراتب الحالي</TableHead>
          <TableHead>الوقت الإضافي</TableHead>
          <TableHead>تاريخ التعيين</TableHead>
          <TableHead>الإجراءات</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {employees.map((employee) => (
          <TableRow key={employee.id}>
            <TableCell className="font-medium">{employee.name}</TableCell>
            <TableCell>{employee.position || "-"}</TableCell>
            <TableCell>{employee.currentSalary} دينار</TableCell>
            <TableCell>
              {employee.overtimeEligible ? (
                <span className="px-2 py-1 rounded-full text-xs bg-green-100 text-green-700" role="status" aria-label="مؤهل للوقت الإضافي">
                  مؤهل
                </span>
              ) : (
                <span className="px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-700" role="status" aria-label="غير مؤهل للوقت الإضافي">
                  غير مؤهل
                </span>
              )}
            </TableCell>
            <TableCell>
              {new Date(employee.hireDate).toLocaleDateString("ar-EG")}
            </TableCell>
            <TableCell>
              <div className="flex gap-2" role="group" aria-label="إجراءات الموظف">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onViewHistory(employee.id)}
                  aria-label={`عرض سجل رواتب ${employee.name}`}
                >
                  <History className="w-4 h-4" aria-hidden="true" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onEdit(employee)}
                  aria-label={`تعديل ${employee.name}`}
                >
                  <Edit className="w-4 h-4" aria-hidden="true" />
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => onDelete(employee.id)}
                  aria-label={`حذف ${employee.name}`}
                >
                  <Trash2 className="w-4 h-4" aria-hidden="true" />
                </Button>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
