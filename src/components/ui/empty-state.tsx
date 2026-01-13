/**
 * Empty State Components
 *
 * Beautiful empty states to improve UX when there's no data
 * Features animated icons and contextual illustrations
 */

import { LucideIcon, Users, FileText, Receipt, CreditCard, Wallet, Package } from "lucide-react";
import { Button } from "./button";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
  /** Optional hint text shown below description */
  hint?: string;
  /** Animation variant */
  animated?: boolean;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
  hint,
  animated = true,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center py-12 px-4 text-center",
        animated && "animate-fade-in",
        className
      )}
    >
      <div className={cn(
        "rounded-full bg-gradient-to-br from-slate-50 to-slate-100 p-6 mb-4 shadow-soft",
        animated && "animate-scale-in"
      )}>
        <Icon className="w-12 h-12 text-slate-400" />
      </div>
      <h3 className="text-lg font-semibold text-slate-800 mb-2">{title}</h3>
      <p className="text-sm text-slate-500 mb-2 max-w-sm">{description}</p>
      {hint && (
        <p className="text-xs text-slate-400 mb-4 max-w-xs">{hint}</p>
      )}
      {action && (
        <Button
          onClick={action.onClick}
          className="mt-2 btn-press"
        >
          {action.label}
        </Button>
      )}
    </div>
  );
}

/** Pre-configured empty states for common scenarios */
export type EmptyStateType = "clients" | "invoices" | "cheques" | "payments" | "ledger" | "inventory";

interface ContextualEmptyStateProps {
  type: EmptyStateType;
  onAction?: () => void;
  className?: string;
}

const EMPTY_STATE_CONFIG: Record<EmptyStateType, {
  icon: LucideIcon;
  title: string;
  description: string;
  hint: string;
  actionLabel: string;
}> = {
  clients: {
    icon: Users,
    title: "لا يوجد عملاء بعد",
    description: "ابدأ بإضافة عملائك لتتبع معاملاتهم وأرصدتهم",
    hint: "يمكنك إضافة معلومات الاتصال والرصيد الافتتاحي لكل عميل",
    actionLabel: "إضافة أول عميل",
  },
  invoices: {
    icon: FileText,
    title: "لا توجد فواتير",
    description: "أنشئ فواتيرك الأولى لتتبع مبيعاتك ومستحقاتك",
    hint: "يمكنك إضافة بنود متعددة وحساب الضريبة تلقائياً",
    actionLabel: "إنشاء فاتورة جديدة",
  },
  cheques: {
    icon: CreditCard,
    title: "لا توجد شيكات مسجلة",
    description: "سجّل الشيكات الواردة والصادرة لمتابعة تواريخ استحقاقها",
    hint: "ستتلقى تنبيهات عند اقتراب موعد الاستحقاق",
    actionLabel: "إضافة شيك جديد",
  },
  payments: {
    icon: Wallet,
    title: "لا توجد مدفوعات",
    description: "سجّل المدفوعات النقدية والتحويلات لتتبع التدفق النقدي",
    hint: "يمكنك ربط المدفوعات بالعملاء والفواتير",
    actionLabel: "تسجيل دفعة جديدة",
  },
  ledger: {
    icon: Receipt,
    title: "دفتر الأستاذ فارغ",
    description: "ابدأ بتسجيل قيودك المحاسبية لتتبع إيراداتك ومصروفاتك",
    hint: "كل قيد يُسجّل تلقائياً في الدفتر المناسب",
    actionLabel: "إضافة قيد جديد",
  },
  inventory: {
    icon: Package,
    title: "لا يوجد مخزون",
    description: "أضف منتجاتك ومواردك لتتبع المخزون والتكاليف",
    hint: "يمكنك تتبع الكميات والأسعار لكل صنف",
    actionLabel: "إضافة صنف جديد",
  },
};

/**
 * Contextual empty state with pre-configured content based on type
 */
export function ContextualEmptyState({
  type,
  onAction,
  className,
}: ContextualEmptyStateProps) {
  const config = EMPTY_STATE_CONFIG[type];

  return (
    <EmptyState
      icon={config.icon}
      title={config.title}
      description={config.description}
      hint={config.hint}
      action={onAction ? {
        label: config.actionLabel,
        onClick: onAction,
      } : undefined}
      className={className}
    />
  );
}

interface EmptyStateWithIllustrationProps {
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  illustration?: React.ReactNode;
}

export function EmptyStateWithIllustration({
  title,
  description,
  action,
  illustration,
}: EmptyStateWithIllustrationProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      {illustration && (
        <div className="mb-6 opacity-50">
          {illustration}
        </div>
      )}
      <h3 className="text-xl font-semibold text-gray-900 mb-3">{title}</h3>
      <p className="text-base text-gray-600 mb-8 max-w-md">{description}</p>
      {action && (
        <Button size="lg" onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </div>
  );
}

interface EmptySearchResultsProps {
  searchTerm: string;
  onClear: () => void;
}

export function EmptySearchResults({
  searchTerm,
  onClear,
}: EmptySearchResultsProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      <div className="text-6xl mb-4">🔍</div>
      <h3 className="text-lg font-semibold text-gray-900 mb-2">
        لم يتم العثور على نتائج
      </h3>
      <p className="text-sm text-gray-500 mb-6 max-w-sm">
        لم نتمكن من العثور على نتائج لـ &quot;{searchTerm}&quot;. جرب مصطلح بحث آخر.
      </p>
      <Button variant="outline" onClick={onClear}>
        مسح البحث
      </Button>
    </div>
  );
}

interface EmptyErrorStateProps {
  title?: string;
  description?: string;
  onRetry?: () => void;
}

export function EmptyErrorState({
  title = "حدث خطأ",
  description = "عذراً، حدث خطأ أثناء تحميل البيانات. يرجى المحاولة مرة أخرى.",
  onRetry,
}: EmptyErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      <div className="text-6xl mb-4">⚠️</div>
      <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
      <p className="text-sm text-gray-500 mb-6 max-w-sm">{description}</p>
      {onRetry && (
        <Button onClick={onRetry}>
          إعادة المحاولة
        </Button>
      )}
    </div>
  );
}
