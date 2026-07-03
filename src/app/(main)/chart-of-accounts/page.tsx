import type { Metadata } from "next";
import { ChartOfAccountsPage } from "@/components/chart-of-accounts/chart-of-accounts-page";
import { COMPANY_NAME_AR_SHORT } from "@/lib/branding";

export const metadata: Metadata = {
  title: `دليل الحسابات | ${COMPANY_NAME_AR_SHORT}`,
};

export default function Page() {
  return <ChartOfAccountsPage />;
}
