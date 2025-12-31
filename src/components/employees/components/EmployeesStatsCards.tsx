"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Employee } from "../types/employees";
import { sumAmounts } from "@/lib/currency";

interface EmployeesStatsCardsProps {
  employees: Employee[];
  outstandingAdvances?: number;
}

export function EmployeesStatsCards({
  employees,
  outstandingAdvances = 0,
}: EmployeesStatsCardsProps) {
  const totalEmployees = employees.length;
  const totalMonthlySalaries = sumAmounts(employees.map((emp) => emp.currentSalary));

  return (
    <>
      <Card className="rounded-xl border border-slate-200/60 shadow-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-gray-600">عدد الموظفين</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-blue-600">{totalEmployees}</div>
        </CardContent>
      </Card>
      <Card className="rounded-xl border border-slate-200/60 shadow-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-gray-600">إجمالي الرواتب الشهرية</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-green-600">
            {totalMonthlySalaries.toFixed(2)} دينار
          </div>
        </CardContent>
      </Card>
      {outstandingAdvances > 0 && (
        <Card className="rounded-xl border border-slate-200/60 shadow-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">السلف المستحقة</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-orange-600">
              {outstandingAdvances.toFixed(2)} دينار
            </div>
          </CardContent>
        </Card>
      )}
    </>
  );
}
