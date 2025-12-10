"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandLoading,
} from "@/components/ui/command";
import { useGlobalSearch, typeLabels } from "./useGlobalSearch";
import { SearchResults } from "./SearchResults";

interface SearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SearchDialog({ open, onOpenChange }: SearchDialogProps) {
  const router = useRouter();
  const { query, setQuery, isLoading, groupedResults, clearResults } = useGlobalSearch();

  const handleSelect = useCallback(
    (href: string) => {
      onOpenChange(false);
      clearResults();
      router.push(href);
    },
    [router, onOpenChange, clearResults]
  );

  const handleOpenChange = useCallback(
    (newOpen: boolean) => {
      onOpenChange(newOpen);
      if (!newOpen) {
        clearResults();
      }
    },
    [onOpenChange, clearResults]
  );

  const hasResults = Object.keys(groupedResults).length > 0;

  return (
    <CommandDialog open={open} onOpenChange={handleOpenChange}>
      <CommandInput
        placeholder="ابحث عن معاملة، عميل، شيك..."
        value={query}
        onValueChange={setQuery}
        dir="rtl"
      />
      <CommandList>
        {isLoading && (
          <CommandLoading>
            <div className="flex items-center justify-center gap-2 py-6">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              <span className="text-muted-foreground">جاري البحث...</span>
            </div>
          </CommandLoading>
        )}

        {!isLoading && query.length < 2 && (
          <CommandEmpty>
            <div className="text-muted-foreground py-6 text-center">
              ابدأ الكتابة للبحث...
            </div>
          </CommandEmpty>
        )}

        {!isLoading && query.length >= 2 && !hasResults && (
          <CommandEmpty>
            <div className="text-muted-foreground py-6 text-center">
              لا توجد نتائج لـ &ldquo;{query}&rdquo;
            </div>
          </CommandEmpty>
        )}

        {!isLoading && hasResults && (
          <SearchResults
            groupedResults={groupedResults}
            onSelect={handleSelect}
          />
        )}
      </CommandList>

      {/* Keyboard hints footer */}
      <div className="border-t px-3 py-2 text-xs text-muted-foreground flex items-center justify-center gap-4" dir="rtl">
        <span>
          <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium">
            Enter
          </kbd>
          {" "}للانتقال
        </span>
        <span>
          <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium">
            ↑↓
          </kbd>
          {" "}للتنقل
        </span>
        <span>
          <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium">
            Esc
          </kbd>
          {" "}للإغلاق
        </span>
      </div>
    </CommandDialog>
  );
}
