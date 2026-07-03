import type { Metadata } from "next";
import { Cairo } from "next/font/google";
import "./globals.css";
import { FirebaseClientProvider } from "@/firebase/provider";
import { QueryProvider } from "@/components/providers/QueryProvider";
import { Toaster } from "@/components/ui/toaster";
import {
  COMPANY_NAME_AR_FULL,
  COMPANY_DESCRIPTION_AR,
  LOGO_PATH,
} from "@/lib/branding";

const cairo = Cairo({
  subsets: ["arabic", "latin"],
  weight: ["200", "300", "400", "500", "600", "700", "800", "900"],
  display: "swap",
  variable: "--font-cairo",
});

export const metadata: Metadata = {
  title: COMPANY_NAME_AR_FULL,
  description: COMPANY_DESCRIPTION_AR,
  openGraph: {
    title: COMPANY_NAME_AR_FULL,
    description: COMPANY_DESCRIPTION_AR,
    images: [{ url: LOGO_PATH, width: 512, height: 512 }],
  },
  twitter: {
    card: "summary",
    title: COMPANY_NAME_AR_FULL,
    description: COMPANY_DESCRIPTION_AR,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ar" dir="rtl" className={cairo.variable}>
      <head>
        {/* Preconnect to Firebase services for faster initial load */}
        <link rel="preconnect" href="https://firestore.googleapis.com" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://identitytoolkit.googleapis.com" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://www.googleapis.com" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://firestore.googleapis.com" />
        <link rel="dns-prefetch" href="https://identitytoolkit.googleapis.com" />
      </head>
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
