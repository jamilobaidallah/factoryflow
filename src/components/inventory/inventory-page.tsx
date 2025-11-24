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
import { Plus, Edit, Trash2, TrendingUp, TrendingDown } from "lucide-react";
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
} from "firebase/firestore";
import { firestore } from "@/firebase/config";

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
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isMovementDialogOpen, setIsMovementDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [loading, setLoading] = useState(false);

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

  useEffect(() => {
    if (!user) {return;}

    const inventoryRef = collection(firestore, `users/${user.uid}/inventory`);
    const q = query(inventoryRef, orderBy("itemName", "asc"));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const itemsData: InventoryItem[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        itemsData.push({
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(),
        } as InventoryItem);
      });
      setItems(itemsData);
    });

    return () => unsubscribe();
  }, [user]);

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
      toast({
        title: "خطأ",
        description: "حدث خطأ أثناء حفظ البيانات",
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
      toast({
        title: "خطأ",
        description: "حدث خطأ أثناء تسجيل الحركة",
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

  const handleDelete = async (itemId: string) => {
    if (!user) {return;}
    if (!confirm("هل أنت متأكد من حذف هذا العنصر؟")) {return;}

    try {
      const itemRef = doc(firestore, `users/${user.uid}/inventory`, itemId);
      await deleteDoc(itemRef);
      toast({
        title: "تم الحذف",
        description: "تم حذف العنصر من المخزون بنجاح",
      });
    } catch (error) {
      toast({
        title: "خطأ",
        description: "حدث خطأ أثناء الحذف",
        variant: "destructive",
      });
    }
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
        <Button className="gap-2" onClick={openAddDialog}>
          <Plus className="w-4 h-4" />
          إضافة عنصر للمخزون
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
      </div>

      <Card>
        <CardHeader>
          <CardTitle>سجل المخزون ({items.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {items.length === 0 ? (
            <p className="text-gray-500 text-center py-12">
              لا توجد عناصر في المخزون. اضغط على &quot;إضافة عنصر للمخزون&quot; للبدء.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>اسم العنصر</TableHead>
                  <TableHead>الفئة</TableHead>
                  <TableHead>الكمية</TableHead>
                  <TableHead>الوحدة</TableHead>
                  <TableHead>السماكة</TableHead>
                  <TableHead>العرض</TableHead>
                  <TableHead>الطول</TableHead>
                  <TableHead>سعر الوحدة</TableHead>
                  <TableHead>الموقع</TableHead>
                  <TableHead>الحالة</TableHead>
                  <TableHead>الإجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.itemName}</TableCell>
                    <TableCell>{item.category}</TableCell>
                    <TableCell>{item.quantity || 0}</TableCell>
                    <TableCell>{item.unit}</TableCell>
                    <TableCell>{item.thickness ? `${item.thickness} سم` : '-'}</TableCell>
                    <TableCell>{item.width ? `${item.width} سم` : '-'}</TableCell>
                    <TableCell>{item.length ? `${item.length} سم` : '-'}</TableCell>
                    <TableCell>{item.unitPrice || 0} دينار</TableCell>
                    <TableCell>{item.location}</TableCell>
                    <TableCell>
                      {item.quantity <= item.minStock ? (
                        <span className="px-2 py-1 rounded-full text-xs bg-red-100 text-red-700">
                          مخزون منخفض
                        </span>
                      ) : (
                        <span className="px-2 py-1 rounded-full text-xs bg-green-100 text-green-700">
                          متوفر
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleMovement(item)}
                        >
                          <TrendingUp className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEdit(item)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDelete(item.id)}
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
    </div>
  );
}
