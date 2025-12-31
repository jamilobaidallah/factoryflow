"use client";

import { useState, useMemo } from "react";
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
import { Edit, Trash2, History, Search, ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";
import { PermissionGate } from "@/components/auth";
import { Employee } from "../types/employees";
import { formatShortDate, formatNumber } from "@/lib/date-utils";

type SortField = "name" | "currentSalary" | "hireDate";
type SortDirection = "asc" | "desc";

interface EmployeesTableProps {
  employees: Employee[];
  onEdit: (employee: Employee) => void;
  onDelete: (employeeId: string) => void;
  onViewHistory: (employeeId: string) => void;
}

export function EmployeesTable({
  employees,
  onEdit,
  onDelete,
  onViewHistory,
}: EmployeesTableProps) {
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

      {/* Table */}
      <div className="card-modern overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50/80 hover:bg-slate-50/80">
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
                <TableHead className="text-right font-semibold text-slate-700">
                  الإجراءات
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedEmployees.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-slate-500">
                    لا توجد نتائج مطابقة للبحث
                  </TableCell>
                </TableRow>
              ) : (
                paginatedEmployees.map((employee) => (
                  <TableRow key={employee.id} className="table-row-hover">
                    <TableCell>
                      <div>
                        <span className="font-medium">{employee.name}</span>
                        <span className="block sm:hidden text-xs text-slate-500">
                          {employee.position || ""}
                        </span>
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
                    <TableCell className="hidden md:table-cell">
                      {employee.overtimeEligible ? (
                        <span className="badge-success" role="status">
                          مؤهل
                        </span>
                      ) : (
                        <span className="badge-neutral" role="status">
                          غير مؤهل
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      {formatShortDate(employee.hireDate)}
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
