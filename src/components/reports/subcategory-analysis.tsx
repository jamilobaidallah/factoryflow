"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Download, TrendingUp } from "lucide-react";
import { useUser } from "@/firebase/provider";
import {
  collection,
  query,
  where,
  getDocs,
} from "firebase/firestore";
import { firestore } from "@/firebase/config";

// Import CATEGORIES from ledger (you may need to export this from ledger-page.tsx)
const CATEGORIES = [
  {
    name: "رأس المال",
    type: "دخل",
    subcategories: ["رأس مال مالك", "سحوبات المالك"]
  },
  {
    name: "إيرادات المبيعات",
    type: "دخل",
    subcategories: ["مبيعات منتجات", "مبيعات خدمات", "إيرادات عمولات"]
  },
  {
    name: "تكلفة البضاعة المباعة (COGS)",
    type: "مصروف",
    subcategories: ["مواد خام", "شحن و نقل", "شراء بضائع للبيع"]
  },
  {
    name: "مصاريف تشغيلية",
    type: "مصروف",
    subcategories: ["رواتب وأجور", "إيجار", "كهرباء وماء", "صيانة", "وقود ومواصلات"]
  },
  {
    name: "مصاريف إدارية",
    type: "مصروف",
    subcategories: ["قرطاسية", "اتصالات", "تأمين", "رسوم حكومية"]
  },
  {
    name: "رأس المال الثابت (استثمارات)",
    type: "مصروف",
    subcategories: ["معدات", "سيارات", "مباني", "أثاث"]
  },
  {
    name: "أصول ثابتة",
    type: "مصروف",
    subcategories: ["معدات", "سيارات", "مباني", "أثاث"]
  },
];

interface MonthlyData {
  month: string;
  amount: number;
  count: number;
}

