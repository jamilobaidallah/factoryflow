"use client";

import { useState, useMemo } from "react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronDown, ChevronLeft, MoreHorizontal, Plus, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { buildAccountTree } from "../utils/buildAccountTree";
import type { AccountNode } from "../types/account-tree";
import type { Account } from "@/types/accounting";
import { usePermissions } from "@/hooks/usePermissions";

interface AccountTreeProps {
  accounts: Account[];
  loading: boolean;
  error: string | null;
  selectedCode: string | null;
  onSelectAccount: (code: string) => void;
  onAddAccount: () => void;
  onEditAccount: (account: Account) => void;
  onDeactivateAccount: (account: Account) => void;
  onDeleteAccount: (account: Account) => void;
}

const TYPE_LABELS: Record<string, string> = {
  asset: "الأصول",
  liability: "الالتزامات",
  equity: "حقوق الملكية",
  revenue: "الإيرادات",
  expense: "المصروفات",
};

const TYPE_ORDER = ["asset", "liability", "equity", "revenue", "expense"];

interface AccountRowProps {
  node: AccountNode;
  depth: number;
  selectedCode: string | null;
  onSelectAccount: (code: string) => void;
  onEditAccount: (account: Account) => void;
  onDeactivateAccount: (account: Account) => void;
  onDeleteAccount: (account: Account) => void;
  isOwner: boolean;
}

function AccountRow({
  node,
  depth,
  selectedCode,
  onSelectAccount,
  onEditAccount,
  onDeactivateAccount,
  onDeleteAccount,
  isOwner,
}: AccountRowProps) {
  const [open, setOpen] = useState(depth === 0);
  const hasChildren = node.children.length > 0;
  const isSelected = node.code === selectedCode;

  if (hasChildren) {
    return (
      <Collapsible open={open} onOpenChange={setOpen}>
        <div
          className={cn(
            "group flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm cursor-pointer hover:bg-slate-100 transition-colors",
            isSelected && "bg-primary-50 text-primary-700",
            depth > 0 && `mr-${depth * 4}`
          )}
          style={{ marginRight: depth * 16 }}
        >
          <CollapsibleTrigger asChild>
            <button
              className="flex items-center gap-1 flex-1 text-right"
              onClick={() => onSelectAccount(node.code)}
            >
              {open ? (
                <ChevronDown className="h-3.5 w-3.5 text-slate-400 shrink-0" />
              ) : (
                <ChevronLeft className="h-3.5 w-3.5 text-slate-400 shrink-0" />
              )}
              <span className="font-medium text-slate-500 ml-1 shrink-0">{node.code}</span>
              <span className="flex-1 truncate">{node.nameAr}</span>
              <span className="text-xs text-slate-400 shrink-0">({node.children.length})</span>
            </button>
          </CollapsibleTrigger>

          {isOwner && (
            <AccountMenu
              account={node}
              onEdit={onEditAccount}
              onDeactivate={onDeactivateAccount}
              onDelete={onDeleteAccount}
            />
          )}
        </div>
        <CollapsibleContent>
          {node.children.map((child) => (
            <AccountRow
              key={child.id}
              node={child}
              depth={depth + 1}
              selectedCode={selectedCode}
              onSelectAccount={onSelectAccount}
              onEditAccount={onEditAccount}
              onDeactivateAccount={onDeactivateAccount}
              onDeleteAccount={onDeleteAccount}
              isOwner={isOwner}
            />
          ))}
        </CollapsibleContent>
      </Collapsible>
    );
  }

  return (
    <div
      className={cn(
        "group flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm cursor-pointer hover:bg-slate-100 transition-colors",
        isSelected && "bg-primary-50 text-primary-700"
      )}
      style={{ marginRight: depth * 16 }}
      onClick={() => onSelectAccount(node.code)}
    >
      <span className="w-3.5 shrink-0" />
      <span className="font-medium text-slate-500 ml-1 shrink-0">{node.code}</span>
      <span className="flex-1 truncate">{node.nameAr}</span>
      {isOwner && (
        <AccountMenu
          account={node}
          onEdit={onEditAccount}
          onDeactivate={onDeactivateAccount}
          onDelete={onDeleteAccount}
        />
      )}
    </div>
  );
}

interface AccountMenuProps {
  account: Account;
  onEdit: (account: Account) => void;
  onDeactivate: (account: Account) => void;
  onDelete: (account: Account) => void;
}

