"use client";

import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { AlertTriangle, ChevronDown, ChevronUp, Check, X, Clock } from "lucide-react";
import {
  FixedAsset,
  DepreciationPeriod,
  DepreciationRecord,
  isFullyDepreciated,
  isBeforePurchaseDate,
  categorizeAssetsForDepreciation,
} from "../types/fixed-assets";
import { formatNumber } from "@/lib/date-utils";

interface DepreciationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  loading: boolean;
  period: DepreciationPeriod;
  setPeriod: (period: DepreciationPeriod) => void;
  assets: FixedAsset[];
  onRunDepreciation: () => void;
  processedPeriods?: Set<string>;
  /** All depreciation records — used to detect already-processed assets for the selected period */
  existingRecords?: DepreciationRecord[];
  /** When set, the dialog targets only this specific asset (per-asset mode) */
  selectedAsset?: FixedAsset;
}

export function DepreciationDialog({
  isOpen,
  onClose,
  loading,
  period,
  setPeriod,
  assets,
  onRunDepreciation,
  processedPeriods,
  existingRecords,
  selectedAsset,
}: DepreciationDialogProps) {
  const [isBreakdownOpen, setIsBreakdownOpen] = useState(false);
  // Prevent double-click: track if we've already triggered a run
  const [isSubmitting, setIsSubmitting] = useState(false);

  const periodLabel = `${period.year}-${String(period.month).padStart(2, "0")}`;

  // In global mode, warn if the whole period was already globally processed.
  // In per-asset mode, we skip this check (the service handles per-asset dedup).
  const isAlreadyProcessed = !selectedAsset && (processedPeriods?.has(periodLabel) ?? false);

  // Categorize assets: pass period + selectedAsset to enable purchase-date filtering
  const { activeAssets, assetsToDepreciate, fullyDepreciatedAssets, assetsBeforePurchaseDate, expectedDepreciation } =
    useMemo(
      () => categorizeAssetsForDepreciation(assets, period, selectedAsset),
      [assets, period, selectedAsset]
    );

  // Determine which assets were already individually processed for this period
  const alreadyProcessedAssetIds = useMemo(() => {
    const set = new Set<string>();
    if (existingRecords) {
      for (const r of existingRecords) {
        if (r.periodLabel === periodLabel) {
          set.add(r.assetId);
        }
      }
    }
    return set;
  }, [existingRecords, periodLabel]);

  // Exclude already-processed assets from the effective depreciation list
  const effectiveAssetsToDepreciate = useMemo(
    () => assetsToDepreciate.filter((a) => !alreadyProcessedAssetIds.has(a.id)),
    [assetsToDepreciate, alreadyProcessedAssetIds]
  );
  const effectiveDepreciation = effectiveAssetsToDepreciate.reduce(
    (sum, a) => sum + (a.monthlyDepreciation ?? 0),
    0
  );

  const canProcess = !isAlreadyProcessed && effectiveAssetsToDepreciate.length > 0;

  // Handle run with double-click prevention
  const handleRunClick = () => {
    if (isSubmitting || loading) {return;}
    setIsSubmitting(true);
    onRunDepreciation();
    // Reset after a delay to allow for dialog close or error recovery
    setTimeout(() => setIsSubmitting(false), 2000);
  };

  const dialogTitle = selectedAsset
    ? `تسجيل استهلاك: ${selectedAsset.assetName}`
    : "تسجيل استهلاك شهري";

  const dialogDescription = selectedAsset
    ? "اختر الشهر والسنة لتسجيل استهلاك هذا الأصل"
    : "اختر الشهر والسنة لتسجيل الاستهلاك لجميع الأصول النشطة";

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{dialogTitle}</DialogTitle>
          <DialogDescription>{dialogDescription}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          {/* Period already processed warning (global mode only) */}
          {isAlreadyProcessed && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700">
              <AlertTriangle className="h-5 w-5 flex-shrink-0" />
              <span className="text-sm font-medium">
                تم تسجيل الاستهلاك لهذه الفترة مسبقاً
              </span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="month">الشهر</Label>
              <select
                id="month"
                value={period.month}
                onChange={(e) =>
                  setPeriod({ ...period, month: parseInt(e.target.value) })
                }
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="year">السنة</Label>
              <Input
                id="year"
                type="number"
                value={period.year}
                onChange={(e) =>
                  setPeriod({ ...period, year: parseInt(e.target.value) })
                }
              />
            </div>
          </div>

          <div className="bg-gray-50 p-4 rounded-lg space-y-2">
            <div className="text-sm text-gray-600">
              <strong>الأصول التي سيتم استهلاكها:</strong> {effectiveAssetsToDepreciate.length}
            </div>
            {alreadyProcessedAssetIds.size > 0 && (
              <div className="text-sm text-purple-600">
                <strong>تمت المعالجة مسبقاً (سيتم تخطيها):</strong>{" "}
                {alreadyProcessedAssetIds.size}
              </div>
            )}
            {fullyDepreciatedAssets.length > 0 && (
              <div className="text-sm text-amber-600">
                <strong>الأصول المكتملة (سيتم تخطيها):</strong>{" "}
                {fullyDepreciatedAssets.length}
              </div>
            )}
            {assetsBeforePurchaseDate.length > 0 && (
              <div className="text-sm text-blue-600">
                <strong>غير مؤهل (قبل تاريخ الشراء):</strong>{" "}
                {assetsBeforePurchaseDate.length}
              </div>
            )}
            <div className="text-sm text-gray-600">
              <strong>إجمالي الاستهلاك المتوقع:</strong>{" "}
              <span className="font-semibold text-orange-600">
                {formatNumber(effectiveDepreciation)} دينار
              </span>
            </div>
            <div className="text-xs text-gray-500 mt-2">
              سيتم إضافة قيد تلقائي في دفتر الأستاذ
            </div>
          </div>

          {/* Asset breakdown collapsible */}
          {activeAssets.length > 0 && (
            <Collapsible open={isBreakdownOpen} onOpenChange={setIsBreakdownOpen}>
              <CollapsibleTrigger asChild>
                <Button
                  variant="ghost"
                  className="w-full justify-between text-sm text-slate-600 hover:bg-slate-100"
                >
                  <span>تفاصيل الأصول ({activeAssets.length})</span>
                  {isBreakdownOpen ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="border rounded-lg max-h-48 overflow-y-auto mt-2">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 sticky top-0">
                      <tr>
                        <th className="text-right p-2 font-medium text-slate-600">
                          الأصل
                        </th>
                        <th className="text-right p-2 font-medium text-slate-600">
                          الاستهلاك
                        </th>
                        <th className="text-center p-2 font-medium text-slate-600">
                          الحالة
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {activeAssets.map((asset) => {
                        const fullyDep = isFullyDepreciated(asset);
                        const beforePurchase = isBeforePurchaseDate(asset, period);
                        const alreadyDone = alreadyProcessedAssetIds.has(asset.id);
                        return (
                          <tr
                            key={asset.id}
                            className={`border-t ${
                              fullyDep || beforePurchase || alreadyDone ? "bg-slate-50 text-slate-400" : ""
                            }`}
                          >
                            <td className="p-2">{asset.assetName}</td>
                            <td className="p-2 font-mono text-xs">
                              {formatNumber(asset.monthlyDepreciation)} د
                            </td>
                            <td className="p-2 text-center">
                              {alreadyDone ? (
                                <span className="inline-flex items-center gap-1 text-purple-500">
                                  <Check className="h-3.5 w-3.5" />
                                  تمت المعالجة
                                </span>
                              ) : beforePurchase ? (
                                <span className="inline-flex items-center gap-1 text-blue-400">
                                  <Clock className="h-3.5 w-3.5" />
                                  قبل الشراء
                                </span>
                              ) : fullyDep ? (
                                <span className="inline-flex items-center gap-1 text-slate-400">
                                  <X className="h-3.5 w-3.5" />
                                  مكتمل
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-green-600">
                                  <Check className="h-3.5 w-3.5" />
                                  سيُعالج
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            إلغاء
          </Button>
          <Button
            onClick={handleRunClick}
            disabled={loading || isSubmitting || !canProcess}
          >
            {loading || isSubmitting ? "جاري التسجيل..." : "تسجيل الاستهلاك"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
