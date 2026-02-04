"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/firebase/provider";
import { doc, onSnapshot } from "firebase/firestore";
import { firestore } from "@/firebase/config";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowRight,
  User,
  Calendar,
  Wallet,
  Clock,
  FileText,
  Banknote,
  Edit,
  Plus,
} from "lucide-react";
import { PermissionGate } from "@/components/auth";
import { useConfirmation } from "@/components/ui/confirmation-dialog";
import { formatShortDate, formatNumber } from "@/lib/date-utils";
import { safeSubtract } from "@/lib/currency";
import { convertFirestoreDates } from "@/lib/firestore-utils";

// Types and hooks
import { Employee, initialEmployeeFormData, PayrollEntry, SalaryHistory } from "./types/employees";
import { Advance, initialAdvanceFormData } from "./types/advances";
import { useEmployeesData } from "./hooks/useEmployeesData";
import { useEmployeesOperations } from "./hooks/useEmployeesOperations";
import { useAdvancesData } from "./hooks/useAdvancesData";
import { useAdvancesOperations } from "./hooks/useAdvancesOperations";

// Components
import { EmployeeFormDialog } from "./components/EmployeeFormDialog";
import { AdvanceFormDialog } from "./components/AdvanceFormDialog";
import { EmployeeBalanceDisplay } from "./components/EmployeeBalanceDisplay";
import { EmployeeProfileCard } from "./components/EmployeeProfileCard";
import { EmployeePayrollHistory } from "./components/EmployeePayrollHistory";
import { EmployeeSalaryHistory } from "./components/EmployeeSalaryHistory";
import { EmployeeAdvancesHistory } from "./components/EmployeeAdvancesHistory";

interface EmployeeDetailPageProps {
  employeeId: string;
}

