"use client";

import { useUser } from "@/firebase/provider";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";
import MobileNav from "@/components/layout/mobile-nav";
import FloatingActionButton from "@/components/layout/floating-action-button";
import { AccessRequestForm } from "@/components/auth";
import { Factory } from "lucide-react";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, role, loading, signOut } = useUser();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push("/");
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  // User exists but has no role - show access request form
  // المستخدم موجود لكن بدون دور - عرض نموذج طلب الوصول
  if (role === null) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        <div className="max-w-2xl mx-auto py-8">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="flex justify-center mb-4">
              <div className="p-3 bg-primary rounded-full">
                <Factory className="w-8 h-8 text-white" />
              </div>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">مرحباً في FactoryFlow</h1>
            <p className="text-gray-600">
              لا يوجد لديك صلاحية للوصول حالياً. يرجى طلب الوصول من مالك المصنع.
            </p>
          </div>

          {/* Access Request Form */}
          <AccessRequestForm />

          {/* Sign out option */}
          <div className="mt-6 text-center">
            <button
              onClick={() => signOut()}
              className="text-sm text-gray-500 hover:text-gray-700 underline"
            >
              تسجيل الخروج واستخدام حساب آخر
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-50">
      {/* الشريط الجانبي - مخفي على الشاشات الصغيرة */}
      <div className="hidden md:flex">
        <Sidebar />
      </div>
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        {/* المحتوى الرئيسي - مع مساحة سفلية للتنقل على الجوال */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6 pb-24 md:pb-6">
          {children}
        </main>
      </div>
      {/* شريط التنقل السفلي للجوال */}
      <MobileNav />
      {/* زر الإجراء العائم للجوال */}
      <FloatingActionButton />
    </div>
  );
}
