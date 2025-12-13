"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "firebase/auth";
import { auth } from "@/firebase/config";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { usePermissions } from "@/hooks/usePermissions";
import { USER_ROLE_LABELS } from "@/lib/constants";
import type { UserRole } from "@/types/rbac";

const ROLE_BADGE_STYLES: Record<UserRole, string> = {
  owner: "bg-primary/10 text-primary",
  accountant: "bg-blue-100 text-blue-700",
  viewer: "bg-slate-100 text-slate-600",
};
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  LayoutDashboard,
  Users,
  BookOpen,
  FileText,
  Menu,
  CreditCard,
  Package,
  Settings,
  LogOut,
  Search,
  FilePlus,
  FileMinus,
  Users2,
  UserCheck,
  Building2,
  BarChart3,
  Receipt,
  Database,
  ChevronLeft,
} from "lucide-react";

/** Navigation item */
interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

/** Navigation group */
interface NavGroup {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  items: NavItem[];
}

/** Bottom bar items (always visible) */
const bottomBarItems: NavItem[] = [
  { label: "الرئيسية", href: "/dashboard", icon: LayoutDashboard },
  { label: "البحث", href: "/search", icon: Search },
  { label: "دفتر الأستاذ", href: "/ledger", icon: BookOpen },
];

/** Navigation groups for the "More" menu */
const navigationGroups: NavGroup[] = [
  {
    id: "accounts",
    label: "الحسابات",
    icon: BookOpen,
    items: [
      { label: "المدفوعات", href: "/payments", icon: CreditCard },
      { label: "الفواتير", href: "/invoices", icon: Receipt },
    ],
  },
  {
    id: "cheques",
    label: "الشيكات",
    icon: FileText,
    items: [
      { label: "الشيكات الواردة", href: "/incoming-cheques", icon: FilePlus },
      { label: "الشيكات الصادرة", href: "/outgoing-cheques", icon: FileMinus },
    ],
  },
  {
    id: "parties",
    label: "الأطراف",
    icon: Users,
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
    items: [
      { label: "التقارير", href: "/reports", icon: BarChart3 },
      { label: "النسخ الاحتياطي", href: "/backup", icon: Database },
    ],
  },
];

/** Get all hrefs from navigation groups */
function getAllGroupHrefs(): string[] {
  return navigationGroups.flatMap((group) => group.items.map((item) => item.href));
}

interface MobileNavGroupProps {
  group: NavGroup;
  pathname: string;
  onNavigate: () => void;
}

function MobileNavGroup({ group, pathname, onNavigate }: MobileNavGroupProps) {
  const [isOpen, setIsOpen] = useState(() =>
    group.items.some((item) => pathname === item.href)
  );
  const Icon = group.icon;
  const hasActiveItem = group.items.some((item) => pathname === item.href);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger
        className={cn(
          "flex items-center justify-between w-full px-4 py-3 rounded-xl transition-colors",
          hasActiveItem
            ? "bg-primary/10 text-primary"
            : "text-gray-700 hover:bg-gray-100"
        )}
      >
        <div className="flex items-center gap-4">
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
        <div className="mr-6 mt-1 space-y-1 border-r border-gray-200 pr-2">
          {group.items.map((item) => {
            const ItemIcon = item.icon;
            const isActive = pathname === item.href;

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                className={cn(
                  "flex items-center gap-3 px-4 py-2.5 rounded-lg transition-colors text-sm",
                  isActive
                    ? "bg-primary text-white"
                    : "text-gray-600 hover:bg-gray-100"
                )}
                aria-current={isActive ? "page" : undefined}
              >
                <ItemIcon className="w-4 h-4" aria-hidden="true" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

export default function MobileNav() {
  const pathname = usePathname();
  const { toast } = useToast();
  const { role } = usePermissions();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const isActive = (href: string) => pathname === href;
  const isMenuActive = getAllGroupHrefs().includes(pathname);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setIsMenuOpen(false);
      toast({
        title: "تم تسجيل الخروج",
        description: "نراك قريباً",
      });
    } catch {
      toast({
        title: "خطأ",
        description: "حدث خطأ أثناء تسجيل الخروج",
        variant: "destructive",
      });
    }
  };

  return (
    <>
      <nav
        className="fixed bottom-0 left-0 right-0 z-40 md:hidden"
        role="navigation"
        aria-label="التنقل الرئيسي للجوال"
      >
        <div className="bg-white/95 backdrop-blur-lg border-t border-gray-200 shadow-lg">
          <div className="pb-safe">
            <div className="flex items-center justify-around px-2 py-2">
              {bottomBarItems.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.href);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex flex-col items-center justify-center min-w-[64px] py-2 px-3 rounded-xl transition-all duration-200",
                      active
                        ? "text-primary bg-primary/10"
                        : "text-gray-500 hover:text-gray-700 hover:bg-gray-100"
                    )}
                    aria-current={active ? "page" : undefined}
                    aria-label={item.label}
                  >
                    <Icon
                      className={cn("w-6 h-6 mb-1", active && "text-primary")}
                      aria-hidden="true"
                    />
                    <span
                      className={cn(
                        "text-[10px] font-medium leading-tight",
                        active ? "text-primary" : "text-gray-500"
                      )}
                    >
                      {item.label}
                    </span>
                  </Link>
                );
              })}

              <button
                onClick={() => setIsMenuOpen(true)}
                className={cn(
                  "flex flex-col items-center justify-center min-w-[64px] py-2 px-3 rounded-xl transition-all duration-200",
                  isMenuActive
                    ? "text-primary bg-primary/10"
                    : "text-gray-500 hover:text-gray-700 hover:bg-gray-100"
                )}
                aria-label="المزيد من الخيارات"
                aria-expanded={isMenuOpen}
                aria-haspopup="dialog"
              >
                <Menu
                  className={cn("w-6 h-6 mb-1", isMenuActive && "text-primary")}
                  aria-hidden="true"
                />
                <span
                  className={cn(
                    "text-[10px] font-medium leading-tight",
                    isMenuActive ? "text-primary" : "text-gray-500"
                  )}
                >
                  المزيد
                </span>
              </button>
            </div>
          </div>
        </div>
      </nav>

      <Sheet open={isMenuOpen} onOpenChange={setIsMenuOpen}>
        <SheetContent className="overflow-y-auto">
          <SheetHeader className="text-right">
            <div className="flex items-center justify-between">
              <SheetTitle>القائمة</SheetTitle>
              {role && (
                <span className={cn(
                  "text-xs px-2 py-0.5 rounded-full font-medium",
                  ROLE_BADGE_STYLES[role]
                )}>
                  {USER_ROLE_LABELS[role]}
                </span>
              )}
            </div>
            <SheetDescription>الوصول السريع لجميع الأقسام</SheetDescription>
          </SheetHeader>

          <div className="py-4 space-y-2">
            {navigationGroups.map((group) => (
              <MobileNavGroup
                key={group.id}
                group={group}
                pathname={pathname}
                onNavigate={() => setIsMenuOpen(false)}
              />
            ))}

            <div className="my-4 border-t border-gray-200" />

            <button
              onClick={handleLogout}
              className="flex items-center gap-4 w-full px-4 py-3 rounded-xl text-red-600 hover:bg-red-50 transition-colors"
              aria-label="تسجيل الخروج من النظام"
            >
              <LogOut className="w-5 h-5" aria-hidden="true" />
              <span className="font-medium">تسجيل الخروج</span>
            </button>
          </div>

          <div className="h-8" />
        </SheetContent>
      </Sheet>
    </>
  );
}
