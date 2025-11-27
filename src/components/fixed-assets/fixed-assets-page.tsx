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
import { Plus, Edit, Trash2, TrendingDown, Calendar, FileText } from "lucide-react";
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
  orderBy,
  where,
  getDocs,
  writeBatch,
  limit,
} from "firebase/firestore";
import { firestore } from "@/firebase/config";

interface FixedAsset {
  id: string;
  assetNumber: string;
  assetName: string;
  category: string;
  purchaseDate: Date;
  purchaseCost: number;
  salvageValue: number;
  usefulLifeMonths: number;
  monthlyDepreciation: number;
  status: "active" | "disposed" | "sold" | "written-off";
  accumulatedDepreciation: number;
  bookValue: number;
  lastDepreciationDate?: Date;
  location?: string;
  serialNumber?: string;
  supplier?: string;
  notes?: string;
  createdAt: Date;
}

interface DepreciationRecord {
  id: string;
  assetId: string;
  assetName: string;
  month: number;
  year: number;
  periodLabel: string;
  depreciationAmount: number;
  accumulatedDepreciationBefore: number;
  accumulatedDepreciationAfter: number;
  bookValueBefore: number;
  bookValueAfter: number;
  ledgerEntryId?: string;
  recordedDate: Date;
  createdAt: Date;
}

const ASSET_CATEGORIES = [
  "آلات ومعدات",
  "مركبات",
  "مباني",
  "معدات مكتبية",
  "أدوات",
  "أثاث",
  "أجهزة كمبيوتر",
  "أخرى",
];

// Helper function to generate unique asset number
const generateAssetNumber = (): string => {
  const now = new Date();
  const year = now.getFullYear();
  const random = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
  return `ASSET-${year}-${random}`;
};

// Helper function to generate transaction ID
const generateTransactionId = (): string => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  const random = String(Math.floor(Math.random() * 1000)).padStart(3, '0');
  return `TXN-${year}${month}${day}-${hours}${minutes}${seconds}-${random}`;
};

