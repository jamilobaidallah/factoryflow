"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, Clock, Shield } from "lucide-react";
import { useUser } from "@/firebase/provider";
import { usePermissions } from "@/hooks/usePermissions";
import { TableSkeleton } from "@/components/ui/loading-skeleton";
import { UserList } from "./UserList";
import { PendingRequestsList } from "./PendingRequestsList";
import {
  getOrganizationMembers,
  getPendingRequests,
} from "@/services/userService";
import type { OrganizationMember, AccessRequest } from "@/types/rbac";

export default function UsersPage() {
  const { user } = useUser();
  const { role } = usePermissions();
  const [members, setMembers] = useState<OrganizationMember[]>([]);
  const [pendingRequests, setPendingRequests] = useState<AccessRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("users");

  const fetchData = useCallback(async () => {
    if (!user?.uid) return;

    setLoading(true);
    try {
      const [membersData, requestsData] = await Promise.all([
        getOrganizationMembers(user.uid),
        getPendingRequests(user.uid),
      ]);

      // Add owner to members list if not already there
      const ownerExists = membersData.some((m) => m.uid === user.uid);
      if (!ownerExists) {
        membersData.unshift({
          uid: user.uid,
          orgId: user.uid,
          email: user.email || "",
          displayName: user.displayName || user.email || "",
          role: "owner",
          requestedAt: new Date(),
          approvedAt: new Date(),
          isActive: true,
        });
      }

      setMembers(membersData);
      setPendingRequests(requestsData);
    } catch (error) {
      console.error("Error fetching user data:", error);
    } finally {
      setLoading(false);
    }
  }, [user?.uid, user?.email, user?.displayName]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Only owners can access this page
  if (role !== "owner") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <div className="p-4 bg-red-100 rounded-full">
          <Shield className="w-8 h-8 text-red-600" />
        </div>
        <div className="text-center">
          <h2 className="text-xl font-semibold text-slate-900">غير مصرح</h2>
          <p className="text-slate-600 mt-1">
            هذه الصفحة متاحة للمالكين فقط
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">إدارة المستخدمين</h1>
          <p className="text-gray-600 mt-2">
            إدارة صلاحيات المستخدمين وطلبات الوصول
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
              <Users className="w-4 h-4" />
              المستخدمون النشطون
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {loading ? "-" : members.length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
              <Clock className="w-4 h-4" />
              طلبات معلقة
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">
              {loading ? "-" : pendingRequests.length}
            </div>
            {pendingRequests.length > 0 && (
              <p className="text-xs text-yellow-600 mt-1">
                بانتظار الموافقة
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="users" className="gap-2">
            <Users className="w-4 h-4" />
            المستخدمون الحاليون ({members.length})
          </TabsTrigger>
          <TabsTrigger value="requests" className="gap-2">
            <Clock className="w-4 h-4" />
            طلبات الانتظار
            {pendingRequests.length > 0 && (
              <span className="mr-1 px-2 py-0.5 text-xs bg-yellow-100 text-yellow-700 rounded-full">
                {pendingRequests.length}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="users">
          <Card>
            <CardHeader>
              <CardTitle>المستخدمون الحاليون</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <TableSkeleton rows={5} />
              ) : (
                <UserList
                  members={members}
                  ownerId={user?.uid || ""}
                  onMemberUpdated={fetchData}
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="requests">
          <Card>
            <CardHeader>
              <CardTitle>طلبات الوصول المعلقة</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <TableSkeleton rows={5} />
              ) : (
                <PendingRequestsList
                  requests={pendingRequests}
                  ownerId={user?.uid || ""}
                  onRequestProcessed={fetchData}
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
