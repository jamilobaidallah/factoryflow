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
import { Plus, Edit, Trash2, TrendingUp, TrendingDown, Download } from "lucide-react";
import { PermissionGate } from "@/components/auth";
import { useConfirmation } from "@/components/ui/confirmation-dialog";
import { StatCardSkeleton, TableSkeleton } from "@/components/ui/loading-skeleton";
import { useUser } from "@/firebase/provider";
import { useToast } from "@/hooks/use-toast";
import { handleError, getErrorTitle } from "@/lib/error-handling";
import { exportInventoryToExcel } from "@/lib/export-utils";
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  orderBy,
  limit,
  getCountFromServer,
} from "firebase/firestore";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { firestore } from "@/firebase/config";
import { convertFirestoreDates } from "@/lib/firestore-utils";

interface InventoryItem {
  id: string;
  itemName: string;
  category: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  minStock: number;
  location: string;
  notes: string;
  thickness?: number;
  width?: number;
  length?: number;
  createdAt: Date;
  // Weighted Average Cost tracking (optional fields)
  lastPurchasePrice?: number;
  lastPurchaseDate?: Date;
  lastPurchaseAmount?: number;
}

export default function InventoryPage() {
  const { user } = useUser();
  const { toast } = useToast();
  const { confirm, dialog: confirmationDialog } = useConfirmation();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isMovementDialogOpen, setIsMovementDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [loading, setLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(true);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(50);
  const [totalCount, setTotalCount] = useState(0);
  const totalPages = Math.ceil(totalCount / pageSize);

  const [formData, setFormData] = useState({
    itemName: "",
    category: "",
    quantity: "",
    unit: "كجم",
    unitPrice: "",
    minStock: "0",
    location: "",
    notes: "",
    thickness: "",
    width: "",
    length: "",
  });

  const [movementData, setMovementData] = useState({
    type: "دخول",
    quantity: "",
    linkedTransactionId: "",
    notes: "",
  });

  // Fetch total count
  useEffect(() => {
    if (!user) { return; }

    const inventoryRef = collection(firestore, `users/${user.uid}/inventory`);
    getCountFromServer(query(inventoryRef)).then((snapshot) => {
      setTotalCount(snapshot.data().count);
    });
  }, [user]);

  // Fetch inventory items with pagination
  useEffect(() => {
    if (!user) {return;}

    const inventoryRef = collection(firestore, `users/${user.uid}/inventory`);
    const q = query(inventoryRef, orderBy("itemName", "asc"), limit(pageSize));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const itemsData: InventoryItem[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        itemsData.push({
          id: doc.id,
          ...convertFirestoreDates(data),
        } as InventoryItem);
      });
      setItems(itemsData);
      setDataLoading(false);
    });

    return () => unsubscribe();
  }, [user, pageSize, currentPage]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {return;}

    setLoading(true);
    try {
      if (editingItem) {
        const itemRef = doc(firestore, `users/${user.uid}/inventory`, editingItem.id);
        await updateDoc(itemRef, {
          itemName: formData.itemName,
          category: formData.category,
          quantity: parseFloat(formData.quantity),
          unit: formData.unit,
          unitPrice: parseFloat(formData.unitPrice),
          minStock: parseFloat(formData.minStock),
          location: formData.location,
          notes: formData.notes,
          thickness: formData.thickness ? parseFloat(formData.thickness) : null,
          width: formData.width ? parseFloat(formData.width) : null,
          length: formData.length ? parseFloat(formData.length) : null,
        });
        toast({
          title: "تم التحديث بنجاح",
          description: "تم تحديث بيانات العنصر",
        });
      } else {
        const inventoryRef = collection(firestore, `users/${user.uid}/inventory`);
        await addDoc(inventoryRef, {
          itemName: formData.itemName,
          category: formData.category,
          quantity: parseFloat(formData.quantity),
          unit: formData.unit,
          unitPrice: parseFloat(formData.unitPrice),
          minStock: parseFloat(formData.minStock),
          location: formData.location,
          notes: formData.notes,
          thickness: formData.thickness ? parseFloat(formData.thickness) : null,
          width: formData.width ? parseFloat(formData.width) : null,
          length: formData.length ? parseFloat(formData.length) : null,
          createdAt: new Date(),
        });
        toast({
          title: "تمت الإضافة بنجاح",
          description: "تم إضافة عنصر جديد للمخزون",
        });
      }

      resetForm();
      setIsDialogOpen(false);
    } catch (error) {
      const appError = handleError(error);
      toast({
        title: getErrorTitle(appError),
        description: appError.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleMovementSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedItem) {return;}

    setLoading(true);
    try {
      const itemRef = doc(firestore, `users/${user.uid}/inventory`, selectedItem.id);
      const movementQty = parseFloat(movementData.quantity);
      const newQuantity = movementData.type === "دخول"
        ? selectedItem.quantity + movementQty
        : selectedItem.quantity - movementQty;

      if (newQuantity < 0) {
        toast({
          title: "خطأ",
          description: "الكمية غير كافية في المخزون",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      await updateDoc(itemRef, {
        quantity: newQuantity,
      });

      // Log the movement
      const movementsRef = collection(firestore, `users/${user.uid}/inventory_movements`);
      await addDoc(movementsRef, {
        itemId: selectedItem.id,
        itemName: selectedItem.itemName,
        type: movementData.type,
        quantity: movementQty,
        linkedTransactionId: movementData.linkedTransactionId,
        notes: movementData.notes,
        createdAt: new Date(),
      });

      toast({
        title: "تمت العملية بنجاح",
        description: `تم تسجيل ${movementData.type} ${movementQty} ${selectedItem.unit}`,
      });

      setIsMovementDialogOpen(false);
      setSelectedItem(null);
      setMovementData({ type: "دخول", quantity: "", linkedTransactionId: "", notes: "" });
    } catch (error) {
      const appError = handleError(error);
      toast({
        title: getErrorTitle(appError),
        description: appError.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (item: InventoryItem) => {
    setEditingItem(item);
    setFormData({
      itemName: item.itemName || "",
      category: item.category || "",
      quantity: (item.quantity || 0).toString(),
      unit: item.unit || "كجم",
      unitPrice: (item.unitPrice || 0).toString(),
      minStock: (item.minStock || 0).toString(),
      location: item.location || "",
      notes: item.notes || "",
      thickness: (item.thickness || "").toString(),
      width: (item.width || "").toString(),
      length: (item.length || "").toString(),
    });
    setIsDialogOpen(true);
  };

  const handleMovement = (item: InventoryItem) => {
    setSelectedItem(item);
    setMovementData({ type: "دخول", quantity: "", linkedTransactionId: "", notes: "" });
    setIsMovementDialogOpen(true);
  };

  const handleDelete = (itemId: string) => {
    if (!user) {return;}

    confirm(
      "حذف العنصر",
      "هل أنت متأكد من حذف هذا العنصر من المخزون؟ لا يمكن التراجع عن هذا الإجراء.",
      async () => {
        try {
          const itemRef = doc(firestore, `users/${user.uid}/inventory`, itemId);
          await deleteDoc(itemRef);
          toast({
            title: "تم الحذف",
            description: "تم حذف العنصر من المخزون بنجاح",
          });
        } catch (error) {
          const appError = handleError(error);
          toast({
            title: getErrorTitle(appError),
            description: appError.message,
            variant: "destructive",
          });
        }
      },
      "destructive"
    );
  };

  const resetForm = () => {
    setFormData({
      itemName: "",
      category: "",
      quantity: "",
      unit: "كجم",
      unitPrice: "",
      minStock: "0",
      location: "",
      notes: "",
      thickness: "",
      width: "",
      length: "",
    });
    setEditingItem(null);
  };

  const openAddDialog = () => {
    resetForm();
    setIsDialogOpen(true);
  };

  const totalItems = items.length;
  const lowStockItems = items.filter(item => {
    const minStock = item.minStock || 0;
    return minStock > 0 && item.quantity <= minStock;
  }).length;
  const totalValue = items.reduce((sum, item) => {
    const quantity = item.quantity || 0;
    const unitPrice = item.unitPrice || 0;
    return sum + (quantity * unitPrice);
  }, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">المخزون</h1>
          <p className="text-gray-600 mt-2">تتبع حركة المواد (دخول/خروج)</p>
        </div>
        <PermissionGate action="create" module="inventory">
          <Button className="gap-2" onClick={openAddDialog}>
            <Plus className="w-4 h-4" />
            إضافة عنصر للمخزون
          </Button>
        </PermissionGate>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {dataLoading ? (
          <>
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
          </>
        ) : (
          <>
            <Card>
              <CardHeader>
                <CardTitle>إجمالي العناصر</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-blue-600">
                  {totalItems}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>عناصر منخفضة المخزون</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-orange-600">
                  {lowStockItems}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>القيمة الإجمالية</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-green-600">
                  {totalValue.toFixed(2)} دينار
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-800">سجل المخزون ({items.length})</h2>
          {items.length > 0 && (
            <PermissionGate action="export" module="inventory">
              <Button
                variant="outline"
                size="sm"
                onClick={() => exportInventoryToExcel(items, `المخزون_${new Date().toISOString().split('T')[0]}`)}
              >
                <Download className="w-4 h-4 ml-2" />
                Excel
              </Button>
            </PermissionGate>
          )}
        </div>
        {dataLoading ? (
          <TableSkeleton rows={10} />
        ) : items.length === 0 ? (
          <p className="text-slate-500 text-center py-12">
            لا توجد عناصر في المخزون. اضغط على &quot;إضافة عنصر للمخزون&quot; للبدء.
          </p>
        ) : (
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
                    <TableCell>{item.category}</TableCell>
                    <TableCell>{item.quantity || 0}</TableCell>
                    <TableCell>{item.unit}</TableCell>
                    <TableCell>{item.thickness ? `${item.thickness} سم` : '-'}</TableCell>
                    <TableCell>{item.width ? `${item.width} سم` : '-'}</TableCell>
                    <TableCell>{item.length ? `${item.length} سم` : '-'}</TableCell>
                    <TableCell>
                      <span className="font-semibold text-slate-900">
                        {(item.unitPrice || 0).toLocaleString()} دينار
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
                            onClick={() => handleMovement(item)}
                          >
                            <TrendingUp className="h-4 w-4" />
                          </Button>
                        </PermissionGate>
                        <PermissionGate action="update" module="inventory">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                            onClick={() => handleEdit(item)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        </PermissionGate>
                        <PermissionGate action="delete" module="inventory">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-slate-400 hover:text-red-600 hover:bg-red-50"
                            onClick={() => handleDelete(item.id)}
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
        )}

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
                      if (currentPage < totalPages) { setCurrentPage(currentPage + 1); }
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
                          setCurrentPage(pageNum);
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
                      if (currentPage > 1) { setCurrentPage(currentPage - 1); }
                    }}
                    className={currentPage <= 1 ? "pointer-events-none opacity-50" : ""}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        )}
      </div>

      {/* Add/Edit Item Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingItem ? "تعديل عنصر المخزون" : "إضافة عنصر جديد"}
            </DialogTitle>
            <DialogDescription>
              {editingItem
                ? "قم بتعديل بيانات العنصر أدناه"
                : "أدخل بيانات العنصر الجديد أدناه"}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="itemName">اسم العنصر</Label>
                <Input
                  id="itemName"
                  value={formData.itemName}
                  onChange={(e) =>
                    setFormData({ ...formData, itemName: e.target.value })
                  }
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="category">الفئة</Label>
                  <Input
                    id="category"
                    value={formData.category}
                    onChange={(e) =>
                      setFormData({ ...formData, category: e.target.value })
                    }
                    placeholder="مثال: مواد خام، منتجات"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="location">الموقع</Label>
                  <Input
                    id="location"
                    value={formData.location}
                    onChange={(e) =>
                      setFormData({ ...formData, location: e.target.value })
                    }
                    placeholder="مثال: مخزن A، رف 1"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="quantity">الكمية</Label>
                  <Input
                    id="quantity"
                    type="number"
                    step="0.01"
                    value={formData.quantity}
                    onChange={(e) =>
                      setFormData({ ...formData, quantity: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="unit">الوحدة</Label>
                  <select
                    id="unit"
                    value={formData.unit}
                    onChange={(e) =>
                      setFormData({ ...formData, unit: e.target.value })
                    }
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    required
                  >
                    <option value="">اختر الوحدة</option>
                    <option value="م">م (متر)</option>
                    <option value="م²">م² (متر مربع)</option>
                    <option value="قطعة">قطعة</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="unitPrice">سعر الوحدة (دينار)</Label>
                  <Input
                    id="unitPrice"
                    type="number"
                    step="0.01"
                    value={formData.unitPrice}
                    onChange={(e) =>
                      setFormData({ ...formData, unitPrice: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="minStock">الحد الأدنى للمخزون</Label>
                  <Input
                    id="minStock"
                    type="number"
                    step="0.01"
                    value={formData.minStock}
                    onChange={(e) =>
                      setFormData({ ...formData, minStock: e.target.value })
                    }
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>الأبعاد (اختياري)</Label>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="thickness" className="text-xs">السماكة (سم)</Label>
                    <Input
                      id="thickness"
                      type="number"
                      step="0.01"
                      value={formData.thickness}
                      onChange={(e) =>
                        setFormData({ ...formData, thickness: e.target.value })
                      }
                      placeholder="سم"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="width" className="text-xs">العرض (سم)</Label>
                    <Input
                      id="width"
                      type="number"
                      step="0.01"
                      value={formData.width}
                      onChange={(e) =>
                        setFormData({ ...formData, width: e.target.value })
                      }
                      placeholder="سم"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="length" className="text-xs">الطول (سم)</Label>
                    <Input
                      id="length"
                      type="number"
                      step="0.01"
                      value={formData.length}
                      onChange={(e) =>
                        setFormData({ ...formData, length: e.target.value })
                      }
                      placeholder="سم"
                    />
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes">ملاحظات</Label>
                <Input
                  id="notes"
                  value={formData.notes}
                  onChange={(e) =>
                    setFormData({ ...formData, notes: e.target.value })
                  }
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsDialogOpen(false)}
              >
                إلغاء
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? "جاري الحفظ..." : editingItem ? "تحديث" : "إضافة"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Movement Dialog */}
      <Dialog open={isMovementDialogOpen} onOpenChange={setIsMovementDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>تسجيل حركة مخزون</DialogTitle>
            <DialogDescription>
              {selectedItem && `العنصر: ${selectedItem.itemName} - الكمية الحالية: ${selectedItem.quantity} ${selectedItem.unit}`}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleMovementSubmit}>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="movementType">نوع الحركة</Label>
                <select
                  id="movementType"
                  value={movementData.type}
                  onChange={(e) =>
                    setMovementData({ ...movementData, type: e.target.value })
                  }
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  required
                >
                  <option value="دخول">دخول</option>
                  <option value="خروج">خروج</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="movementQuantity">الكمية</Label>
                <Input
                  id="movementQuantity"
                  type="number"
                  step="0.01"
                  value={movementData.quantity}
                  onChange={(e) =>
                    setMovementData({ ...movementData, quantity: e.target.value })
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="linkedTransactionId">رقم المعاملة المرتبطة (اختياري)</Label>
                <Input
                  id="linkedTransactionId"
                  value={movementData.linkedTransactionId}
                  onChange={(e) =>
                    setMovementData({ ...movementData, linkedTransactionId: e.target.value })
                  }
                  placeholder="TXN-20250109-123456-789"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="movementNotes">ملاحظات</Label>
                <Input
                  id="movementNotes"
                  value={movementData.notes}
                  onChange={(e) =>
                    setMovementData({ ...movementData, notes: e.target.value })
                  }
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsMovementDialogOpen(false)}
              >
                إلغاء
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? "جاري التسجيل..." : "تسجيل"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {confirmationDialog}
    </div>
  );
}
