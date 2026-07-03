import type { Metadata } from "next";
import { JournalEntriesPage } from "@/components/journal-entries/journal-entries-page";
import { COMPANY_NAME_AR_SHORT } from "@/lib/branding";

export const metadata: Metadata = {
  title: `القيود اليومية | ${COMPANY_NAME_AR_SHORT}`,
};

export default function Page() {
  return <JournalEntriesPage />;
}