function AccountMenu({ account, onEdit, onDeactivate, onDelete }: AccountMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="p-0.5 rounded hover:bg-slate-200 opacity-0 group-hover:opacity-100 focus:opacity-100"
          onClick={(e) => e.stopPropagation()}
          aria-label="خيارات الحساب"
        >
          <MoreHorizontal className="h-3.5 w-3.5 text-slate-500" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="text-sm">
        <DropdownMenuItem onClick={() => onEdit(account)}>تعديل الاسم</DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => onDeactivate(account)}
          disabled={!!account.isSystemAccount}
        >
          تعطيل
        </DropdownMenuItem>
        <DropdownMenuItem
          className="text-danger-600"
          onClick={() => onDelete(account)}
          disabled={!!account.isSystemAccount}
        >
          حذف
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function AccountTree({
  accounts,
  loading,
  error,
  selectedCode,
  onSelectAccount,
  onAddAccount,
  onEditAccount,
  onDeactivateAccount,
  onDeleteAccount,
}: AccountTreeProps) {
  const { isOwner } = usePermissions();

  const tree = useMemo(() => buildAccountTree(accounts), [accounts]);

  // Group root nodes by type
  const grouped = useMemo(() => {
    const map = new Map<string, AccountNode[]>();
    for (const type of TYPE_ORDER) {
      map.set(type, []);
    }
    for (const node of tree) {
      const bucket = map.get(node.type) ?? [];
      bucket.push(node);
      map.set(node.type, bucket);
    }
    return map;
  }, [tree]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-slate-400">
        <Loader2 className="h-5 w-5 animate-spin ml-2" />
        <span>جارٍ تحميل الحسابات…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="px-4 py-8 text-sm text-danger-600 text-center">
        <p className="font-medium">فشل تحميل الحسابات</p>
        <p className="text-xs text-slate-400 mt-1">{error}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
        <h2 className="font-semibold text-slate-800">دليل الحسابات</h2>
        {isOwner && (
          <Button size="sm" onClick={onAddAccount} className="h-7 text-xs gap-1">
            <Plus className="h-3.5 w-3.5" />
            حساب جديد
          </Button>
        )}
      </div>

      {/* Tree */}
      <div className="flex-1 overflow-y-auto px-2 py-2 space-y-1">
        {TYPE_ORDER.map((type) => {
          const nodes = grouped.get(type) ?? [];
          if (nodes.length === 0) return null;
          return (
            <TypeGroup
              key={type}
              typeKey={type}
              label={TYPE_LABELS[type]}
              nodes={nodes}
              selectedCode={selectedCode}
              onSelectAccount={onSelectAccount}
              onAddAccount={onAddAccount}
              onEditAccount={onEditAccount}
              onDeactivateAccount={onDeactivateAccount}
              onDeleteAccount={onDeleteAccount}
              isOwner={isOwner}
            />
          );
        })}
      </div>
    </div>
  );
}

interface TypeGroupProps {
  typeKey: string;
  label: string;
  nodes: AccountNode[];
  selectedCode: string | null;
  onSelectAccount: (code: string) => void;
  onAddAccount: () => void;
  onEditAccount: (account: Account) => void;
  onDeactivateAccount: (account: Account) => void;
  onDeleteAccount: (account: Account) => void;
  isOwner: boolean;
}

function TypeGroup({
  label,
  nodes,
  selectedCode,
  onSelectAccount,
  onEditAccount,
  onDeactivateAccount,
  onDeleteAccount,
  isOwner,
}: TypeGroupProps) {
  const [open, setOpen] = useState(true);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex items-center gap-1.5 w-full px-2 py-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wide hover:text-slate-700 transition-colors">
        {open ? (
          <ChevronDown className="h-3 w-3" />
        ) : (
          <ChevronLeft className="h-3 w-3" />
        )}
        {label}
        <span className="mr-auto text-slate-400 font-normal normal-case">({nodes.length})</span>
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-0.5">
        {nodes.map((node) => (
          <AccountRow
            key={node.id}
            node={node}
            depth={0}
            selectedCode={selectedCode}
            onSelectAccount={onSelectAccount}
            onEditAccount={onEditAccount}
            onDeactivateAccount={onDeactivateAccount}
            onDeleteAccount={onDeleteAccount}
            isOwner={isOwner}
          />
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
}
