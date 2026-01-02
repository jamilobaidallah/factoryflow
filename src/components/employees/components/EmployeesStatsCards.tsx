"use client";

import { useState } from "react";
import { Users, Wallet, Banknote, Scale, ChevronDown, ChevronUp } from "lucide-react";
import { Employee } from "../types/employees";
import { UnpaidSalaryBreakdown } from "../hooks/useEmployeesData";
import { sumAmounts, safeSubtract } from "@/lib/currency";
import { formatNumber } from "@/lib/date-utils";

interface EmployeesStatsCardsProps {
  employees: Employee[];
  outstandingAdvances?: number;
  totalUnpaidSalaries?: number;
  unpaidBreakdown?: UnpaidSalaryBreakdown[];
}

export function EmployeesStatsCards({
  employees,
  outstandingAdvances = 0,
  totalUnpaidSalaries = 0,
  unpaidBreakdown = [],
}: EmployeesStatsCardsProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const totalEmployees = employees.length;
  const totalMonthlySalaries = sumAmounts(employees.map((emp) => emp.currentSalary));
  const overtimeEligible = employees.filter((emp) => emp.overtimeEligible).length;

  // Net balance = Unpaid Salaries - Outstanding Advances
  // Positive means factory owes employees
  const netOwed = safeSubtract(totalUnpaidSalaries, outstandingAdvances);

  // Check if card should be expandable (has unpaid entries)
  const hasUnpaidEntries = unpaidBreakdown.length > 0;

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

      {/* Net Owed Card - Expandable */}
      <div className={`rounded-xl bg-gradient-to-br ${
        netOwed > 0
          ? "from-danger-50 to-danger-100/50 border border-danger-200/50"
          : netOwed < 0
          ? "from-success-50 to-success-100/50 border border-success-200/50"
          : "from-slate-50 to-slate-100/50 border border-slate-200/50"
      } shadow-sm overflow-hidden`}>
        {/* Card Header - Clickable */}
        <div
          className={`p-6 ${hasUnpaidEntries ? "cursor-pointer hover:bg-black/5 transition-colors" : ""}`}
          onClick={() => hasUnpaidEntries && setIsExpanded(!isExpanded)}
          role={hasUnpaidEntries ? "button" : undefined}
          aria-expanded={hasUnpaidEntries ? isExpanded : undefined}
        >
          <div className="flex items-center justify-between">
            <div>
              <div className={`text-sm font-medium ${
                netOwed > 0 ? "text-danger-600" : netOwed < 0 ? "text-success-600" : "text-slate-600"
              }`}>
                {netOwed > 0 ? "مستحقات للموظفين" : netOwed < 0 ? "مستحقات على الموظفين" : "الرصيد الصافي"}
              </div>
              <div className={`text-3xl font-bold mt-1 ${
                netOwed > 0 ? "text-danger-900" : netOwed < 0 ? "text-success-900" : "text-slate-900"
              }`}>
                {formatNumber(Math.abs(netOwed))}
              </div>
              <div className={`text-xs mt-1 flex items-center gap-1 ${
                netOwed > 0 ? "text-danger-500" : netOwed < 0 ? "text-success-500" : "text-slate-500"
              }`}>
                {netOwed > 0 ? "المصنع مدين" : netOwed < 0 ? "الموظفين مدينون" : "لا توجد مستحقات"}
                {hasUnpaidEntries && (
                  <span className="text-xs opacity-75">
                    • {unpaidBreakdown.length} {unpaidBreakdown.length === 1 ? "شهر" : "أشهر"}
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {hasUnpaidEntries && (
                <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                  netOwed > 0 ? "bg-danger-200/50" : netOwed < 0 ? "bg-success-200/50" : "bg-slate-200/50"
                }`}>
                  {isExpanded ? (
                    <ChevronUp className={`w-4 h-4 ${
                      netOwed > 0 ? "text-danger-600" : netOwed < 0 ? "text-success-600" : "text-slate-600"
                    }`} />
                  ) : (
                    <ChevronDown className={`w-4 h-4 ${
                      netOwed > 0 ? "text-danger-600" : netOwed < 0 ? "text-success-600" : "text-slate-600"
                    }`} />
                  )}
                </div>
              )}
              <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                netOwed > 0 ? "bg-danger-100" : netOwed < 0 ? "bg-success-100" : "bg-slate-100"
              }`}>
                <Scale className={`w-6 h-6 ${
                  netOwed > 0 ? "text-danger-600" : netOwed < 0 ? "text-success-600" : "text-slate-600"
                }`} aria-hidden="true" />
              </div>
            </div>
          </div>
        </div>

        {/* Expandable Content */}
        {isExpanded && hasUnpaidEntries && (
          <div className={`border-t ${
            netOwed > 0 ? "border-danger-200/50" : netOwed < 0 ? "border-success-200/50" : "border-slate-200/50"
          } px-6 pb-4`}>
            <div className="space-y-3 pt-3">
              {unpaidBreakdown.map((breakdown) => (
                <div
                  key={breakdown.month}
                  className={`rounded-lg p-3 ${
                    netOwed > 0 ? "bg-danger-100/50" : netOwed < 0 ? "bg-success-100/50" : "bg-slate-100/50"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className={`text-sm font-medium ${
                      netOwed > 0 ? "text-danger-700" : netOwed < 0 ? "text-success-700" : "text-slate-700"
                    }`}>
                      شهر {breakdown.month}
                    </span>
                    <span className={`text-sm font-bold ${
                      netOwed > 0 ? "text-danger-800" : netOwed < 0 ? "text-success-800" : "text-slate-800"
                    }`}>
                      {formatNumber(breakdown.total)} دينار
                    </span>
                  </div>
                  <div className="space-y-1">
                    {breakdown.entries.map((entry) => (
                      <div
                        key={entry.id}
                        className={`flex items-center justify-between text-xs ${
                          netOwed > 0 ? "text-danger-600" : netOwed < 0 ? "text-success-600" : "text-slate-600"
                        }`}
                      >
                        <span>• {entry.employeeName}</span>
                        <span>{formatNumber(entry.netSalary ?? entry.totalSalary)} دينار</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
