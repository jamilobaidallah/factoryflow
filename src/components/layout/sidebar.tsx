"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  LayoutDashboard,
  Users,
  BookOpen,
  CreditCard,
  FilePlus,
  FileMinus,
  Package,
  Settings,
  UserCheck,
  Building2,
  BarChart3,
  Receipt,
  Search,
  Users2,
  Database,
  Factory,
  ChevronLeft,
  FileText,
  UserCog,
} from "lucide-react";
import { usePermissions } from "@/hooks/usePermissions";

/** Navigation item within a group */
interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

/** Collapsible navigation group */
interface NavGroup {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  items: NavItem[];
  defaultOpen?: boolean;
}

/** Top-level navigation items (always visible) */
const topLevelItems: NavItem[] = [
  { label: "لوحة التحكم", href: "/dashboard", icon: LayoutDashboard },
  { label: "البحث عن معاملة", href: "/search", icon: Search },
];

/** Grouped navigation structure */
const navigationGroups: NavGroup[] = [
  {
    id: "accounts",
    label: "الحسابات",
    icon: BookOpen,
    defaultOpen: true,
    items: [
      { label: "دفتر الأستاذ", href: "/ledger", icon: BookOpen },
      { label: "المدفوعات", href: "/payments", icon: CreditCard },
      { label: "الفواتير", href: "/invoices", icon: Receipt },
    ],
  },
  {
    id: "cheques",
    label: "الشيكات",
    icon: FileText,
    defaultOpen: false,
    items: [
      { label: "الشيكات الواردة", href: "/incoming-cheques", icon: FilePlus },
      { label: "الشيكات الصادرة", href: "/outgoing-cheques", icon: FileMinus },
    ],
  },
  {
    id: "parties",
    label: "الأطراف",
    icon: Users,
    defaultOpen: false,
    items: [
      { label: "العملاء", href: "/clients", icon: Users },
      { label: "الشركاء", href: "/partners", icon: Users2 },
      { label: "الموظفين", href: "/employees", icon: UserCheck },
    ],
  },
  {
    id: "inventory",
    label: "المخزون والإنتاج",
    icon: Package,
    defaultOpen: false,
    items: [
      { label: "المخزون", href: "/inventory", icon: Package },
      { label: "الإنتاج", href: "/production", icon: Settings },
      { label: "الأصول الثابتة", href: "/fixed-assets", icon: Building2 },
    ],
  },
  {
    id: "reports",
    label: "التقارير والنسخ",
    icon: BarChart3,
    defaultOpen: false,
    items: [
      { label: "التقارير", href: "/reports", icon: BarChart3 },
      { label: "النسخ الاحتياطي", href: "/backup", icon: Database },
    ],
  },
];

/** Admin navigation group (owner only) */
const adminGroup: NavGroup = {
  id: "admin",
  label: "الإدارة",
  icon: UserCog,
  defaultOpen: false,
  items: [
    { label: "إدارة المستخدمين", href: "/users", icon: UserCog },
  ],
};

const STORAGE_KEY = "sidebar-groups-state";

/** Load group open states from localStorage */
function loadGroupStates(): Record<string, boolean> {
  if (typeof window === "undefined") {
    return {};
  }
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch {
    // Ignore parse errors
  }
  return {};
}

/** Save group open states to localStorage */
function saveGroupStates(states: Record<string, boolean>): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(states));
  } catch {
    // Ignore storage errors
  }
}

/** Get initial open states - defaults + stored preferences */
function getInitialStates(pathname: string): Record<string, boolean> {
  const stored = loadGroupStates();
  const initial: Record<string, boolean> = {};

  for (const group of navigationGroups) {
    // Check if any item in this group matches the current path
    const hasActiveItem = group.items.some((item) => pathname === item.href);

    // Priority: active route > stored preference > default
    if (hasActiveItem) {
      initial[group.id] = true;
    } else if (stored[group.id] !== undefined) {
      initial[group.id] = stored[group.id];
    } else {
      initial[group.id] = group.defaultOpen ?? false;
    }
  }

  return initial;
}

interface SidebarGroupProps {
  group: NavGroup;
  isOpen: boolean;
  onToggle: (id: string) => void;
  pathname: string;
}

