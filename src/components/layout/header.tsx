"use client";

import { useUser } from "@/firebase/provider";
import { signOut } from "firebase/auth";
import { auth } from "@/firebase/config";
import { Button } from "@/components/ui/button";
import { LogOut, User } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Header() {
  const { user } = useUser();
  const { toast } = useToast();

  const handleLogout = async () => {
    try {
      await signOut(auth);
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
    <header
      className="min-h-[56px] md:h-16 bg-white border-b border-gray-200 flex items-center justify-between px-4 md:px-6 py-2 md:py-0"
      role="banner"
    >
      <div className="min-w-0 flex-1">
        <h2 className="text-sm md:text-lg font-semibold text-gray-900 truncate">
          نظام إدارة المصنع
        </h2>
      </div>

      <div className="hidden md:flex items-center gap-4">
        <div
          className="flex items-center gap-2 text-sm text-gray-600"
          aria-label="معلومات المستخدم"
        >
          <User className="w-4 h-4" aria-hidden="true" />
          <span>{user?.email}</span>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleLogout}
          className="gap-2"
          aria-label="تسجيل الخروج من النظام"
        >
          <LogOut className="w-4 h-4" aria-hidden="true" />
          تسجيل الخروج
        </Button>
      </div>
    </header>
  );
}
