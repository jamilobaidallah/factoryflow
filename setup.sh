#!/bin/bash

# FactoryFlow - Complete Project Setup Script
# نظام إدارة المصنع - سكريبت الإعداد الكامل

echo "🏭 بدء إعداد مشروع FactoryFlow..."

# Create main project structure
mkdir -p src/{app,components/{ui,clients,ledger,payments,cheques,inventory,layout,dashboard},lib,firebase,hooks,contexts}
mkdir -p public
mkdir -p docs

# Create all necessary files
echo "📝 إنشاء جميع ملفات المشروع..."

# ==========================
# Main Application Files
# ==========================

# src/app/layout.tsx
cat > src/app/layout.tsx << 'EOF'
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
EOF

# src/app/page.tsx  
cat > src/app/page.tsx << 'EOF'
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/firebase/provider";
import LoginPage from "@/components/auth/login-page";
import DashboardPage from "@/components/dashboard/dashboard-page";

export default function Home() {
  const { user, loading } = useUser();
  const router = useRouter();

  if (loading) {
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

  return <DashboardPage />;
}
EOF

# src/app/(main)/layout.tsx
cat > src/app/\(main\)/layout.tsx << 'EOF'
"use client";

import { useUser } from "@/firebase/provider";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading } = useUser();
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

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
EOF

# Create all route pages
cat > src/app/\(main\)/clients/page.tsx << 'EOF'
"use client";

import ClientsPage from "@/components/clients/clients-page";

export default function Page() {
  return <ClientsPage />;
}
EOF

cat > src/app/\(main\)/ledger/page.tsx << 'EOF'
"use client";

import LedgerPage from "@/components/ledger/ledger-page";

export default function Page() {
  return <LedgerPage />;
}
EOF

cat > src/app/\(main\)/payments/page.tsx << 'EOF'
"use client";

import PaymentsPage from "@/components/payments/payments-page";

export default function Page() {
  return <PaymentsPage />;
}
EOF

cat > src/app/\(main\)/cheques/page.tsx << 'EOF'
"use client";

import ChequesPage from "@/components/cheques/cheques-page";

export default function Page() {
  return <ChequesPage />;
}
EOF

cat > src/app/\(main\)/inventory/page.tsx << 'EOF'
"use client";

import InventoryPage from "@/components/inventory/inventory-page";

export default function Page() {
  return <InventoryPage />;
}
EOF

echo "✅ تم إنشاء ملفات التطبيق الأساسية"

# ==========================
# Component Files - Part 1
# ==========================

# Create UI Components
cat > src/components/ui/button.tsx << 'EOF'
import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline: "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
EOF

cat > src/components/ui/card.tsx << 'EOF'
import * as React from "react"
import { cn } from "@/lib/utils"

const Card = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "rounded-lg border bg-card text-card-foreground shadow-sm",
      className
    )}
    {...props}
  />
))
Card.displayName = "Card"

const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex flex-col space-y-1.5 p-6", className)}
    {...props}
  />
))
CardHeader.displayName = "CardHeader"

const CardTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn("text-2xl font-semibold leading-none tracking-tight", className)}
    {...props}
  />
))
CardTitle.displayName = "CardTitle"

const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
))
CardDescription.displayName = "CardDescription"

const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />
))
CardContent.displayName = "CardContent"

const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex items-center p-6 pt-0", className)}
    {...props}
  />
))
CardFooter.displayName = "CardFooter"

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent }
EOF

echo "✅ تم إنشاء مكونات UI الأساسية"

# Create Install Script
cat > install.sh << 'EOF'
#!/bin/bash
echo "📦 تثبيت المكتبات المطلوبة..."
npm install
echo "✅ تم تثبيت جميع المكتبات"
echo ""
echo "🔧 الخطوة التالية:"
echo "1. أنشئ ملف .env.local وأضف بيانات Firebase"
echo "2. شغل المشروع: npm run dev"
EOF

chmod +x install.sh

echo "======================================"
echo "✅ تم إعداد المشروع بنجاح!"
echo "======================================"
echo ""
echo "📋 الخطوات التالية:"
echo "1. انتقل إلى مجلد المشروع: cd factory-flow"
echo "2. شغل سكريبت التثبيت: ./install.sh"
echo "3. أضف بيانات Firebase في .env.local"
echo "4. شغل المشروع: npm run dev"
echo ""
echo "📖 راجع README.md للمزيد من التفاصيل"
