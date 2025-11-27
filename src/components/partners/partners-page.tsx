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
import { Plus, Edit, Trash2, Users } from "lucide-react";
import { useConfirmation } from "@/components/ui/confirmation-dialog";
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
  limit,
} from "firebase/firestore";
import { firestore } from "@/firebase/config";
import PartnersEquityReport from "./partners-equity-report";

interface Partner {
  id: string;
  name: string;
  ownershipPercentage: number;
  phone: string;
  email: string;
  initialInvestment: number;
  joinDate: Date;
  active: boolean;
}

export default function PartnersPage() {
  const { user } = useUser();
  const { toast } = useToast();
  const { confirm, dialog: confirmationDialog } = useConfirmation();
  const [partners, setPartners] = useState<Partner[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingPartner, setEditingPartner] = useState<Partner | null>(null);
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    ownershipPercentage: "50",
    phone: "",
    email: "",
    initialInvestment: "0",
    active: true,
  });

  // Real-time data fetching
  useEffect(() => {
    if (!user) {return;}

    const partnersRef = collection(firestore, `users/${user.uid}/partners`);
    // Limit to 100 partners (reasonable for most businesses)
    const q = query(partnersRef, orderBy("name", "asc"), limit(100));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const partnersData: Partner[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        partnersData.push({
          id: doc.id,
          ...data,
          joinDate: data.joinDate?.toDate ? data.joinDate.toDate() : new Date(),
        } as Partner);
      });
      setPartners(partnersData);
    });

    return () => unsubscribe();
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {return;}

    // Validate ownership percentage
    const newPercentage = parseFloat(formData.ownershipPercentage);
    const totalPercentage = partners
      .filter((p) => p.active && (!editingPartner || p.id !== editingPartner.id))
      .reduce((sum, p) => sum + p.ownershipPercentage, 0);

    if (totalPercentage + newPercentage > 100) {
      toast({
        title: "خطأ في النسبة",
        description: `مجموع نسب الشراكة سيتجاوز 100%. النسبة المتاحة: ${(100 - totalPercentage).toFixed(2)}%`,
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      if (editingPartner) {
        // Update existing partner
        const partnerRef = doc(firestore, `users/${user.uid}/partners`, editingPartner.id);
        await updateDoc(partnerRef, {
          name: formData.name,
          ownershipPercentage: parseFloat(formData.ownershipPercentage),
          phone: formData.phone,
          email: formData.email,
          initialInvestment: parseFloat(formData.initialInvestment),
          active: formData.active,
        });
        toast({
          title: "تم التحديث بنجاح",
          description: "تم تحديث بيانات الشريك",
        });
      } else {
        // Add new partner
        const partnersRef = collection(firestore, `users/${user.uid}/partners`);
        await addDoc(partnersRef, {
          name: formData.name,
          ownershipPercentage: parseFloat(formData.ownershipPercentage),
          phone: formData.phone,
          email: formData.email,
          initialInvestment: parseFloat(formData.initialInvestment),
          joinDate: new Date(),
          active: true,
        });
        toast({
          title: "تمت الإضافة بنجاح",
          description: "تم إضافة شريك جديد",
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

  const handleEdit = (partner: Partner) => {
    setEditingPartner(partner);
    setFormData({
      name: partner.name || "",
      ownershipPercentage: (partner.ownershipPercentage || 0).toString(),
      phone: partner.phone || "",
      email: partner.email || "",
      initialInvestment: (partner.initialInvestment || 0).toString(),
      active: partner.active !== false,
    });
    setIsDialogOpen(true);
  };

  const handleDelete = (partnerId: string) => {
    if (!user) {return;}

    confirm(
      "حذف الشريك",
      "هل أنت متأكد من حذف هذا الشريك؟ لا يمكن التراجع عن هذا الإجراء.",
      async () => {
        try {
          const partnerRef = doc(firestore, `users/${user.uid}/partners`, partnerId);
          await deleteDoc(partnerRef);
          toast({
            title: "تم الحذف",
            description: "تم حذف الشريك بنجاح",
          });
        } catch (error) {
          toast({
            title: "خطأ",
            description: "حدث خطأ أثناء الحذف",
            variant: "destructive",
          });
        }
      },
      "destructive"
    );
  };

  const resetForm = () => {
    setFormData({
      name: "",
      ownershipPercentage: "50",
      phone: "",
      email: "",
      initialInvestment: "0",
      active: true,
    });
    setEditingPartner(null);
  };

  const openAddDialog = () => {
    resetForm();
    setIsDialogOpen(true);
  };

  const totalOwnership = partners
    .filter((p) => p.active)
    .reduce((sum, p) => sum + p.ownershipPercentage, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">إدارة الشركاء</h1>
          <p className="text-gray-600 mt-2">إضافة وتتبع معلومات الشركاء والملاك</p>
        </div>
        <Button className="gap-2" onClick={openAddDialog}>
          <Plus className="w-4 h-4" />
          إضافة شريك جديد
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">
              عدد الشركاء
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-600" />
              <span className="text-2xl font-bold text-gray-900">
                {partners.filter((p) => p.active).length}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">
              مجموع نسب الملكية
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              <span
                className={
                  totalOwnership === 100
                    ? "text-green-600"
                    : totalOwnership < 100
                    ? "text-orange-600"
                    : "text-red-600"
                }
              >
                {totalOwnership.toFixed(2)}%
              </span>
            </div>
            {totalOwnership !== 100 && (
              <p className="text-xs text-gray-500 mt-1">
                {totalOwnership < 100 ? "متبقي" : "زيادة"}:{" "}
                {Math.abs(100 - totalOwnership).toFixed(2)}%
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">
              رأس المال الأولي
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {partners
                .filter((p) => p.active)
                .reduce((sum, p) => sum + (p.initialInvestment || 0), 0)
                .toFixed(2)}{" "}
              د.أ
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Partners Equity Report */}
      <PartnersEquityReport />

      <Card>
        <CardHeader>
          <CardTitle>قائمة الشركاء ({partners.filter((p) => p.active).length})</CardTitle>
        </CardHeader>
        <CardContent>
          {partners.length === 0 ? (
            <p className="text-gray-500 text-center py-12">
              لا يوجد شركاء حالياً. اضغط على &quot;إضافة شريك جديد&quot; للبدء.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>الاسم</TableHead>
                  <TableHead>نسبة الملكية</TableHead>
                  <TableHead>الاستثمار الأولي</TableHead>
                  <TableHead>الهاتف</TableHead>
                  <TableHead>البريد الإلكتروني</TableHead>
                  <TableHead>الحالة</TableHead>
                  <TableHead>الإجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {partners.map((partner) => (
                  <TableRow key={partner.id}>
                    <TableCell className="font-medium">{partner.name}</TableCell>
                    <TableCell>
                      <span className="font-semibold text-blue-600">
                        {partner.ownershipPercentage}%
                      </span>
                    </TableCell>
                    <TableCell>{partner.initialInvestment.toFixed(2)} د.أ</TableCell>
                    <TableCell>{partner.phone}</TableCell>
                    <TableCell>{partner.email}</TableCell>
                    <TableCell>
                      <span
                        className={`px-2 py-1 rounded text-xs ${
                          partner.active
                            ? "bg-green-100 text-green-800"
                            : "bg-gray-100 text-gray-800"
                        }`}
                      >
                        {partner.active ? "نشط" : "غير نشط"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEdit(partner)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDelete(partner.id)}
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

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingPartner ? "تعديل بيانات الشريك" : "إضافة شريك جديد"}
            </DialogTitle>
            <DialogDescription>
              {editingPartner
                ? "قم بتعديل بيانات الشريك أدناه"
                : "أدخل بيانات الشريك الجديد أدناه"}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">الاسم</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ownershipPercentage">نسبة الملكية (%)</Label>
                <Input
                  id="ownershipPercentage"
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  value={formData.ownershipPercentage}
                  onChange={(e) =>
                    setFormData({ ...formData, ownershipPercentage: e.target.value })
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="initialInvestment">الاستثمار الأولي (د.أ)</Label>
                <Input
                  id="initialInvestment"
                  type="number"
                  step="0.01"
                  value={formData.initialInvestment}
                  onChange={(e) =>
                    setFormData({ ...formData, initialInvestment: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">رقم الهاتف</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) =>
                    setFormData({ ...formData, phone: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">البريد الإلكتروني</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                />
              </div>
              {editingPartner && (
                <div className="flex items-center space-x-2 space-x-reverse">
                  <input
                    type="checkbox"
                    id="active"
                    checked={formData.active}
                    onChange={(e) =>
                      setFormData({ ...formData, active: e.target.checked })
                    }
                    className="w-4 h-4"
                  />
                  <Label htmlFor="active">شريك نشط</Label>
                </div>
              )}
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
                {loading ? "جاري الحفظ..." : editingPartner ? "تحديث" : "إضافة"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {confirmationDialog}
    </div>
  );
}
