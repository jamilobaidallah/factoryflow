"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Edit, Trash2, History, Search, ChevronUp, ChevronDown, ChevronsUpDown, MoreVertical, Wallet, Calendar, Clock } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PermissionGate } from "@/components/auth";
import { Employee } from "../types/employees";
import { formatShortDate, formatNumber } from "@/lib/date-utils";
import { EmployeeBalanceDisplay } from "./EmployeeBalanceDisplay";
import { safeSubtract } from "@/lib/currency";

type SortField = "name" | "currentSalary" | "hireDate";
type SortDirection = "asc" | "desc";

interface EmployeesTableProps {
  employees: Employee[];
  onEdit: (employee: Employee) => void;
  onDelete: (employeeId: string) => void;
  onViewHistory: (employeeId: string) => void;
  getEmployeeUnpaidSalaries: (employeeId: string) => number;
  getEmployeeOutstandingAdvances: (employeeId: string) => number;
}

export function EmployeesTable({
  employees,
  onEdit,
  onDelete,
  onViewHistory,
  getEmployeeUnpaidSalaries,
  getEmployeeOutstandingAdvances,
}: EmployeesTableProps) {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState("");
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  // Filter employees by search term
  const filteredEmployees = useMemo(() => {
    if (!searchTerm.trim()) return employees;
    const term = searchTerm.toLowerCase();
    return employees.filter(
      (emp) =>
        emp.name.toLowerCase().includes(term) ||
        (emp.position && emp.position.toLowerCase().includes(term))
    );
  }, [employees, searchTerm]);

  // Sort employees
  const sortedEmployees = useMemo(() => {
    if (!sortField) return filteredEmployees;

    return [...filteredEmployees].sort((a, b) => {
      let comparison = 0;

      switch (sortField) {
        case "name":
          comparison = a.name.localeCompare(b.name, "ar");
          break;
        case "currentSalary":
          comparison = a.currentSalary - b.currentSalary;
          break;
        case "hireDate":
          const dateA = a.hireDate instanceof Date ? a.hireDate : new Date(a.hireDate);
          const dateB = b.hireDate instanceof Date ? b.hireDate : new Date(b.hireDate);
          comparison = dateA.getTime() - dateB.getTime();
          break;
      }

      return sortDirection === "asc" ? comparison : -comparison;
    });
  }, [filteredEmployees, sortField, sortDirection]);

  // Paginate
  const totalPages = Math.ceil(sortedEmployees.length / pageSize);
  const paginatedEmployees = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedEmployees.slice(start, start + pageSize);
  }, [sortedEmployees, currentPage, pageSize]);

  // Reset to page 1 when search changes
  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
    setCurrentPage(1);
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return <ChevronsUpDown className="h-4 w-4 text-slate-300" />;
    }
    return sortDirection === "asc" ? (
      <ChevronUp className="h-4 w-4 text-blue-600" />
    ) : (
      <ChevronDown className="h-4 w-4 text-blue-600" />
    );
  };

  if (employees.length === 0) {
    return (
      <p className="text-slate-500 text-center py-12">
        لا يوجد موظفين. اضغط &quot;إضافة موظف&quot; للبدء.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search and Page Size */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="relative w-full sm:w-64">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            type="text"
            placeholder="بحث بالاسم أو المسمى..."
            value={searchTerm}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pr-10"
          />
        </div>
        <div className="flex items-center gap-2 text-sm text-slate-600">
          <span>عرض</span>
          <Select
            value={pageSize.toString()}
            onValueChange={(value) => {
              setPageSize(parseInt(value));
              setCurrentPage(1);
            }}
          >
            <SelectTrigger className="w-20">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="10">10</SelectItem>
              <SelectItem value="20">20</SelectItem>
              <SelectItem value="50">50</SelectItem>
            </SelectContent>
          </Select>
          <span>سجل</span>
        </div>
      </div>

      {/* Results count */}
      {searchTerm && (
        <p className="text-sm text-slate-500">
          تم العثور على {filteredEmployees.length} نتيجة
        </p>
      )}

      {/* Mobile Cards - shown only on small screens */}
      <div className="md:hidden space-y-3">
        {paginatedEmployees.length === 0 ? (
          <p className="text-center py-8 text-slate-500">لا توجد نتائج مطابقة للبحث</p>
        ) : (
          paginatedEmployees.map((employee) => {
            const unpaidSalaries = getEmployeeUnpaidSalaries(employee.id);
            const outstandingAdvances = getEmployeeOutstandingAdvances(employee.id);
            const netBalance = safeSubtract(unpaidSalaries, outstandingAdvances);

            return (
              <div
                key={employee.id}
                className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <button
                      onClick={() => router.push(`/employees/${employee.id}`)}
                      className="font-semibold text-primary-600 hover:text-primary-700 hover:underline text-right"
                    >
                      {employee.name}
                    </button>
                    <p className="text-sm text-slate-500">{employee.position || "موظف"}</p>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => onViewHistory(employee.id)}>
                        <History className="h-4 w-4 ml-2" />
                        سجل الرواتب
                      </DropdownMenuItem>
                      <PermissionGate action="update" module="employees">
                        <DropdownMenuItem onClick={() => onEdit(employee)}>
                          <Edit className="h-4 w-4 ml-2" />
                          تعديل
                        </DropdownMenuItem>
                      </PermissionGate>
                      <PermissionGate action="delete" module="employees">
                        <DropdownMenuItem
                          onClick={() => onDelete(employee.id)}
                          className="text-danger-600"
                        >
                          <Trash2 className="h-4 w-4 ml-2" />
                          حذف
                        </DropdownMenuItem>
                      </PermissionGate>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                {/* Info Grid */}
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="flex items-center gap-2">
                    <Wallet className="h-4 w-4 text-slate-400" />
                    <div>
                      <span className="text-slate-500">الراتب:</span>
                      <span className="font-semibold text-slate-900 mr-1">
                        {formatNumber(employee.currentSalary)}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-slate-400" />
                    <div>
                      <span className="text-slate-500">إضافي:</span>
                      <span className={`font-medium mr-1 ${employee.overtimeEligible ? "text-success-600" : "text-slate-400"}`}>
                        {employee.overtimeEligible ? "مؤهل" : "غير مؤهل"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Balance and Status */}
                <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between">
                  <EmployeeBalanceDisplay
                    unpaidSalaries={unpaidSalaries}
                    outstandingAdvances={outstandingAdvances}
                    netBalance={netBalance}
                    size="sm"
                  />
                  <div className="flex flex-wrap gap-1">
                    {unpaidSalaries > 0 && (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-warning-100 text-warning-700">
                        راتب معلق
                      </span>
                    )}
                    {outstandingAdvances > 0 && (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-danger-100 text-danger-700">
                        سلفة نشطة
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Table - hidden on mobile */}
      <div className="card-modern overflow-hidden hidden md:block">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader sticky className="bg-slate-50">
              <TableRow className="hover:bg-transparent">
                <TableHead className="text-right font-semibold text-slate-700">
                  <button
                    onClick={() => handleSort("name")}
                    className="flex items-center gap-1 hover:text-blue-600 transition-colors"
                  >
                    الاسم
                    <SortIcon field="name" />
                  </button>
                </TableHead>
                <TableHead className="text-right font-semibold text-slate-700 hidden sm:table-cell">
                  المسمى الوظيفي
                </TableHead>
                <TableHead className="text-right font-semibold text-slate-700">
                  <button
                    onClick={() => handleSort("currentSalary")}
                    className="flex items-center gap-1 hover:text-blue-600 transition-colors"
                  >
                    الراتب
                    <SortIcon field="currentSalary" />
                  </button>
                </TableHead>
                <TableHead className="text-right font-semibold text-slate-700 hidden sm:table-cell">
                  الرصيد
                </TableHead>
                <TableHead className="text-right font-semibold text-slate-700 hidden md:table-cell">
                  الوقت الإضافي
                </TableHead>
                <TableHead className="text-right font-semibold text-slate-700 hidden lg:table-cell">
                  <button
                    onClick={() => handleSort("hireDate")}
                    className="flex items-center gap-1 hover:text-blue-600 transition-colors"
                  >
                    تاريخ التعيين
                    <SortIcon field="hireDate" />
                  </button>
                </TableHead>
                <TableHead className="text-right font-semibold text-slate-700 hidden xl:table-cell">
                  الحالة
                </TableHead>
                <TableHead className="text-right font-semibold text-slate-700">
                  الإجراءات
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedEmployees.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-slate-500">
                    لا توجد نتائج مطابقة للبحث
                  </TableCell>
                </TableRow>
              ) : (
                paginatedEmployees.map((employee) => (
                  <TableRow key={employee.id} className="table-row-hover">
                    <TableCell>
                      <div>
                        <button
                          onClick={() => router.push(`/employees/${employee.id}`)}
                          className="font-medium text-primary-600 hover:text-primary-700 hover:underline text-right"
                        >
                          {employee.name}
                        </button>
                        <span className="block sm:hidden text-xs text-slate-500">
                          {employee.position || ""}
                        </span>
                        {/* Status indicators on mobile */}
                        <div className="flex flex-wrap gap-1 mt-1 sm:hidden">
                          {getEmployeeUnpaidSalaries(employee.id) > 0 && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-warning-100 text-warning-700">
                              راتب معلق
                            </span>
                          )}
                          {getEmployeeOutstandingAdvances(employee.id) > 0 && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-danger-100 text-danger-700">
                              سلفة نشطة
                            </span>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      {employee.position || "-"}
                    </TableCell>
                    <TableCell>
                      <span className="font-semibold text-slate-900">
                        {formatNumber(employee.currentSalary)}
                      </span>
                      <span className="hidden sm:inline"> دينار</span>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      {(() => {
                        const unpaidSalaries = getEmployeeUnpaidSalaries(employee.id);
                        const outstandingAdvances = getEmployeeOutstandingAdvances(employee.id);
                        const netBalance = safeSubtract(unpaidSalaries, outstandingAdvances);
                        return (
                          <EmployeeBalanceDisplay
                            unpaidSalaries={unpaidSalaries}
                            outstandingAdvances={outstandingAdvances}
                            netBalance={netBalance}
                            size="sm"
                          />
                        );
                      })()}
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {employee.overtimeEligible ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-success-100 text-success-700" role="status">
                          مؤهل
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600" role="status">
                          غير مؤهل
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      {formatShortDate(employee.hireDate)}
                    </TableCell>
                    <TableCell className="hidden xl:table-cell">
                      <div className="flex flex-wrap gap-1">
                        {getEmployeeUnpaidSalaries(employee.id) > 0 && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-warning-100 text-warning-700">
                            راتب معلق
                          </span>
                        )}
                        {getEmployeeOutstandingAdvances(employee.id) > 0 && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-danger-100 text-danger-700">
                            سلفة نشطة
                          </span>
                        )}
                        {getEmployeeUnpaidSalaries(employee.id) === 0 && getEmployeeOutstandingAdvances(employee.id) === 0 && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-500">
                            لا توجد مستحقات
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1" role="group">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-slate-400 hover:text-blue-600 hover:bg-blue-50"
                          onClick={() => onViewHistory(employee.id)}
                          aria-label={`عرض سجل رواتب ${employee.name}`}
                        >
                          <History className="h-4 w-4" aria-hidden="true" />
                        </Button>
                        <PermissionGate action="update" module="employees">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                            onClick={() => onEdit(employee)}
                            aria-label={`تعديل ${employee.name}`}
                          >
                            <Edit className="h-4 w-4" aria-hidden="true" />
                          </Button>
                        </PermissionGate>
                        <PermissionGate action="delete" module="employees">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-slate-400 hover:text-red-600 hover:bg-red-50"
                            onClick={() => onDelete(employee.id)}
                            aria-label={`حذف ${employee.name}`}
                          >
                            <Trash2 className="h-4 w-4" aria-hidden="true" />
                          </Button>
                        </PermissionGate>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-sm">
          <p className="text-slate-500">
            عرض {(currentPage - 1) * pageSize + 1} - {Math.min(currentPage * pageSize, sortedEmployees.length)} من {sortedEmployees.length}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              السابق
            </Button>
            <span className="px-3 py-1 text-slate-600">
              {currentPage} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
            >
              التالي
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
