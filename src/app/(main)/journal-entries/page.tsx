import type { Metadata } from "next";
import { JournalEntriesPage } from "@/components/journal-entries/journal-entries-page";

export const metadata: Metadata = {
  title: "القيود اليومية | FactoryFlow",
};

export default function Page() {
  return <JournalEntriesPage />;
}
