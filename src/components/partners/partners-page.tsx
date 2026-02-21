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
import { Plus, Edit, Trash2, Users, ChevronDown, ChevronUp, ExternalLink, TrendingUp, TrendingDown } from "lucide-react";
import { PermissionGate } from "@/components/auth";
import { useConfirmation } from "@/components/ui/confirmation-dialog";
import { useUser } from "@/firebase/provider";
import { useToast } from "@/hooks/use-toast";
import { handleError, getErrorTitle } from "@/lib/error-handling";
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  where,
  orderBy,
  limit,
} from "firebase/firestore";
import { firestore } from "@/firebase/config";
import { convertFirestoreDates } from "@/lib/firestore-utils";
import PartnersEquityReport from "./partners-equity-report";
import { formatNumber } from "@/lib/date-utils";
import { logActivity } from "@/services/activityLogService";
import { parseAmount, sumAmounts, safeAdd } from "@/lib/currency";

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

interface EquityTransaction {
  id: string;
  date: Date;
  description: string;
  amount: number;
  subCategory: string;
  isInvestment: boolean;
}

interface PartnerEquityData {
  investments: number;
  withdrawals: number;
  netEquity: number;
  recentTransactions: EquityTransaction[];
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

  // Equity data from ledger entries
  const [partnerEquityMap, setPartnerEquityMap] = useState<Map<string, PartnerEquityData>>(new Map());
  const [expandedPartners, setExpandedPartners] = useState<Set<string>>(new Set());

