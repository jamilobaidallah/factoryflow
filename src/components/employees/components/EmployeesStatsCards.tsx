"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Banknote, CheckCircle, Clock } from "lucide-react";
import { Employee, PayrollEntry } from "../types/employees";

interface EmployeesStatsCardsProps {
  employees: Employee[];
  monthPayroll: PayrollEntry[];
  selectedMonth: string;
}

export function EmployeesStatsCards({
  employees,
  monthPayroll,
  selectedMonth
}: EmployeesStatsCardsProps) {
  // Calculate stats from monthPayroll
  const totalMonthSalary = monthPayroll.reduce((sum, p) => sum + p.totalSalary, 0);
  const paidEntries = monthPayroll.filter(p => p.isPaid);
  const unpaidEntries = monthPayroll.filter(p => !p.isPaid);
  const totalPaid = paidEntries.reduce((sum, p) => sum + p.totalSalary, 0);
  const totalUnpaid = unpaidEntries.reduce((sum, p) => sum + p.totalSalary, 0);

  // Format month for display (2025-01 → يناير 2025)
  const formatMonth = (month: string) => {
    const [year, monthNum] = month.split('-');
    const monthNames = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
                        'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
    return `${monthNames[parseInt(monthNum) - 1]} ${year}`;
  };

  return (
    <>
      {/* Card 1: Employee Count */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-gray-600">عدد الموظفين</CardTitle>
          <Users className="h-5 w-5 text-blue-600" />
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-gray-900">{employees.length}</div>
          <p className="text-sm text-gray-500 mt-1">موظف نشط</p>
        </CardContent>
      </Card>

      {/* Card 2: Total Month Salary */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-gray-600">رواتب {formatMonth(selectedMonth)}</CardTitle>
          <Banknote className="h-5 w-5 text-purple-600" />
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-gray-900">{totalMonthSalary.toFixed(2)}</div>
          <p className="text-sm text-gray-500 mt-1">دينار ({monthPayroll.length} موظف)</p>
        </CardContent>
      </Card>

      {/* Card 3: Paid Amount */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-gray-600">المدفوع</CardTitle>
          <CheckCircle className="h-5 w-5 text-green-600" />
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-green-600">{totalPaid.toFixed(2)}</div>
          <p className="text-sm text-gray-500 mt-1">دينار ({paidEntries.length} موظف)</p>
        </CardContent>
      </Card>

      {/* Card 4: Unpaid Amount */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-gray-600">المتبقي</CardTitle>
          <Clock className="h-5 w-5 text-orange-600" />
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-orange-600">{totalUnpaid.toFixed(2)}</div>
          <p className="text-sm text-gray-500 mt-1">دينار ({unpaidEntries.length} موظف)</p>
        </CardContent>
      </Card>
    </>
  );
}
