"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Receipt,
  BookOpen,
  Briefcase,
  ListTree,
} from "lucide-react";
import { useActiveProfile, clearActiveProfile } from "@/hooks/local/useActiveProfile";
import { cn } from "@/lib/utils";

/**
 * Navigation chrome shared by every /local/* page.
 *
 * Unlike the Firebase side (which authenticates a real user), the local app is
 * scoped to a "profile" — a single SQLite database file. This layout shows the
 * active profile and lets the user jump between the local feature pages without
 * each page re-implementing its own header.
 */

interface NavItem {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
}

const NAV_ITEMS: NavItem[] = [
  { href: "/local/dashboard",          label: "لوحة التحكم",     icon: LayoutDashboard },
  { href: "/local/clients",            label: "العملاء",          icon: Users },
  { href: "/local/ledger",             label: "السجل المالي",     icon: Receipt },
  { href: "/local/journal-entries",    label: "القيود المحاسبية", icon: BookOpen },
  { href: "/local/partners",           label: "الشركاء",          icon: Briefcase },
  { href: "/local/chart-of-accounts",  label: "دليل الحسابات",    icon: ListTree },
];

export default function LocalLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const profile = useActiveProfile();

  function handleSwitchProfile() {
    clearActiveProfile();
    router.push("/profile-picker");
  }

  return (
    <div dir="rtl" className="min-h-screen bg-slate-50 flex">
      {/* Sidebar — appears on the right in RTL */}
      <aside className="w-60 shrink-0 bg-white border-l border-slate-200 flex flex-col">
        <div className="px-5 py-4 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{profile?.emoji ?? "🏭"}</span>
            <div className="min-w-0">
              <h1 className="font-semibold text-slate-700 truncate">
                {profile?.name ?? "جاري التحميل..."}
              </h1>
              <p className="text-xs text-slate-400">النسخة المحلية</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary-50 text-primary-700"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="px-3 py-4 border-t border-slate-200 space-y-1">
          <Link
            href="/local-diagnostic"
            className="block rounded-lg px-3 py-2 text-sm text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-colors"
          >
            صفحة الاختبار
          </Link>
          <button
            onClick={handleSwitchProfile}
            className="w-full text-right rounded-lg px-3 py-2 text-sm text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-colors"
          >
            تبديل الملف ←
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 min-w-0 overflow-x-hidden">{children}</main>
    </div>
  );
}