function SidebarGroup({ group, isOpen, onToggle, pathname }: SidebarGroupProps) {
  const Icon = group.icon;
  const hasActiveItem = group.items.some((item) => pathname === item.href);

  return (
    <Collapsible open={isOpen} onOpenChange={() => onToggle(group.id)}>
      <CollapsibleTrigger
        className={cn(
          "flex items-center justify-between w-full px-4 py-3 rounded-lg transition-colors",
          hasActiveItem
            ? "bg-primary/10 text-primary"
            : "text-gray-700 hover:bg-gray-100"
        )}
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-3">
          <Icon className="w-5 h-5" aria-hidden="true" />
          <span className="font-medium">{group.label}</span>
        </div>
        <ChevronLeft
          className={cn(
            "w-4 h-4 transition-transform duration-200",
            isOpen && "-rotate-90"
          )}
          aria-hidden="true"
        />
      </CollapsibleTrigger>
      <CollapsibleContent className="overflow-hidden data-[state=open]:animate-collapsible-down data-[state=closed]:animate-collapsible-up">
        <ul className="mt-1 mr-4 space-y-1 border-r border-gray-200 pr-2">
          {group.items.map((item) => {
            const ItemIcon = item.icon;
            const isActive = pathname === item.href;

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 px-4 py-2 rounded-lg transition-colors text-sm",
                    isActive
                      ? "bg-primary text-white"
                      : "text-gray-600 hover:bg-gray-100"
                  )}
                  aria-current={isActive ? "page" : undefined}
                  aria-label={item.label}
                >
                  <ItemIcon className="w-4 h-4" aria-hidden="true" />
                  <span>{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </CollapsibleContent>
    </Collapsible>
  );
}

export default function Sidebar() {
  const pathname = usePathname();
  const { role } = usePermissions();
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const [isHydrated, setIsHydrated] = useState(false);

  // Include admin group only for owners
  const allGroups = useMemo(() => {
    return role === "owner"
      ? [...navigationGroups, adminGroup]
      : navigationGroups;
  }, [role]);

  // Initialize state after hydration to avoid SSR mismatch
  useEffect(() => {
    setOpenGroups(getInitialStates(pathname));
    setIsHydrated(true);
  }, [pathname]);

  // Auto-expand group when navigating to a sub-item
  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    for (const group of allGroups) {
      const hasActiveItem = group.items.some((item) => pathname === item.href);
      if (hasActiveItem && !openGroups[group.id]) {
        setOpenGroups((prev) => {
          const next = { ...prev, [group.id]: true };
          saveGroupStates(next);
          return next;
        });
        break;
      }
    }
  }, [pathname, isHydrated, openGroups, allGroups]);

  const handleToggle = useCallback((id: string) => {
    setOpenGroups((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      saveGroupStates(next);
      return next;
    });
  }, []);

  return (
    <div className="w-64 bg-white border-l border-gray-200 flex flex-col">
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary rounded-lg">
            <Factory className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">FactoryFlow</h1>
            <p className="text-xs text-gray-500">نظام إدارة المصنع</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-4 overflow-y-auto" aria-label="القائمة الرئيسية">
        {/* Top-level items (always visible) */}
        <ul className="space-y-2 mb-4" role="list">
          {topLevelItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 rounded-lg transition-colors",
                    isActive
                      ? "bg-primary text-white"
                      : "text-gray-700 hover:bg-gray-100"
                  )}
                  aria-current={isActive ? "page" : undefined}
                  aria-label={item.label}
                >
                  <Icon className="w-5 h-5" aria-hidden="true" />
                  <span className="font-medium">{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>

        {/* Divider */}
        <div className="border-t border-gray-200 my-3" />

        {/* Collapsible groups */}
        <div className="space-y-2">
          {allGroups.map((group) => (
            <SidebarGroup
              key={group.id}
              group={group}
              isOpen={isHydrated ? (openGroups[group.id] ?? false) : (group.defaultOpen ?? false)}
              onToggle={handleToggle}
              pathname={pathname}
            />
          ))}
        </div>
      </nav>
    </div>
  );
}
