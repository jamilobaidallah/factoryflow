"use client";

import { useState, useEffect, useMemo, useCallback, memo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, DollarSign, TrendingUp, TrendingDown, Package, Activity } from "lucide-react";
import dynamic from "next/dynamic";

// Lazy load heavy chart components
const LazyLineChart = dynamic(
  () => import("recharts").then((mod) => ({ default: mod.LineChart })),
  { ssr: false, loading: () => <ChartSkeleton /> }
);
const LazyBarChart = dynamic(
  () => import("recharts").then((mod) => ({ default: mod.BarChart })),
  { ssr: false, loading: () => <ChartSkeleton /> }
);
const LazyPieChart = dynamic(
  () => import("recharts").then((mod) => ({ default: mod.PieChart })),
  { ssr: false, loading: () => <ChartSkeleton /> }
);
const LazyComposedChart = dynamic(
  () => import("recharts").then((mod) => ({ default: mod.ComposedChart })),
  { ssr: false, loading: () => <ChartSkeleton /> }
);

// Chart skeleton for loading state
function ChartSkeleton() {
  return (
    <div className="h-[300px] w-full bg-gray-100 animate-pulse rounded-lg flex items-center justify-center">
      <span className="text-gray-400">جاري تحميل الرسم البياني...</span>
    </div>
  );
}
import { useUser } from "@/firebase/provider";
import { collection, onSnapshot, query, orderBy, getDocs } from "firebase/firestore";
import { firestore } from "@/firebase/config";
// Import only what we need from recharts (tree shaking)
import {
  Line,
  Bar,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

interface LedgerEntry {
  id: string;
  type: string;
  amount: number;
  category: string;
  date: Date;
  associatedParty?: string;
  description?: string;
}

interface Payment {
  id: string;
  type: string;
  amount: number;
  date: Date;
}

export default function DashboardPage() {
  const { user } = useUser();
  const [clientsCount, setClientsCount] = useState(0);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [totalExpenses, setTotalExpenses] = useState(0);
  const [salesCount, setSalesCount] = useState(0);
  const [inventoryCount, setInventoryCount] = useState(0);
  const [totalCashIn, setTotalCashIn] = useState(0);
  const [totalCashOut, setTotalCashOut] = useState(0);
  const [recentTransactions, setRecentTransactions] = useState<any[]>([]);
  const [recentClients, setRecentClients] = useState<any[]>([]);

  // Chart data states
  const [monthlyData, setMonthlyData] = useState<any[]>([]);
  const [cashFlowData, setCashFlowData] = useState<any[]>([]);
  const [topCustomers, setTopCustomers] = useState<any[]>([]);
  const [expensesByCategory, setExpensesByCategory] = useState<any[]>([]);

  // Load clients count
  useEffect(() => {
    if (!user) {return;}

    const clientsRef = collection(firestore, `users/${user.uid}/clients`);
    const unsubscribe = onSnapshot(clientsRef, (snapshot) => {
      setClientsCount(snapshot.size);

      // Get recent clients (last 5)
      const clients: any[] = [];
      snapshot.docs.slice(0, 5).forEach((doc) => {
        clients.push({ id: doc.id, ...doc.data() });
      });
      setRecentClients(clients);
    });

    return () => unsubscribe();
  }, [user]);

  // Load ledger data for revenue, expenses, and charts
  useEffect(() => {
    if (!user) {return;}

    const ledgerRef = collection(firestore, `users/${user.uid}/ledger`);
    const unsubscribe = onSnapshot(ledgerRef, (snapshot) => {
      let revenue = 0;
      let expenses = 0;
      let sales = 0;
      const transactions: LedgerEntry[] = [];

      // Monthly aggregation
      const monthlyMap: { [key: string]: { revenue: number; expenses: number; profit: number } } = {};

      // Customer revenue aggregation
      const customerMap: { [key: string]: number } = {};

      // Expense categories
      const categoryMap: { [key: string]: number } = {};

      snapshot.forEach((doc) => {
        const data = doc.data();
        const entry: LedgerEntry = {
          id: doc.id,
          type: data.type || "",
          amount: data.amount || 0,
          category: data.category || "",
          date: data.date?.toDate ? data.date.toDate() : new Date(),
          associatedParty: data.associatedParty,
          description: data.description,
        };

        // Calculate totals (EXCLUDE owner equity from P&L)
        const isOwnerEquity = entry.category === "رأس المال" || entry.category === "Owner Equity";

        if (!isOwnerEquity) {
          if (entry.type === "دخل" || entry.type === "إيراد") {
            revenue += entry.amount;
            sales++;

            // Track by customer
            if (entry.associatedParty) {
              customerMap[entry.associatedParty] = (customerMap[entry.associatedParty] || 0) + entry.amount;
            }
          } else if (entry.type === "مصروف") {
            expenses += entry.amount;

            // Track by category
            if (entry.category) {
              categoryMap[entry.category] = (categoryMap[entry.category] || 0) + entry.amount;
            }
          }

          // Monthly aggregation (excluding owner equity)
          // Use UTC to avoid timezone shifting the month
          const monthKey = `${entry.date.getUTCFullYear()}-${String(entry.date.getUTCMonth() + 1).padStart(2, '0')}`;
          if (!monthlyMap[monthKey]) {
            monthlyMap[monthKey] = { revenue: 0, expenses: 0, profit: 0 };
          }

          if (entry.type === "دخل" || entry.type === "إيراد") {
            monthlyMap[monthKey].revenue += entry.amount;
          } else if (entry.type === "مصروف") {
            monthlyMap[monthKey].expenses += entry.amount;
          }
        }

        transactions.push(entry);
      });

      // Calculate profit for each month
      Object.keys(monthlyMap).forEach(month => {
        monthlyMap[month].profit = monthlyMap[month].revenue - monthlyMap[month].expenses;
      });

      setTotalRevenue(revenue);
      setTotalExpenses(expenses);
      setSalesCount(sales);

      // Sort by date and get last 5 transactions
      transactions.sort((a, b) => b.date.getTime() - a.date.getTime());
      setRecentTransactions(transactions.slice(0, 5));

      // Prepare monthly chart data (last 6 months with actual data)
      const monthlyArray = Object.entries(monthlyMap)
        .filter(([, data]) => data.revenue > 0 || data.expenses > 0) // Only include months with actual transactions
        .sort(([a], [b]) => a.localeCompare(b))
        .slice(-6)
        .map(([month, data]) => {
          // Parse year and month from "YYYY-MM" format to avoid timezone issues
          const [year, monthNum] = month.split('-');
          const date = new Date(parseInt(year), parseInt(monthNum) - 1, 15); // Use day 15 to avoid timezone edge cases
          return {
            month: date.toLocaleDateString("en-US", { month: "short", year: "numeric" }),
            الإيرادات: data.revenue,
            المصروفات: data.expenses,
            الربح: data.profit,
          };
        });
      setMonthlyData(monthlyArray);

      // Top 5 customers
      const topCustomersArray = Object.entries(customerMap)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([name, amount]) => ({ name, amount }));
      setTopCustomers(topCustomersArray);

      // Top expense categories
      const categoryArray = Object.entries(categoryMap)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([name, value]) => ({ name, value }));
      setExpensesByCategory(categoryArray);
    });

    return () => unsubscribe();
  }, [user]);

  // Load payments for cash flow chart
  useEffect(() => {
    if (!user) {return;}

    const paymentsRef = collection(firestore, `users/${user.uid}/payments`);
    const unsubscribe = onSnapshot(paymentsRef, (snapshot) => {
      const monthlyMap: { [key: string]: { cashIn: number; cashOut: number } } = {};
      let totalIn = 0;
      let totalOut = 0;

      snapshot.forEach((doc) => {
        const data = doc.data();
        const date = data.date?.toDate ? data.date.toDate() : new Date();
        // Use UTC to avoid timezone shifting the month
        const monthKey = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;

        if (!monthlyMap[monthKey]) {
          monthlyMap[monthKey] = { cashIn: 0, cashOut: 0 };
        }

        // Skip endorsed cheques and no-cash-movement payments
        if (data.isEndorsement || data.noCashMovement) {
          return;
        }

        if (data.type === "قبض") {
          monthlyMap[monthKey].cashIn += data.amount || 0;
          totalIn += data.amount || 0;
        } else if (data.type === "صرف") {
          monthlyMap[monthKey].cashOut += data.amount || 0;
          totalOut += data.amount || 0;
        }
      });

      setTotalCashIn(totalIn);
      setTotalCashOut(totalOut);

      // Prepare cash flow chart data (last 6 months with actual data)
      const cashFlowArray = Object.entries(monthlyMap)
        .filter(([, data]) => data.cashIn > 0 || data.cashOut > 0) // Only include months with actual transactions
        .sort(([a], [b]) => a.localeCompare(b))
        .slice(-6)
        .map(([month, data]) => {
          // Parse year and month from "YYYY-MM" format to avoid timezone issues
          const [year, monthNum] = month.split('-');
          const date = new Date(parseInt(year), parseInt(monthNum) - 1, 15); // Use day 15 to avoid timezone edge cases
          return {
            month: date.toLocaleDateString("en-US", { month: "short", year: "numeric" }),
            "نقد وارد": data.cashIn,
            "نقد صادر": data.cashOut,
            "صافي التدفق": data.cashIn - data.cashOut,
          };
        });
      setCashFlowData(cashFlowArray);
    });

    return () => unsubscribe();
  }, [user]);

  // Load inventory count
  useEffect(() => {
    if (!user) {return;}

    const inventoryRef = collection(firestore, `users/${user.uid}/inventory`);
    const unsubscribe = onSnapshot(inventoryRef, (snapshot) => {
      setInventoryCount(snapshot.size);
    });

    return () => unsubscribe();
  }, [user]);

  const netCashFlow = totalCashIn - totalCashOut;

  // Memoize stats to avoid recalculation on every render
  const stats = useMemo(() => [
    {
      title: "إجمالي العملاء",
      value: clientsCount.toString(),
      icon: Users,
      color: "text-blue-600",
      bgColor: "bg-blue-100",
    },
    {
      title: "الإيرادات",
      value: `${totalRevenue.toFixed(2)} دينار`,
      icon: TrendingUp,
      color: "text-green-600",
      bgColor: "bg-green-100",
    },
    {
      title: "المصروفات",
      value: `${totalExpenses.toFixed(2)} دينار`,
      icon: TrendingDown,
      color: "text-red-600",
      bgColor: "bg-red-100",
    },
    {
      title: "صافي الربح",
      value: `${(totalRevenue - totalExpenses).toFixed(2)} دينار`,
      icon: DollarSign,
      color: totalRevenue - totalExpenses >= 0 ? "text-green-600" : "text-red-600",
      bgColor: totalRevenue - totalExpenses >= 0 ? "bg-green-100" : "bg-red-100",
    },
    {
      title: "صافي التدفق النقدي",
      value: `${netCashFlow.toFixed(2)} دينار`,
      icon: Activity,
      color: netCashFlow >= 0 ? "text-green-600" : "text-red-600",
      bgColor: netCashFlow >= 0 ? "bg-green-100" : "bg-red-100",
    },
  ], [clientsCount, totalRevenue, totalExpenses, netCashFlow]);

  // Memoize colors to avoid recreation
  const COLORS = useMemo(() => ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'], []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">لوحة التحكم</h1>
        <p className="text-gray-600 mt-2">نظرة عامة على إحصائيات المصنع</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
        {stats.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <Card key={index}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">
                  {stat.title}
                </CardTitle>
                <div className={`p-2 rounded-lg ${stat.bgColor}`}>
                  <Icon className={`w-5 h-5 ${stat.color}`} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Charts Row 1: Revenue vs Expenses + Cash Flow */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue vs Expenses Trend */}
        <Card>
          <CardHeader>
            <CardTitle>الإيرادات والمصروفات (آخر 6 أشهر)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LazyLineChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="الإيرادات" stroke="#10b981" strokeWidth={2} />
                <Line type="monotone" dataKey="المصروفات" stroke="#ef4444" strokeWidth={2} />
                <Line type="monotone" dataKey="الربح" stroke="#3b82f6" strokeWidth={2} />
              </LazyLineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Cash Flow */}
        <Card>
          <CardHeader>
            <CardTitle>التدفق النقدي (آخر 6 أشهر)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LazyComposedChart data={cashFlowData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="نقد وارد" fill="#10b981" />
                <Bar dataKey="نقد صادر" fill="#ef4444" />
                <Line type="monotone" dataKey="صافي التدفق" stroke="#3b82f6" strokeWidth={2} />
              </LazyComposedChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 2: Top Customers + Expenses by Category */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Customers */}
        <Card>
          <CardHeader>
            <CardTitle>أفضل 5 عملاء (حسب الإيرادات)</CardTitle>
          </CardHeader>
          <CardContent>
            {topCustomers.length === 0 ? (
              <p className="text-gray-500 text-center py-8">لا توجد بيانات بعد</p>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <LazyBarChart data={topCustomers} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis dataKey="name" type="category" width={100} />
                  <Tooltip />
                  <Bar dataKey="amount" fill="#3b82f6" />
                </LazyBarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Expenses by Category */}
        <Card>
          <CardHeader>
            <CardTitle>المصروفات حسب الفئة</CardTitle>
          </CardHeader>
          <CardContent>
            {expensesByCategory.length === 0 ? (
              <p className="text-gray-500 text-center py-8">لا توجد مصروفات بعد</p>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <LazyPieChart>
                  <Pie
                    data={expensesByCategory}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={(entry) => `${entry.name}`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {expensesByCategory.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </LazyPieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>آخر الحركات المالية</CardTitle>
          </CardHeader>
          <CardContent>
            {recentTransactions.length === 0 ? (
              <p className="text-gray-500 text-center py-8">لا توجد حركات مالية بعد</p>
            ) : (
              <div className="space-y-3">
                {recentTransactions.map((transaction) => (
                  <div
                    key={transaction.id}
                    className="flex items-center justify-between py-2 border-b last:border-0"
                  >
                    <div>
                      <div className="font-medium">{transaction.description || transaction.category}</div>
                      <div className="text-xs text-gray-500">
                        {transaction.date.toLocaleDateString("ar-EG")}
                      </div>
                    </div>
                    <div
                      className={`font-semibold ${
                        transaction.type === "دخل" || transaction.type === "إيراد"
                          ? "text-green-600"
                          : "text-red-600"
                      }`}
                    >
                      {transaction.type === "دخل" || transaction.type === "إيراد" ? "+" : "-"}
                      {transaction.amount.toFixed(2)} دينار
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>العملاء الجدد</CardTitle>
          </CardHeader>
          <CardContent>
            {recentClients.length === 0 ? (
              <p className="text-gray-500 text-center py-8">لا يوجد عملاء بعد</p>
            ) : (
              <div className="space-y-3">
                {recentClients.map((client) => (
                  <div
                    key={client.id}
                    className="flex items-center justify-between py-2 border-b last:border-0"
                  >
                    <div>
                      <div className="font-medium">{client.name}</div>
                      <div className="text-xs text-gray-500">
                        {client.phone || "لا يوجد رقم هاتف"}
                      </div>
                    </div>
                    <div className="text-sm text-gray-600">
                      {client.company || "لا توجد شركة"}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