export default function FixedAssetsPage() {
  const { user } = useUser();
  const { toast } = useToast();
  const { confirm, dialog: confirmationDialog } = useConfirmation();
  const [assets, setAssets] = useState<FixedAsset[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDepreciationDialogOpen, setIsDepreciationDialogOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState<FixedAsset | null>(null);
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    assetName: "",
    category: "",
    purchaseDate: new Date().toISOString().split("T")[0],
    purchaseCost: "",
    salvageValue: "",
    usefulLifeYears: "",
    location: "",
    serialNumber: "",
    supplier: "",
    notes: "",
  });

  const [depreciationPeriod, setDepreciationPeriod] = useState({
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear(),
  });

  useEffect(() => {
    if (!user) {return;}

    const assetsRef = collection(firestore, `users/${user.uid}/fixed_assets`);
    // Limit to 500 most recent assets
    const q = query(assetsRef, orderBy("createdAt", "desc"), limit(500));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const assetsData: FixedAsset[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        assetsData.push({
          id: doc.id,
          ...data,
          purchaseDate: data.purchaseDate?.toDate ? data.purchaseDate.toDate() : new Date(),
          lastDepreciationDate: data.lastDepreciationDate?.toDate ? data.lastDepreciationDate.toDate() : undefined,
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(),
        } as FixedAsset);
      });
      setAssets(assetsData);
    });

    return () => unsubscribe();
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {return;}

    setLoading(true);
    try {
      const purchaseCost = parseFloat(formData.purchaseCost);
      const salvageValue = parseFloat(formData.salvageValue);
      const usefulLifeYears = parseFloat(formData.usefulLifeYears);
      const usefulLifeMonths = usefulLifeYears * 12;

      // Validation
      if (purchaseCost <= salvageValue) {
        toast({
          title: "خطأ في البيانات",
          description: "تكلفة الشراء يجب أن تكون أكبر من قيمة الخردة",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      // Calculate monthly depreciation (Straight-Line Method)
      const monthlyDepreciation = (purchaseCost - salvageValue) / usefulLifeMonths;
      const bookValue = purchaseCost; // Initial book value

      const assetsRef = collection(firestore, `users/${user.uid}/fixed_assets`);

      if (editingAsset) {
        const assetRef = doc(firestore, `users/${user.uid}/fixed_assets`, editingAsset.id);
        await updateDoc(assetRef, {
          assetName: formData.assetName,
          category: formData.category,
          purchaseDate: new Date(formData.purchaseDate),
          purchaseCost: purchaseCost,
          salvageValue: salvageValue,
          usefulLifeMonths: usefulLifeMonths,
          monthlyDepreciation: monthlyDepreciation,
          location: formData.location,
          serialNumber: formData.serialNumber,
          supplier: formData.supplier,
          notes: formData.notes,
        });
        toast({
          title: "تم التحديث بنجاح",
          description: "تم تحديث بيانات الأصل الثابت",
        });
      } else {
        const assetNumber = generateAssetNumber();
        await addDoc(assetsRef, {
          assetNumber: assetNumber,
          assetName: formData.assetName,
          category: formData.category,
          purchaseDate: new Date(formData.purchaseDate),
          purchaseCost: purchaseCost,
          salvageValue: salvageValue,
          usefulLifeMonths: usefulLifeMonths,
          monthlyDepreciation: monthlyDepreciation,
          status: "active",
          accumulatedDepreciation: 0,
          bookValue: bookValue,
          location: formData.location,
          serialNumber: formData.serialNumber,
          supplier: formData.supplier,
          notes: formData.notes,
          createdAt: new Date(),
        });
        toast({
          title: "تمت الإضافة بنجاح",
          description: `تم إضافة الأصل الثابت - ${assetNumber}`,
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

  const handleRunDepreciation = () => {
    if (!user) {return;}

    confirm(
      "تسجيل الاستهلاك",
      `هل أنت متأكد من تسجيل استهلاك شهر ${depreciationPeriod.month}/${depreciationPeriod.year}؟`,
      async () => {
        setLoading(true);
        try {
          const batch = writeBatch(firestore);
          const periodLabel = `${depreciationPeriod.year}-${String(depreciationPeriod.month).padStart(2, '0')}`;

          // Check if depreciation already run for this period
          const runsRef = collection(firestore, `users/${user.uid}/depreciation_runs`);
          const runQuery = query(runsRef, where("period", "==", periodLabel));
          const runSnapshot = await getDocs(runQuery);

          if (!runSnapshot.empty) {
            toast({
              title: "تحذير",
              description: "تم تسجيل الاستهلاك لهذه الفترة مسبقاً",
              variant: "destructive",
            });
            setLoading(false);
            return;
          }

          // Get active assets
          const activeAssets = assets.filter(a => a.status === "active");

          if (activeAssets.length === 0) {
            toast({
              title: "لا توجد أصول",
              description: "لا توجد أصول ثابتة نشطة لتسجيل الاستهلاك",
              variant: "destructive",
            });
            setLoading(false);
            return;
          }

          let totalDepreciation = 0;
          const transactionId = generateTransactionId();

          // Process each asset
          for (const asset of activeAssets) {
            // Check if asset is fully depreciated
            if (asset.accumulatedDepreciation >= (asset.purchaseCost - asset.salvageValue)) {
              continue; // Skip fully depreciated assets
            }

            const depreciationAmount = Math.min(
              asset.monthlyDepreciation,
              (asset.purchaseCost - asset.salvageValue) - asset.accumulatedDepreciation
            );

            const newAccumulatedDepreciation = asset.accumulatedDepreciation + depreciationAmount;
            const newBookValue = asset.purchaseCost - newAccumulatedDepreciation;

            // Create depreciation record
            const recordsRef = collection(firestore, `users/${user.uid}/depreciation_records`);
            const recordDocRef = doc(recordsRef);
            batch.set(recordDocRef, {
              assetId: asset.id,
              assetName: asset.assetName,
              month: depreciationPeriod.month,
              year: depreciationPeriod.year,
              periodLabel: periodLabel,
              depreciationAmount: depreciationAmount,
              accumulatedDepreciationBefore: asset.accumulatedDepreciation,
              accumulatedDepreciationAfter: newAccumulatedDepreciation,
              bookValueBefore: asset.bookValue,
              bookValueAfter: newBookValue,
              ledgerEntryId: transactionId,
              recordedDate: new Date(),
              createdAt: new Date(),
            });

            // Update asset
            const assetRef = doc(firestore, `users/${user.uid}/fixed_assets`, asset.id);
            batch.update(assetRef, {
              accumulatedDepreciation: newAccumulatedDepreciation,
              bookValue: newBookValue,
              lastDepreciationDate: new Date(),
            });

            totalDepreciation += depreciationAmount;
          }

          // Create ledger entry for total depreciation
          const ledgerRef = collection(firestore, `users/${user.uid}/ledger`);
          const ledgerDocRef = doc(ledgerRef);
          batch.set(ledgerDocRef, {
            transactionId: transactionId,
            description: `استهلاك أصول ثابتة - ${periodLabel}`,
            type: "مصروف",
            amount: totalDepreciation,
            category: "مصاريف تشغيلية",
            subCategory: "استهلاك أصول ثابتة",
            associatedParty: "",
            date: new Date(),
            reference: periodLabel,
            notes: `استهلاك شهري لعدد ${activeAssets.length} أصول ثابتة`,
            autoGenerated: true,
            createdAt: new Date(),
          });

          // Record depreciation run
          const runDocRef = doc(runsRef);
          batch.set(runDocRef, {
            period: periodLabel,
            runDate: new Date(),
            assetsCount: activeAssets.length,
            totalDepreciation: totalDepreciation,
            ledgerEntryId: transactionId,
            createdAt: new Date(),
          });

          await batch.commit();

          toast({
            title: "تم تسجيل الاستهلاك بنجاح",
            description: `إجمالي الاستهلاك: ${totalDepreciation.toFixed(2)} دينار`,
          });
          setIsDepreciationDialogOpen(false);
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
      },
      "warning"
    );
  };

  const handleEdit = (asset: FixedAsset) => {
    setEditingAsset(asset);
    setFormData({
      assetName: asset.assetName || "",
      category: asset.category || "",
      purchaseDate: asset.purchaseDate ? new Date(asset.purchaseDate).toISOString().split("T")[0] : new Date().toISOString().split("T")[0],
      purchaseCost: (asset.purchaseCost || 0).toString(),
      salvageValue: (asset.salvageValue || 0).toString(),
      usefulLifeYears: ((asset.usefulLifeMonths || 0) / 12).toString(),
      location: asset.location || "",
      serialNumber: asset.serialNumber || "",
      supplier: asset.supplier || "",
      notes: asset.notes || "",
    });
    setIsDialogOpen(true);
  };

  const handleDelete = (assetId: string) => {
    if (!user) {return;}

    confirm(
      "حذف الأصل الثابت",
      "هل أنت متأكد من حذف هذا الأصل الثابت؟ لا يمكن التراجع عن هذا الإجراء.",
      async () => {
        try {
          const assetRef = doc(firestore, `users/${user.uid}/fixed_assets`, assetId);
          await deleteDoc(assetRef);
          toast({
            title: "تم الحذف",
            description: "تم حذف الأصل الثابت بنجاح",
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
      assetName: "",
      category: "",
      purchaseDate: new Date().toISOString().split("T")[0],
      purchaseCost: "",
      salvageValue: "",
      usefulLifeYears: "",
      location: "",
      serialNumber: "",
      supplier: "",
      notes: "",
    });
    setEditingAsset(null);
  };

  const openAddDialog = () => {
    resetForm();
    setIsDialogOpen(true);
  };

  // Calculate totals
  const activeAssets = assets.filter(a => a.status === "active");
  const totalOriginalCost = activeAssets.reduce((sum, a) => sum + (a.purchaseCost || 0), 0);
  const totalAccumulatedDepreciation = activeAssets.reduce((sum, a) => sum + (a.accumulatedDepreciation || 0), 0);
  const totalBookValue = activeAssets.reduce((sum, a) => sum + (a.bookValue || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">الأصول الثابتة</h1>
          <p className="text-gray-600 mt-2">إدارة الأصول الثابتة وحساب الاستهلاك</p>
        </div>
        <div className="flex gap-2">
          <Button
            className="gap-2"
            variant="outline"
            onClick={() => setIsDepreciationDialogOpen(true)}
          >
            <TrendingDown className="w-4 h-4" />
            تسجيل استهلاك شهري
          </Button>
          <Button className="gap-2" onClick={openAddDialog}>
            <Plus className="w-4 h-4" />
            إضافة أصل ثابت
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>عدد الأصول النشطة</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-600">
              {activeAssets.length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>التكلفة الأصلية</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">
              {totalOriginalCost.toFixed(0)} د
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>الاستهلاك المتراكم</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-orange-600">
              {totalAccumulatedDepreciation.toFixed(0)} د
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>القيمة الدفترية</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-purple-600">
              {totalBookValue.toFixed(0)} د
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>سجل الأصول الثابتة ({assets.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {assets.length === 0 ? (
            <p className="text-gray-500 text-center py-12">
              لا توجد أصول ثابتة. اضغط على &quot;إضافة أصل ثابت&quot; للبدء.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>رقم الأصل</TableHead>
                  <TableHead>اسم الأصل</TableHead>
                  <TableHead>الفئة</TableHead>
                  <TableHead>تاريخ الشراء</TableHead>
                  <TableHead>التكلفة الأصلية</TableHead>
                  <TableHead>الاستهلاك المتراكم</TableHead>
                  <TableHead>القيمة الدفترية</TableHead>
                  <TableHead>الحالة</TableHead>
                  <TableHead>الإجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {assets.map((asset) => (
                  <TableRow key={asset.id}>
                    <TableCell className="font-mono text-xs">
                      {asset.assetNumber}
                    </TableCell>
                    <TableCell className="font-medium">
                      {asset.assetName}
                    </TableCell>
                    <TableCell>{asset.category}</TableCell>
                    <TableCell>
                      {new Date(asset.purchaseDate).toLocaleDateString("ar-EG")}
                    </TableCell>
                    <TableCell>{asset.purchaseCost.toFixed(2)} د</TableCell>
                    <TableCell>{asset.accumulatedDepreciation.toFixed(2)} د</TableCell>
                    <TableCell>{asset.bookValue.toFixed(2)} د</TableCell>
                    <TableCell>
                      <span
                        className={`px-2 py-1 rounded-full text-xs ${
                          asset.status === "active"
                            ? "bg-green-100 text-green-700"
                            : "bg-gray-100 text-gray-700"
                        }`}
                      >
                        {asset.status === "active" ? "نشط" : asset.status}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEdit(asset)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDelete(asset.id)}
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

      {/* Add/Edit Asset Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingAsset ? "تعديل أصل ثابت" : "إضافة أصل ثابت جديد"}</DialogTitle>
            <DialogDescription>
              أدخل بيانات الأصل الثابت وسيتم حساب الاستهلاك الشهري تلقائياً
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="assetName">اسم الأصل *</Label>
                <Input
                  id="assetName"
                  value={formData.assetName}
                  onChange={(e) =>
                    setFormData({ ...formData, assetName: e.target.value })
                  }
                  required
                  placeholder="مثال: آلة CNC موديل XYZ"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="category">الفئة *</Label>
                <select
                  id="category"
                  value={formData.category}
                  onChange={(e) =>
                    setFormData({ ...formData, category: e.target.value })
                  }
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  required
                >
                  <option value="">اختر الفئة</option>
                  {ASSET_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="purchaseDate">تاريخ الشراء *</Label>
                  <Input
                    id="purchaseDate"
                    type="date"
                    value={formData.purchaseDate}
                    onChange={(e) =>
                      setFormData({ ...formData, purchaseDate: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="purchaseCost">تكلفة الشراء (دينار) *</Label>
                  <Input
                    id="purchaseCost"
                    type="number"
                    step="0.01"
                    value={formData.purchaseCost}
                    onChange={(e) =>
                      setFormData({ ...formData, purchaseCost: e.target.value })
                    }
                    required
                    placeholder="120000"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="salvageValue">قيمة الخردة (دينار) *</Label>
                  <Input
                    id="salvageValue"
                    type="number"
                    step="0.01"
                    value={formData.salvageValue}
                    onChange={(e) =>
                      setFormData({ ...formData, salvageValue: e.target.value })
                    }
                    required
                    placeholder="20000"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="usefulLifeYears">العمر الإنتاجي (سنوات) *</Label>
                  <Input
                    id="usefulLifeYears"
                    type="number"
                    step="0.1"
                    value={formData.usefulLifeYears}
                    onChange={(e) =>
                      setFormData({ ...formData, usefulLifeYears: e.target.value })
                    }
                    required
                    placeholder="5"
                  />
                </div>
              </div>

              {formData.purchaseCost && formData.salvageValue && formData.usefulLifeYears && (
                <div className="bg-blue-50 p-4 rounded-lg">
                  <div className="text-sm font-semibold text-blue-900 mb-2">
                    💡 الاستهلاك الشهري المحسوب:
                  </div>
                  <div className="text-2xl font-bold text-blue-600">
                    {(
                      (parseFloat(formData.purchaseCost) - parseFloat(formData.salvageValue)) /
                      (parseFloat(formData.usefulLifeYears) * 12)
                    ).toFixed(2)}{" "}
                    دينار/شهر
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="location">الموقع</Label>
                  <Input
                    id="location"
                    value={formData.location}
                    onChange={(e) =>
                      setFormData({ ...formData, location: e.target.value })
                    }
                    placeholder="المصنع - قسم الإنتاج"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="serialNumber">الرقم التسلسلي</Label>
                  <Input
                    id="serialNumber"
                    value={formData.serialNumber}
                    onChange={(e) =>
                      setFormData({ ...formData, serialNumber: e.target.value })
                    }
                    placeholder="SN-12345"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="supplier">المورد</Label>
                <Input
                  id="supplier"
                  value={formData.supplier}
                  onChange={(e) =>
                    setFormData({ ...formData, supplier: e.target.value })
                  }
                  placeholder="اسم المورد"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">ملاحظات</Label>
                <Input
                  id="notes"
                  value={formData.notes}
                  onChange={(e) =>
                    setFormData({ ...formData, notes: e.target.value })
                  }
                  placeholder="ملاحظات إضافية"
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
                {loading
                  ? "جاري الحفظ..."
                  : editingAsset
                  ? "تحديث الأصل"
                  : "إضافة الأصل"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Run Depreciation Dialog */}
      <Dialog open={isDepreciationDialogOpen} onOpenChange={setIsDepreciationDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>تسجيل استهلاك شهري</DialogTitle>
            <DialogDescription>
              اختر الشهر والسنة لتسجيل الاستهلاك لجميع الأصول النشطة
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="month">الشهر</Label>
                <select
                  id="month"
                  value={depreciationPeriod.month}
                  onChange={(e) =>
                    setDepreciationPeriod({ ...depreciationPeriod, month: parseInt(e.target.value) })
                  }
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="year">السنة</Label>
                <Input
                  id="year"
                  type="number"
                  value={depreciationPeriod.year}
                  onChange={(e) =>
                    setDepreciationPeriod({ ...depreciationPeriod, year: parseInt(e.target.value) })
                  }
                />
              </div>
            </div>

            <div className="bg-gray-50 p-4 rounded-lg space-y-2">
              <div className="text-sm text-gray-600">
                <strong>عدد الأصول النشطة:</strong> {activeAssets.length}
              </div>
              <div className="text-sm text-gray-600">
                <strong>إجمالي الاستهلاك المتوقع:</strong>{" "}
                {activeAssets.reduce((sum, a) => sum + a.monthlyDepreciation, 0).toFixed(2)} دينار
              </div>
              <div className="text-xs text-gray-500 mt-2">
                ⚠️ سيتم إضافة قيد تلقائي في دفتر الأستاذ
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsDepreciationDialogOpen(false)}
            >
              إلغاء
            </Button>
            <Button onClick={handleRunDepreciation} disabled={loading}>
              {loading ? "جاري التسجيل..." : "تسجيل الاستهلاك"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {confirmationDialog}
    </div>
  );
}
