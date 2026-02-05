import { format } from "date-fns";
import { formatStatementDate } from "@/lib/statement-format";

interface StatementHeaderProps {
  clientName: string;
  hasTransactions: boolean;
  dateFrom: Date | undefined;
  dateTo: Date | undefined;
  dateRange: { oldest: Date; newest: Date };
}

export function StatementHeader({
  clientName,
  hasTransactions,
  dateFrom,
  dateTo,
  dateRange,
}: StatementHeaderProps) {
  return (
    <div className="bg-gradient-to-l from-blue-600 to-blue-800 text-white p-5 rounded-t-lg">
      <h3 className="text-lg mb-1">كشف حساب</h3>
      <div className="text-2xl font-bold mb-2">{clientName}</div>
      {hasTransactions && (
        <div className="text-sm opacity-90">
          الفترة: من {dateFrom ? format(dateFrom, "dd/MM/yyyy") : formatStatementDate(dateRange.oldest)} إلى {dateTo ? format(dateTo, "dd/MM/yyyy") : formatStatementDate(dateRange.newest)}
        </div>
      )}
    </div>
  );
}
