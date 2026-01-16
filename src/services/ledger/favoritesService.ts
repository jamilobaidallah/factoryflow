/**
 * Ledger Favorites Service
 * CRUD operations for saved ledger entry templates (favorites)
 */

import { firestore } from "@/firebase/config";
import {
  collection,
  doc,
  addDoc,
  deleteDoc,
  getDocs,
  query,
  orderBy,
  limit,
  Timestamp,
  updateDoc,
  increment,
} from "firebase/firestore";
import type { LedgerFavorite, CreateLedgerFavoriteData } from "@/types/ledger-favorite";
import type { LedgerFormData } from "@/components/ledger/types/ledger";
import { COLLECTIONS, QUERY_LIMITS } from "@/lib/constants";
import { handleError } from "@/lib/error-handling";
import type { ServiceResult } from "./types";
import Decimal from "decimal.js-light";

/**
 * Get the favorites collection reference for a user
 */
function getFavoritesCollection(userId: string) {
  return collection(
    firestore,
    COLLECTIONS.USERS,
    userId,
    COLLECTIONS.LEDGER_FAVORITES
  );
}

/**
 * Save a new favorite from ledger form data
 */
export async function saveFavorite(
  userId: string,
  name: string,
  formData: LedgerFormData,
  entryType: string
): Promise<ServiceResult<string>> {
  try {
    const favoritesRef = getFavoritesCollection(userId);

    // Build favorite data - exclude undefined values (Firestore doesn't accept them)
    const favoriteData: Record<string, unknown> = {
      name,
      type: entryType,
      amount: new Decimal(formData.amount || 0).toNumber(),
      category: formData.category,
      subCategory: formData.subCategory,
      associatedParty: formData.associatedParty || "",
      immediateSettlement: formData.immediateSettlement,
      usageCount: 0,
      createdAt: Timestamp.now(),
    };

    // Only add optional fields if they have values
    if (formData.ownerName) favoriteData.ownerName = formData.ownerName;
    if (formData.description) favoriteData.description = formData.description;

    const docRef = await addDoc(favoritesRef, favoriteData);

    return {
      success: true,
      data: docRef.id,
    };
  } catch (error) {
    const handledError = handleError(error);
    return {
      success: false,
      error: handledError.message,
      errorType: handledError.type,
    };
  }
}

/**
 * Get all favorites for a user, ordered by usage count (most used first)
 */
export async function getFavorites(
  userId: string
): Promise<ServiceResult<LedgerFavorite[]>> {
  try {
    const favoritesRef = getFavoritesCollection(userId);
    const q = query(
      favoritesRef,
      orderBy("usageCount", "desc"),
      limit(QUERY_LIMITS.LEDGER_FAVORITES)
    );

    const snapshot = await getDocs(q);
    const favorites: LedgerFavorite[] = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as LedgerFavorite[];

    return {
      success: true,
      data: favorites,
    };
  } catch (error) {
    const handledError = handleError(error);
    return {
      success: false,
      error: handledError.message,
      errorType: handledError.type,
    };
  }
}

/**
 * Delete a favorite
 */
export async function deleteFavorite(
  userId: string,
  favoriteId: string
): Promise<ServiceResult> {
  try {
    const favoriteRef = doc(
      firestore,
      COLLECTIONS.USERS,
      userId,
      COLLECTIONS.LEDGER_FAVORITES,
      favoriteId
    );

    await deleteDoc(favoriteRef);

    return { success: true };
  } catch (error) {
    const handledError = handleError(error);
    return {
      success: false,
      error: handledError.message,
      errorType: handledError.type,
    };
  }
}

/**
 * Increment usage count when a favorite is used
 */
export async function incrementFavoriteUsage(
  userId: string,
  favoriteId: string
): Promise<ServiceResult> {
  try {
    const favoriteRef = doc(
      firestore,
      COLLECTIONS.USERS,
      userId,
      COLLECTIONS.LEDGER_FAVORITES,
      favoriteId
    );

    await updateDoc(favoriteRef, {
      usageCount: increment(1),
      lastUsedAt: Timestamp.now(),
    });

    return { success: true };
  } catch (error) {
    const handledError = handleError(error);
    return {
      success: false,
      error: handledError.message,
      errorType: handledError.type,
    };
  }
}

/**
 * Convert a favorite to LedgerFormData for pre-filling the form
 */
export function favoriteToFormData(favorite: LedgerFavorite): LedgerFormData {
  return {
    description: favorite.description || "",
    amount: favorite.amount.toString(),
    category: favorite.category,
    subCategory: favorite.subCategory,
    associatedParty: favorite.associatedParty,
    ownerName: favorite.ownerName || "",
    date: new Date().toISOString().split("T")[0], // Always use today's date
    immediateSettlement: favorite.immediateSettlement,
    trackARAP: !favorite.immediateSettlement, // Inverse of immediateSettlement
  };
}
