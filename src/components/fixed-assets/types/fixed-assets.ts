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

export interface FixedAssetFormData {
  assetName: string;
  category: string;
  purchaseDate: string;
  purchaseCost: string;
  salvageValue: string;
  usefulLifeYears: string;
  paymentMethod: 'cash' | 'credit';
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
  paymentMethod: "cash",
  location: "",
  serialNumber: "",
  supplier: "",
  notes: "",
};

export const initialDepreciationPeriod: DepreciationPeriod = {
  month: new Date().getMonth() + 1,
  year: new Date().getFullYear(),
};
