"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Search } from "lucide-react";
import { SearchDialog } from "./SearchDialog";

/**
 * Global search trigger button with Cmd+K / Ctrl+K keyboard shortcut.
 * Opens the SearchDialog modal for searching across all data types.
 */
export function GlobalSearch() {
  const [open, setOpen] = useState(false);

  // Keyboard shortcut: Cmd+K or Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <>
      <Button
        variant="outline"
        className="relative h-9 w-full justify-start text-sm text-muted-foreground sm:pr-12 md:w-40 lg:w-64 gap-2"
        onClick={() => setOpen(true)}
        aria-label="فتح البحث السريع"
      >
        <Search className="h-4 w-4" aria-hidden="true" />
        <span className="hidden sm:inline-flex">ابحث...</span>
        <kbd className="pointer-events-none absolute left-1.5 top-1/2 -translate-y-1/2 hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 sm:flex">
          <span className="text-xs">⌘</span>K
        </kbd>
      </Button>
      <SearchDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
