"use client";

import { CommandGroup, CommandItem } from "@/components/ui/command";
import { ChevronLeft } from "lucide-react";
import { SearchResult, typeLabels } from "./useGlobalSearch";

interface SearchResultsProps {
  groupedResults: Record<string, SearchResult[]>;
  onSelect: (href: string) => void;
}

/**
 * Displays grouped search results organized by type (ledger, client, cheque, payment).
 * Each result shows an icon, title, subtitle, and navigation arrow.
 */
export function SearchResults({ groupedResults, onSelect }: SearchResultsProps) {
  const groupOrder: Array<SearchResult["type"]> = ["ledger", "client", "cheque", "payment"];

  return (
    <>
      {groupOrder.map((type) => {
        const results = groupedResults[type];
        if (!results || results.length === 0) {
          return null;
        }

        return (
          <CommandGroup key={type} heading={typeLabels[type]}>
            {results.map((result) => (
              <CommandItem
                key={result.id}
                value={`${result.type}-${result.id}-${result.title}`}
                onSelect={() => onSelect(result.href)}
                className="flex items-center justify-between gap-2 cursor-pointer"
                dir="rtl"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <span className="text-lg flex-shrink-0" role="img" aria-hidden="true">
                    {result.icon}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="font-medium truncate">{result.title}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {result.subtitle}
                    </div>
                  </div>
                </div>
                <ChevronLeft className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              </CommandItem>
            ))}
          </CommandGroup>
        );
      })}
    </>
  );
}
