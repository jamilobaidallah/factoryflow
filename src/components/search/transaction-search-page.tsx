"use client";

import { useState } from "react";
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
import { Search, FileText, Wallet, Receipt, Package } from "lucide-react";
import { useUser } from "@/firebase/provider";
import { useToast } from "@/hooks/use-toast";
import { CopyButton } from "@/components/ui/copy-button";
import {
  collection,
  query,
  where,
  getDocs,
} from "firebase/firestore";
import { firestore } from "@/firebase/config";
import { toDate, toDateOptional } from "@/lib/firestore-utils";

interface SearchResult {
  type: "ledger" | "payment" | "cheque" | "inventory";
  id: string;
  data: any;
}

export default function TransactionSearchPage() {
  const { user } = useUser();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searched, setSearched] = useState(false);

  const handleSearch = async () => {
    if (!user || !searchQuery.trim()) {
      toast({
        title: "خطأ",
        description: "يرجى إدخال رقم المعاملة للبحث",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    setSearched(true);
    const searchResults: SearchResult[] = [];

    try {
      const trimmedQuery = searchQuery.trim();

      // Search in Ledger
      const ledgerRef = collection(firestore, `users/${user.dataOwnerId}/ledger`);
      const ledgerQuery = query(
        ledgerRef,
        where("transactionId", "==", trimmedQuery)
      );
      const ledgerSnapshot = await getDocs(ledgerQuery);
      ledgerSnapshot.forEach((doc) => {
        searchResults.push({
          type: "ledger",
          id: doc.id,
          data: {
            ...doc.data(),
            date: toDate(doc.data().date),
          },
        });
      });

      // Search in Payments
      const paymentsRef = collection(firestore, `users/${user.dataOwnerId}/payments`);
      const paymentsQuery = query(
        paymentsRef,
        where("linkedTransactionId", "==", trimmedQuery)
      );
      const paymentsSnapshot = await getDocs(paymentsQuery);
      paymentsSnapshot.forEach((doc) => {
        searchResults.push({
          type: "payment",
          id: doc.id,
          data: {
            ...doc.data(),
            date: toDate(doc.data().date),
          },
        });
      });

      // Search in Cheques
      const chequesRef = collection(firestore, `users/${user.dataOwnerId}/cheques`);
      const chequesQuery = query(
        chequesRef,
        where("linkedTransactionId", "==", trimmedQuery)
      );
      const chequesSnapshot = await getDocs(chequesQuery);
      chequesSnapshot.forEach((doc) => {
        searchResults.push({
          type: "cheque",
          id: doc.id,
          data: {
            ...doc.data(),
            date: toDate(doc.data().date),
            dueDate: toDateOptional(doc.data().dueDate),
          },
        });
      });

      // Search in Inventory Movements (if they have transaction IDs)
      const inventoryRef = collection(firestore, `users/${user.dataOwnerId}/inventory_movements`);
      const inventoryQuery = query(
        inventoryRef,
        where("transactionId", "==", trimmedQuery)
      );
      const inventorySnapshot = await getDocs(inventoryQuery);
      inventorySnapshot.forEach((doc) => {
        searchResults.push({
          type: "inventory",
          id: doc.id,
          data: {
            ...doc.data(),
            date: toDate(doc.data().date),
          },
        });
      });

      setResults(searchResults);

      if (searchResults.length === 0) {
        toast({
          title: "لا توجد نتائج",
          description: `لم يتم العثور على أي سجلات لرقم المعاملة: ${trimmedQuery}`,
        });
      } else {
        toast({
          title: "تم البحث بنجاح",
          description: `تم العثور على ${searchResults.length} سجل(ات)`,
        });
      }
    } catch (error) {
      console.error("Error searching:", error);
      toast({
        title: "خطأ",
        description: "حدث خطأ أثناء البحث",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "ledger":
        return <FileText className="w-5 h-5 text-blue-600" />;
      case "payment":
        return <Wallet className="w-5 h-5 text-green-600" />;
      case "cheque":
        return <Receipt className="w-5 h-5 text-purple-600" />;
      case "inventory":
        return <Package className="w-5 h-5 text-orange-600" />;
      default:
        return <FileText className="w-5 h-5 text-gray-600" />;
    }
  };

  const getTypeName = (type: string) => {
    switch (type) {
      case "ledger":
        return "دفتر الأستاذ";
      case "payment":
        return "مدفوعات";
      case "cheque":
        return "شيكات";
      case "inventory":
        return "حركة مخزون";
      default:
        return type;
    }
  };

  const ledgerResults = results.filter((r) => r.type === "ledger");
  const paymentResults = results.filter((r) => r.type === "payment");
  const chequeResults = results.filter((r) => r.type === "cheque");
  const inventoryResults = results.filter((r) => r.type === "inventory");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">البحث عن معاملة</h1>
          <p className="text-gray-500 mt-1">
            ابحث عن المعاملات باستخدام رقم المعاملة عبر جميع السجلات
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Search className="w-8 h-8 text-primary" />
        </div>
      </div>

      {/* Search Box */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4">
            <div className="flex-1 space-y-2">
              <Label htmlFor="searchQuery">رقم المعاملة</Label>
              <div className="flex gap-2">
                <Input
                  id="searchQuery"
                  placeholder="TXN-20250109-123456-789"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {handleSearch();}
                  }}
                />
                {searchQuery && (
                  <CopyButton text={searchQuery} size="md" />
                )}
              </div>
            </div>
            <div className="flex items-end">
              <Button onClick={handleSearch} disabled={loading} className="gap-2">
                <Search className="w-4 h-4" />
                {loading ? "جاري البحث..." : "بحث"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      {searched && (
        <>
          {results.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-gray-500">
                <Search className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                <p className="text-lg">لم يتم العثور على أي نتائج</p>
                <p className="text-sm mt-2">
                  تأكد من رقم المعاملة وحاول مرة أخرى
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-6">
              {/* Summary */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {ledgerResults.length > 0 && (
                  <Card>
                    <CardHeader className="pb-3">
                      <div className="flex items-center gap-2">
                        <FileText className="w-5 h-5 text-blue-600" />
                        <CardTitle className="text-sm">دفتر الأستاذ</CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-blue-600">
                        {ledgerResults.length}
                      </div>
                    </CardContent>
                  </Card>
                )}
                {paymentResults.length > 0 && (
                  <Card>
                    <CardHeader className="pb-3">
                      <div className="flex items-center gap-2">
                        <Wallet className="w-5 h-5 text-green-600" />
                        <CardTitle className="text-sm">مدفوعات</CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-green-600">
                        {paymentResults.length}
                      </div>
                    </CardContent>
                  </Card>
                )}
                {chequeResults.length > 0 && (
                  <Card>
                    <CardHeader className="pb-3">
                      <div className="flex items-center gap-2">
                        <Receipt className="w-5 h-5 text-purple-600" />
                        <CardTitle className="text-sm">شيكات</CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-purple-600">
                        {chequeResults.length}
                      </div>
                    </CardContent>
                  </Card>
                )}
                {inventoryResults.length > 0 && (
                  <Card>
                    <CardHeader className="pb-3">
                      <div className="flex items-center gap-2">
                        <Package className="w-5 h-5 text-orange-600" />
                        <CardTitle className="text-sm">حركة مخزون</CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-orange-600">
                        {inventoryResults.length}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>

              {/* Detailed Results */}
              <Card>
                <CardHeader>
                  <CardTitle>نتائج البحث ({results.length})</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>النوع</TableHead>
                        <TableHead>التاريخ</TableHead>
                        <TableHead>الوصف</TableHead>
                        <TableHead>الطرف المرتبط</TableHead>
                        <TableHead>المبلغ</TableHead>
                        <TableHead>التفاصيل</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {results.map((result) => (
                        <TableRow key={`${result.type}-${result.id}`}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {getTypeIcon(result.type)}
                              <span className="font-medium">
                                {getTypeName(result.type)}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            {result.data.date
                              ? new Date(result.data.date).toLocaleDateString("ar-JO")
                              : "-"}
                          </TableCell>
                          <TableCell>
                            {result.type === "ledger" && result.data.description}
                            {result.type === "payment" && result.data.notes}
                            {result.type === "cheque" && result.data.chequeNumber}
                            {result.type === "inventory" && result.data.itemName}
                          </TableCell>
                          <TableCell>
                            {result.type === "ledger" && result.data.associatedParty}
                            {result.type === "payment" && result.data.clientName}
                            {result.type === "cheque" && result.data.partyName}
                            {result.type === "inventory" && "-"}
                          </TableCell>
                          <TableCell>
                            {result.data.amount
                              ? `${result.data.amount.toFixed(2)} د.أ`
                              : "-"}
                          </TableCell>
                          <TableCell>
                            {result.type === "ledger" && (
                              <div className="text-xs space-y-1">
                                <div>
                                  <span className="font-medium">الفئة: </span>
                                  {result.data.category || "-"}
                                </div>
                                {result.data.subCategory && (
                                  <div>
                                    <span className="font-medium">الفئة الفرعية: </span>
                                    {result.data.subCategory}
                                  </div>
                                )}
                                <div>
                                  <span className="font-medium">النوع: </span>
                                  <span
                                    className={`px-2 py-0.5 rounded ${
                                      result.data.type === "دخل"
                                        ? "bg-green-100 text-green-700"
                                        : "bg-red-100 text-red-700"
                                    }`}
                                  >
                                    {result.data.type}
                                  </span>
                                </div>
                              </div>
                            )}
                            {result.type === "payment" && (
                              <div className="text-xs space-y-1">
                                {result.data.category && (
                                  <div>
                                    <span className="font-medium">الفئة: </span>
                                    {result.data.category}
                                  </div>
                                )}
                                <div>
                                  <span className="font-medium">النوع: </span>
                                  <span
                                    className={`px-2 py-0.5 rounded ${
                                      result.data.type === "قبض"
                                        ? "bg-green-100 text-green-700"
                                        : "bg-red-100 text-red-700"
                                    }`}
                                  >
                                    {result.data.type}
                                  </span>
                                </div>
                              </div>
                            )}
                            {result.type === "cheque" && (
                              <div className="text-xs space-y-1">
                                <div>
                                  <span className="font-medium">رقم الشيك: </span>
                                  {result.data.chequeNumber}
                                </div>
                                <div>
                                  <span className="font-medium">تاريخ الاستحقاق: </span>
                                  {result.data.dueDate
                                    ? new Date(result.data.dueDate).toLocaleDateString("ar-JO")
                                    : "-"}
                                </div>
                                <div>
                                  <span className="font-medium">الحالة: </span>
                                  <span
                                    className={`px-2 py-0.5 rounded ${
                                      result.data.status === "مقبوض"
                                        ? "bg-green-100 text-green-700"
                                        : result.data.status === "مرتجع"
                                        ? "bg-red-100 text-red-700"
                                        : "bg-yellow-100 text-yellow-700"
                                    }`}
                                  >
                                    {result.data.status}
                                  </span>
                                </div>
                              </div>
                            )}
                            {result.type === "inventory" && (
                              <div className="text-xs space-y-1">
                                <div>
                                  <span className="font-medium">الصنف: </span>
                                  {result.data.itemName}
                                </div>
                                <div>
                                  <span className="font-medium">الكمية: </span>
                                  {result.data.quantity} {result.data.unit}
                                </div>
                                <div>
                                  <span className="font-medium">النوع: </span>
                                  <span
                                    className={`px-2 py-0.5 rounded ${
                                      result.data.movementType === "in"
                                        ? "bg-green-100 text-green-700"
                                        : "bg-red-100 text-red-700"
                                    }`}
                                  >
                                    {result.data.movementType === "in" ? "إضافة" : "سحب"}
                                  </span>
                                </div>
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          )}
        </>
      )}
    </div>
  );
}
