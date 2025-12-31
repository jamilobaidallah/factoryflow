"use client";

import { Button } from "@/components/ui/button";
import { Edit, Plus, Calendar, Wallet, Clock, Briefcase } from "lucide-react";
import { PermissionGate } from "@/components/auth";
import { Employee } from "../types/employees";
import { formatShortDate, formatNumber } from "@/lib/date-utils";
import { EmployeeBalanceDisplay } from "./EmployeeBalanceDisplay";

interface EmployeeProfileCardProps {
  employee: Employee;
  unpaidSalaries: number;
  outstandingAdvances: number;
  netBalance: number;
  onEdit: () => void;
  onAddAdvance: () => void;
}

export function EmployeeProfileCard({
  employee,
  unpaidSalaries,
  outstandingAdvances,
  netBalance,
  onEdit,
  onAddAdvance,
}: EmployeeProfileCardProps) {
  return (
    <div className="rounded-xl border border-slate-200/60 shadow-card bg-white overflow-hidden">
      {/* Header with gradient */}
      <div className="h-24 bg-gradient-to-r from-primary-500 to-primary-600" />

      <div className="px-6 pb-6">
        {/* Avatar and Name */}
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between -mt-12 gap-4">
          <div className="flex items-end gap-4">
            <div className="w-24 h-24 rounded-xl bg-white shadow-lg flex items-center justify-center border-4 border-white">
              <span className="text-4xl font-bold text-primary-600">
                {employee.name.charAt(0)}
              </span>
            </div>
            <div className="mb-2">
              <h2 className="text-xl font-bold text-slate-900">{employee.name}</h2>
              <div className="flex items-center gap-1 text-slate-500">
                <Briefcase className="w-4 h-4" />
                <span>{employee.position || "موظف"}</span>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <PermissionGate action="update" module="employees">
              <Button variant="outline" size="sm" onClick={onEdit} className="gap-2">
                <Edit className="w-4 h-4" />
                تعديل
              </Button>
            </PermissionGate>
            <PermissionGate action="create" module="employees">
              <Button size="sm" onClick={onAddAdvance} className="gap-2">
                <Plus className="w-4 h-4" />
                صرف سلفة
              </Button>
            </PermissionGate>
          </div>
        </div>

        {/* Info Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
          {/* Salary */}
          <div className="rounded-lg bg-slate-50 p-4">
            <div className="flex items-center gap-2 text-slate-500 text-sm mb-1">
              <Wallet className="w-4 h-4" />
              الراتب الحالي
            </div>
            <div className="text-xl font-bold text-slate-900">
              {formatNumber(employee.currentSalary)} <span className="text-sm font-normal text-slate-500">دينار</span>
            </div>
          </div>

          {/* Hire Date */}
          <div className="rounded-lg bg-slate-50 p-4">
            <div className="flex items-center gap-2 text-slate-500 text-sm mb-1">
              <Calendar className="w-4 h-4" />
              تاريخ التعيين
            </div>
            <div className="text-xl font-bold text-slate-900">
              {formatShortDate(employee.hireDate)}
            </div>
          </div>

          {/* Overtime Status */}
          <div className="rounded-lg bg-slate-50 p-4">
            <div className="flex items-center gap-2 text-slate-500 text-sm mb-1">
              <Clock className="w-4 h-4" />
              الوقت الإضافي
            </div>
            <div className="text-xl font-bold">
              {employee.overtimeEligible ? (
                <span className="text-success-600">مؤهل</span>
              ) : (
                <span className="text-slate-400">غير مؤهل</span>
              )}
            </div>
          </div>

          {/* Net Balance */}
          <div className={`rounded-lg p-4 ${
            netBalance > 0
              ? "bg-danger-50"
              : netBalance < 0
              ? "bg-success-50"
              : "bg-slate-50"
          }`}>
            <div className="flex items-center gap-2 text-slate-500 text-sm mb-1">
              صافي الرصيد
            </div>
            <EmployeeBalanceDisplay
              unpaidSalaries={unpaidSalaries}
              outstandingAdvances={outstandingAdvances}
              netBalance={netBalance}
              size="lg"
            />
          </div>
        </div>

        {/* Balance Breakdown */}
        {(unpaidSalaries > 0 || outstandingAdvances > 0) && (
          <div className="mt-4 p-4 rounded-lg bg-slate-50 border border-slate-100">
            <h4 className="text-sm font-medium text-slate-700 mb-3">تفاصيل الرصيد</h4>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">رواتب غير مدفوعة:</span>
                <span className="font-medium text-success-600">
                  +{formatNumber(unpaidSalaries)} دينار
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">سلف مستحقة:</span>
                <span className="font-medium text-danger-600">
                  -{formatNumber(outstandingAdvances)} دينار
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
