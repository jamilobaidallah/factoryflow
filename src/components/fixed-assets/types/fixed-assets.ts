import { safeSubtract, safeAdd, safeDivide } from "@/lib/currency";

// ============================================================================
// CONSTANTS
// ============================================================================

/** Maximum depreciation records to fetch (covers ~100 assets × 50 months) */
export const DEPRECIATION_RECORDS_LIMIT = 5000;

/** Maximum depreciation runs to fetch (10 years of monthly runs) */
export const DEPRECIATION_RUNS_LIMIT = 120;

// ============================================================================
// INTERFACES
// ============================================================================

export interface FixedAsset {
  id: string;
  assetNumber: string;
  assetName: string;
  category: string;
  purchaseDate: Date;
  purchaseCost: number;
  salvageValue: number;
  usefulLifeMonths: number;
  monthlyDepreciation: number;
  status: "active" | "disposed" | "sold" | "written-off";
  accumulatedDepreciation: number;
  bookValue: number;
  lastDepreciationDate?: Date;
  location?: string;
  serialNumber?: string;
  supplier?: string;
  notes?: string;
  createdAt: Date;
}

export interface DepreciationRecord {
  id: string;
  assetId: string;
  assetName: string;
  month: number;
  year: number;
  periodLabel: string;
  depreciationAmount: number;
  accumulatedDepreciationBefore: number;
  accumulatedDepreciationAfter: number;
  bookValueBefore: number;
  bookValueAfter: number;
  ledgerEntryId?: string;
  recordedDate: Date;
  createdAt: Date;
}

export interface DepreciationRun {
  id: string;
  period: string;
  runDate: Date;
  assetsCount: number;
  totalDepreciation: number;
  ledgerEntryId: string;
  createdAt: Date;
  /** "global" = all-assets run; "per-asset" = single-asset run */
  runType?: "global" | "per-asset";
  /** Display label for per-asset runs */
  assetName?: string;
}

export interface PendingPeriod {
  year: number;
  month: number;
  periodLabel: string;
}

export interface AutoDepreciationResult {
  success: boolean;
  processedPeriods: string[];
  totalDepreciation: number;
  errors: string[];
  failedAt?: string;
}

/**
 * Result of a single depreciation run.
 * Provides detailed info about partial failures (records saved but journal failed).
 */
export interface DepreciationResult {
  /** Whether the operation fully succeeded (records + journal) */
  success: boolean;
  /** Total depreciation amount processed */
  totalDepreciation: number;
  /** Whether depreciation records were saved but journal failed */
  partialFailure: boolean;
  /** Recovery instructions for manual journal entry (shown in UI when partialFailure=true) */
  recoveryInstructions?: string;
  /** Error message if any step failed */
  error?: string;
  /** Period label for reference */
  periodLabel?: string;
}

/** Recovery instructions template for depreciation journal failures */
export const DEPRECIATION_RECOVERY_INSTRUCTIONS =
  "يجب إنشاء قيد يدوي:\n" +
  "مدين: 5400 (مصروف الاستهلاك)\n" +
  "دائن: 1510 (الاستهلاك المتراكم)";

export interface FixedAssetFormData {
  assetName: string;
  category: string;
  purchaseDate: string;
  purchaseCost: string;
  salvageValue: string;
  usefulLifeYears: string;
  location: string;
  serialNumber: string;
  supplier: string;
  notes: string;
}

export interface DepreciationPeriod {
  month: number;
  year: number;
}

export const ASSET_CATEGORIES = [
  "آلات ومعدات",
  "مركبات",
  "مباني",
  "معدات مكتبية",
  "أدوات",
  "أثاث",
  "أجهزة كمبيوتر",
  "أخرى",
];

export const initialFormData: FixedAssetFormData = {
  assetName: "",
  category: "",
  purchaseDate: new Date().toISOString().split("T")[0],
  purchaseCost: "",
  salvageValue: "",
  usefulLifeYears: "",
  location: "",
  serialNumber: "",
  supplier: "",
  notes: "",
};

export const initialDepreciationPeriod: DepreciationPeriod = {
  month: new Date().getMonth() + 1,
  year: new Date().getFullYear(),
};

