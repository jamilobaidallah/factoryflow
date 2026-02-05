import { formatCurrency, formatStatementDate } from "@/lib/statement-format";
import type { Cheque } from '../../hooks';
import { filterPendingCheques, calculateBalanceAfterCheques } from '../../lib';

interface PendingChequesSectionProps {
  cheques: Cheque[];
  finalBalance: number;
}

export function PendingChequesSection({ cheques, finalBalance }: PendingChequesSectionProps) {
  const pendingCheques = filterPendingCheques(cheques);

  if (pendingCheques.length === 0) {
    return null;
  }

  const totalPendingCheques = pendingCheques.reduce((sum, c) => sum + (c.amount || 0), 0);
  const { balanceAfterCheques } = calculateBalanceAfterCheques(finalBalance, pendingCheques);

  return (
    <div className="mt-6 border-t-2 border-gray-200 pt-6 px-4" dir="rtl">
      <h3 className="text-lg font-semibold text-gray-700 mb-4 flex items-center gap-2">
        <span>شيكات قيد الانتظار</span>
        <span className="bg-yellow-100 text-yellow-800 text-sm px-2 py-1 rounded-full">
          {pendingCheques.length}
        </span>
      </h3>

      <div className="bg-yellow-50 rounded-lg overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-yellow-100">
              <th className="px-4 py-3 text-right text-sm font-semibold text-yellow-800">رقم الشيك</th>
              <th className="px-4 py-3 text-right text-sm font-semibold text-yellow-800">النوع</th>
              <th className="px-4 py-3 text-right text-sm font-semibold text-yellow-800">البنك</th>
              <th className="px-4 py-3 text-right text-sm font-semibold text-yellow-800">تاريخ الاستحقاق</th>
              <th className="px-4 py-3 text-right text-sm font-semibold text-yellow-800">المبلغ</th>
            </tr>
          </thead>
          <tbody>
            {pendingCheques.map((cheque, index) => (
              <tr key={cheque.id} className={index % 2 === 0 ? 'bg-yellow-50' : 'bg-white'}>
                <td className="px-4 py-3 text-sm">{cheque.chequeNumber}</td>
                <td className="px-4 py-3 text-sm">{cheque.type}</td>
                <td className="px-4 py-3 text-sm">{cheque.bankName}</td>
                <td className="px-4 py-3 text-sm">
                  {cheque.dueDate ? formatStatementDate(cheque.dueDate) : '-'}
                </td>
                <td className="px-4 py-3 text-sm font-medium">
                  {formatCurrency(cheque.amount)} د.أ
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-yellow-200 font-semibold">
              <td colSpan={4} className="px-4 py-3 text-right">إجمالي الشيكات المعلقة</td>
              <td className="px-4 py-3">
                {formatCurrency(totalPendingCheques)} د.أ
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Balance After Cheques Clear */}
      <div className="mt-4 p-4 bg-gray-100 rounded-lg flex justify-between items-center">
        <span className="font-medium text-gray-600">الرصيد المتوقع بعد صرف الشيكات:</span>
        <span className={`text-lg font-bold ${
          balanceAfterCheques > 0 ? 'text-red-600' : balanceAfterCheques < 0 ? 'text-green-600' : ''
        }`}>
          {formatCurrency(Math.abs(balanceAfterCheques))} د.أ
          {balanceAfterCheques > 0 ? ' عليه' : balanceAfterCheques < 0 ? ' له' : ' (مسدد)'}
        </span>
      </div>
    </div>
  );
}
