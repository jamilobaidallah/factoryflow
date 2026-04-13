import type { Metadata } from "next";
import { ChartOfAccountsPage } from "@/components/chart-of-accounts/chart-of-accounts-page";

export const metadata: Metadata = {
  title: "دليل الحسابات | FactoryFlow",
};

export default function Page() {
  return <ChartOfAccountsPage />;
}
