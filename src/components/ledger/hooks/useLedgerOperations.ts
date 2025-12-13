/**
 * Custom hook for ledger CRUD operations
 * Thin wrapper around LedgerService that handles UI concerns (toasts)
 */

import { useUser } from "@/firebase/provider";
import { useToast } from "@/hooks/use-toast";
import { LedgerEntry } from "../utils/ledger-constants";
import { handleError, getErrorTitle } from "@/lib/error-handling";
import { createLedgerService, CreateLedgerEntryOptions } from "@/services/ledgerService";
import type {
  LedgerFormData,
  CheckFormData,
  OutgoingCheckFormData,
  InventoryFormData,
  FixedAssetFormData,
  PaymentFormData,
  ChequeRelatedFormData,
  InventoryRelatedFormData,
} from "../types/ledger";

export function useLedgerOperations() {
  const { user, role } = useUser();
  const { toast } = useToast();

  /**
   * Add or update a ledger entry
   */
  const submitLedgerEntry = async (
    formData: LedgerFormData,
    editingEntry: LedgerEntry | null,
    options: {
      hasIncomingCheck?: boolean;
      checkFormData?: CheckFormData;
      hasOutgoingCheck?: boolean;
      outgoingCheckFormData?: OutgoingCheckFormData;
      // Multiple cheques support
      incomingChequesList?: CheckFormData[];
      outgoingChequesList?: OutgoingCheckFormData[];
      hasInventoryUpdate?: boolean;
      inventoryFormData?: InventoryFormData;
      hasFixedAsset?: boolean;
      fixedAssetFormData?: FixedAssetFormData;
      hasInitialPayment?: boolean;
      initialPaymentAmount?: string;
    } = {}
  ): Promise<boolean> => {
    if (!user) { return false; }

    const service = createLedgerService(user.dataOwnerId, user.email || '', role || 'owner');

    try {
      if (editingEntry) {
        // Update existing entry
        const result = await service.updateLedgerEntry(editingEntry.id, formData);

        if (result.success) {
          toast({
            title: "تم التحديث بنجاح",
            description: "تم تحديث الحركة المالية",
          });
          return true;
        } else {
          toast({
            title: "خطأ",
            description: result.error || "حدث خطأ أثناء تحديث الحركة المالية",
            variant: "destructive",
          });
          return false;
        }
      }

      // Determine if we need batch operations
      const needsBatch =
        options.hasIncomingCheck ||
        options.hasOutgoingCheck ||
        options.hasInventoryUpdate ||
        options.hasFixedAsset ||
        options.hasInitialPayment ||
        formData.trackARAP ||
        formData.immediateSettlement;

      if (needsBatch) {
        const serviceOptions: CreateLedgerEntryOptions = {
          hasIncomingCheck: options.hasIncomingCheck,
          checkFormData: options.checkFormData,
          hasOutgoingCheck: options.hasOutgoingCheck,
          outgoingCheckFormData: options.outgoingCheckFormData,
          // Multiple cheques support
          incomingChequesList: options.incomingChequesList,
          outgoingChequesList: options.outgoingChequesList,
          hasInventoryUpdate: options.hasInventoryUpdate,
          inventoryFormData: options.inventoryFormData,
          hasFixedAsset: options.hasFixedAsset,
          fixedAssetFormData: options.fixedAssetFormData,
          hasInitialPayment: options.hasInitialPayment,
          initialPaymentAmount: options.initialPaymentAmount,
        };

        const result = await service.createLedgerEntryWithRelated(formData, serviceOptions);

        if (result.success) {
          toast({
            title: "تمت الإضافة بنجاح",
            description: "تم إضافة الحركة المالية وجميع السجلات المرتبطة",
          });
          return true;
        } else {
          toast({
            title: "خطأ",
            description: result.error || "حدث خطأ أثناء حفظ الحركة المالية",
            variant: "destructive",
          });
          return false;
        }
      } else {
        // Simple ledger entry without batch
        const result = await service.createSimpleLedgerEntry(formData);

        if (result.success) {
          toast({
            title: "تمت الإضافة بنجاح",
            description: "تم إضافة الحركة المالية",
          });
          return true;
        } else {
          toast({
            title: "خطأ",
            description: result.error || "حدث خطأ أثناء حفظ الحركة المالية",
            variant: "destructive",
          });
          return false;
        }
      }
    } catch (error) {
      console.error("Error submitting ledger entry:", error);
      toast({
        title: "خطأ",
        description: "حدث خطأ أثناء حفظ الحركة المالية",
        variant: "destructive",
      });
      return false;
    }
  };

  /**
   * Delete a ledger entry and all related records
   */
  const deleteLedgerEntry = async (
    entry: LedgerEntry,
    entries: LedgerEntry[]
  ): Promise<boolean> => {
    if (!user) { return false; }

    const service = createLedgerService(user.dataOwnerId, user.email || '', role || 'owner');

    try {
      const result = await service.deleteLedgerEntry(entry);

      if (result.success) {
        const deletedCount = result.deletedRelatedCount || 0;
        toast({
          title: "تم الحذف",
          description: deletedCount > 0
            ? `تم حذف الحركة المالية و ${deletedCount} سجل مرتبط`
            : "تم حذف الحركة المالية بنجاح",
        });
        return true;
      } else {
        toast({
          title: "خطأ",
          description: result.error || "حدث خطأ أثناء حذف الحركة المالية",
          variant: "destructive",
        });
        return false;
      }
    } catch (error) {
      const appError = handleError(error);
      toast({
        title: getErrorTitle(appError),
        description: appError.message,
        variant: "destructive",
      });
      return false;
    }
  };

  /**
   * Add a payment to an existing ledger entry
   */
  const addPaymentToEntry = async (
    entry: LedgerEntry,
    formData: PaymentFormData
  ): Promise<boolean> => {
    if (!user) { return false; }

    const service = createLedgerService(user.dataOwnerId, user.email || '', role || 'owner');

    try {
      const result = await service.addPaymentToEntry(entry, formData);

      if (result.success) {
        toast({
          title: "تمت الإضافة بنجاح",
          description: entry.isARAPEntry
            ? `تم إضافة الدفعة وتحديث الرصيد المتبقي`
            : "تم إضافة الدفعة المرتبطة بالمعاملة",
        });
        return true;
      } else {
        toast({
          title: "خطأ",
          description: result.error || "حدث خطأ أثناء إضافة الدفعة",
          variant: "destructive",
        });
        return false;
      }
    } catch (error) {
      const appError = handleError(error);
      toast({
        title: getErrorTitle(appError),
        description: appError.message,
        variant: "destructive",
      });
      return false;
    }
  };

  /**
   * Add a cheque to an existing ledger entry
   */
  const addChequeToEntry = async (
    entry: LedgerEntry,
    formData: ChequeRelatedFormData
  ): Promise<boolean> => {
    if (!user) { return false; }

    const service = createLedgerService(user.dataOwnerId, user.email || '', role || 'owner');

    try {
      const result = await service.addChequeToEntry(entry, formData);

      if (result.success) {
        const accountingType = formData.accountingType || "cashed";

        if (accountingType === "cashed") {
          toast({
            title: "تمت الإضافة بنجاح",
            description: "تم إضافة شيك الصرف وتسجيل الدفعة وتحديث الرصيد",
          });
        } else if (accountingType === "postponed") {
          toast({
            title: "تمت الإضافة بنجاح",
            description: "تم تسجيل الشيك المؤجل. لن يؤثر على الرصيد حتى يتم تأكيد التحصيل من صفحة الشيكات.",
          });
        } else if (accountingType === "endorsed") {
          toast({
            title: "تم التظهير بنجاح",
            description: `تم تظهير الشيك رقم ${formData.chequeNumber} إلى ${formData.endorsedToName}`,
          });
        }
        return true;
      } else {
        toast({
          title: "خطأ",
          description: result.error || "حدث خطأ أثناء إضافة الشيك",
          variant: "destructive",
        });
        return false;
      }
    } catch (error) {
      const appError = handleError(error);
      toast({
        title: getErrorTitle(appError),
        description: appError.message,
        variant: "destructive",
      });
      return false;
    }
  };

  /**
   * Add inventory movement to an existing ledger entry
   */
  const addInventoryToEntry = async (
    entry: LedgerEntry,
    formData: InventoryRelatedFormData
  ): Promise<boolean> => {
    if (!user) { return false; }

    const service = createLedgerService(user.dataOwnerId, user.email || '', role || 'owner');

    try {
      const result = await service.addInventoryToEntry(entry, formData);

      if (result.success) {
        toast({
          title: "تمت الإضافة بنجاح",
          description: "تم إضافة حركة المخزون المرتبطة بالمعاملة",
        });
        return true;
      } else {
        toast({
          title: "خطأ",
          description: result.error || "حدث خطأ أثناء إضافة حركة المخزون",
          variant: "destructive",
        });
        return false;
      }
    } catch (error) {
      const appError = handleError(error);
      toast({
        title: getErrorTitle(appError),
        description: appError.message,
        variant: "destructive",
      });
      return false;
    }
  };

  return {
    submitLedgerEntry,
    deleteLedgerEntry,
    addPaymentToEntry,
    addChequeToEntry,
    addInventoryToEntry,
  };
}
