import {
  formatCurrency,
  formatStatementDate,
  extractPaymentMethod,
} from "@/lib/statement-format";
import type { StatementItem } from '../../hooks';

interface StatementTableProps {
  openingBalance: number;
  rowsWithBalance: StatementItem[];
  totalDebit: number;
  totalCredit: number;
  finalBalance: number;
  onRowClick: (transaction: StatementItem) => void;
}

export function StatementTable({
  openingBalance,
  rowsWithBalance,
  totalDebit,
  totalCredit,
  finalBalance,
  onRowClick,
}: StatementTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="bg-gray-50 border-b-2 border-gray-200">
            <th colSpan={2} className="px-4 py-3 text-right text-sm font-semibold text-gray-600">الرصيد</th>
            <th className="px-4 py-3 text-right text-sm font-semibold text-gray-600">دائن</th>
            <th className="px-4 py-3 text-right text-sm font-semibold text-gray-600">مدين</th>
            <th className="px-4 py-3 text-right text-sm font-semibold text-gray-600">البيان</th>
            <th className="px-4 py-3 text-right text-sm font-semibold text-gray-600">التاريخ</th>
          </tr>
        </thead>
        <tbody>
          {/* Opening Balance Row */}
          <tr className="bg-gray-100">
            <td className={`pl-1 pr-2 py-3 font-medium ${openingBalance > 0 ? 'text-red-600' : openingBalance < 0 ? 'text-green-600' : ''}`}>
              د.أ {openingBalance > 0 ? 'عليه' : openingBalance < 0 ? 'له' : ''}
            </td>
            <td className={`pl-0 pr-4 py-3 font-medium text-left ${openingBalance > 0 ? 'text-red-600' : openingBalance < 0 ? 'text-green-600' : ''}`}>
              {formatCurrency(Math.abs(openingBalance))}
            </td>
            <td className="px-4 py-3"></td>
            <td className="px-4 py-3"></td>
            <td colSpan={2} className="px-4 py-3 text-right font-medium text-gray-600">رصيد افتتاحي</td>
          </tr>

          {/* Transaction Rows */}
          {rowsWithBalance.length === 0 ? (
            <tr>
              <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                لا توجد معاملات
              </td>
            </tr>
          ) : (
            rowsWithBalance.map((transaction, index) => (
              <tr
                key={index}
                onClick={() => onRowClick(transaction)}
                className="border-b border-gray-100 hover:bg-blue-50 cursor-pointer transition-colors"
              >
                <td className={`pl-1 pr-2 py-3 text-sm font-semibold ${(transaction.balance ?? 0) >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                  د.أ {(transaction.balance ?? 0) > 0 ? 'عليه' : (transaction.balance ?? 0) < 0 ? 'له' : ''}
                </td>
                <td className={`pl-0 pr-4 py-3 text-sm font-semibold text-left ${(transaction.balance ?? 0) >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {formatCurrency(Math.abs(transaction.balance ?? 0))}
                </td>
                <td className="px-4 py-3 text-sm text-green-600 font-medium">
                  {transaction.credit > 0 ? formatCurrency(transaction.credit) : ''}
                </td>
                <td className="px-4 py-3 text-sm text-red-600 font-medium">
                  {transaction.debit > 0 ? formatCurrency(transaction.debit) : ''}
                </td>
                <td className="px-4 py-3 text-sm text-right">
                  <div className="flex items-center gap-2 justify-end">
                    <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium shrink-0 ${
                      transaction.entryType === 'سلفة'
                        ? 'bg-orange-100 text-orange-800'
                        : transaction.entryType === 'قرض'
                        ? 'bg-indigo-100 text-indigo-800'
                        : transaction.isEndorsement
                        ? 'bg-purple-100 text-purple-800'
                        : transaction.isPayment
                        ? 'bg-green-100 text-green-800'
                        : 'bg-blue-100 text-blue-800'
                    }`}>
                      {transaction.entryType === 'سلفة' ? 'سلفة' : transaction.entryType === 'قرض' ? 'قرض' : transaction.isEndorsement ? 'تظهير' : transaction.isPayment ? 'دفعة' : 'فاتورة'}
                    </span>
                    <span>
                      {transaction.isPayment
                        ? extractPaymentMethod(transaction.description)
                        : transaction.description}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3 text-sm">{formatStatementDate(transaction.date)}</td>
              </tr>
            ))
          )}

          {/* Totals Row */}
          {rowsWithBalance.length > 0 && (
            <tr className="bg-blue-800 text-white font-semibold">
              <td className="pl-1 pr-0 py-4"></td>
              <td className="pl-0 pr-4 py-4"></td>
              <td className="px-4 py-4">{formatCurrency(totalCredit)}</td>
              <td className="px-4 py-4">{formatCurrency(totalDebit)}</td>
              <td className="px-4 py-4">المجموع</td>
              <td className="px-4 py-4"></td>
            </tr>
          )}

          {/* Final Balance Row */}
          {rowsWithBalance.length > 0 && (
            <tr className="bg-green-50">
              <td className={`pl-1 pr-2 py-4 font-bold ${finalBalance >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                د.أ {finalBalance > 0 ? 'عليه' : finalBalance < 0 ? 'له' : '(مسدد)'}
              </td>
              <td className={`pl-0 pr-4 py-4 font-bold text-lg text-left ${finalBalance >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                {formatCurrency(Math.abs(finalBalance))}
              </td>
              <td className="px-4 py-4 font-bold text-gray-800" colSpan={3}>
                الرصيد المستحق
              </td>
              <td className="px-4 py-4"></td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
