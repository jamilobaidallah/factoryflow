import ClientDetailPage from "@/components/clients/client-detail-page";

export async function generateStaticParams() { return [{ id: "placeholder" }]; }
export const dynamicParams = true;

export default function ClientDetailRoute({ params }: { params: { id: string } }) {
  return <ClientDetailPage clientId={params.id} />;
}
