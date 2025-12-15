"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Download, TrendingUp, Calendar } from "lucide-react";
import { useUser } from "@/firebase/provider";
import {
  collection,
  query,
  where,
  getDocs,
} from "firebase/firestore";
import { firestore } from "@/firebase/config";

interface Partner {
  id: string;
  name: string;
  ownershipPercentage: number;
  initialInvestment: number;
}

interface PartnerEquity {
  partner: Partner;
  investments: number;
  withdrawals: number;
  profitShare: number;
  currentEquity: number;
}

export default function PartnersEquityReport() {
  const { user } = useUser();
  const [partners, setPartners] = useState<Partner[]>([]);
  const [equityData, setEquityData] = useState<PartnerEquity[]>([]);
  const [loading, setLoading] = useState(false);
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 12); // Last 12 months by default
    return d.toISOString().split("T")[0];
  });
  const [endDate, setEndDate] = useState(new Date().toISOString().split("T")[0]);
  const [totalProfit, setTotalProfit] = useState(0);

  // Load partners
  useEffect(() => {
    if (!user) {return;}

    const loadPartners = async () => {
      const partnersRef = collection(firestore, `users/${user.dataOwnerId}/partners`);
      const snapshot = await getDocs(partnersRef);
      const partnersData: Partner[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        if (data.active !== false) {
          partnersData.push({
            id: doc.id,
            ...data,
          } as Partner);
        }
      });
      setPartners(partnersData);
    };

    loadPartners();
  }, [user]);

  const calculateEquity = async () => {
    if (!user || partners.length === 0) {return;}

    setLoading(true);
    try {
      const ledgerRef = collection(firestore, `users/${user.dataOwnerId}/ledger`);

      // Get all ledger entries for the date range
      const q = query(
        ledgerRef,
        where("date", ">=", new Date(startDate)),
        where("date", "<=", new Date(endDate))
      );
      const snapshot = await getDocs(q);

      // Calculate total profit ONCE (revenue - expenses, excluding capital)
      let totalRevenue = 0;
      let totalExpenses = 0;

      // First pass: Calculate total profit for ALL partners
      snapshot.forEach((doc) => {
        const data = doc.data();
        const entryDate = data.date?.toDate?.() || new Date();

        // Skip if date is out of range
        if (entryDate < new Date(startDate) || entryDate > new Date(endDate)) {
          return;
        }

        // Check if this is an equity transaction (by type or category)
        const isEquity = data.type === "حركة رأس مال" || data.category === "رأس المال";

        // Calculate total profit (excluding all equity/capital transactions)
        if (!isEquity) {
          if (data.type === "دخل" || data.type === "إيراد") {
            totalRevenue += data.amount || 0;
          } else if (data.type === "مصروف") {
            totalExpenses += data.amount || 0;
          }
        }
      });

      const netProfit = totalRevenue - totalExpenses;

      // Second pass: Calculate each partner's equity
      const equityResults: PartnerEquity[] = [];

      for (const partner of partners) {
        let investments = partner.initialInvestment || 0;
        let withdrawals = 0;

        // Process partner-specific capital transactions
        snapshot.forEach((doc) => {
          const data = doc.data();
          const entryDate = data.date?.toDate?.() || new Date();

          // Skip if date is out of range
          if (entryDate < new Date(startDate) || entryDate > new Date(endDate)) {
            return;
          }

          // Track partner-specific capital transactions
          if (data.ownerName === partner.name) {
            // Check if this is an equity transaction (by type or category)
            const isEquity = data.type === "حركة رأس مال" || data.category === "رأس المال";

            if (isEquity) {
              // Direction determined by subcategory
              if (data.subCategory === "رأس مال مالك") {
                // Capital contribution = investment (positive)
                investments += data.amount || 0;
              } else if (data.subCategory === "سحوبات المالك") {
                // Owner withdrawal = withdrawal (negative)
                withdrawals += data.amount || 0;
              }
            }
          }
        });

        const profitShare = (netProfit * partner.ownershipPercentage) / 100;
        const currentEquity = investments - withdrawals + profitShare;

        equityResults.push({
          partner,
          investments,
          withdrawals,
          profitShare,
          currentEquity,
        });
      }

      setTotalProfit(netProfit);
      setEquityData(equityResults);
    } catch (error) {
      console.error("Error calculating equity:", error);
    }
    setLoading(false);
  };

  const exportToCSV = () => {
    const headers = ["الشريك", "نسبة الملكية", "الاستثمارات", "السحوبات", "نصيب الربح", "حقوق الملكية"];
    const rows = equityData.map((e) => [
      e.partner.name,
      `${e.partner.ownershipPercentage}%`,
      e.investments.toFixed(2),
      e.withdrawals.toFixed(2),
      e.profitShare.toFixed(2),
      e.currentEquity.toFixed(2),
    ]);
    const csv = [headers, ...rows].map((row) => row.join(",")).join("\n");

    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `partners_equity_report.csv`;
    link.click();
  };

  const totalInvestments = equityData.reduce((sum, e) => sum + e.investments, 0);
  const totalWithdrawals = equityData.reduce((sum, e) => sum + e.withdrawals, 0);
  const totalProfitShares = equityData.reduce((sum, e) => sum + e.profitShare, 0);
  const totalEquity = equityData.reduce((sum, e) => sum + e.currentEquity, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5" />
          تقرير حقوق الملكية للشركاء
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="startDate">من تاريخ</Label>
            <Input
              id="startDate"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="endDate">إلى تاريخ</Label>
            <Input
              id="endDate"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>&nbsp;</Label>
            <Button
              onClick={calculateEquity}
              disabled={partners.length === 0 || loading}
              className="w-full"
            >
              <Calendar className="w-4 h-4 ml-2" />
              {loading ? "جاري الحساب..." : "حساب حقوق الملكية"}
            </Button>
          </div>
        </div>

        {partners.length === 0 && (
          <div className="text-center text-gray-500 py-8 border border-dashed rounded-lg">
            <p className="font-medium">لا يوجد شركاء</p>
            <p className="text-sm mt-2">يرجى إضافة شركاء من صفحة &quot;الشركاء&quot; أولاً</p>
          </div>
        )}

        {/* Summary Cards */}
        {equityData.length > 0 && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-4">
              <Card className="bg-green-50">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-gray-600">
                    إجمالي الاستثمارات
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-xl font-bold text-green-700">
                    {totalInvestments.toFixed(2)} د.أ
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-red-50">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-gray-600">
                    إجمالي السحوبات
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-xl font-bold text-red-700">
                    {totalWithdrawals.toFixed(2)} د.أ
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-blue-50">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-gray-600">
                    صافي الربح (الفترة)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className={`text-xl font-bold ${totalProfit >= 0 ? "text-blue-700" : "text-red-700"}`}>
                    {totalProfit.toFixed(2)} د.أ
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-purple-50">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-gray-600">
                    إجمالي حقوق الملكية
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-xl font-bold text-purple-700">
                    {totalEquity.toFixed(2)} د.أ
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Detailed Table */}
            <div className="flex items-center justify-between border-t pt-4">
              <h3 className="text-lg font-semibold">تفاصيل حقوق الملكية لكل شريك</h3>
              <Button variant="outline" size="sm" onClick={exportToCSV}>
                <Download className="w-4 h-4 ml-2" />
                تصدير CSV
              </Button>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>الشريك</TableHead>
                  <TableHead>نسبة الملكية</TableHead>
                  <TableHead className="text-right">الاستثمارات</TableHead>
                  <TableHead className="text-right">السحوبات</TableHead>
                  <TableHead className="text-right">نصيب من الربح</TableHead>
                  <TableHead className="text-right">حقوق الملكية</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {equityData.map((equity, index) => (
                  <TableRow key={index}>
                    <TableCell className="font-medium">{equity.partner.name}</TableCell>
                    <TableCell>
                      <span className="font-semibold text-blue-600">
                        {equity.partner.ownershipPercentage}%
                      </span>
                    </TableCell>
                    <TableCell className="text-right text-green-700">
                      {equity.investments.toFixed(2)} د.أ
                    </TableCell>
                    <TableCell className="text-right text-red-700">
                      {equity.withdrawals.toFixed(2)} د.أ
                    </TableCell>
                    <TableCell className="text-right text-blue-700">
                      {equity.profitShare.toFixed(2)} د.أ
                    </TableCell>
                    <TableCell className="text-right font-bold text-purple-700">
                      {equity.currentEquity.toFixed(2)} د.أ
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow className="bg-gray-50 font-bold">
                  <TableCell colSpan={2}>المجموع</TableCell>
                  <TableCell className="text-right text-green-700">
                    {totalInvestments.toFixed(2)} د.أ
                  </TableCell>
                  <TableCell className="text-right text-red-700">
                    {totalWithdrawals.toFixed(2)} د.أ
                  </TableCell>
                  <TableCell className="text-right text-blue-700">
                    {totalProfitShares.toFixed(2)} د.أ
                  </TableCell>
                  <TableCell className="text-right text-purple-700">
                    {totalEquity.toFixed(2)} د.أ
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>

            {/* Explanation */}
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200 text-sm">
              <p className="font-semibold text-blue-900 mb-2">💡 كيف يتم حساب حقوق الملكية:</p>
              <ul className="space-y-1 text-blue-800">
                <li><strong>الاستثمارات:</strong> الاستثمار الأولي + جميع استثمارات إضافية في الفترة المحددة</li>
                <li><strong>السحوبات:</strong> جميع سحوبات الشريك في الفترة المحددة</li>
                <li><strong>نصيب من الربح:</strong> (صافي الربح × نسبة الملكية) - يتم توزيع الأرباح حسب نسبة الملكية</li>
                <li><strong>حقوق الملكية:</strong> الاستثمارات - السحوبات + نصيب من الربح</li>
              </ul>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
