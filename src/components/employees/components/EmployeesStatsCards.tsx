"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Employee } from "../types/employees";

interface EmployeesStatsCardsProps {
  employees: Employee[];
}

export function EmployeesStatsCards({ employees }: EmployeesStatsCardsProps) {
  const totalEmployees = employees.length;
  const totalMonthlySalaries = employees.reduce((sum, emp) => sum + emp.currentSalary, 0);

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>عدد الموظفين</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-blue-600">{totalEmployees}</div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>إجمالي الرواتب الشهرية</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-green-600">
            {totalMonthlySalaries.toFixed(2)} دينار
          </div>
        </CardContent>
      </Card>
    </>
  );
}
