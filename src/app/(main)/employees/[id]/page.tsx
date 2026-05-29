import EmployeeDetailPage from "@/components/employees/employee-detail-page";

// Required for Next.js static export — dynamic routes need declared params.
// We have none to pre-render at build time; client-side navigation will
// hydrate the route at runtime.
export async function generateStaticParams() { return [{ id: "placeholder" }]; }
export const dynamicParams = true;

export default function Page({ params }: { params: { id: string } }) {
  return <EmployeeDetailPage employeeId={params.id} />;
}
