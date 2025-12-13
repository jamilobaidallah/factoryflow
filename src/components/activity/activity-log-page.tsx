"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Activity, Shield, Filter } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDateTime, formatCurrency } from "@/lib/date-utils";
import { useUser } from "@/firebase/provider";
import { usePermissions } from "@/hooks/usePermissions";
import { TableSkeleton } from "@/components/ui/loading-skeleton";
import { getRecentActivities } from "@/services/activityLogService";
import {
  ACTION_LABELS,
  MODULE_LABELS,
  type ActivityLog,
  type ActivityAction,
  type ActivityModule,
} from "@/types/activity-log";

export default function ActivityLogPage() {
  const { user, loading: authLoading } = useUser();
  const { role } = usePermissions();
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [moduleFilter, setModuleFilter] = useState<ActivityModule | "all">("all");
  const [actionFilter, setActionFilter] = useState<ActivityAction | "all">("all");

  const fetchActivities = useCallback(async () => {
    // Activity logs are stored under owner's uid
    // Since only owners can access this page, use their uid
    if (!user?.uid) {
      return;
    }

    setLoading(true);
    try {
      const data = await getRecentActivities(user.uid, {
        limitCount: 100,
        moduleFilter: moduleFilter === "all" ? undefined : moduleFilter,
        actionFilter: actionFilter === "all" ? undefined : actionFilter,
      });
      setActivities(data);
    } catch (error) {
      console.error("Error fetching activities:", error);
    } finally {
      setLoading(false);
    }
  }, [user?.uid, moduleFilter, actionFilter]);

  useEffect(() => {
    fetchActivities();
  }, [fetchActivities]);

  // Wait for auth to load
  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

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
          <h1 className="text-3xl font-bold text-gray-900">سجل النشاطات</h1>
          <p className="text-gray-600 mt-2">
            متابعة جميع التغييرات والعمليات في النظام
          </p>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
            <Filter className="w-4 h-4" />
            تصفية النتائج
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            <div className="w-48">
              <label className="text-sm text-gray-600 mb-1 block">القسم</label>
              <Select
                value={moduleFilter}
                onValueChange={(value) => setModuleFilter(value as ActivityModule | "all")}
              >
                <SelectTrigger>
                  <SelectValue placeholder="جميع الأقسام" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">جميع الأقسام</SelectItem>
                  {Object.entries(MODULE_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-48">
              <label className="text-sm text-gray-600 mb-1 block">الإجراء</label>
              <Select
                value={actionFilter}
                onValueChange={(value) => setActionFilter(value as ActivityAction | "all")}
              >
                <SelectTrigger>
                  <SelectValue placeholder="جميع الإجراءات" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">جميع الإجراءات</SelectItem>
                  {Object.entries(ACTION_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Activity Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="w-5 h-5" />
            النشاطات الأخيرة
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <TableSkeleton rows={10} />
          ) : activities.length === 0 ? (
            <div className="text-center py-12">
              <Activity className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500">لا توجد نشاطات مسجلة</p>
              <p className="text-sm text-slate-400 mt-1">
                ستظهر النشاطات هنا عند إجراء تغييرات في النظام
              </p>
            </div>
          ) : (
            <div className="card-modern overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50/80 hover:bg-slate-50/80">
                    <TableHead className="text-right font-semibold text-slate-700">التاريخ</TableHead>
                    <TableHead className="text-right font-semibold text-slate-700">المستخدم</TableHead>
                    <TableHead className="text-right font-semibold text-slate-700">الإجراء</TableHead>
                    <TableHead className="text-right font-semibold text-slate-700">القسم</TableHead>
                    <TableHead className="text-right font-semibold text-slate-700">المبلغ</TableHead>
                    <TableHead className="text-right font-semibold text-slate-700">الوصف</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activities.map((activity) => (
                    <TableRow key={activity.id} className="table-row-hover">
                      <TableCell className="text-slate-600 whitespace-nowrap">
                        {formatDateTime(activity.createdAt)}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium">
                            {activity.userDisplayName || "-"}
                          </span>
                          <span className="text-xs text-slate-500" dir="ltr">
                            {activity.userEmail}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <ActionBadge action={activity.action} />
                      </TableCell>
                      <TableCell>
                        <span className="text-slate-600">
                          {MODULE_LABELS[activity.module]}
                        </span>
                      </TableCell>
                      <TableCell>
                        {activity.metadata?.amount !== undefined && activity.metadata?.amount !== null ? (
                          <span
                            className={cn(
                              "font-medium",
                              activity.metadata?.type === "دخل" && "text-green-600",
                              activity.metadata?.type === "مصروف" && "text-red-600"
                            )}
                          >
                            {formatCurrency(Number(activity.metadata.amount))}
                          </span>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </TableCell>
                      <TableCell className="max-w-[300px] truncate" title={activity.description}>
                        {activity.description}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/** Badge component for action types */
function ActionBadge({ action }: { action: ActivityAction }) {
  const colorMap: Record<ActivityAction, string> = {
    create: "bg-green-100 text-green-700",
    update: "bg-blue-100 text-blue-700",
    delete: "bg-red-100 text-red-700",
    approve: "bg-emerald-100 text-emerald-700",
    reject: "bg-orange-100 text-orange-700",
    role_change: "bg-purple-100 text-purple-700",
    remove_access: "bg-rose-100 text-rose-700",
  };

  return (
    <span className={`px-2 py-1 rounded-full text-xs font-medium ${colorMap[action]}`}>
      {ACTION_LABELS[action]}
    </span>
  );
}
