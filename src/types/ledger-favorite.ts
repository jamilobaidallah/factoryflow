import { Timestamp } from "firebase/firestore";

/**
 * Ledger Favorite - A saved template for frequently-used ledger entries
 * Allows users to quickly create entries with one click
 */
export interface LedgerFavorite {
  id: string;
  name: string; // User-friendly name, e.g., "إيجار المحل", "راتب أحمد"

  // Transaction template (mirrors LedgerFormData fields)
  type: string; // "دخل" | "مصروف" | "حركة رأس مال"
  amount: number;
  category: string;
  subCategory: string;
  associatedParty: string;
  ownerName?: string;
  description?: string; // The main description field

  // Settlement option
  immediateSettlement: boolean;

  // Metadata
  usageCount: number;
  lastUsedAt?: Timestamp;
  createdAt: Timestamp;
}

/**
 * Data for creating a new favorite (without id and timestamps)
 */
export interface CreateLedgerFavoriteData {
  name: string;
  type: string;
  amount: number;
  category: string;
  subCategory: string;
  associatedParty: string;
  ownerName?: string;
  description?: string;
  immediateSettlement: boolean;
}

/**
 * Form data for the "Save as Favorite" dialog
 */
export interface SaveFavoriteFormData {
  name: string;
}

export const initialSaveFavoriteFormData: SaveFavoriteFormData = {
  name: "",
};
