"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "firebase/auth";
import { auth } from "@/firebase/config";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
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
  ArrowDownLeft,
  ArrowUpRight,
} from "lucide-react";

const mainNavItems = [
  {
    title: "الرئيسية",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    title: "العملاء",
    href: "/clients",
    icon: Users,
  },
  {
    title: "دفتر الأستاذ",
    href: "/ledger",
    icon: BookOpen,
  },
];

const chequePages = [
  {
    title: "الشيكات الواردة",
    href: "/incoming-cheques",
    icon: ArrowDownLeft,
  },
  {
    title: "الشيكات الصادرة",
    href: "/outgoing-cheques",
    icon: ArrowUpRight,
  },
];

const moreMenuItems = [
  {
    title: "المدفوعات",
    href: "/payments",
    icon: CreditCard,
  },
  {
    title: "المخزون",
    href: "/inventory",
    icon: Package,
  },
  {
    title: "الإعدادات",
    href: "/production",
    icon: Settings,
  },
];

export default function MobileNav() {
  const pathname = usePathname();
  const { toast } = useToast();
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const [isChequesOpen, setIsChequesOpen] = useState(false);

  const isActive = (href: string) => pathname === href;
  const isMoreActive = moreMenuItems.some((item) => pathname === item.href);
  const isChequesActive = chequePages.some((item) => pathname === item.href);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setIsMoreOpen(false);
      toast({
        title: "تم تسجيل الخروج",
        description: "نراك قريباً",
      });
    } catch (error) {
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
              {mainNavItems.map((item) => {
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
                    aria-label={item.title}
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
                      {item.title}
                    </span>
                  </Link>
                );
              })}

              <button
                onClick={() => setIsChequesOpen(true)}
                className={cn(
                  "flex flex-col items-center justify-center min-w-[64px] py-2 px-3 rounded-xl transition-all duration-200",
                  isChequesActive
                    ? "text-primary bg-primary/10"
                    : "text-gray-500 hover:text-gray-700 hover:bg-gray-100"
                )}
                aria-label="الشيكات"
                aria-expanded={isChequesOpen}
                aria-haspopup="dialog"
              >
                <FileText
                  className={cn("w-6 h-6 mb-1", isChequesActive && "text-primary")}
                  aria-hidden="true"
                />
                <span
                  className={cn(
                    "text-[10px] font-medium leading-tight",
                    isChequesActive ? "text-primary" : "text-gray-500"
                  )}
                >
                  الشيكات
                </span>
              </button>

              <button
                onClick={() => setIsMoreOpen(true)}
                className={cn(
                  "flex flex-col items-center justify-center min-w-[64px] py-2 px-3 rounded-xl transition-all duration-200",
                  isMoreActive
                    ? "text-primary bg-primary/10"
                    : "text-gray-500 hover:text-gray-700 hover:bg-gray-100"
                )}
                aria-label="المزيد من الخيارات"
                aria-expanded={isMoreOpen}
                aria-haspopup="dialog"
              >
                <Menu
                  className={cn("w-6 h-6 mb-1", isMoreActive && "text-primary")}
                  aria-hidden="true"
                />
                <span
                  className={cn(
                    "text-[10px] font-medium leading-tight",
                    isMoreActive ? "text-primary" : "text-gray-500"
                  )}
                >
                  المزيد
                </span>
              </button>
            </div>
          </div>
        </div>
      </nav>

      <Sheet open={isChequesOpen} onOpenChange={setIsChequesOpen}>
        <SheetContent>
          <SheetHeader className="text-right">
            <SheetTitle>الشيكات</SheetTitle>
            <SheetDescription>اختر نوع الشيكات</SheetDescription>
          </SheetHeader>

          <div className="py-4 px-2">
            <div className="space-y-2">
              {chequePages.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.href);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setIsChequesOpen(false)}
                    className={cn(
                      "flex items-center gap-4 px-4 py-4 rounded-xl transition-colors",
                      active
                        ? "bg-primary text-white"
                        : "text-gray-700 hover:bg-gray-100"
                    )}
                    aria-current={active ? "page" : undefined}
                  >
                    <Icon className="w-6 h-6" aria-hidden="true" />
                    <span className="font-medium text-base">{item.title}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <Sheet open={isMoreOpen} onOpenChange={setIsMoreOpen}>
        <SheetContent>
          <SheetHeader className="text-right">
            <SheetTitle>القائمة</SheetTitle>
            <SheetDescription>الوصول السريع للخيارات الإضافية</SheetDescription>
          </SheetHeader>

          <div className="py-4 px-2">
            <div className="space-y-1">
              {moreMenuItems.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.href);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setIsMoreOpen(false)}
                    className={cn(
                      "flex items-center gap-4 px-4 py-3 rounded-xl transition-colors",
                      active
                        ? "bg-primary text-white"
                        : "text-gray-700 hover:bg-gray-100"
                    )}
                    aria-current={active ? "page" : undefined}
                  >
                    <Icon className="w-5 h-5" aria-hidden="true" />
                    <span className="font-medium">{item.title}</span>
                  </Link>
                );
              })}
            </div>

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
