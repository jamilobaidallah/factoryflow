"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Edit, Trash2, DollarSign, History } from "lucide-react";
import { useUser } from "@/firebase/provider";
import { useToast } from "@/hooks/use-toast";
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  orderBy,
  writeBatch,
  limit,
} from "firebase/firestore";
import { firestore } from "@/firebase/config";

interface Employee {
  id: string;
  name: string;
  currentSalary: number;
  overtimeEligible: boolean;
  hireDate: Date;
  position: string;
  createdAt: Date;
}

interface SalaryHistory {
  id: string;
  employeeId: string;
  employeeName: string;
  oldSalary: number;
  newSalary: number;
  incrementPercentage: number;
  effectiveDate: Date;
  notes: string;
  createdAt: Date;
}

interface PayrollEntry {
  id: string;
  employeeId: string;
  employeeName: string;
  month: string; // "2025-11"
  baseSalary: number;
  overtimeHours: number;
  overtimePay: number;
  totalSalary: number;
  isPaid: boolean;
  paidDate?: Date;
  linkedTransactionId?: string;
  notes: string;
  createdAt: Date;
}

export default function EmployeesPage() {
  const { user } = useUser();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<"employees" | "payroll">("employees");
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [salaryHistory, setSalaryHistory] = useState<SalaryHistory[]>([]);
  const [payrollEntries, setPayrollEntries] = useState<PayrollEntry[]>([]);

  const [isEmployeeDialogOpen, setIsEmployeeDialogOpen] = useState(false);
  const [isHistoryDialogOpen, setIsHistoryDialogOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [selectedEmployeeHistory, setSelectedEmployeeHistory] = useState<SalaryHistory[]>([]);
  const [loading, setLoading] = useState(false);

  // Payroll state
  const [selectedMonth, setSelectedMonth] = useState(
    new Date().toISOString().slice(0, 7) // "2025-11"
  );
  const [payrollData, setPayrollData] = useState<{[key: string]: {overtime: string, notes: string}}>({});

  const [employeeFormData, setEmployeeFormData] = useState({
    name: "",
    currentSalary: "",
    overtimeEligible: false,
    position: "",
    hireDate: new Date().toISOString().split("T")[0],
  });

  // Load employees
  useEffect(() => {
    if (!user) {return;}

    const employeesRef = collection(firestore, `users/${user.uid}/employees`);
    // Limit to 500 employees (reasonable for most businesses)
    const q = query(employeesRef, orderBy("name", "asc"), limit(500));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const employeesData: Employee[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        employeesData.push({
          id: doc.id,
          ...data,
          hireDate: data.hireDate?.toDate ? data.hireDate.toDate() : new Date(),
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(),
        } as Employee);
      });
      setEmployees(employeesData);
    });

    return () => unsubscribe();
  }, [user]);

  // Load salary history
  useEffect(() => {
    if (!user) {return;}

    const historyRef = collection(firestore, `users/${user.uid}/salary_history`);
    // Limit to 1000 most recent salary changes
    const q = query(historyRef, orderBy("effectiveDate", "desc"), limit(1000));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const historyData: SalaryHistory[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        historyData.push({
          id: doc.id,
          ...data,
          effectiveDate: data.effectiveDate?.toDate ? data.effectiveDate.toDate() : new Date(),
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(),
        } as SalaryHistory);
      });
      setSalaryHistory(historyData);
    });

    return () => unsubscribe();
  }, [user]);

  // Load payroll entries
  useEffect(() => {
    if (!user) {return;}

    const payrollRef = collection(firestore, `users/${user.uid}/payroll`);
    // Limit to last 24 months of payroll (2 years)
    const q = query(payrollRef, orderBy("month", "desc"), limit(24));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const payrollData: PayrollEntry[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        payrollData.push({
          id: doc.id,
          ...data,
          paidDate: data.paidDate?.toDate ? data.paidDate.toDate() : undefined,
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(),
        } as PayrollEntry);
      });
      setPayrollEntries(payrollData);
    });

    return () => unsubscribe();
  }, [user]);

  const handleEmployeeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {return;}

    setLoading(true);
    try {
      if (editingEmployee) {
        const oldSalary = editingEmployee.currentSalary;
        const newSalary = parseFloat(employeeFormData.currentSalary);

        // Update employee
        const employeeRef = doc(firestore, `users/${user.uid}/employees`, editingEmployee.id);
        await updateDoc(employeeRef, {
          name: employeeFormData.name,
          currentSalary: newSalary,
          overtimeEligible: employeeFormData.overtimeEligible,
          position: employeeFormData.position,
          hireDate: new Date(employeeFormData.hireDate),
        });

        // If salary changed, record history
        if (oldSalary !== newSalary) {
          const incrementPercentage = ((newSalary - oldSalary) / oldSalary) * 100;
          const historyRef = collection(firestore, `users/${user.uid}/salary_history`);
          await addDoc(historyRef, {
            employeeId: editingEmployee.id,
            employeeName: employeeFormData.name,
            oldSalary: oldSalary,
            newSalary: newSalary,
            incrementPercentage: incrementPercentage,
            effectiveDate: new Date(),
            notes: incrementPercentage > 0 ? "زيادة راتب" : "تخفيض راتب",
            createdAt: new Date(),
          });
        }

        toast({
          title: "تم التحديث",
          description: "تم تحديث بيانات الموظف بنجاح",
        });
      } else {
        const employeesRef = collection(firestore, `users/${user.uid}/employees`);
        await addDoc(employeesRef, {
          name: employeeFormData.name,
          currentSalary: parseFloat(employeeFormData.currentSalary),
          overtimeEligible: employeeFormData.overtimeEligible,
          position: employeeFormData.position,
          hireDate: new Date(employeeFormData.hireDate),
          createdAt: new Date(),
        });

        toast({
          title: "تمت الإضافة",
          description: "تم إضافة موظف جديد بنجاح",
        });
      }

      resetEmployeeForm();
      setIsEmployeeDialogOpen(false);
    } catch (error) {
      toast({
        title: "خطأ",
        description: "حدث خطأ أثناء حفظ البيانات",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteEmployee = async (employeeId: string) => {
    if (!user) {return;}
    if (!confirm("هل أنت متأكد من حذف هذا الموظف؟")) {return;}

    try {
      const employeeRef = doc(firestore, `users/${user.uid}/employees`, employeeId);
      await deleteDoc(employeeRef);
      toast({
        title: "تم الحذف",
        description: "تم حذف الموظف بنجاح",
      });
    } catch (error) {
      toast({
        title: "خطأ",
        description: "حدث خطأ أثناء الحذف",
        variant: "destructive",
      });
    }
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

  const viewSalaryHistory = (employeeId: string) => {
    const history = salaryHistory.filter(h => h.employeeId === employeeId);
    setSelectedEmployeeHistory(history);
    setIsHistoryDialogOpen(true);
  };

  const resetEmployeeForm = () => {
    setEmployeeFormData({
      name: "",
      currentSalary: "",
      overtimeEligible: false,
      position: "",
      hireDate: new Date().toISOString().split("T")[0],
    });
    setEditingEmployee(null);
  };

  const openAddEmployeeDialog = () => {
    resetEmployeeForm();
    setIsEmployeeDialogOpen(true);
  };

  // Payroll functions
  const calculateOvertimePay = (employee: Employee, overtimeHours: number): number => {
    // Calculate hourly rate: monthly salary ÷ 208 hours (26 days × 8 hours)
    const hourlyRate = employee.currentSalary / 208;
    // Overtime at 1.5x
    return overtimeHours * hourlyRate * 1.5;
  };

  const handleProcessPayroll = async () => {
    if (!user) {return;}
    if (!confirm(`هل أنت متأكد من معالجة الرواتب لشهر ${selectedMonth}؟`)) {return;}

    setLoading(true);
    try {
      const batch = writeBatch(firestore);
      const payrollRef = collection(firestore, `users/${user.uid}/payroll`);

      for (const employee of employees) {
        const overtimeHours = parseFloat(payrollData[employee.id]?.overtime || "0");
        const overtimePay = employee.overtimeEligible ? calculateOvertimePay(employee, overtimeHours) : 0;
        const totalSalary = employee.currentSalary + overtimePay;

        const payrollDocRef = doc(payrollRef);
        batch.set(payrollDocRef, {
          employeeId: employee.id,
          employeeName: employee.name,
          month: selectedMonth,
          baseSalary: employee.currentSalary,
          overtimeHours: overtimeHours,
          overtimePay: overtimePay,
          totalSalary: totalSalary,
          isPaid: false,
          notes: payrollData[employee.id]?.notes || "",
          createdAt: new Date(),
        });
      }

      await batch.commit();

      toast({
        title: "تمت المعالجة",
        description: `تم إنشاء كشف رواتب ${selectedMonth} بنجاح`,
      });

      // Reset payroll data
      setPayrollData({});
    } catch (error) {
      toast({
        title: "خطأ",
        description: "حدث خطأ أثناء معالجة الرواتب",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAsPaid = async (payrollEntry: PayrollEntry) => {
    if (!user) {return;}

    setLoading(true);
    try {
      const batch = writeBatch(firestore);

      // Generate transaction ID
      const now = new Date();
      const transactionId = `SAL-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${String(Math.floor(Math.random() * 1000)).padStart(3, '0')}`;

      // Update payroll entry
      const payrollRef = doc(firestore, `users/${user.uid}/payroll`, payrollEntry.id);
      batch.update(payrollRef, {
        isPaid: true,
        paidDate: new Date(),
        linkedTransactionId: transactionId,
      });

      // Create ledger entry
      const ledgerRef = collection(firestore, `users/${user.uid}/ledger`);
      const ledgerDocRef = doc(ledgerRef);
      batch.set(ledgerDocRef, {
        transactionId: transactionId,
        description: `راتب ${payrollEntry.employeeName} - ${payrollEntry.month}`,
        type: "مصروف",
        amount: payrollEntry.totalSalary,
        category: "مصاريف تشغيلية",
        subCategory: "رواتب وأجور",
        associatedParty: payrollEntry.employeeName,
        date: new Date(),
        reference: `Payroll-${payrollEntry.month}`,
        notes: `راتب شهر ${payrollEntry.month}${payrollEntry.overtimeHours > 0 ? ` - ساعات إضافية: ${payrollEntry.overtimeHours}` : ""}`,
        createdAt: new Date(),
      });

      // Create payment entry
      const paymentsRef = collection(firestore, `users/${user.uid}/payments`);
      const paymentDocRef = doc(paymentsRef);
      batch.set(paymentDocRef, {
        clientName: payrollEntry.employeeName,
        amount: payrollEntry.totalSalary,
        type: "صرف",
        linkedTransactionId: transactionId,
        date: new Date(),
        notes: `دفع راتب ${payrollEntry.month}`,
        createdAt: new Date(),
      });

      await batch.commit();

      toast({
        title: "تم الدفع",
        description: `تم تسجيل دفع راتب ${payrollEntry.employeeName}`,
      });
    } catch (error) {
      toast({
        title: "خطأ",
        description: "حدث خطأ أثناء تسجيل الدفع",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const monthPayroll = payrollEntries.filter(p => p.month === selectedMonth);
  const totalEmployees = employees.length;
  const totalMonthlySalaries = employees.reduce((sum, emp) => sum + emp.currentSalary, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">الموظفين والرواتب</h1>
          <p className="text-gray-600 mt-2">إدارة الموظفين والرواتب الشهرية</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-4">
          <button
            onClick={() => setActiveTab("employees")}
            className={`pb-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === "employees"
                ? "border-blue-500 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
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
            <Button onClick={openAddEmployeeDialog} className="gap-2">
              <Plus className="w-4 h-4" />
              إضافة موظف
            </Button>
          </CardHeader>
          <CardContent>
            {employees.length === 0 ? (
              <p className="text-gray-500 text-center py-12">
                لا يوجد موظفين. اضغط &quot;إضافة موظف&quot; للبدء.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>الاسم</TableHead>
                    <TableHead>المسمى الوظيفي</TableHead>
                    <TableHead>الراتب الحالي</TableHead>
                    <TableHead>الوقت الإضافي</TableHead>
                    <TableHead>تاريخ التعيين</TableHead>
                    <TableHead>الإجراءات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {employees.map((employee) => (
                    <TableRow key={employee.id}>
                      <TableCell className="font-medium">{employee.name}</TableCell>
                      <TableCell>{employee.position || "-"}</TableCell>
                      <TableCell>{employee.currentSalary} دينار</TableCell>
                      <TableCell>
                        {employee.overtimeEligible ? (
                          <span className="px-2 py-1 rounded-full text-xs bg-green-100 text-green-700">
                            مؤهل
                          </span>
                        ) : (
                          <span className="px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-700">
                            غير مؤهل
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        {new Date(employee.hireDate).toLocaleDateString("ar-EG")}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => viewSalaryHistory(employee.id)}
                          >
                            <History className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEditEmployee(employee)}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleDeleteEmployee(employee.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {/* Payroll Tab */}
      {activeTab === "payroll" && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>معالجة الرواتب الشهرية</CardTitle>
                <div className="flex items-center gap-4">
                  <Label htmlFor="month">الشهر:</Label>
                  <Input
                    id="month"
                    type="month"
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    className="w-48"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {monthPayroll.length > 0 ? (
                <div>
                  <p className="text-sm text-gray-600 mb-4">
                    تم معالجة رواتب هذا الشهر. يمكنك عرض التفاصيل أدناه.
                  </p>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>الموظف</TableHead>
                        <TableHead>الراتب الأساسي</TableHead>
                        <TableHead>ساعات إضافية</TableHead>
                        <TableHead>أجر إضافي</TableHead>
                        <TableHead>الإجمالي</TableHead>
                        <TableHead>الحالة</TableHead>
                        <TableHead>الإجراء</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {monthPayroll.map((entry) => (
                        <TableRow key={entry.id}>
                          <TableCell className="font-medium">{entry.employeeName}</TableCell>
                          <TableCell>{entry.baseSalary} دينار</TableCell>
                          <TableCell>{entry.overtimeHours} ساعة</TableCell>
                          <TableCell>{entry.overtimePay.toFixed(2)} دينار</TableCell>
                          <TableCell className="font-bold">
                            {entry.totalSalary.toFixed(2)} دينار
                          </TableCell>
                          <TableCell>
                            {entry.isPaid ? (
                              <span className="px-2 py-1 rounded-full text-xs bg-green-100 text-green-700">
                                تم الدفع
                              </span>
                            ) : (
                              <span className="px-2 py-1 rounded-full text-xs bg-orange-100 text-orange-700">
                                لم يتم الدفع
                              </span>
                            )}
                          </TableCell>
                          <TableCell>
                            {!entry.isPaid && (
                              <Button
                                size="sm"
                                onClick={() => handleMarkAsPaid(entry)}
                                disabled={loading}
                              >
                                <DollarSign className="w-4 h-4 mr-1" />
                                تسجيل دفع
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : employees.length > 0 ? (
                <div>
                  <p className="text-sm text-gray-600 mb-4">
                    أدخل ساعات العمل الإضافية (إن وجدت) لكل موظف:
                  </p>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>الموظف</TableHead>
                        <TableHead>الراتب الأساسي</TableHead>
                        <TableHead>ساعات إضافية</TableHead>
                        <TableHead>أجر إضافي</TableHead>
                        <TableHead>الإجمالي</TableHead>
                        <TableHead>ملاحظات</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {employees.map((employee) => {
                        const overtime = parseFloat(payrollData[employee.id]?.overtime || "0");
                        const overtimePay = employee.overtimeEligible
                          ? calculateOvertimePay(employee, overtime)
                          : 0;
                        const total = employee.currentSalary + overtimePay;

                        return (
                          <TableRow key={employee.id}>
                            <TableCell className="font-medium">{employee.name}</TableCell>
                            <TableCell>{employee.currentSalary} دينار</TableCell>
                            <TableCell>
                              {employee.overtimeEligible ? (
                                <Input
                                  type="number"
                                  step="0.5"
                                  value={payrollData[employee.id]?.overtime || ""}
                                  onChange={(e) =>
                                    setPayrollData({
                                      ...payrollData,
                                      [employee.id]: {
                                        ...payrollData[employee.id],
                                        overtime: e.target.value,
                                      },
                                    })
                                  }
                                  placeholder="0"
                                  className="w-24"
                                />
                              ) : (
                                <span className="text-gray-400">-</span>
                              )}
                            </TableCell>
                            <TableCell>
                              {overtimePay > 0 ? `${overtimePay.toFixed(2)} دينار` : "-"}
                            </TableCell>
                            <TableCell className="font-bold">{total.toFixed(2)} دينار</TableCell>
                            <TableCell>
                              <Input
                                value={payrollData[employee.id]?.notes || ""}
                                onChange={(e) =>
                                  setPayrollData({
                                    ...payrollData,
                                    [employee.id]: {
                                      ...payrollData[employee.id],
                                      notes: e.target.value,
                                    },
                                  })
                                }
                                placeholder="ملاحظات"
                                className="w-32"
                              />
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                  <div className="mt-4 flex justify-end">
                    <Button
                      onClick={handleProcessPayroll}
                      disabled={loading}
                      size="lg"
                      className="gap-2"
                    >
                      <DollarSign className="w-5 h-5" />
                      معالجة الرواتب
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="text-gray-500 text-center py-12">
                  لا يوجد موظفين. قم بإضافة موظفين أولاً.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Add/Edit Employee Dialog */}
      <Dialog open={isEmployeeDialogOpen} onOpenChange={setIsEmployeeDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingEmployee ? "تعديل بيانات الموظف" : "إضافة موظف جديد"}
            </DialogTitle>
            <DialogDescription>
              {editingEmployee
                ? "قم بتعديل البيانات أدناه. تغيير الراتب سيتم تسجيله تلقائياً."
                : "أدخل بيانات الموظف الجديد"}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEmployeeSubmit}>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">الاسم</Label>
                <Input
                  id="name"
                  value={employeeFormData.name}
                  onChange={(e) =>
                    setEmployeeFormData({ ...employeeFormData, name: e.target.value })
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="position">المسمى الوظيفي</Label>
                <Input
                  id="position"
                  value={employeeFormData.position}
                  onChange={(e) =>
                    setEmployeeFormData({ ...employeeFormData, position: e.target.value })
                  }
                  placeholder="مثال: عامل، مشرف، فني"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="currentSalary">الراتب الشهري (دينار)</Label>
                <Input
                  id="currentSalary"
                  type="number"
                  step="0.01"
                  value={employeeFormData.currentSalary}
                  onChange={(e) =>
                    setEmployeeFormData({
                      ...employeeFormData,
                      currentSalary: e.target.value,
                    })
                  }
                  required
                />
                {editingEmployee && parseFloat(employeeFormData.currentSalary) !== editingEmployee.currentSalary && (
                  <p className="text-sm text-blue-600">
                    التغيير: {editingEmployee.currentSalary} ← {employeeFormData.currentSalary} دينار
                    {" "}
                    ({(((parseFloat(employeeFormData.currentSalary) - editingEmployee.currentSalary) / editingEmployee.currentSalary) * 100).toFixed(2)}%)
                  </p>
                )}
              </div>
              <div className="flex items-center space-x-2 space-x-reverse">
                <input
                  type="checkbox"
                  id="overtimeEligible"
                  checked={employeeFormData.overtimeEligible}
                  onChange={(e) =>
                    setEmployeeFormData({
                      ...employeeFormData,
                      overtimeEligible: e.target.checked,
                    })
                  }
                  className="h-4 w-4 rounded border-gray-300"
                />
                <Label htmlFor="overtimeEligible" className="cursor-pointer font-normal">
                  مؤهل للوقت الإضافي (1.5x)
                </Label>
              </div>
              <div className="space-y-2">
                <Label htmlFor="hireDate">تاريخ التعيين</Label>
                <Input
                  id="hireDate"
                  type="date"
                  value={employeeFormData.hireDate}
                  onChange={(e) =>
                    setEmployeeFormData({ ...employeeFormData, hireDate: e.target.value })
                  }
                  required
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsEmployeeDialogOpen(false)}
              >
                إلغاء
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? "جاري الحفظ..." : editingEmployee ? "تحديث" : "إضافة"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Salary History Dialog */}
      <Dialog open={isHistoryDialogOpen} onOpenChange={setIsHistoryDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>سجل الرواتب</DialogTitle>
            <DialogDescription>تاريخ التغييرات على الراتب</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {selectedEmployeeHistory.length === 0 ? (
              <p className="text-gray-500 text-center py-4">لا يوجد سجل تغييرات</p>
            ) : (
              <div className="space-y-3">
                {selectedEmployeeHistory.map((history) => (
                  <div key={history.id} className="border-b pb-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium">
                          {history.oldSalary} ← {history.newSalary} دينار
                        </div>
                        <div className="text-sm text-gray-500">
                          {new Date(history.effectiveDate).toLocaleDateString("ar-EG")}
                        </div>
                      </div>
                      <div
                        className={`px-2 py-1 rounded-full text-xs ${
                          history.incrementPercentage > 0
                            ? "bg-green-100 text-green-700"
                            : "bg-red-100 text-red-700"
                        }`}
                      >
                        {history.incrementPercentage > 0 ? "+" : ""}
                        {history.incrementPercentage.toFixed(2)}%
                      </div>
                    </div>
                    {history.notes && (
                      <div className="text-sm text-gray-600 mt-1">{history.notes}</div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button onClick={() => setIsHistoryDialogOpen(false)}>إغلاق</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