  // Real-time data fetching
  useEffect(() => {
    if (!user) {return;}

    const partnersRef = collection(firestore, `users/${user.dataOwnerId}/partners`);
    // Limit to 100 partners (reasonable for most businesses)
    const q = query(partnersRef, orderBy("name", "asc"), limit(100));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const partnersData: Partner[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        partnersData.push({
          id: doc.id,
          ...convertFirestoreDates(data),
        } as Partner);
      });
      setPartners(partnersData);
    });

    return () => unsubscribe();
  }, [user]);

  // Load equity data from ledger entries for all partners
  useEffect(() => {
    if (!user || partners.length === 0) {return;}

    const ledgerRef = collection(firestore, `users/${user.dataOwnerId}/ledger`);
    // Query only equity entries (filtered at Firestore level instead of fetching 500 docs)
    const unsubscribe = onSnapshot(
      query(ledgerRef, where("type", "==", "حركة رأس مال"), orderBy("date", "desc"), limit(500)),
      (snapshot) => {
        const equityMap = new Map<string, PartnerEquityData>();

        // Initialize map for all partners
        partners.forEach((partner) => {
          equityMap.set(partner.name, {
            investments: 0,
            withdrawals: 0,
            netEquity: 0,
            recentTransactions: [],
          });
        });

        // Process ledger entries (already filtered to equity type by query)
        snapshot.forEach((doc) => {
          const data = doc.data();

          if (!data.ownerName) {return;}

          const partnerData = equityMap.get(data.ownerName);
          if (!partnerData) {return;}

          const isInvestment = data.subCategory === "رأس مال مالك";
          const isWithdrawal = data.subCategory === "سحوبات المالك";

          if (isInvestment) {
            partnerData.investments += data.amount || 0;
          } else if (isWithdrawal) {
            partnerData.withdrawals += data.amount || 0;
          }

          // Add to recent transactions (keep last 5)
          if (partnerData.recentTransactions.length < 5) {
            const entryDate = data.date?.toDate?.() || new Date();
            partnerData.recentTransactions.push({
              id: doc.id,
              date: entryDate,
              description: data.description || "",
              amount: data.amount || 0,
              subCategory: data.subCategory || "",
              isInvestment,
            });
          }
        });

        // Calculate net equity for each partner
        equityMap.forEach((data) => {
          data.netEquity = data.investments - data.withdrawals;
        });

        setPartnerEquityMap(equityMap);
      }
    );

    return () => unsubscribe();
  }, [user, partners]);

  // Toggle expanded state for a partner
  const toggleExpanded = (partnerName: string) => {
    setExpandedPartners((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(partnerName)) {
        newSet.delete(partnerName);
      } else {
        newSet.add(partnerName);
      }
      return newSet;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {return;}

    // Validate ownership percentage
    const newPercentage = parseAmount(formData.ownershipPercentage);
    const totalPercentage = sumAmounts(partners
      .filter((p) => p.active && (!editingPartner || p.id !== editingPartner.id))
      .map(p => p.ownershipPercentage));

    if (safeAdd(totalPercentage, newPercentage) > 100) {
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
        const partnerRef = doc(firestore, `users/${user.dataOwnerId}/partners`, editingPartner.id);
        await updateDoc(partnerRef, {
          name: formData.name,
          ownershipPercentage: parseAmount(formData.ownershipPercentage),
          phone: formData.phone,
          email: formData.email,
          initialInvestment: parseAmount(formData.initialInvestment),
          active: formData.active,
        });

        // Log activity for update
        logActivity(user.dataOwnerId, {
          action: 'update',
          module: 'partners',
          targetId: editingPartner.id,
          userId: user.uid,
          userEmail: user.email || '',
          description: `تعديل بيانات شريك: ${formData.name}`,
          metadata: {
            ownershipPercentage: parseAmount(formData.ownershipPercentage),
            investment: parseAmount(formData.initialInvestment),
            name: formData.name,
          },
        });

        toast({
          title: "تم التحديث بنجاح",
          description: "تم تحديث بيانات الشريك",
        });
      } else {
        // Add new partner
        const partnersRef = collection(firestore, `users/${user.dataOwnerId}/partners`);
        const docRef = await addDoc(partnersRef, {
          name: formData.name,
          ownershipPercentage: parseAmount(formData.ownershipPercentage),
          phone: formData.phone,
          email: formData.email,
          initialInvestment: parseAmount(formData.initialInvestment),
          joinDate: new Date(),
          active: true,
        });

        // Log activity for create
        logActivity(user.dataOwnerId, {
          action: 'create',
          module: 'partners',
          targetId: docRef.id,
          userId: user.uid,
          userEmail: user.email || '',
          description: `إضافة شريك: ${formData.name}`,
          metadata: {
            ownershipPercentage: parseAmount(formData.ownershipPercentage),
            investment: parseAmount(formData.initialInvestment),
            name: formData.name,
          },
        });

        toast({
          title: "تمت الإضافة بنجاح",
          description: "تم إضافة شريك جديد",
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

    const partner = partners.find((p) => p.id === partnerId);

    confirm(
      "حذف الشريك",
      "هل أنت متأكد من حذف هذا الشريك؟ لا يمكن التراجع عن هذا الإجراء.",
      async () => {
        try {
          const partnerRef = doc(firestore, `users/${user.dataOwnerId}/partners`, partnerId);
          await deleteDoc(partnerRef);

          // Log activity for delete
          logActivity(user.dataOwnerId, {
            action: 'delete',
            module: 'partners',
            targetId: partnerId,
            userId: user.uid,
            userEmail: user.email || '',
            description: `حذف شريك: ${partner?.name || ''}`,
            metadata: {
              ownershipPercentage: partner?.ownershipPercentage,
              investment: partner?.initialInvestment,
              name: partner?.name,
            },
          });

          toast({
            title: "تم الحذف",
            description: "تم حذف الشريك بنجاح",
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
        <PermissionGate action="create" module="partners">
          <Button className="gap-2" onClick={openAddDialog}>
            <Plus className="w-4 h-4" />
            إضافة شريك جديد
          </Button>
        </PermissionGate>
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
              صافي رأس المال
            </CardTitle>
          </CardHeader>
          <CardContent>
            {(() => {
              let totalEquity = 0;
              partnerEquityMap.forEach((data, partnerName) => {
                const partner = partners.find(p => p.name === partnerName && p.active);
                if (partner) {
                  totalEquity += data.netEquity;
                }
              });
              return (
                <div className={`text-2xl font-bold ${totalEquity >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                  {formatNumber(totalEquity)} د.أ
                </div>
              );
            })()}
            <p className="text-xs text-gray-500 mt-1">من حركات دفتر الأستاذ</p>
          </CardContent>
        </Card>
      </div>

      {/* Partners Equity Report */}
      <PartnersEquityReport />

      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-slate-800">قائمة الشركاء ({partners.filter((p) => p.active).length})</h2>
        {partners.length === 0 ? (
          <p className="text-slate-500 text-center py-12">
            لا يوجد شركاء حالياً. اضغط على &quot;إضافة شريك جديد&quot; للبدء.
          </p>
        ) : (
          <div className="card-modern overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/80 hover:bg-slate-50/80">
                  <TableHead className="text-right font-semibold text-slate-700 w-8"></TableHead>
                  <TableHead className="text-right font-semibold text-slate-700">الاسم</TableHead>
                  <TableHead className="text-right font-semibold text-slate-700">نسبة الملكية</TableHead>
                  <TableHead className="text-right font-semibold text-slate-700">الاستثمارات</TableHead>
                  <TableHead className="text-right font-semibold text-slate-700">السحوبات</TableHead>
                  <TableHead className="text-right font-semibold text-slate-700">صافي الملكية</TableHead>
                  <TableHead className="text-right font-semibold text-slate-700">الحالة</TableHead>
                  <TableHead className="text-right font-semibold text-slate-700">الإجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {partners.map((partner) => {
                  const equityData = partnerEquityMap.get(partner.name);
                  const isExpanded = expandedPartners.has(partner.name);
                  const hasTransactions = equityData && equityData.recentTransactions.length > 0;

                  return (
                    <>
                      <TableRow key={partner.id} className="table-row-hover">
                        <TableCell className="w-8">
                          {hasTransactions && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => toggleExpanded(partner.name)}
                            >
                              {isExpanded ? (
                                <ChevronUp className="h-4 w-4" />
                              ) : (
                                <ChevronDown className="h-4 w-4" />
                              )}
                            </Button>
                          )}
                        </TableCell>
                        <TableCell className="font-medium">{partner.name}</TableCell>
                        <TableCell>
                          <span className="font-semibold text-blue-600">
                            {partner.ownershipPercentage}%
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <TrendingUp className="h-3 w-3 text-green-600" />
                            <span className="font-semibold text-green-600">
                              {formatNumber(equityData?.investments || 0)} د.أ
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <TrendingDown className="h-3 w-3 text-red-600" />
                            <span className="font-semibold text-red-600">
                              {formatNumber(equityData?.withdrawals || 0)} د.أ
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className={`font-bold ${(equityData?.netEquity || 0) >= 0 ? "text-emerald-700" : "text-red-700"}`}>
                            {formatNumber(equityData?.netEquity || 0)} د.أ
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className={partner.active ? "badge-success" : "badge-neutral"}>
                            {partner.active ? "نشط" : "غير نشط"}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <PermissionGate action="update" module="partners">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                                onClick={() => handleEdit(partner)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                            </PermissionGate>
                            <PermissionGate action="delete" module="partners">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-slate-400 hover:text-red-600 hover:bg-red-50"
                                onClick={() => handleDelete(partner.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </PermissionGate>
                          </div>
                        </TableCell>
                      </TableRow>
                      {/* Expanded row with recent transactions */}
                      {isExpanded && hasTransactions && (
                        <TableRow key={`${partner.id}-expanded`} className="bg-slate-50/50">
                          <TableCell colSpan={8} className="p-0">
                            <div className="px-6 py-4 border-t border-slate-100">
                              <div className="flex items-center justify-between mb-3">
                                <h4 className="text-sm font-semibold text-slate-700">آخر حركات رأس المال</h4>
                                <a
                                  href={`/ledger?category=رأس المال&search=${encodeURIComponent(partner.name)}`}
                                  className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
                                >
                                  عرض الكل في دفتر الأستاذ
                                  <ExternalLink className="h-3 w-3" />
                                </a>
                              </div>
                              <div className="space-y-2">
                                {equityData?.recentTransactions.map((tx) => (
                                  <div
                                    key={tx.id}
                                    className="flex items-center justify-between bg-white rounded-lg px-4 py-2 border border-slate-100"
                                  >
                                    <div className="flex items-center gap-3">
                                      <div className={`w-2 h-2 rounded-full ${tx.isInvestment ? "bg-green-500" : "bg-red-500"}`} />
                                      <div>
                                        <p className="text-sm font-medium text-slate-700">{tx.description || tx.subCategory}</p>
                                        <p className="text-xs text-slate-500">
                                          {tx.date.toLocaleDateString("ar-EG", { year: "numeric", month: "short", day: "numeric" })}
                                        </p>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <span className={`text-sm font-semibold ${tx.isInvestment ? "text-green-600" : "text-red-600"}`}>
                                        {tx.isInvestment ? "+" : "-"}{formatNumber(tx.amount)} د.أ
                                      </span>
                                      <span className={`text-xs px-2 py-0.5 rounded-full ${tx.isInvestment ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                                        {tx.isInvestment ? "استثمار" : "سحب"}
                                      </span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
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
            <div className="grid gap-4 px-6 py-4">
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
