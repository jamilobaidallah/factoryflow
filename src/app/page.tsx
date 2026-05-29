"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/firebase/provider";
import LoginPage from "@/components/auth/login-page";

/** True when the app is running inside Electron (window.electron bridge present). */
function isElectron(): boolean {
  return typeof window !== "undefined" && "electron" in window;
}

export default function Home() {
  const { user, loading } = useUser();
  const router = useRouter();

  useEffect(() => {
    // In the Electron local app, the home page should never redirect users
    // into the Firebase-backed routes — they don't have a Firebase auth
    // session in local mode. Send them to the profile picker instead.
    if (isElectron()) {
      router.replace("/profile-picker");
      return;
    }

    // Web (Vercel) flow: standard Firebase auth redirect.
    if (!loading && user) {
      router.push("/dashboard");
    }
  }, [user, loading, router]);

  // While the Electron check / Firebase auth resolves, show the spinner.
  if (isElectron() || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">جاري التحميل...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  return null;
}
