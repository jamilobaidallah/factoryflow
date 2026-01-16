/**
 * StepBasicInfo - Step 1 of the ledger entry wizard
 * Contains basic information fields: description, category, subcategory, amount, date, reference, notes
 */

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LedgerFormData } from "../types/ledger";

interface StepBasicInfoProps {
  formData: LedgerFormData;
  onUpdate: (updates: Partial<LedgerFormData>) => void;
  categories: Array<{
    name: string;
    subcategories: string[];
  }>;
}

export function StepBasicInfo({
  formData,
  onUpdate,
  categories,
}: StepBasicInfoProps) {
  return (
    <>
      {/* Description */}
      <div className="space-y-2">
        <Label htmlFor="description">الوصف</Label>
        <Input
          id="description"
          value={formData.description}
          onChange={(e) => onUpdate({ description: e.target.value })}
          required
        />
      </div>

      {/* Category & Subcategory */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="category">التصنيف الرئيسي</Label>
          <select
            id="category"
            value={formData.category}
            onChange={(e) => onUpdate({ category: e.target.value, subCategory: "" })}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            required
          >
            <option value="">اختر التصنيف</option>
            {categories.map((cat) => (
              <option key={cat.name} value={cat.name}>{cat.name}</option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="subCategory">الفئة الفرعية</Label>
          <select
            id="subCategory"
            value={formData.subCategory}
            onChange={(e) => onUpdate({ subCategory: e.target.value })}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            required
            disabled={!formData.category}
          >
            <option value="">اختر الفئة الفرعية</option>
            {formData.category && categories
              .find(cat => cat.name === formData.category)
              ?.subcategories.map((sub) => (
                <option key={sub} value={sub}>{sub}</option>
              ))}
          </select>
        </div>
      </div>

      {/* Amount & Date */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="amount">المبلغ (دينار)</Label>
          <Input
            id="amount"
            type="number"
            step="0.01"
            value={formData.amount}
            onChange={(e) => onUpdate({ amount: e.target.value })}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="date">التاريخ</Label>
          <Input
            id="date"
            type="date"
            value={formData.date}
            onChange={(e) => onUpdate({ date: e.target.value })}
            required
          />
        </div>
      </div>

    </>
  );
}
