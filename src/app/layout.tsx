import type { Metadata } from "next";
import { Cairo } from "next/font/google";
import "./globals.css";
import { FirebaseClientProvider } from "@/firebase/provider";
import { Toaster } from "@/components/ui/toaster";

const cairo = Cairo({ subsets: ["arabic", "latin"] });

export const metadata: Metadata = {
  title: "FactoryFlow - نظام إدارة المصنع",
  description: "نظام متكامل لإدارة العمليات المالية والمخزون",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ar" dir="rtl">
      <body className={cairo.className}>
        <FirebaseClientProvider>
          {children}
          <Toaster />
        </FirebaseClientProvider>
      </body>
    </html>
  );
}
