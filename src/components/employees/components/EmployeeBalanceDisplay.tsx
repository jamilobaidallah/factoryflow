"use client";

import { ArrowUp, ArrowDown, Minus } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { formatNumber } from "@/lib/date-utils";

interface EmployeeBalanceDisplayProps {
  unpaidSalaries: number;
  outstandingAdvances: number;
  netBalance: number;
  showTooltip?: boolean;
  size?: "sm" | "md" | "lg";
}

export function EmployeeBalanceDisplay({
  unpaidSalaries,
  outstandingAdvances,
  netBalance,
  showTooltip = true,
  size = "md",
}: EmployeeBalanceDisplayProps) {
  const isPositive = netBalance > 0;
  const isNegative = netBalance < 0;
  const isZero = netBalance === 0;

  const sizeClasses = {
    sm: "text-sm",
    md: "text-base",
    lg: "text-lg",
  };

  const iconSizes = {
    sm: "h-3 w-3",
    md: "h-4 w-4",
    lg: "h-5 w-5",
  };

  const getColorClasses = () => {
    if (isPositive) return "text-success-600";
    if (isNegative) return "text-danger-600";
    return "text-slate-400";
  };

  const getBgClasses = () => {
    if (isPositive) return "bg-success-50";
    if (isNegative) return "bg-danger-50";
    return "bg-slate-50";
  };

  const getIcon = () => {
    if (isPositive) return <ArrowUp className={`${iconSizes[size]} text-success-500`} />;
    if (isNegative) return <ArrowDown className={`${iconSizes[size]} text-danger-500`} />;
    return <Minus className={`${iconSizes[size]} text-slate-400`} />;
  };

  const content = (
    <div
      className={`inline-flex items-center gap-1 px-2 py-1 rounded-md ${getBgClasses()}`}
    >
      {getIcon()}
      <span className={`font-semibold ${sizeClasses[size]} ${getColorClasses()}`}>
        {isZero ? "-" : formatNumber(Math.abs(netBalance))}
      </span>
    </div>
  );

  if (!showTooltip || isZero) {
    return content;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          {content}
        </TooltipTrigger>
        <TooltipContent side="top" className="text-right max-w-xs">
          <div className="space-y-1.5 text-sm">
            <div className="font-semibold border-b pb-1.5 mb-1.5">
              تفاصيل الرصيد
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-slate-500">رواتب غير مدفوعة:</span>
              <span className="font-medium text-success-600">
                +{formatNumber(unpaidSalaries)}
              </span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-slate-500">سلف مستحقة:</span>
              <span className="font-medium text-danger-600">
                -{formatNumber(outstandingAdvances)}
              </span>
            </div>
            <div className="flex justify-between gap-4 border-t pt-1.5 mt-1.5">
              <span className="font-medium">صافي الرصيد:</span>
              <span className={`font-bold ${getColorClasses()}`}>
                {isPositive ? "+" : isNegative ? "-" : ""}
                {formatNumber(Math.abs(netBalance))}
              </span>
            </div>
            <div className="text-xs text-slate-400 pt-1">
              {isPositive
                ? "المصنع مدين للموظف"
                : isNegative
                ? "الموظف مدين للمصنع"
                : "لا توجد مستحقات"}
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
