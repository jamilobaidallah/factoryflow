import type { Metadata } from "next";
import { Cairo } from "next/font/google";
import "./globals.css";
import { FirebaseClientProvider } from "@/firebase/provider";
import { QueryProvider } from "@/components/providers/QueryProvider";
import { Toaster } from "@/components/ui/toaster";

const cairo = Cairo({
  subsets: ["arabic", "latin"],
  weight: ["200", "300", "400", "500", "600", "700", "800", "900"],
  display: "swap",
  variable: "--font-cairo",
});

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
    <html lang="ar" dir="rtl" className={cairo.variable}>
      <body className={cairo.className}>
        <FirebaseClientProvider>
          <QueryProvider>
            {children}
            <Toaster />
          </QueryProvider>
        </FirebaseClientProvider>
      </body>
    </html>
  );
}
