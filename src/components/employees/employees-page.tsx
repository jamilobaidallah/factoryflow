"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { PermissionGate } from "@/components/auth";
import { useConfirmation } from "@/components/ui/confirmation-dialog";
import { StatCardSkeleton, TableSkeleton } from "@/components/ui/loading-skeleton";

// Types and hooks
import { Employee, initialEmployeeFormData } from "./types/employees";
import { useEmployeesData } from "./hooks/useEmployeesData";
import { useEmployeesOperations } from "./hooks/useEmployeesOperations";

// Components
import { EmployeesStatsCards } from "./components/EmployeesStatsCards";
import { EmployeesTable } from "./components/EmployeesTable";
import { PayrollTable } from "./components/PayrollTable";
import { EmployeeFormDialog } from "./components/EmployeeFormDialog";
import { SalaryHistoryDialog } from "./components/SalaryHistoryDialog";

export default function EmployeesPage() {
  const { confirm, dialog: confirmationDialog } = useConfirmation();

  // Data and operations hooks
  const { employees, salaryHistory, payrollEntries, loading: dataLoading } = useEmployeesData();
  const { submitEmployee, deleteEmployee, processPayroll, markAsPaid } = useEmployeesOperations();

  // UI state
  const [activeTab, setActiveTab] = useState<"employees" | "payroll">("employees");
  const [isEmployeeDialogOpen, setIsEmployeeDialogOpen] = useState(false);
  const [isHistoryDialogOpen, setIsHistoryDialogOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [selectedEmployeeHistory, setSelectedEmployeeHistory] = useState<typeof salaryHistory>([]);
  const [loading, setLoading] = useState(false);

  // Payroll state
  const [selectedMonth, setSelectedMonth] = useState(
    new Date().toISOString().slice(0, 7) // "2025-11"
  );
  const [payrollData, setPayrollData] = useState<{[key: string]: {overtime: string, notes: string}}>({});

  // Form state
  const [employeeFormData, setEmployeeFormData] = useState(initialEmployeeFormData);

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
    confirm(
      "حذف الموظف",
      "هل أنت متأكد من حذف هذا الموظف؟ لا يمكن التراجع عن هذا الإجراء.",
      async () => {
        await deleteEmployee(employeeId);
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

  const handleMarkAsPaid = async (payrollEntry: typeof payrollEntries[0]) => {
    setLoading(true);
    await markAsPaid(payrollEntry);
    setLoading(false);
  };

  const monthPayroll = payrollEntries.filter(p => p.month === selectedMonth);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">الموظفين والرواتب</h1>
          <p className="text-gray-600 mt-2">إدارة الموظفين والرواتب الشهرية</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {dataLoading ? (
          <>
            <StatCardSkeleton />
            <StatCardSkeleton />
          </>
        ) : (
          <EmployeesStatsCards employees={employees} />
        )}
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-4" role="tablist" aria-label="أقسام الموظفين والرواتب">
          <button
            onClick={() => setActiveTab("employees")}
            className={`pb-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === "employees"
                ? "border-blue-500 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
            role="tab"
            aria-selected={activeTab === "employees"}
            aria-controls="employees-panel"
            id="employees-tab"
          >
            📋 الموظفين
          </button>
          <button
            onClick={() => setActiveTab("payroll")}
            className={`pb-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === "payroll"
                ? "border-blue-500 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
            role="tab"
            aria-selected={activeTab === "payroll"}
            aria-controls="payroll-panel"
            id="payroll-tab"
          >
            💰 الرواتب الشهرية
          </button>
        </nav>
      </div>

      {/* Employees Tab */}
      {activeTab === "employees" && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>قائمة الموظفين ({employees.length})</CardTitle>
            <PermissionGate action="create" module="employees">
              <Button onClick={openAddEmployeeDialog} className="gap-2" aria-label="إضافة موظف جديد">
                <Plus className="w-4 h-4" aria-hidden="true" />
                إضافة موظف
              </Button>
            </PermissionGate>
          </CardHeader>
          <CardContent>
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
        <Card>
          <CardHeader>
            <CardTitle>الرواتب الشهرية</CardTitle>
          </CardHeader>
          <CardContent>
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
            />
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

      {confirmationDialog}
    </div>
  );
}
