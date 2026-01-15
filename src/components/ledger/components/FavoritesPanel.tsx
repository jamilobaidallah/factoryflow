/**
 * FavoritesPanel - Bottom sheet showing saved ledger entry favorites
 * Users can click on a favorite to pre-fill the ledger form
 */

import { Star, Trash2, Clock, Repeat } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useLedgerFavorites } from "@/hooks/useLedgerFavorites";
import type { LedgerFavorite } from "@/types/ledger-favorite";
import type { LedgerFormData } from "../types/ledger";
import { formatCurrency, cn } from "@/lib/utils";
import { TRANSACTION_TYPES } from "@/lib/constants";

interface FavoritesPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectFavorite: (formData: LedgerFormData, entryType: string) => void;
}

export function FavoritesPanel({
  isOpen,
  onClose,
  onSelectFavorite,
}: FavoritesPanelProps) {
  const { favorites, isLoading, removeFavorite, applyFavorite } = useLedgerFavorites();

  const handleSelectFavorite = (favorite: LedgerFavorite) => {
    const formData = applyFavorite(favorite);
    onSelectFavorite(formData, favorite.type);
    onClose();
  };

  const handleDeleteFavorite = async (e: React.MouseEvent, favoriteId: string) => {
    e.stopPropagation(); // Prevent triggering the card click
    await removeFavorite(favoriteId);
  };

  const getTypeColor = (type: string) => {
    if (type === TRANSACTION_TYPES.INCOME || type === TRANSACTION_TYPES.INCOME_ALT) {
      return "bg-success-50 text-success-700 border-success-200";
    }
    if (type === TRANSACTION_TYPES.EXPENSE) {
      return "bg-danger-50 text-danger-700 border-danger-200";
    }
    return "bg-primary-50 text-primary-700 border-primary-200";
  };

  const getTypeLabel = (type: string) => {
    if (type === TRANSACTION_TYPES.INCOME || type === TRANSACTION_TYPES.INCOME_ALT) {
      return "دخل";
    }
    if (type === TRANSACTION_TYPES.EXPENSE) {
      return "مصروف";
    }
    return "رأس مال";
  };

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent className="max-h-[85vh]">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Star className="h-5 w-5 text-amber-500" />
            المفضلات
          </SheetTitle>
          <SheetDescription>
            اختر من الحركات المحفوظة للإدخال السريع
          </SheetDescription>
        </SheetHeader>

        <div className="p-4 overflow-y-auto max-h-[60vh]">
          {isLoading ? (
            <div className="grid gap-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-24 w-full rounded-xl" />
              ))}
            </div>
          ) : favorites.length === 0 ? (
            <div className="text-center py-12">
              <Star className="h-12 w-12 mx-auto text-slate-300 mb-4" />
              <p className="text-slate-500 font-medium">لا توجد مفضلات بعد</p>
              <p className="text-slate-400 text-sm mt-1">
                أضف حركة مالية واحفظها كمفضلة للوصول السريع
              </p>
            </div>
          ) : (
            <div className="grid gap-3">
              {favorites.map((favorite) => (
                <FavoriteCard
                  key={favorite.id}
                  favorite={favorite}
                  typeColor={getTypeColor(favorite.type)}
                  typeLabel={getTypeLabel(favorite.type)}
                  onSelect={() => handleSelectFavorite(favorite)}
                  onDelete={(e) => handleDeleteFavorite(e, favorite.id)}
                />
              ))}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

interface FavoriteCardProps {
  favorite: LedgerFavorite;
  typeColor: string;
  typeLabel: string;
  onSelect: () => void;
  onDelete: (e: React.MouseEvent) => void;
}

function FavoriteCard({
  favorite,
  typeColor,
  typeLabel,
  onSelect,
  onDelete,
}: FavoriteCardProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-label={`استخدام المفضلة: ${favorite.name}`}
      className="w-full text-right p-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300 transition-colors group"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          {/* Name and type badge */}
          <div className="flex items-center gap-2 mb-2">
            <span className="font-semibold text-slate-800 truncate">
              {favorite.name}
            </span>
            <span
              className={cn(
                "px-2 py-0.5 rounded-full text-xs font-medium border",
                typeColor
              )}
            >
              {typeLabel}
            </span>
          </div>

          {/* Category */}
          <p className="text-sm text-slate-500 truncate">
            {favorite.category}
            {favorite.subCategory && ` • ${favorite.subCategory}`}
          </p>

          {/* Amount and party */}
          <div className="flex items-center gap-4 mt-2">
            <span className="text-lg font-bold text-slate-800">
              {formatCurrency(favorite.amount)}
            </span>
            {favorite.associatedParty && (
              <span className="text-sm text-slate-400 truncate">
                {favorite.associatedParty}
              </span>
            )}
          </div>

          {/* Usage stats */}
          {favorite.usageCount > 0 && (
            <div className="flex items-center gap-1 mt-2 text-xs text-slate-400">
              <Repeat className="h-3 w-3" />
              <span>تم الاستخدام {favorite.usageCount} مرات</span>
            </div>
          )}
        </div>

        {/* Delete button */}
        <Button
          variant="ghost"
          size="icon"
          aria-label={`حذف المفضلة: ${favorite.name}`}
          className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-danger-600 hover:bg-danger-50"
          onClick={onDelete}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </button>
  );
}
