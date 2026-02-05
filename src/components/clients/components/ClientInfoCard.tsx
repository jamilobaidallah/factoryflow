import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatShortDate } from "@/lib/date-utils";
import type { Client } from '../hooks';

interface ClientInfoCardProps {
  client: Client;
}

export function ClientInfoCard({ client }: ClientInfoCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>معلومات العميل</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-sm text-gray-500">الهاتف</p>
            <p className="font-medium">{client.phone}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">البريد الإلكتروني</p>
            <p className="font-medium">{client.email || "-"}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">العنوان</p>
            <p className="font-medium">{client.address || "-"}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">تاريخ التسجيل</p>
            <p className="font-medium">{formatShortDate(client.createdAt)}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
