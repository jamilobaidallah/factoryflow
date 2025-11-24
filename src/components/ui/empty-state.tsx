/**
 * Empty State Components
 *
 * Beautiful empty states to improve UX when there's no data
 */

import { LucideIcon } from "lucide-react";
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
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center py-12 px-4 text-center",
        className
      )}
    >
      <div className="rounded-full bg-gray-100 p-6 mb-4">
        <Icon className="w-12 h-12 text-gray-400" />
      </div>
      <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
      <p className="text-sm text-gray-500 mb-6 max-w-sm">{description}</p>
      {action && (
        <Button onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </div>
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
