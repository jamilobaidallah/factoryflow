"use client";

import { Users, Wallet, Banknote } from "lucide-react";
import { Employee } from "../types/employees";
import { sumAmounts } from "@/lib/currency";
import { formatNumber } from "@/lib/date-utils";

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
  const overtimeEligible = employees.filter((emp) => emp.overtimeEligible).length;

  return (
    <>
      {/* Employee Count Card */}
      <div className="rounded-xl p-6 bg-gradient-to-br from-primary-50 to-primary-100/50 border border-primary-200/50 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm text-primary-600 font-medium">عدد الموظفين</div>
            <div className="text-3xl font-bold text-primary-900 mt-1">{totalEmployees}</div>
            <div className="text-xs text-primary-500 mt-1">
              {overtimeEligible} مؤهل للوقت الإضافي
            </div>
          </div>
          <div className="w-12 h-12 rounded-full bg-primary-100 flex items-center justify-center">
            <Users className="w-6 h-6 text-primary-600" aria-hidden="true" />
          </div>
        </div>
      </div>

      {/* Monthly Salaries Card */}
      <div className="rounded-xl p-6 bg-gradient-to-br from-success-50 to-success-100/50 border border-success-200/50 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm text-success-600 font-medium">إجمالي الرواتب الشهرية</div>
            <div className="text-3xl font-bold text-success-900 mt-1">
              {formatNumber(totalMonthlySalaries)}
            </div>
            <div className="text-xs text-success-500 mt-1">دينار</div>
          </div>
          <div className="w-12 h-12 rounded-full bg-success-100 flex items-center justify-center">
            <Wallet className="w-6 h-6 text-success-600" aria-hidden="true" />
          </div>
        </div>
      </div>

      {/* Outstanding Advances Card */}
      <div className="rounded-xl p-6 bg-gradient-to-br from-warning-50 to-warning-100/50 border border-warning-200/50 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm text-warning-600 font-medium">السلف المستحقة</div>
            <div className="text-3xl font-bold text-warning-900 mt-1">
              {formatNumber(outstandingAdvances)}
            </div>
            <div className="text-xs text-warning-500 mt-1">دينار</div>
          </div>
          <div className="w-12 h-12 rounded-full bg-warning-100 flex items-center justify-center">
            <Banknote className="w-6 h-6 text-warning-600" aria-hidden="true" />
          </div>
        </div>
      </div>
    </>
  );
}
