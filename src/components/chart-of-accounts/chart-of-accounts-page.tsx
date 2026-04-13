"use client";

import { useState, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { useUser } from "@/firebase/provider";
import type { Account } from "@/types/accounting";
import { deactivateAccount, deleteAccount } from "@/services/journalService";
import { AccountTree } from "./components/AccountTree";
import { AccountLedger } from "./components/AccountLedger";
import { AddAccountDialog } from "./components/AddAccountDialog";
import { useActiveAccounts } from "./hooks/useActiveAccounts";

export function ChartOfAccountsPage() {
  const { user } = useUser();
  const { toast } = useToast();
  const { accounts, loading, error, refresh } = useActiveAccounts();

  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);

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

  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden" dir="rtl">
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
