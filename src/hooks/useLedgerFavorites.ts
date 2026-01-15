/**
 * Hook for managing ledger favorites (saved transaction templates)
 */

import { useCallback, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useUser } from "@/firebase/provider";
import { queryKeys } from "@/hooks/firebase-query/keys";
import type { LedgerFavorite } from "@/types/ledger-favorite";
import type { LedgerFormData } from "@/components/ledger/types/ledger";
import {
  getFavorites,
  saveFavorite,
  deleteFavorite,
  incrementFavoriteUsage,
  favoriteToFormData,
} from "@/services/ledger/favoritesService";
import { toast } from "@/hooks/use-toast";

interface UseLedgerFavoritesReturn {
  favorites: LedgerFavorite[];
  isLoading: boolean;
  isError: boolean;
  isSaving: boolean;
  saveFavoriteFromForm: (name: string, formData: LedgerFormData, entryType: string) => Promise<boolean>;
  removeFavorite: (favoriteId: string) => Promise<boolean>;
  applyFavorite: (favorite: LedgerFavorite) => LedgerFormData;
  refetch: () => void;
}

export function useLedgerFavorites(): UseLedgerFavoritesReturn {
  const { user } = useUser();
  const queryClient = useQueryClient();
  const [isSaving, setIsSaving] = useState(false);

  const ownerId = user?.dataOwnerId;

  // Fetch favorites
  const {
    data: favoritesResult,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: queryKeys.favorites.all(ownerId || ""),
    queryFn: async () => {
      if (!ownerId) return { success: false, data: [] };
      return getFavorites(ownerId);
    },
    enabled: !!ownerId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const favorites = favoritesResult?.success ? favoritesResult.data || [] : [];

  // Save a new favorite
  const saveFavoriteFromForm = useCallback(
    async (name: string, formData: LedgerFormData, entryType: string): Promise<boolean> => {
      if (!ownerId) {
        toast({ title: "حدث خطأ: لم يتم العثور على المستخدم", variant: "destructive" });
        return false;
      }

      setIsSaving(true);
      try {
        const result = await saveFavorite(ownerId, name, formData, entryType);

        if (result.success) {
          toast({ title: "تم حفظ المفضلة بنجاح" });
          queryClient.invalidateQueries({ queryKey: queryKeys.favorites.all(ownerId) });
          return true;
        } else {
          toast({ title: result.error || "فشل حفظ المفضلة", variant: "destructive" });
          return false;
        }
      } finally {
        setIsSaving(false);
      }
    },
    [ownerId, queryClient]
  );

  // Delete a favorite
  const removeFavorite = useCallback(
    async (favoriteId: string): Promise<boolean> => {
      if (!ownerId) {
        toast({ title: "حدث خطأ: لم يتم العثور على المستخدم", variant: "destructive" });
        return false;
      }

      try {
        const result = await deleteFavorite(ownerId, favoriteId);

        if (result.success) {
          toast({ title: "تم حذف المفضلة" });
          queryClient.invalidateQueries({ queryKey: queryKeys.favorites.all(ownerId) });
          return true;
        } else {
          toast({ title: result.error || "فشل حذف المفضلة", variant: "destructive" });
          return false;
        }
      } catch {
        toast({ title: "حدث خطأ غير متوقع", variant: "destructive" });
        return false;
      }
    },
    [ownerId, queryClient]
  );

  // Apply a favorite (convert to form data and increment usage)
  const applyFavorite = useCallback(
    (favorite: LedgerFavorite): LedgerFormData => {
      // Increment usage in background (don't await)
      if (ownerId) {
        incrementFavoriteUsage(ownerId, favorite.id).catch(() => {
          // Silently ignore usage tracking errors
        });
      }

      return favoriteToFormData(favorite);
    },
    [ownerId]
  );

  return {
    favorites,
    isLoading,
    isError,
    isSaving,
    saveFavoriteFromForm,
    removeFavorite,
    applyFavorite,
    refetch,
  };
}
