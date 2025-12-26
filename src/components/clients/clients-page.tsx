"use client";

import { useReducer } from "react";
import { useRouter } from "next/navigation";
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
import { Plus, Edit, Trash2, AlertCircle } from "lucide-react";
import { PermissionGate } from "@/components/auth";
import { useConfirmation } from "@/components/ui/confirmation-dialog";
import { TableSkeleton } from "@/components/ui/loading-skeleton";
import { useUser } from "@/firebase/provider";
import { useToast } from "@/hooks/use-toast";
import { collection, addDoc, updateDoc, deleteDoc, doc } from "firebase/firestore";
import { firestore } from "@/firebase/config";
import { formatNumber } from "@/lib/date-utils";
import { logActivity } from "@/services/activityLogService";
import {
  useClientsPageData,
  type Client,
  type ClientBalance,
} from "@/hooks/firebase-query/useClientsQueries";

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

// Form data type
interface FormData {
  name: string;
  phone: string;
  email: string;
  address: string;
  balance: string;
}

const initialFormData: FormData = {
  name: "",
  phone: "",
  email: "",
  address: "",
  balance: "0",
};

// UI state management with useReducer
interface UIState {
  isDialogOpen: boolean;
  editingClient: Client | null;
  loading: boolean;
  formData: FormData;
  validationErrors: Record<string, string>;
}

type UIAction =
  | { type: 'OPEN_ADD_DIALOG' }
  | { type: 'OPEN_EDIT_DIALOG'; client: Client }
  | { type: 'CLOSE_DIALOG' }
  | { type: 'SET_LOADING'; value: boolean }
  | { type: 'SET_FORM_DATA'; data: FormData }
  | { type: 'UPDATE_FORM_FIELD'; field: keyof FormData; value: string }
  | { type: 'SET_VALIDATION_ERRORS'; errors: Record<string, string> }
  | { type: 'RESET_FORM' };

const initialUIState: UIState = {
  isDialogOpen: false,
  editingClient: null,
  loading: false,
  formData: initialFormData,
  validationErrors: {},
};

function uiReducer(state: UIState, action: UIAction): UIState {
  switch (action.type) {
    case 'OPEN_ADD_DIALOG':
      return { ...state, isDialogOpen: true, editingClient: null, formData: initialFormData, validationErrors: {} };
    case 'OPEN_EDIT_DIALOG':
      return {
        ...state,
        isDialogOpen: true,
        editingClient: action.client,
        formData: {
          name: action.client.name || "",
          phone: action.client.phone || "",
          email: action.client.email || "",
          address: action.client.address || "",
          balance: (action.client.balance || 0).toString(),
        },
        validationErrors: {},
      };
    case 'CLOSE_DIALOG':
      return { ...state, isDialogOpen: false, editingClient: null, formData: initialFormData, validationErrors: {} };
    case 'SET_LOADING':
      return { ...state, loading: action.value };
    case 'SET_FORM_DATA':
      return { ...state, formData: action.data };
    case 'UPDATE_FORM_FIELD':
      return { ...state, formData: { ...state.formData, [action.field]: action.value } };
    case 'SET_VALIDATION_ERRORS':
      return { ...state, validationErrors: action.errors };
    case 'RESET_FORM':
      return { ...state, formData: initialFormData, validationErrors: {}, editingClient: null };
    default:
      return state;
  }
}

/** Displays client balance with appropriate styling */
function ClientBalanceDisplay({ balance }: { balance: number }) {
  const colorClass = balance > 0 ? 'text-red-600' : balance < 0 ? 'text-green-600' : '';
  const suffix = balance > 0 ? ' عليه' : balance < 0 ? ' له' : '';

  return (
    <span className={`font-semibold ${colorClass}`}>
      {formatNumber(Math.abs(balance))} دينار{suffix}
    </span>
  );
}

/** Get display balance: expectedBalance if available, otherwise currentBalance */
function getClientDisplayBalance(balanceData: ClientBalance | undefined): number {
  return balanceData?.expectedBalance ?? balanceData?.currentBalance ?? 0;
}

