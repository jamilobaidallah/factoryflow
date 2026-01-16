/**
 * FixedAssetFormCard - Reusable component for fixed asset details forms
 * Extracted from LedgerFormDialog.tsx to improve maintainability
 */

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { parseAmount, safeSubtract, safeDivide, safeMultiply, roundCurrency } from "@/lib/currency";

export interface FixedAssetFormCardProps {
  formData: {
    assetName: string;
    usefulLifeYears: string;
    salvageValue: string;
  };
  onUpdate: (field: string, value: string) => void;
  entryAmount: string;
}

export function FixedAssetFormCard({
  formData,
  onUpdate,
  entryAmount,
}: FixedAssetFormCardProps) {
  // Calculate monthly depreciation using safe currency utilities
  const calculateMonthlyDepreciation = (): string => {
    const amount = parseAmount(entryAmount || "0");
    const salvage = parseAmount(formData.salvageValue || "0");
    const years = parseAmount(formData.usefulLifeYears || "0");

    if (years <= 0) {
      return "0.00";
    }

    const monthlyDepreciation = safeDivide(
      safeSubtract(amount, salvage),
      safeMultiply(years, 12)
    );

    return roundCurrency(monthlyDepreciation).toFixed(2);
  };

  const showDepreciation = formData.usefulLifeYears && formData.salvageValue;

  return (
    <div className="space-y-4 p-4 border rounded-lg bg-gray-50">
      <h4 className="font-medium text-sm">إضافة كأصل ثابت</h4>
      <div className="space-y-2">
        <Input
          type="text"
          placeholder="اسم الأصل"
          value={formData.assetName}
          onChange={(e) => onUpdate("assetName", e.target.value)}
          required
        />
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-2">
            <Label htmlFor="usefulLifeYears">العمر الإنتاجي (سنوات)</Label>
            <Input
              id="usefulLifeYears"
              type="number"
              step="0.1"
              placeholder="مثال: 5"
              value={formData.usefulLifeYears}
              onChange={(e) => onUpdate("usefulLifeYears", e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="salvageValue">القيمة المتبقية (دينار)</Label>
            <Input
              id="salvageValue"
              type="number"
              step="0.01"
              placeholder="مثال: 500"
              value={formData.salvageValue}
              onChange={(e) => onUpdate("salvageValue", e.target.value)}
            />
          </div>
        </div>
        {showDepreciation && (
          <p className="text-xs text-gray-600 pr-2">
            الإهلاك الشهري المقدر: {calculateMonthlyDepreciation()} دينار/شهر
          </p>
        )}
      </div>
    </div>
  );
}