export default function EmployeeDetailPage({ employeeId }: EmployeeDetailPageProps) {
  const router = useRouter();
  const { user } = useUser();
  const { confirm, dialog: confirmationDialog } = useConfirmation();

  // Employee state
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [employeeLoading, setEmployeeLoading] = useState(true);

  // Data hooks
  const { salaryHistory, payrollEntries, getEmployeeUnpaidSalaries } = useEmployeesData();
  const { submitEmployee, markAsPaid, deletePayrollEntry } = useEmployeesOperations();
  const { getEmployeeAdvances, getEmployeeOutstandingBalance } = useAdvancesData();
  const { createAdvance, deleteAdvance } = useAdvancesOperations();

  // UI state
  const [activeTab, setActiveTab] = useState<"overview" | "payroll" | "advances">("overview");
  const [isEmployeeDialogOpen, setIsEmployeeDialogOpen] = useState(false);
  const [isAdvanceDialogOpen, setIsAdvanceDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  // Form state
  const [employeeFormData, setEmployeeFormData] = useState(initialEmployeeFormData);
  const [advanceFormData, setAdvanceFormData] = useState(initialAdvanceFormData);

  // Load employee data
  useEffect(() => {
    if (!user || !employeeId) {return;}

    const employeeRef = doc(firestore, `users/${user.dataOwnerId}/employees`, employeeId);
    const unsubscribe = onSnapshot(employeeRef, (snapshot) => {
      if (snapshot.exists()) {
        setEmployee({
          id: snapshot.id,
          ...convertFirestoreDates(snapshot.data()),
        } as Employee);
      } else {
        setEmployee(null);
      }
      setEmployeeLoading(false);
    });

    return () => unsubscribe();
  }, [user, employeeId]);

  // Filter data for this employee
  const employeeSalaryHistory = salaryHistory.filter((h) => h.employeeId === employeeId);
  const employeePayroll = payrollEntries.filter((p) => p.employeeId === employeeId);
  const employeeAdvances = getEmployeeAdvances(employeeId);

  // Calculate balance
  const unpaidSalaries = getEmployeeUnpaidSalaries(employeeId);
  const outstandingAdvances = getEmployeeOutstandingBalance(employeeId);
  const netBalance = safeSubtract(unpaidSalaries, outstandingAdvances);

  // Handlers
  const handleEditEmployee = () => {
    if (!employee) {return;}
    setEmployeeFormData({
      name: employee.name,
      currentSalary: employee.currentSalary.toString(),
      overtimeEligible: employee.overtimeEligible,
      position: employee.position || "",
      hireDate: new Date(employee.hireDate).toISOString().split("T")[0],
    });
    setIsEmployeeDialogOpen(true);
  };

  const handleEmployeeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!employee) {return;}
    setLoading(true);
    const success = await submitEmployee(employeeFormData, employee);
    if (success) {
      setIsEmployeeDialogOpen(false);
    }
    setLoading(false);
  };

  const openAddAdvanceDialog = () => {
    setAdvanceFormData({
      ...initialAdvanceFormData,
      employeeId: employeeId,
    });
    setIsAdvanceDialogOpen(true);
  };

  const handleAdvanceSubmit = async () => {
    if (!employee) {return;}
    setLoading(true);
    const success = await createAdvance(advanceFormData, employee);
    if (success) {
      setAdvanceFormData(initialAdvanceFormData);
      setIsAdvanceDialogOpen(false);
    }
    setLoading(false);
  };

  const handleDeleteAdvance = (advance: Advance) => {
    confirm(
      "حذف السلفة",
      `هل أنت متأكد من حذف سلفة ${advance.employeeName}؟ سيتم حذف جميع السجلات المرتبطة بها.`,
      async () => {
        setLoading(true);
        await deleteAdvance(advance);
        setLoading(false);
      },
      "destructive"
    );
  };

  const handleMarkAsPaid = (payrollEntry: PayrollEntry) => {
    confirm(
      "تأكيد دفع الراتب",
      `هل تريد تسجيل دفع راتب ${payrollEntry.employeeName} بقيمة ${formatNumber(payrollEntry.totalSalary)} دينار؟`,
      async () => {
        setLoading(true);
        await markAsPaid(payrollEntry);
        setLoading(false);
      },
      "info"
    );
  };

  const handleDeletePayrollEntry = (payrollEntry: PayrollEntry) => {
    confirm(
      "حذف سجل الراتب",
      `هل أنت متأكد من حذف سجل راتب ${payrollEntry.employeeName} لشهر ${payrollEntry.month}؟`,
      async () => {
        setLoading(true);
        await deletePayrollEntry(payrollEntry);
        setLoading(false);
      },
      "destructive"
    );
  };

  const tabs = [
    { id: "overview" as const, label: "نظرة عامة", icon: User },
    { id: "payroll" as const, label: "سجل الرواتب", icon: Wallet },
    { id: "advances" as const, label: "السلف", icon: Banknote },
  ];

  // Loading state
  if (employeeLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10" />
          <Skeleton className="h-8 w-48" />
        </div>
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  // Not found state
  if (!employee) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <h2 className="text-xl font-semibold text-slate-800 mb-2">الموظف غير موجود</h2>
        <p className="text-slate-500 mb-4">لا يمكن العثور على الموظف المطلوب</p>
        <Button onClick={() => router.push("/employees")}>
          <ArrowRight className="ml-2 h-4 w-4" />
          العودة للموظفين
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Back Button and Title */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push("/employees")}
          className="h-10 w-10"
          aria-label="العودة"
        >
          <ArrowRight className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{employee.name}</h1>
          <p className="text-slate-500">{employee.position || "موظف"}</p>
        </div>
      </div>

      {/* Profile Card */}
      <EmployeeProfileCard
        employee={employee}
        unpaidSalaries={unpaidSalaries}
        outstandingAdvances={outstandingAdvances}
        netBalance={netBalance}
        onEdit={handleEditEmployee}
        onAddAdvance={openAddAdvanceDialog}
      />

      {/* Tabs */}
      <div className="border-b border-slate-200">
        <nav className="flex gap-1" role="tablist" aria-label="أقسام الموظف">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === tab.id
                    ? "border-primary-500 text-primary-600 bg-primary-50/50"
                    : "border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50"
                }`}
                role="tab"
                aria-selected={activeTab === tab.id}
              >
                <Icon className="w-4 h-4" aria-hidden="true" />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === "overview" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Salary History */}
          <Card className="rounded-xl border border-slate-200/60 shadow-card">
            <CardHeader className="border-b border-slate-100 pb-4">
              <CardTitle className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                <Clock className="w-5 h-5 text-slate-400" />
                سجل تعديلات الراتب
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <EmployeeSalaryHistory
                history={employeeSalaryHistory}
                currentSalary={employee.currentSalary}
              />
            </CardContent>
          </Card>

          {/* Recent Payroll */}
          <Card className="rounded-xl border border-slate-200/60 shadow-card">
            <CardHeader className="border-b border-slate-100 pb-4">
              <CardTitle className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                <FileText className="w-5 h-5 text-slate-400" />
                آخر الرواتب
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <EmployeePayrollHistory
                payrollEntries={employeePayroll.slice(0, 5)}
                onMarkAsPaid={handleMarkAsPaid}
                onDelete={handleDeletePayrollEntry}
                loading={loading}
                compact
              />
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === "payroll" && (
        <Card className="rounded-xl border border-slate-200/60 shadow-card">
          <CardHeader className="border-b border-slate-100 pb-4">
            <CardTitle className="text-lg font-semibold text-slate-800">سجل الرواتب الكامل</CardTitle>
            <p className="text-sm text-slate-500 mt-1">
              {employeePayroll.length} سجل راتب
            </p>
          </CardHeader>
          <CardContent className="pt-4">
            <EmployeePayrollHistory
              payrollEntries={employeePayroll}
              onMarkAsPaid={handleMarkAsPaid}
              onDelete={handleDeletePayrollEntry}
              loading={loading}
            />
          </CardContent>
        </Card>
      )}

      {activeTab === "advances" && (
        <Card className="rounded-xl border border-slate-200/60 shadow-card">
          <CardHeader className="flex flex-row items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <CardTitle className="text-lg font-semibold text-slate-800">سجل السلف</CardTitle>
              <p className="text-sm text-slate-500 mt-1">
                {employeeAdvances.length} سلفة مسجلة
              </p>
            </div>
            <PermissionGate action="create" module="employees">
              <Button onClick={openAddAdvanceDialog} className="gap-2">
                <Plus className="w-4 h-4 ml-1" />
                صرف سلفة
              </Button>
            </PermissionGate>
          </CardHeader>
          <CardContent className="pt-4">
            <EmployeeAdvancesHistory
              advances={employeeAdvances}
              onDelete={handleDeleteAdvance}
              loading={loading}
            />
          </CardContent>
        </Card>
      )}

      {/* Dialogs */}
      <EmployeeFormDialog
        isOpen={isEmployeeDialogOpen}
        onClose={() => setIsEmployeeDialogOpen(false)}
        editingEmployee={employee}
        formData={employeeFormData}
        setFormData={setEmployeeFormData}
        loading={loading}
        onSubmit={handleEmployeeSubmit}
      />

      {employee && (
        <AdvanceFormDialog
          isOpen={isAdvanceDialogOpen}
          onClose={() => setIsAdvanceDialogOpen(false)}
          employees={[employee]}
          formData={advanceFormData}
          setFormData={setAdvanceFormData}
          onSubmit={handleAdvanceSubmit}
          loading={loading}
        />
      )}

      {confirmationDialog}
    </div>
  );
}