export default function SubcategoryAnalysis() {
  const { user } = useUser();
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedSubcategory, setSelectedSubcategory] = useState("");
  const [monthlyData, setMonthlyData] = useState<MonthlyData[]>([]);
  const [totalAmount, setTotalAmount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 6);
    return d.toISOString().split("T")[0];
  });
  const [endDate, setEndDate] = useState(new Date().toISOString().split("T")[0]);

  const availableSubcategories = selectedCategory
    ? CATEGORIES.find((cat) => cat.name === selectedCategory)?.subcategories || []
    : [];

  const analyzeData = async () => {
    if (!user || !selectedCategory || !selectedSubcategory) {return;}

    setLoading(true);
    try {
      const ledgerRef = collection(firestore, `users/${user.uid}/ledger`);
      const q = query(
        ledgerRef,
        where("category", "==", selectedCategory),
        where("subCategory", "==", selectedSubcategory)
      );

      const snapshot = await getDocs(q);
      const monthlyMap: { [key: string]: { amount: number; count: number } } = {};
      let total = 0;

      snapshot.forEach((doc) => {
        const data = doc.data();
        const date = data.date?.toDate?.() || new Date();

        // Apply date filter
        if (date >= new Date(startDate) && date <= new Date(endDate)) {
          const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

          if (!monthlyMap[monthKey]) {
            monthlyMap[monthKey] = { amount: 0, count: 0 };
          }

          monthlyMap[monthKey].amount += data.amount || 0;
          monthlyMap[monthKey].count += 1;
          total += data.amount || 0;
        }
      });

      // Convert to array and sort
      const monthlyArray: MonthlyData[] = Object.entries(monthlyMap)
        .map(([month, data]) => {
          const [year, monthNum] = month.split("-");
          const date = new Date(parseInt(year), parseInt(monthNum) - 1, 15);
          return {
            month: date.toLocaleDateString("en-US", { month: "short", year: "numeric" }),
            amount: data.amount,
            count: data.count,
          };
        })
        .sort((a, b) => {
          const dateA = new Date(a.month);
          const dateB = new Date(b.month);
          return dateA.getTime() - dateB.getTime();
        });

      setMonthlyData(monthlyArray);
      setTotalAmount(total);
    } catch (error) {
      console.error("Error analyzing data:", error);
    }
    setLoading(false);
  };

  const exportToCSV = () => {
    const headers = ["الشهر", "المبلغ", "عدد المعاملات"];
    const rows = monthlyData.map((d) => [d.month, d.amount.toFixed(2), d.count]);
    const csv = [headers, ...rows].map((row) => row.join(",")).join("\n");

    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${selectedSubcategory}_analysis.csv`;
    link.click();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5" />
          تحليل المصروفات حسب الفئة الفرعية
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="space-y-2">
            <Label htmlFor="category">الفئة الرئيسية</Label>
            <select
              id="category"
              value={selectedCategory}
              onChange={(e) => {
                setSelectedCategory(e.target.value);
                setSelectedSubcategory("");
                setMonthlyData([]);
              }}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">اختر الفئة</option>
              {CATEGORIES.map((cat) => (
                <option key={cat.name} value={cat.name}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="subcategory">الفئة الفرعية</Label>
            <select
              id="subcategory"
              value={selectedSubcategory}
              onChange={(e) => {
                setSelectedSubcategory(e.target.value);
                setMonthlyData([]);
              }}
              disabled={!selectedCategory}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm disabled:opacity-50"
            >
              <option value="">اختر الفئة الفرعية</option>
              {availableSubcategories.map((sub) => (
                <option key={sub} value={sub}>
                  {sub}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="startDate">من تاريخ</Label>
            <input
              id="startDate"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="endDate">إلى تاريخ</Label>
            <input
              id="endDate"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>

          <div className="space-y-2">
            <Label>&nbsp;</Label>
            <Button
              onClick={analyzeData}
              disabled={!selectedCategory || !selectedSubcategory || loading}
              className="w-full"
            >
              {loading ? "جاري التحليل..." : "تحليل"}
            </Button>
          </div>
        </div>

        {/* Results */}
        {monthlyData.length > 0 && (
          <>
            <div className="flex items-center justify-between border-t pt-4">
              <div>
                <p className="text-2xl font-bold text-blue-600">
                  {totalAmount.toFixed(2)} د.أ
                </p>
                <p className="text-sm text-gray-500">
                  إجمالي {selectedSubcategory} ({monthlyData.reduce((sum, d) => sum + d.count, 0)} معاملة)
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={exportToCSV}>
                <Download className="w-4 h-4 ml-2" />
                تصدير CSV
              </Button>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>الشهر</TableHead>
                  <TableHead>عدد المعاملات</TableHead>
                  <TableHead className="text-left">المبلغ</TableHead>
                  <TableHead className="text-left">المتوسط</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {monthlyData.map((data, index) => (
                  <TableRow key={index}>
                    <TableCell className="font-medium">{data.month}</TableCell>
                    <TableCell>{data.count}</TableCell>
                    <TableCell className="text-left font-semibold">
                      {data.amount.toFixed(2)} د.أ
                    </TableCell>
                    <TableCell className="text-left text-gray-600">
                      {(data.amount / data.count).toFixed(2)} د.أ
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow className="bg-blue-50 font-bold">
                  <TableCell>المجموع</TableCell>
                  <TableCell>{monthlyData.reduce((sum, d) => sum + d.count, 0)}</TableCell>
                  <TableCell className="text-left text-blue-700">
                    {totalAmount.toFixed(2)} د.أ
                  </TableCell>
                  <TableCell className="text-left text-gray-600">
                    {(totalAmount / monthlyData.reduce((sum, d) => sum + d.count, 0)).toFixed(2)} د.أ
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </>
        )}

        {monthlyData.length === 0 && selectedCategory && selectedSubcategory && !loading && (
          <div className="text-center text-gray-500 py-8">
            لا توجد بيانات للفترة المحددة
          </div>
        )}
      </CardContent>
    </Card>
  );
}