export default function ClientsPage() {
  const router = useRouter();
  const { user } = useUser();
  const { toast } = useToast();
  const { confirm, dialog: confirmationDialog } = useConfirmation();

  // Data from React Query hooks (4 subscriptions + balance calculation)
  const { clients, clientBalances, isLoading: dataLoading } = useClientsPageData();

  // UI state - consolidated with useReducer
  const [ui, dispatch] = useReducer(uiReducer, initialUIState);

  // Validate form data in real-time
  const validateForm = (data: FormData): boolean => {
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

    dispatch({ type: 'SET_VALIDATION_ERRORS', errors });
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) { return; }

    // Validate form
    if (!validateForm(ui.formData)) {
      toast({
        title: "خطأ في البيانات",
        description: "يرجى تصحيح الأخطاء والمحاولة مرة أخرى",
        variant: "destructive",
      });
      return;
    }

    dispatch({ type: 'SET_LOADING', value: true });

    try {
      // Check for duplicate name
      const isDuplicate = await checkDuplicateClient(
        ui.formData.name,
        user.dataOwnerId,
        ui.editingClient?.id
      );

      if (isDuplicate) {
        toast({
          title: "عميل مكرر",
          description: "يوجد عميل بنفس الاسم مسبقاً",
          variant: "destructive",
        });
        dispatch({ type: 'SET_VALIDATION_ERRORS', errors: { name: "يوجد عميل بنفس الاسم مسبقاً" } });
        dispatch({ type: 'SET_LOADING', value: false });
        return;
      }

      // Parse and validate data
      const balanceNum = parseNumericInput(ui.formData.balance) ?? 0;

      const clientData: ClientInput = {
        name: sanitizeString(ui.formData.name),
        phone: ui.formData.phone.trim(),
        email: ui.formData.email.trim(),
        address: ui.formData.address.trim(),
        balance: balanceNum,
      };

      // Final validation with Zod
      const validated = clientSchema.parse(clientData);

      if (ui.editingClient) {
        // Update existing client
        const clientRef = doc(firestore, `users/${user.dataOwnerId}/clients`, ui.editingClient.id);
        await updateDoc(clientRef, validated);

        // Log activity for update
        logActivity(user.dataOwnerId, {
          action: 'update',
          module: 'clients',
          targetId: ui.editingClient.id,
          userId: user.uid,
          userEmail: user.email || '',
          description: `تعديل بيانات عميل: ${validated.name}`,
          metadata: {
            phone: validated.phone,
            email: validated.email,
            balance: validated.balance,
          },
        });

        const successMsg = getSuccessMessage('update', 'العميل');
        toast({
          title: successMsg.title,
          description: successMsg.description,
        });
      } else {
        // Add new client
        const clientsRef = collection(firestore, `users/${user.dataOwnerId}/clients`);
        const docRef = await addDoc(clientsRef, {
          ...validated,
          createdAt: new Date(),
        });

        // Log activity for create
        logActivity(user.dataOwnerId, {
          action: 'create',
          module: 'clients',
          targetId: docRef.id,
          userId: user.uid,
          userEmail: user.email || '',
          description: `إضافة عميل: ${validated.name}`,
          metadata: {
            phone: validated.phone,
            email: validated.email,
            balance: validated.balance,
          },
        });

        const successMsg = getSuccessMessage('create', 'العميل');
        toast({
          title: successMsg.title,
          description: successMsg.description,
        });
      }

      dispatch({ type: 'CLOSE_DIALOG' });
    } catch (error) {
      const appError = handleError(error);
      logError(appError, { operation: 'saveClient', formData: ui.formData }, user?.uid);

      toast({
        title: getErrorTitle(appError),
        description: appError.message,
        variant: "destructive",
      });
    } finally {
      dispatch({ type: 'SET_LOADING', value: false });
    }
  };

  const handleEdit = (client: Client) => {
    dispatch({ type: 'OPEN_EDIT_DIALOG', client });
  };

  const handleDelete = (clientId: string) => {
    if (!user) { return; }

    const client = clients.find((c) => c.id === clientId);

    confirm(
      "حذف العميل",
      "هل أنت متأكد من حذف هذا العميل؟ لا يمكن التراجع عن هذا الإجراء.",
      async () => {
        try {
          const clientRef = doc(firestore, `users/${user.dataOwnerId}/clients`, clientId);
          await deleteDoc(clientRef);

          // Log activity for delete
          logActivity(user.dataOwnerId, {
            action: 'delete',
            module: 'clients',
            targetId: clientId,
            userId: user.uid,
            userEmail: user.email || '',
            description: `حذف عميل: ${client?.name || ''}`,
            metadata: {
              phone: client?.phone,
              email: client?.email,
              balance: client?.balance,
            },
          });

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

  const openAddDialog = () => {
    dispatch({ type: 'OPEN_ADD_DIALOG' });
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
                  <TableRow
                    key={client.id}
                    className="hover:bg-blue-50 cursor-pointer transition-colors duration-150"
                    onClick={() => router.push(`/clients/${client.id}`)}
                  >
                    <TableCell>
                      <span className="text-blue-600 font-medium hover:text-blue-800 hover:underline">
                        {client.name}
                      </span>
                    </TableCell>
                    <TableCell>{client.phone}</TableCell>
                    <TableCell>{client.email}</TableCell>
                    <TableCell>{client.address}</TableCell>
                    <TableCell>
                      <ClientBalanceDisplay
                        balance={getClientDisplayBalance(clientBalances.get(client.id))}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1" role="group" aria-label="إجراءات العميل">
                        <PermissionGate action="update" module="clients">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEdit(client);
                            }}
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
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(client.id);
                            }}
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

      <Dialog open={ui.isDialogOpen} onOpenChange={(open) => !open && dispatch({ type: 'CLOSE_DIALOG' })}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {ui.editingClient ? "تعديل بيانات العميل" : "إضافة عميل جديد"}
            </DialogTitle>
            <DialogDescription>
              {ui.editingClient
                ? "قم بتعديل بيانات العميل أدناه"
                : "أدخل بيانات العميل الجديد أدناه"}
            </DialogDescription>
          </DialogHeader>

          {Object.keys(ui.validationErrors).length > 0 && (
            <div className="px-6">
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  يرجى تصحيح الأخطاء أدناه
                </AlertDescription>
              </Alert>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="grid gap-4 px-6 py-4">
              <ValidatedInput
                label="الاسم"
                name="name"
                value={ui.formData.name}
                onChange={(value) => dispatch({ type: 'UPDATE_FORM_FIELD', field: 'name', value })}
                required
                error={ui.validationErrors.name}
                hint="اسم العميل الكامل"
                maxLength={100}
              />

              <ValidatedInput
                label="رقم الهاتف"
                name="phone"
                value={ui.formData.phone}
                onChange={(value) => dispatch({ type: 'UPDATE_FORM_FIELD', field: 'phone', value })}
                error={ui.validationErrors.phone}
                hint="رقم من 7 إلى 20 خانة"
                maxLength={20}
              />

              <ValidatedInput
                label="البريد الإلكتروني"
                name="email"
                type="email"
                value={ui.formData.email}
                onChange={(value) => dispatch({ type: 'UPDATE_FORM_FIELD', field: 'email', value })}
                error={ui.validationErrors.email}
                hint="اختياري"
              />

              <ValidatedInput
                label="العنوان"
                name="address"
                value={ui.formData.address}
                onChange={(value) => dispatch({ type: 'UPDATE_FORM_FIELD', field: 'address', value })}
                error={ui.validationErrors.address}
                hint="اختياري"
                maxLength={200}
              />

              <ValidatedInput
                label="الرصيد الافتتاحي (دينار)"
                name="balance"
                type="number"
                value={ui.formData.balance}
                onChange={(value) => dispatch({ type: 'UPDATE_FORM_FIELD', field: 'balance', value })}
                error={ui.validationErrors.balance}
                hint="الرصيد عند إنشاء الحساب (افتراضي: 0)"
                showSuccessIndicator={false}
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => dispatch({ type: 'CLOSE_DIALOG' })}
              >
                إلغاء
              </Button>
              <Button type="submit" disabled={ui.loading}>
                {ui.loading ? "جاري الحفظ..." : ui.editingClient ? "تحديث" : "إضافة"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {confirmationDialog}
    </div>
  );
}
