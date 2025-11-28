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
  X,
} from "lucide-react";

// عناصر التنقل الرئيسية - تظهر في شريط التنقل السفلي
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
  {
    title: "الشيكات",
    href: "/incoming-cheques",
    icon: FileText,
  },
];

// عناصر القائمة الإضافية - تظهر في الدرج السفلي
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

  // التحقق من العنصر النشط
  const isActive = (href: string) => pathname === href;

  // التحقق من أن أي عنصر من قائمة المزيد نشط
  const isMoreActive = moreMenuItems.some((item) => pathname === item.href);

  // تسجيل الخروج
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
      {/* شريط التنقل السفلي - يظهر فقط على الشاشات الصغيرة */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-40 md:hidden"
        role="navigation"
        aria-label="التنقل الرئيسي للجوال"
      >
        {/* خلفية مع تأثير الضبابية */}
        <div className="bg-white/95 backdrop-blur-lg border-t border-gray-200 shadow-lg">
          {/* منطقة آمنة للأجهزة مع مؤشر الصفحة الرئيسية */}
          <div className="pb-safe">
            <div className="flex items-center justify-around px-2 py-2">
              {/* عناصر التنقل الرئيسية */}
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
                      className={cn(
                        "w-6 h-6 mb-1",
                        active && "text-primary"
                      )}
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

              {/* زر المزيد */}
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
                  className={cn(
                    "w-6 h-6 mb-1",
                    isMoreActive && "text-primary"
                  )}
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

      {/* درج القائمة الإضافية */}
      <Sheet open={isMoreOpen} onOpenChange={setIsMoreOpen}>
        <SheetContent>
          <SheetHeader className="text-right">
            <SheetTitle>القائمة</SheetTitle>
            <SheetDescription>
              الوصول السريع للخيارات الإضافية
            </SheetDescription>
          </SheetHeader>

          <div className="py-4 px-2">
            {/* عناصر القائمة الإضافية */}
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

            {/* فاصل */}
            <div className="my-4 border-t border-gray-200" />

            {/* زر تسجيل الخروج */}
            <button
              onClick={handleLogout}
              className="flex items-center gap-4 w-full px-4 py-3 rounded-xl text-red-600 hover:bg-red-50 transition-colors"
              aria-label="تسجيل الخروج من النظام"
            >
              <LogOut className="w-5 h-5" aria-hidden="true" />
              <span className="font-medium">تسجيل الخروج</span>
            </button>
          </div>

          {/* مساحة إضافية للأمان */}
          <div className="h-8" />
        </SheetContent>
      </Sheet>
    </>
  );
}