// ============================================================================
// UTILITY FUNCTIONS (using safe math to avoid floating point errors)
// ============================================================================

/**
 * Check if an asset is fully depreciated.
 * Uses safe math to avoid floating point comparison errors.
 */
export function isFullyDepreciated(asset: FixedAsset): boolean {
  const depreciableTotal = safeSubtract(asset.purchaseCost, asset.salvageValue);
  return asset.accumulatedDepreciation >= depreciableTotal;
}

/**
 * Calculate remaining useful life in months.
 * Uses safe math to avoid floating point errors.
 */
export function getRemainingLifeMonths(asset: FixedAsset): number {
  const depreciableAmount = safeSubtract(asset.purchaseCost, asset.salvageValue);
  if (depreciableAmount <= 0 || asset.monthlyDepreciation <= 0) {return 0;}

  const monthsDepreciated = Math.floor(
    safeDivide(asset.accumulatedDepreciation, asset.monthlyDepreciation)
  );
  const remaining = asset.usefulLifeMonths - monthsDepreciated;
  return Math.max(0, remaining);
}

/**
 * Calculate total expected depreciation for a list of active, non-fully-depreciated assets.
 * Uses safe math to avoid floating point errors.
 */
export function calculateExpectedDepreciation(assets: FixedAsset[]): number {
  return assets
    .filter((a) => a.status === "active" && !isFullyDepreciated(a))
    .reduce((sum, a) => safeAdd(sum, a.monthlyDepreciation), 0);
}

/**
 * Resolve a FixedAsset purchaseDate to a JS Date regardless of whether it
 * arrived as a JS Date or a Firestore Timestamp.
 */
function resolvePurchaseDate(asset: FixedAsset): Date {
  if (asset.purchaseDate instanceof Date) return asset.purchaseDate;
  const maybeTimestamp = asset.purchaseDate as unknown as { toDate?: () => Date };
  return maybeTimestamp.toDate?.() ?? new Date(asset.purchaseDate as unknown as string);
}

/**
 * Return true when the given period falls BEFORE the asset's purchase month.
 */
export function isBeforePurchaseDate(asset: FixedAsset, period: DepreciationPeriod): boolean {
  const d = resolvePurchaseDate(asset);
  const py = d.getFullYear();
  const pm = d.getMonth() + 1; // 1-indexed
  return period.year < py || (period.year === py && period.month < pm);
}

/**
 * Categorize assets for depreciation.
 *
 * @param assets        Full asset list.
 * @param period        Optional – when provided, assets purchased after the period are
 *                      separated into `assetsBeforePurchaseDate` instead of `assetsToDepreciate`.
 * @param selectedAsset Optional – when provided, only this asset is considered for depreciation.
 */
export function categorizeAssetsForDepreciation(
  assets: FixedAsset[],
  period?: DepreciationPeriod,
  selectedAsset?: FixedAsset
): {
  activeAssets: FixedAsset[];
  assetsToDepreciate: FixedAsset[];
  fullyDepreciatedAssets: FixedAsset[];
  assetsBeforePurchaseDate: FixedAsset[];
  expectedDepreciation: number;
} {
  const activeAssets: FixedAsset[] = [];
  const assetsToDepreciate: FixedAsset[] = [];
  const fullyDepreciatedAssets: FixedAsset[] = [];
  const assetsBeforePurchaseDate: FixedAsset[] = [];
  let expectedDepreciation = 0;

  for (const asset of assets) {
    if (asset.status !== "active") continue;
    // In per-asset mode, skip every asset except the selected one
    if (selectedAsset && asset.id !== selectedAsset.id) continue;

    activeAssets.push(asset);

    if (period && isBeforePurchaseDate(asset, period)) {
      assetsBeforePurchaseDate.push(asset);
    } else if (isFullyDepreciated(asset)) {
      fullyDepreciatedAssets.push(asset);
    } else {
      assetsToDepreciate.push(asset);
      expectedDepreciation = safeAdd(expectedDepreciation, asset.monthlyDepreciation);
    }
  }

  return {
    activeAssets,
    assetsToDepreciate,
    fullyDepreciatedAssets,
    assetsBeforePurchaseDate,
    expectedDepreciation,
  };
}
