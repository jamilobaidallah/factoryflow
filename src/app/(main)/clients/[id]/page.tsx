import ClientDetailPage from "@/components/clients/client-detail-page";

export default function ClientDetailRoute({ params }: { params: { id: string } }) {
  return <ClientDetailPage clientId={params.id} />;
}
