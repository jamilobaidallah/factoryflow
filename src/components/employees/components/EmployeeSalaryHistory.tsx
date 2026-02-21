"use client";

import { ArrowUp, ArrowDown, Clock } from "lucide-react";
import { SalaryHistory } from "../types/employees";
import { formatShortDate, formatNumber } from "@/lib/date-utils";

interface EmployeeSalaryHistoryProps {
  history: SalaryHistory[];
  currentSalary: number;
}

export function EmployeeSalaryHistory({
  history,
  currentSalary,
}: EmployeeSalaryHistoryProps) {
  if (history.length === 0) {
    return (
      <div className="text-center py-8">
        <Clock className="w-12 h-12 text-slate-200 mx-auto mb-3" />
        <p className="text-slate-500">لا يوجد سجل تعديلات للراتب</p>
        <p className="text-sm text-slate-400 mt-1">
          الراتب الحالي: {formatNumber(currentSalary)} دينار
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Current Salary Indicator */}
      <div className="flex items-center gap-3 p-3 rounded-lg bg-primary-50 border border-primary-100">
        <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center">
          <span className="text-primary-600 font-bold text-sm">الآن</span>
        </div>
        <div>
          <div className="font-semibold text-primary-900">
            {formatNumber(currentSalary)} دينار
          </div>
          <div className="text-xs text-primary-600">الراتب الحالي</div>
        </div>
      </div>

      {/* Timeline */}
      <div className="relative">
        <div className="absolute right-5 top-0 bottom-0 w-0.5 bg-slate-200" />

        {history.map((entry, index) => {
          const isIncrease = entry.incrementPercentage > 0;
          return (
            <div key={entry.id} className="relative flex gap-3 pb-4 last:pb-0">
              {/* Timeline dot */}
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center z-10 ${
                  isIncrease
                    ? "bg-success-100 text-success-600"
                    : "bg-danger-100 text-danger-600"
                }`}
              >
                {isIncrease ? (
                  <ArrowUp className="w-4 h-4" />
                ) : (
                  <ArrowDown className="w-4 h-4" />
                )}
              </div>

              {/* Content */}
              <div className="flex-1 pt-1">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-medium text-slate-900">
                      {formatNumber(entry.oldSalary)} → {formatNumber(entry.newSalary)}
                    </span>
                    <span
                      className={`ml-2 text-sm font-medium ${
                        isIncrease ? "text-success-600" : "text-danger-600"
                      }`}
                    >
                      ({isIncrease ? "+" : ""}{entry.incrementPercentage.toFixed(1)}%)
                    </span>
                  </div>
                  <span className="text-sm text-slate-400">
                    {formatShortDate(entry.effectiveDate)}
                  </span>
                </div>
                {entry.notes && (
                  <p className="text-sm text-slate-500 mt-0.5">{entry.notes}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
