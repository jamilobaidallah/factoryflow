"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ValidatedInput } from "@/components/ui/validated-input";
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
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Plus, Edit, Trash2, Eye, AlertCircle } from "lucide-react";
import { PermissionGate } from "@/components/auth";
import { useConfirmation } from "@/components/ui/confirmation-dialog";
import { TableSkeleton } from "@/components/ui/loading-skeleton";
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
import { convertFirestoreDates } from "@/lib/firestore-utils";

// Import validation utilities
import {
  clientSchema,
  type ClientInput,
  checkDuplicateClient,
  parseNumericInput,
  sanitizeString,
} from "@/lib/validation";
import {
  handleError,
  getErrorTitle,
  getSuccessMessage,
  logError,
} from "@/lib/error-handling";
import { z } from "zod";

interface Client {
  id: string;
  name: string;
  phone: string;
  email: string;
  address: string;
  balance: number;
  createdAt: Date;
}

export default function ClientsPage() {
  const router = useRouter();
  const { user } = useUser();
  const { toast } = useToast();
  const { confirm, dialog: confirmationDialog } = useConfirmation();
  const [clients, setClients] = useState<Client[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(true);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    email: "",
    address: "",
    balance: "0",
  });

  // Real-time data fetching
  useEffect(() => {
    if (!user) { return; }

    const clientsRef = collection(firestore, `users/${user.uid}/clients`);
    // Limit to 500 most recent clients to prevent performance issues
    const q = query(clientsRef, orderBy("createdAt", "desc"), limit(500));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const clientsData: Client[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        clientsData.push({
          id: doc.id,
          ...convertFirestoreDates(data),
        } as Client);
      });
      setClients(clientsData);
      setDataLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  // Validate form data in real-time
  const validateForm = (data: typeof formData): boolean => {
    const errors: Record<string, string> = {};

    // Parse balance
    const balanceNum = parseNumericInput(data.balance);
    if (balanceNum === null) {
      errors.balance = "يجب إدخال رقم صحيح";
    }

    // Prepare data for Zod validation
    const clientData: ClientInput = {
      name: sanitizeString(data.name),
      phone: data.phone.trim(),
      email: data.email.trim(),
      address: data.address.trim(),
      balance: balanceNum ?? 0,
    };

    // Validate with Zod schema
    try {
      clientSchema.parse(clientData);
    } catch (error) {
      if (error instanceof z.ZodError) {
        error.errors.forEach((err) => {
          const field = err.path[0] as string;
          errors[field] = err.message;
        });
      }
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) { return; }

    // Validate form
    if (!validateForm(formData)) {
      toast({
        title: "خطأ في البيانات",
        description: "يرجى تصحيح الأخطاء والمحاولة مرة أخرى",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      // Check for duplicate name
      const isDuplicate = await checkDuplicateClient(
        formData.name,
        user.uid,
        editingClient?.id
      );

      if (isDuplicate) {
        toast({
          title: "عميل مكرر",
          description: "يوجد عميل بنفس الاسم مسبقاً",
          variant: "destructive",
        });
        setValidationErrors({ name: "يوجد عميل بنفس الاسم مسبقاً" });
        setLoading(false);
        return;
      }

      // Parse and validate data
      const balanceNum = parseNumericInput(formData.balance) ?? 0;

      const clientData: ClientInput = {
        name: sanitizeString(formData.name),
        phone: formData.phone.trim(),
        email: formData.email.trim(),
        address: formData.address.trim(),
        balance: balanceNum,
      };

      // Final validation with Zod
      const validated = clientSchema.parse(clientData);

      if (editingClient) {
        // Update existing client
        const clientRef = doc(firestore, `users/${user.uid}/clients`, editingClient.id);
        await updateDoc(clientRef, validated);

        const successMsg = getSuccessMessage('update', 'العميل');
        toast({
          title: successMsg.title,
          description: successMsg.description,
        });
      } else {
        // Add new client
        const clientsRef = collection(firestore, `users/${user.uid}/clients`);
        await addDoc(clientsRef, {
          ...validated,
          createdAt: new Date(),
        });

        const successMsg = getSuccessMessage('create', 'العميل');
        toast({
          title: successMsg.title,
          description: successMsg.description,
        });
      }

      resetForm();
      setIsDialogOpen(false);
    } catch (error) {
      const appError = handleError(error);
      logError(appError, { operation: 'saveClient', formData }, user?.uid);

      toast({
        title: getErrorTitle(appError),
        description: appError.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (client: Client) => {
    setEditingClient(client);
    setFormData({
      name: client.name || "",
      phone: client.phone || "",
      email: client.email || "",
      address: client.address || "",
      balance: (client.balance || 0).toString(),
    });
    setValidationErrors({});
    setIsDialogOpen(true);
  };

  const handleDelete = (clientId: string) => {
    if (!user) { return; }

    confirm(
      "حذف العميل",
      "هل أنت متأكد من حذف هذا العميل؟ لا يمكن التراجع عن هذا الإجراء.",
      async () => {
        try {
          const clientRef = doc(firestore, `users/${user.uid}/clients`, clientId);
          await deleteDoc(clientRef);

          const successMsg = getSuccessMessage('delete', 'العميل');
          toast({
            title: successMsg.title,
            description: successMsg.description,
          });
        } catch (error) {
          const appError = handleError(error);
          logError(appError, { operation: 'deleteClient', clientId }, user?.uid);

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
      phone: "",
      email: "",
      address: "",
      balance: "0",
    });
    setValidationErrors({});
    setEditingClient(null);
  };

  const openAddDialog = () => {
    resetForm();
    setIsDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">إدارة العملاء</h1>
          <p className="text-gray-600 mt-2">إضافة وتتبع معلومات العملاء</p>
        </div>
        <PermissionGate action="create" module="clients">
          <Button className="gap-2" onClick={openAddDialog} aria-label="إضافة عميل جديد">
            <Plus className="w-4 h-4" aria-hidden="true" />
            إضافة عميل جديد
          </Button>
        </PermissionGate>
      </div>

      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-slate-800">قائمة العملاء ({clients.length})</h2>
        {dataLoading ? (
          <TableSkeleton rows={10} />
        ) : clients.length === 0 ? (
          <p className="text-slate-500 text-center py-12">
            لا يوجد عملاء حالياً. اضغط على &quot;إضافة عميل جديد&quot; للبدء.
          </p>
        ) : (
          <div className="card-modern overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/80 hover:bg-slate-50/80">
                  <TableHead className="text-right font-semibold text-slate-700">الاسم</TableHead>
                  <TableHead className="text-right font-semibold text-slate-700">الهاتف</TableHead>
                  <TableHead className="text-right font-semibold text-slate-700">البريد الإلكتروني</TableHead>
                  <TableHead className="text-right font-semibold text-slate-700">العنوان</TableHead>
                  <TableHead className="text-right font-semibold text-slate-700">الرصيد</TableHead>
                  <TableHead className="text-right font-semibold text-slate-700">الإجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clients.map((client) => (
                  <TableRow key={client.id} className="table-row-hover">
                    <TableCell className="font-medium">{client.name}</TableCell>
                    <TableCell>{client.phone}</TableCell>
                    <TableCell>{client.email}</TableCell>
                    <TableCell>{client.address}</TableCell>
                    <TableCell>
                      <span className={`font-semibold ${(client.balance || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {(client.balance || 0).toLocaleString()} دينار
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1" role="group" aria-label="إجراءات العميل">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-slate-400 hover:text-blue-600 hover:bg-blue-50"
                          onClick={() => router.push(`/clients/${client.id}`)}
                          aria-label={`عرض تفاصيل ${client.name}`}
                        >
                          <Eye className="h-4 w-4" aria-hidden="true" />
                        </Button>
                        <PermissionGate action="update" module="clients">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                            onClick={() => handleEdit(client)}
                            aria-label={`تعديل ${client.name}`}
                          >
                            <Edit className="h-4 w-4" aria-hidden="true" />
                          </Button>
                        </PermissionGate>
                        <PermissionGate action="delete" module="clients">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-slate-400 hover:text-red-600 hover:bg-red-50"
                            onClick={() => handleDelete(client.id)}
                            aria-label={`حذف ${client.name}`}
                          >
                            <Trash2 className="h-4 w-4" aria-hidden="true" />
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
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingClient ? "تعديل بيانات العميل" : "إضافة عميل جديد"}
            </DialogTitle>
            <DialogDescription>
              {editingClient
                ? "قم بتعديل بيانات العميل أدناه"
                : "أدخل بيانات العميل الجديد أدناه"}
            </DialogDescription>
          </DialogHeader>

          {Object.keys(validationErrors).length > 0 && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                يرجى تصحيح الأخطاء أدناه
              </AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit}>
            <div className="grid gap-4 py-4">
              <ValidatedInput
                label="الاسم"
                name="name"
                value={formData.name}
                onChange={(value) => setFormData({ ...formData, name: value })}
                required
                error={validationErrors.name}
                hint="اسم العميل الكامل"
                maxLength={100}
              />

              <ValidatedInput
                label="رقم الهاتف"
                name="phone"
                value={formData.phone}
                onChange={(value) => setFormData({ ...formData, phone: value })}
                error={validationErrors.phone}
                hint="رقم من 7 إلى 20 خانة"
                maxLength={20}
              />

              <ValidatedInput
                label="البريد الإلكتروني"
                name="email"
                type="email"
                value={formData.email}
                onChange={(value) => setFormData({ ...formData, email: value })}
                error={validationErrors.email}
                hint="اختياري"
              />

              <ValidatedInput
                label="العنوان"
                name="address"
                value={formData.address}
                onChange={(value) => setFormData({ ...formData, address: value })}
                error={validationErrors.address}
                hint="اختياري"
                maxLength={200}
              />

              <ValidatedInput
                label="الرصيد الافتتاحي (دينار)"
                name="balance"
                type="number"
                value={formData.balance}
                onChange={(value) => setFormData({ ...formData, balance: value })}
                error={validationErrors.balance}
                hint="الرصيد عند إنشاء الحساب (افتراضي: 0)"
                showSuccessIndicator={false}
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsDialogOpen(false);
                  resetForm();
                }}
              >
                إلغاء
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? "جاري الحفظ..." : editingClient ? "تحديث" : "إضافة"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {confirmationDialog}
    </div>
  );
}
