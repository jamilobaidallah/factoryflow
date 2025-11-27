"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Users,
  BookOpen,
  CreditCard,
  FileText,
  FilePlus,
  FileMinus,
  Package,
  Factory,
  Settings,
  UserCheck,
  Building2,
  BarChart3,
  Receipt,
  Search,
  Users2,
  Database,
} from "lucide-react";

const menuItems = [
  {
    title: "لوحة التحكم",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    title: "البحث عن معاملة",
    href: "/search",
    icon: Search,
  },
  {
    title: "العملاء",
    href: "/clients",
    icon: Users,
  },
  {
    title: "الشركاء",
    href: "/partners",
    icon: Users2,
  },
  {
    title: "دفتر الأستاذ",
    href: "/ledger",
    icon: BookOpen,
  },
  {
    title: "المدفوعات",
    href: "/payments",
    icon: CreditCard,
  },
  {
    title: "الشيكات الواردة",
    href: "/incoming-cheques",
    icon: FilePlus,
  },
  {
    title: "الشيكات الصادرة",
    href: "/outgoing-cheques",
    icon: FileMinus,
  },
  {
    title: "المخزون",
    href: "/inventory",
    icon: Package,
  },
  {
    title: "الإنتاج",
    href: "/production",
    icon: Settings,
  },
  {
    title: "الأصول الثابتة",
    href: "/fixed-assets",
    icon: Building2,
  },
  {
    title: "الموظفين",
    href: "/employees",
    icon: UserCheck,
  },
  {
    title: "الفواتير",
    href: "/invoices",
    icon: Receipt,
  },
  {
    title: "التقارير",
    href: "/reports",
    icon: BarChart3,
  },
  {
    title: "النسخ الاحتياطي",
    href: "/backup",
    icon: Database,
  },
];

export default function Sidebar() {
  const pathname = usePathname();

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

      <nav className="flex-1 p-4" aria-label="القائمة الرئيسية">
        <ul className="space-y-2" role="list">
          {menuItems.map((item) => {
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
                  aria-label={item.title}
                >
                  <Icon className="w-5 h-5" aria-hidden="true" />
                  <span className="font-medium">{item.title}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
