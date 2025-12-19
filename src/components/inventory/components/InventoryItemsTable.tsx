"use client";

import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Edit, Trash2, TrendingUp } from "lucide-react";
import { PermissionGate } from "@/components/auth";
import { TableSkeleton } from "@/components/ui/loading-skeleton";
import { formatNumber } from "@/lib/date-utils";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { InventoryItem } from "../types/inventory.types";

interface InventoryItemsTableProps {
  items: InventoryItem[];
  loading: boolean;
  totalCount: number;
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onEdit: (item: InventoryItem) => void;
  onDelete: (itemId: string) => void;
  onMovement: (item: InventoryItem) => void;
}

export function InventoryItemsTable({
  items,
  loading,
  totalCount,
  currentPage,
  totalPages,
  onPageChange,
  onEdit,
  onDelete,
  onMovement,
}: InventoryItemsTableProps) {
  if (loading) {
    return <TableSkeleton rows={10} />;
  }

  if (items.length === 0) {
    return (
      <p className="text-slate-500 text-center py-12">
        لا توجد عناصر في المخزون. اضغط على &quot;إضافة عنصر للمخزون&quot; للبدء.
      </p>
    );
  }

  return (
    <>
      <div className="card-modern overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50/80 hover:bg-slate-50/80">
              <TableHead className="text-right font-semibold text-slate-700">اسم العنصر</TableHead>
              <TableHead className="text-right font-semibold text-slate-700">الفئة</TableHead>
              <TableHead className="text-right font-semibold text-slate-700">الكمية</TableHead>
              <TableHead className="text-right font-semibold text-slate-700">الوحدة</TableHead>
              <TableHead className="text-right font-semibold text-slate-700">السماكة</TableHead>
              <TableHead className="text-right font-semibold text-slate-700">العرض</TableHead>
              <TableHead className="text-right font-semibold text-slate-700">الطول</TableHead>
              <TableHead className="text-right font-semibold text-slate-700">سعر الوحدة</TableHead>
              <TableHead className="text-right font-semibold text-slate-700">الموقع</TableHead>
              <TableHead className="text-right font-semibold text-slate-700">الحالة</TableHead>
              <TableHead className="text-right font-semibold text-slate-700">الإجراءات</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
              <TableRow key={item.id} className="table-row-hover">
                <TableCell className="font-medium">{item.itemName}</TableCell>
                <TableCell>{item.category}{item.subCategory ? ` / ${item.subCategory}` : ''}</TableCell>
                <TableCell>{item.quantity || 0}</TableCell>
                <TableCell>{item.unit}</TableCell>
                <TableCell>{item.thickness ? `${item.thickness} سم` : '-'}</TableCell>
                <TableCell>{item.width ? `${item.width} سم` : '-'}</TableCell>
                <TableCell>{item.length ? `${item.length} سم` : '-'}</TableCell>
                <TableCell>
                  <span className="font-semibold text-slate-900">
                    {formatNumber(item.unitPrice || 0)} دينار
                  </span>
                </TableCell>
                <TableCell>{item.location}</TableCell>
                <TableCell>
                  {item.quantity <= item.minStock ? (
                    <span className="badge-danger">
                      مخزون منخفض
                    </span>
                  ) : (
                    <span className="badge-success">
                      متوفر
                    </span>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <PermissionGate action="update" module="inventory">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-slate-400 hover:text-green-600 hover:bg-green-50"
                        onClick={() => onMovement(item)}
                      >
                        <TrendingUp className="h-4 w-4" />
                      </Button>
                    </PermissionGate>
                    <PermissionGate action="update" module="inventory">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                        onClick={() => onEdit(item)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                    </PermissionGate>
                    <PermissionGate action="delete" module="inventory">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-slate-400 hover:text-red-600 hover:bg-red-50"
                        onClick={() => onDelete(item.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </PermissionGate>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            عرض {items.length} من {totalCount} عنصر
          </div>
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    if (currentPage < totalPages) { onPageChange(currentPage + 1); }
                  }}
                  className={currentPage >= totalPages ? "pointer-events-none opacity-50" : ""}
                />
              </PaginationItem>

              {[...Array(Math.min(5, totalPages))].map((_, i) => {
                const pageNum = i + 1;
                return (
                  <PaginationItem key={pageNum}>
                    <PaginationLink
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        onPageChange(pageNum);
                      }}
                      isActive={currentPage === pageNum}
                    >
                      {pageNum}
                    </PaginationLink>
                  </PaginationItem>
                );
              })}

              <PaginationItem>
                <PaginationNext
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    if (currentPage > 1) { onPageChange(currentPage - 1); }
                  }}
                  className={currentPage <= 1 ? "pointer-events-none opacity-50" : ""}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}
    </>
  );
}
