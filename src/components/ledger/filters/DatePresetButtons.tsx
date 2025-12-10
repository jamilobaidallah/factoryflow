"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { DatePreset } from "./useLedgerFilters";

/** Props for DatePresetButtons component */
interface DatePresetButtonsProps {
  selected: DatePreset;
  onSelect: (preset: DatePreset) => void;
}

const presets: { value: DatePreset; label: string }[] = [
  { value: "today", label: "اليوم" },
  { value: "week", label: "هذا الأسبوع" },
  { value: "month", label: "هذا الشهر" },
  { value: "all", label: "الكل" },
];

/**
 * Toggle button group for quick date range selection.
 * Provides one-click presets for common date filters (today, week, month, all).
 */
export function DatePresetButtons({ selected, onSelect }: DatePresetButtonsProps) {
  return (
    <div className="flex flex-wrap gap-1">
      {presets.map((preset) => (
        <Button
          key={preset.value}
          variant={selected === preset.value ? "default" : "outline"}
          size="sm"
          onClick={() => onSelect(preset.value)}
          className={cn(
            "text-xs sm:text-sm",
            selected === preset.value && "bg-primary text-primary-foreground"
          )}
        >
          {preset.label}
        </Button>
      ))}
    </div>
  );
}
