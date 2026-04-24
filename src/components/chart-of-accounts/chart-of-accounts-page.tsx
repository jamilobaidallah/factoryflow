"use client";

import { useState, useCallback, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { useUser } from "@/firebase/provider";
import type { Account } from "@/types/accounting";
import {
  deactivateAccount,
  deleteAccount,
  backfillJournalAccountCodes,
  backfillSystemAccountFlags,
  migrateStoneBusinessAccounts,
} from "@/services/journalService";
import { AccountTree } from "./components/AccountTree";
import { AccountLedger } from "./components/AccountLedger";
import { AddAccountDialog } from "./components/AddAccountDialog";
import { useActiveAccounts } from "./hooks/useActiveAccounts";
import { usePermissions } from "@/hooks/usePermissions";
import { Button } from "@/components/ui/button";
import { DatabaseZap } from "lucide-react";

export function ChartOfAccountsPage() {
  const { user } = useUser();
  const { toast } = useToast();
  const { isOwner } = usePermissions();
  const { accounts, loading, error, refresh } = useActiveAccounts();

  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [migrating, setMigrating] = useState(false);
  const [migrationDone, setMigrationDone] = useState<boolean | null>(null);
  const [stoneMigrating, setStoneMigrating] = useState(false);
  const [stoneMigrationDone, setStoneMigrationDone] = useState<boolean | null>(null);

  // Read migration flags once the user ID is known (namespaced to prevent cross-user bleed)
  useEffect(() => {
    const uid = user?.dataOwnerId;
    if (!uid || typeof window === 'undefined') return;
    setMigrationDone(localStorage.getItem(`coa-backfill-done:${uid}`) === '1');
    setStoneMigrationDone(localStorage.getItem(`stone-biz-migration-done:${uid}`) === '1');
  }, [user?.dataOwnerId]);

  const selectedAccount = accounts.find((a) => a.code === selectedCode) ?? null;

  const handleSelectAccount = useCallback((code: string) => {
    setSelectedCode(code);
  }, []);

  const handleAddAccount = useCallback(() => {
    setEditingAccount(null);
    setAddDialogOpen(true);
  }, []);

  const handleEditAccount = useCallback((account: Account) => {
    setEditingAccount(account);
    setAddDialogOpen(true);
  }, []);

  const handleDeactivateAccount = useCallback(
    async (account: Account) => {
      if (!user?.dataOwnerId) return;
      const result = await deactivateAccount(user.dataOwnerId, account.id);
      if (result.success) {
        toast({ title: "تم التعطيل", description: `تم تعطيل الحساب ${account.nameAr}` });
        refresh();
        if (selectedCode === account.code) setSelectedCode(null);
      } else {
        toast({ title: "خطأ", description: result.error, variant: "destructive" });
      }
    },
    [user?.dataOwnerId, selectedCode, refresh, toast]
  );

  const handleDeleteAccount = useCallback(
    async (account: Account) => {
      if (!user?.dataOwnerId) return;
      const result = await deleteAccount(user.dataOwnerId, account.id);
      if (result.success) {
        toast({ title: "تم الحذف", description: `تم حذف الحساب ${account.nameAr}` });
        refresh();
        if (selectedCode === account.code) setSelectedCode(null);
      } else {
        toast({ title: "خطأ", description: result.error, variant: "destructive" });
      }
    },
    [user?.dataOwnerId, selectedCode, refresh, toast]
  );

  const handleMigrate = useCallback(async () => {
    if (!user?.dataOwnerId) return;
    setMigrating(true);
    try {
      const [codesResult, flagsResult] = await Promise.all([
        backfillJournalAccountCodes(user.dataOwnerId),
        backfillSystemAccountFlags(user.dataOwnerId),
      ]);
      const codesUpdated = codesResult.data ?? 0;
      const flagsUpdated = flagsResult.data ?? 0;
      if (codesResult.success && flagsResult.success) {
        localStorage.setItem(`coa-backfill-done:${user.dataOwnerId}`, '1');
        setMigrationDone(true);
        toast({
          title: "تم تحديث البيانات",
          description: `تم تحديث ${codesUpdated} قيد و${flagsUpdated} حساب`,
        });
      } else {
        toast({
          title: "خطأ جزئي",
          description: codesResult.error ?? flagsResult.error,
          variant: "destructive",
        });
      }
    } finally {
      setMigrating(false);
    }
  }, [user?.dataOwnerId, toast]);

  const handleStoneMigration = useCallback(async () => {
    if (!user?.dataOwnerId) return;
    setStoneMigrating(true);
    try {
      const result = await migrateStoneBusinessAccounts(user.dataOwnerId);
      if (result.success) {
        localStorage.setItem(`stone-biz-migration-done:${user.dataOwnerId}`, '1');
        setStoneMigrationDone(true);
        const phases = result.data?.phases ?? {};
        const summary = Object.values(phases).join('، ');
        toast({
          title: "تم ترحيل حسابات الأعمال الحجرية",
          description: summary || "اكتمل الترحيل بنجاح",
        });
        refresh();
      } else {
        toast({ title: "خطأ في الترحيل", description: result.error, variant: "destructive" });
      }
    } finally {
      setStoneMigrating(false);
    }
  }, [user?.dataOwnerId, toast, refresh]);

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] overflow-hidden" dir="rtl">
      {/* One-time migration banner — shown to owner until backfill is done */}
      {isOwner && !loading && accounts.length > 0 && migrationDone === false && (
        <div className="flex items-center gap-3 px-4 py-2 bg-amber-50 border-b border-amber-200 text-sm text-amber-800 shrink-0">
          <DatabaseZap className="h-4 w-4 shrink-0" />
          <span className="flex-1">
            لعرض القيود بشكل صحيح، يجب تحديث البيانات القديمة مرة واحدة فقط.
          </span>
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs border-amber-300 text-amber-800 hover:bg-amber-100"
            onClick={handleMigrate}
            disabled={migrating}
          >
            {migrating ? "جارٍ التحديث…" : "تحديث البيانات"}
          </Button>
        </div>
      )}
      {/* Stone business migration banner */}
      {isOwner && !loading && accounts.length > 0 && stoneMigrationDone === false && (
        <div className="flex items-center gap-3 px-4 py-2 bg-blue-50 border-b border-blue-200 text-sm text-blue-800 shrink-0">
          <DatabaseZap className="h-4 w-4 shrink-0" />
          <span className="flex-1">
            يجب تحديث دليل الحسابات ليناسب الأعمال الحجرية (إعادة تسمية الحسابات، إنشاء حسابات الشركاء).
          </span>
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs border-blue-300 text-blue-800 hover:bg-blue-100"
            onClick={handleStoneMigration}
            disabled={stoneMigrating}
          >
            {stoneMigrating ? "جارٍ الترحيل…" : "ترحيل حسابات الحجر"}
          </Button>
        </div>
      )}
      <div className="flex flex-1 overflow-hidden">
      {/* Left panel: account tree */}
      <div className="w-72 shrink-0 border-l border-slate-200 overflow-hidden flex flex-col bg-white">
        <AccountTree
          accounts={accounts}
          loading={loading}
          error={error}
          selectedCode={selectedCode}
          onSelectAccount={handleSelectAccount}
          onAddAccount={handleAddAccount}
          onEditAccount={handleEditAccount}
          onDeactivateAccount={handleDeactivateAccount}
          onDeleteAccount={handleDeleteAccount}
        />
      </div>

      {/* Right panel: account ledger */}
      <div className="flex-1 overflow-hidden flex flex-col bg-white">
        <AccountLedger account={selectedAccount} />
      </div>

      </div>

      {/* Add / Edit dialog */}
      <AddAccountDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        editAccount={editingAccount}
        existingCodes={accounts.map((a) => a.code)}
        onSuccess={refresh}
      />
    </div>
  );
}
