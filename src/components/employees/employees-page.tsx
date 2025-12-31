"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Users, Wallet, Banknote } from "lucide-react";
import { PermissionGate } from "@/components/auth";
import { useConfirmation } from "@/components/ui/confirmation-dialog";
import { StatCardSkeleton, TableSkeleton } from "@/components/ui/loading-skeleton";

// Types and hooks
import { Employee, initialEmployeeFormData } from "./types/employees";
import { initialAdvanceFormData } from "./types/advances";
import { useEmployeesData } from "./hooks/useEmployeesData";
import { useEmployeesOperations } from "./hooks/useEmployeesOperations";
import { useAdvancesData } from "./hooks/useAdvancesData";
import { useAdvancesOperations } from "./hooks/useAdvancesOperations";

// Components
import { EmployeesStatsCards } from "./components/EmployeesStatsCards";
import { EmployeesTable } from "./components/EmployeesTable";
import { PayrollTable } from "./components/PayrollTable";
import { EmployeeFormDialog } from "./components/EmployeeFormDialog";
import { SalaryHistoryDialog } from "./components/SalaryHistoryDialog";
import { AdvancesTable } from "./components/AdvancesTable";
import { AdvanceFormDialog } from "./components/AdvanceFormDialog";

export default function EmployeesPage() {
  const { confirm, dialog: confirmationDialog } = useConfirmation();

  // Data and operations hooks
  const { employees, salaryHistory, payrollEntries, loading: dataLoading } = useEmployeesData();
  const { submitEmployee, deleteEmployee, processPayroll, markAsPaid, deletePayrollEntry } = useEmployeesOperations();
  const { advances, loading: advancesLoading, getTotalOutstandingAdvances } = useAdvancesData();
  const { createAdvance, cancelAdvance } = useAdvancesOperations();

  // UI state
  const [activeTab, setActiveTab] = useState<"employees" | "payroll" | "advances">("employees");
  const [isEmployeeDialogOpen, setIsEmployeeDialogOpen] = useState(false);
  const [isHistoryDialogOpen, setIsHistoryDialogOpen] = useState(false);
  const [isAdvanceDialogOpen, setIsAdvanceDialogOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [selectedEmployeeHistory, setSelectedEmployeeHistory] = useState<typeof salaryHistory>([]);
  const [loading, setLoading] = useState(false);

  // Payroll state
  const [selectedMonth, setSelectedMonth] = useState(
    new Date().toISOString().slice(0, 7) // "2025-11"
  );
  const [payrollData, setPayrollData] = useState<{[key: string]: {overtime: string, bonus: string, deduction: string, notes: string}}>({});

  // Form state
  const [employeeFormData, setEmployeeFormData] = useState(initialEmployeeFormData);
  const [advanceFormData, setAdvanceFormData] = useState(initialAdvanceFormData);

  const resetEmployeeForm = () => {
    setEmployeeFormData(initialEmployeeFormData);
    setEditingEmployee(null);
  };

  const openAddEmployeeDialog = () => {
    resetEmployeeForm();
    setIsEmployeeDialogOpen(true);
  };

  const handleEditEmployee = (employee: Employee) => {
    setEditingEmployee(employee);
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
    setLoading(true);

    const success = await submitEmployee(employeeFormData, editingEmployee);

    if (success) {
      resetEmployeeForm();
      setIsEmployeeDialogOpen(false);
    }
    setLoading(false);
  };

  const handleDeleteEmployee = (employeeId: string) => {
    const employee = employees.find(e => e.id === employeeId);
    confirm(
      "حذف الموظف",
      `هل أنت متأكد من حذف الموظف "${employee?.name || ''}"؟ لا يمكن التراجع عن هذا الإجراء.`,
      async () => {
        await deleteEmployee(employeeId, employee);
      },
      "destructive"
    );
  };

  const viewSalaryHistory = (employeeId: string) => {
    const history = salaryHistory.filter(h => h.employeeId === employeeId);
    setSelectedEmployeeHistory(history);
    setIsHistoryDialogOpen(true);
  };

  const handleProcessPayroll = () => {
    confirm(
      "معالجة الرواتب",
      `هل أنت متأكد من معالجة الرواتب لشهر ${selectedMonth}؟`,
      async () => {
        setLoading(true);
        const success = await processPayroll(selectedMonth, employees, payrollData);
        if (success) {
          setPayrollData({});
        }
        setLoading(false);
      },
      "warning"
    );
  };

  const handleMarkAsPaid = (payrollEntry: typeof payrollEntries[0]) => {
    confirm(
      "تأكيد دفع الراتب",
      `هل تريد تسجيل دفع راتب ${payrollEntry.employeeName} بقيمة ${payrollEntry.totalSalary.toFixed(2)} دينار؟`,
      async () => {
        setLoading(true);
        await markAsPaid(payrollEntry);
        setLoading(false);
      },
      "info"
    );
  };

  const handleDeletePayrollEntry = (payrollEntry: typeof payrollEntries[0]) => {
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

  const monthPayroll = payrollEntries.filter(p => p.month === selectedMonth);

  // Advance handlers
  const openAddAdvanceDialog = () => {
    setAdvanceFormData(initialAdvanceFormData);
    setIsAdvanceDialogOpen(true);
  };

  const handleAdvanceSubmit = async () => {
    const employee = employees.find((e) => e.id === advanceFormData.employeeId);
    if (!employee) return;

    setLoading(true);
    const success = await createAdvance(advanceFormData, employee);
    if (success) {
      setAdvanceFormData(initialAdvanceFormData);
      setIsAdvanceDialogOpen(false);
    }
    setLoading(false);
  };

  const handleCancelAdvance = (advance: typeof advances[0]) => {
    confirm(
      "إلغاء السلفة",
      `هل أنت متأكد من إلغاء سلفة ${advance.employeeName}؟`,
      async () => {
        setLoading(true);
        await cancelAdvance(advance);
        setLoading(false);
      },
      "destructive"
    );
  };

  const tabs = [
    { id: "employees" as const, label: "الموظفين", icon: Users },
    { id: "payroll" as const, label: "الرواتب الشهرية", icon: Wallet },
    { id: "advances" as const, label: "السلف", icon: Banknote },
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">الموظفين والرواتب</h1>
          <p className="text-slate-500 mt-1">إدارة الموظفين والرواتب الشهرية والسلف</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {dataLoading || advancesLoading ? (
          <>
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
          </>
        ) : (
          <EmployeesStatsCards
            employees={employees}
            outstandingAdvances={getTotalOutstandingAdvances()}
          />
        )}
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200">
        <nav className="flex gap-1" role="tablist" aria-label="أقسام الموظفين والرواتب">
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
                aria-controls={`${tab.id}-panel`}
                id={`${tab.id}-tab`}
              >
                <Icon className="w-4 h-4" aria-hidden="true" />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Employees Tab */}
      {activeTab === "employees" && (
        <Card className="rounded-xl border border-slate-200/60 shadow-card">
          <CardHeader className="flex flex-row items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <CardTitle className="text-lg font-semibold text-slate-800">قائمة الموظفين</CardTitle>
              <p className="text-sm text-slate-500 mt-1">{employees.length} موظف مسجل</p>
            </div>
            <PermissionGate action="create" module="employees">
              <Button onClick={openAddEmployeeDialog} className="gap-2" aria-label="إضافة موظف جديد">
                <Plus className="w-4 h-4 ml-1" aria-hidden="true" />
                إضافة موظف
              </Button>
            </PermissionGate>
          </CardHeader>
          <CardContent className="pt-6">
            {dataLoading ? (
              <TableSkeleton rows={10} />
            ) : (
              <EmployeesTable
                employees={employees}
                onEdit={handleEditEmployee}
                onDelete={handleDeleteEmployee}
                onViewHistory={viewSalaryHistory}
              />
            )}
          </CardContent>
        </Card>
      )}

      {/* Payroll Tab */}
      {activeTab === "payroll" && (
        <Card className="rounded-xl border border-slate-200/60 shadow-card">
          <CardHeader className="border-b border-slate-100 pb-4">
            <CardTitle className="text-lg font-semibold text-slate-800">الرواتب الشهرية</CardTitle>
            <p className="text-sm text-slate-500 mt-1">معالجة ودفع الرواتب الشهرية للموظفين</p>
          </CardHeader>
          <CardContent className="pt-6">
            <PayrollTable
              employees={employees}
              selectedMonth={selectedMonth}
              setSelectedMonth={setSelectedMonth}
              monthPayroll={monthPayroll}
              payrollData={payrollData}
              setPayrollData={setPayrollData}
              loading={loading}
              onProcessPayroll={handleProcessPayroll}
              onMarkAsPaid={handleMarkAsPaid}
              onDeletePayrollEntry={handleDeletePayrollEntry}
            />
          </CardContent>
        </Card>
      )}

      {/* Advances Tab */}
      {activeTab === "advances" && (
        <Card className="rounded-xl border border-slate-200/60 shadow-card">
          <CardHeader className="flex flex-row items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <CardTitle className="text-lg font-semibold text-slate-800">السلف</CardTitle>
              <p className="text-sm text-slate-500 mt-1">{advances.length} سلفة مسجلة</p>
            </div>
            <PermissionGate action="create" module="employees">
              <Button onClick={openAddAdvanceDialog} className="gap-2" aria-label="صرف سلفة جديدة">
                <Plus className="w-4 h-4 ml-1" aria-hidden="true" />
                صرف سلفة
              </Button>
            </PermissionGate>
          </CardHeader>
          <CardContent className="pt-6">
            {advancesLoading ? (
              <TableSkeleton rows={5} />
            ) : (
              <AdvancesTable
                advances={advances}
                employees={employees}
                loading={loading}
                onCancelAdvance={handleCancelAdvance}
              />
            )}
          </CardContent>
        </Card>
      )}

      <EmployeeFormDialog
        isOpen={isEmployeeDialogOpen}
        onClose={() => setIsEmployeeDialogOpen(false)}
        editingEmployee={editingEmployee}
        formData={employeeFormData}
        setFormData={setEmployeeFormData}
        loading={loading}
        onSubmit={handleEmployeeSubmit}
      />

      <SalaryHistoryDialog
        isOpen={isHistoryDialogOpen}
        onClose={() => setIsHistoryDialogOpen(false)}
        history={selectedEmployeeHistory}
      />

      <AdvanceFormDialog
        isOpen={isAdvanceDialogOpen}
        onClose={() => setIsAdvanceDialogOpen(false)}
        employees={employees}
        formData={advanceFormData}
        setFormData={setAdvanceFormData}
        onSubmit={handleAdvanceSubmit}
        loading={loading}
      />

      {confirmationDialog}
    </div>
  );
}
