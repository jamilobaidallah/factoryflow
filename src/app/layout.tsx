import type { Metadata } from "next";
import "./globals.css";
import { FirebaseClientProvider } from "@/firebase/provider";
import { Toaster } from "@/components/ui/toaster";

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
      <head>
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Cairo:wght@200..1000&display=swap"
        />
      </head>
      <body className="font-cairo">
        <FirebaseClientProvider>
          {children}
          <Toaster />
        </FirebaseClientProvider>
      </body>
    </html>
  );
}
