/**
 * Confirmation Dialog Component
 *
 * Beautiful confirmation dialogs for destructive actions with better UX
 */

"use client";

import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { AlertTriangle, Trash2, Info, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface ConfirmationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "destructive" | "warning" | "info" | "success";
  isLoading?: boolean;
}

export function ConfirmationDialog({
  open,
  onOpenChange,
  onConfirm,
  title,
  description,
  confirmText = "تأكيد",
  cancelText = "إلغاء",
  variant = "destructive",
  isLoading = false,
}: ConfirmationDialogProps) {
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    setLoading(true);
    try {
      await onConfirm();
      onOpenChange(false);
    } finally {
      setLoading(false);
    }
  };

  const iconMap = {
    destructive: Trash2,
    warning: AlertTriangle,
    info: Info,
    success: CheckCircle2,
  };

  const colorMap = {
    destructive: "text-red-600",
    warning: "text-yellow-600",
    info: "text-blue-600",
    success: "text-green-600",
  };

  const Icon = iconMap[variant];

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="sm:max-w-md">
        <AlertDialogHeader>
          <div className="flex items-start gap-4">
            <div className={cn(
              "rounded-full p-3",
              variant === "destructive" && "bg-red-100",
              variant === "warning" && "bg-yellow-100",
              variant === "info" && "bg-blue-100",
              variant === "success" && "bg-green-100"
            )}>
              <Icon className={cn("w-6 h-6", colorMap[variant])} />
            </div>
            <div className="flex-1">
              <AlertDialogTitle className="text-right text-lg">
                {title}
              </AlertDialogTitle>
              <AlertDialogDescription className="text-right mt-2">
                {description}
              </AlertDialogDescription>
            </div>
          </div>
        </AlertDialogHeader>
        <AlertDialogFooter className="gap-2 sm:gap-2">
          <AlertDialogCancel disabled={loading || isLoading}>
            {cancelText}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={(e: React.MouseEvent) => {
              e.preventDefault();
              handleConfirm();
            }}
            disabled={loading || isLoading}
            className={cn(
              variant === "destructive" && "bg-red-600 hover:bg-red-700",
              variant === "warning" && "bg-yellow-600 hover:bg-yellow-700",
              variant === "info" && "bg-blue-600 hover:bg-blue-700",
              variant === "success" && "bg-green-600 hover:bg-green-700"
            )}
          >
            {loading || isLoading ? (
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>جاري المعالجة...</span>
              </div>
            ) : (
              confirmText
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// Hook for easier confirmation dialog usage
export function useConfirmation() {
  const [state, setState] = useState<{
    open: boolean;
    title: string;
    description: string;
    onConfirm: () => void | Promise<void>;
    variant?: "destructive" | "warning" | "info" | "success";
  }>({
    open: false,
    title: "",
    description: "",
    onConfirm: () => {},
  });

  const confirm = (
    title: string,
    description: string,
    onConfirm: () => void | Promise<void>,
    variant: "destructive" | "warning" | "info" | "success" = "destructive"
  ) => {
    setState({
      open: true,
      title,
      description,
      onConfirm,
      variant,
    });
  };

  const handleClose = () => {
    setState((prev) => ({ ...prev, open: false }));
  };

  const dialog = (
    <ConfirmationDialog
      open={state.open}
      onOpenChange={handleClose}
      title={state.title}
      description={state.description}
      onConfirm={state.onConfirm}
      variant={state.variant}
    />
  );

  return { confirm, dialog };
}
