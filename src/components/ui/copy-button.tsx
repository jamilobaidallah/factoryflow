"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

interface CopyButtonProps {
  text: string;
  size?: "sm" | "md" | "lg";
  showText?: boolean;
}

export function CopyButton({ text, size = "sm", showText = false }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);

      if (!showText) {
        toast({
          title: "تم النسخ",
          description: "تم نسخ رقم المعاملة إلى الحافظة",
        });
      }

      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast({
        title: "خطأ",
        description: "فشل النسخ إلى الحافظة",
        variant: "destructive",
      });
    }
  };

  const sizeClasses = {
    sm: "h-6 w-6 p-1",
    md: "h-8 w-8 p-1.5",
    lg: "h-10 w-10 p-2",
  };

  const iconSizes = {
    sm: "w-3 h-3",
    md: "w-4 h-4",
    lg: "w-5 h-5",
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      className={`${sizeClasses[size]} hover:bg-gray-100 transition-colors`}
      onClick={handleCopy}
      title="نسخ"
    >
      {copied ? (
        <Check className={`${iconSizes[size]} text-green-600`} />
      ) : (
        <Copy className={`${iconSizes[size]} text-gray-500`} />
      )}
      {showText && (
        <span className="mr-1 text-xs">
          {copied ? "تم النسخ" : "نسخ"}
        </span>
      )}
    </Button>
  );
}
