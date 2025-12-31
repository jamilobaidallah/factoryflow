import EmployeeDetailPage from "@/components/employees/employee-detail-page";

export default function Page({ params }: { params: { id: string } }) {
  return <EmployeeDetailPage employeeId={params.id} />;
}
