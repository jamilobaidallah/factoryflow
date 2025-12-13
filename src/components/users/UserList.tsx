"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Trash2 } from "lucide-react";
import { useConfirmation } from "@/components/ui/confirmation-dialog";
import { useToast } from "@/hooks/use-toast";
import { useUser } from "@/firebase/provider";
import { RoleSelector } from "./RoleSelector";
import { updateUserRole, removeUserAccess } from "@/services/userService";
import { USER_ROLE_LABELS } from "@/lib/constants";
import type { OrganizationMember, UserRole } from "@/types/rbac";
import { formatShortDate } from "@/lib/date-utils";

interface UserListProps {
  members: OrganizationMember[];
  ownerId: string;
  onMemberUpdated: () => void;
}

export function UserList({ members, ownerId, onMemberUpdated }: UserListProps) {
  const { toast } = useToast();
  const { user } = useUser();
  const { confirm, dialog: confirmationDialog } = useConfirmation();
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);

  // معلومات المستخدم الحالي للتسجيل
  const callerInfo = user ? {
    uid: user.uid,
    email: user.email || '',
    displayName: user.displayName || undefined,
  } : undefined;

  const handleRoleChange = async (memberUid: string, newRole: UserRole) => {
    setUpdatingUserId(memberUid);

    const result = await updateUserRole(ownerId, memberUid, newRole, callerInfo);

    if (result.success) {
      toast({
        title: "تم تحديث الدور",
        description: `تم تغيير دور المستخدم إلى ${USER_ROLE_LABELS[newRole]}`,
      });
      onMemberUpdated();
    } else {
      toast({
        title: "خطأ",
        description: result.error || "حدث خطأ أثناء تحديث الدور",
        variant: "destructive",
      });
    }

    setUpdatingUserId(null);
  };

  const handleRemoveAccess = (member: OrganizationMember) => {
    confirm(
      "إزالة المستخدم",
      `هل أنت متأكد من إزالة وصول ${member.displayName || member.email}؟ سيفقد المستخدم جميع صلاحياته.`,
      async () => {
        const result = await removeUserAccess(ownerId, member.uid, callerInfo);

        if (result.success) {
          toast({
            title: "تمت الإزالة",
            description: "تم إزالة وصول المستخدم بنجاح",
          });
          onMemberUpdated();
        } else {
          toast({
            title: "خطأ",
            description: result.error || "حدث خطأ أثناء إزالة المستخدم",
            variant: "destructive",
          });
        }
      },
      "destructive"
    );
  };

  if (members.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-500">لا يوجد مستخدمين آخرين</p>
        <p className="text-sm text-slate-400 mt-1">
          عند قبول طلبات الوصول، سيظهر المستخدمون هنا
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="card-modern overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50/80 hover:bg-slate-50/80">
              <TableHead className="text-right font-semibold text-slate-700">الاسم</TableHead>
              <TableHead className="text-right font-semibold text-slate-700">البريد الإلكتروني</TableHead>
              <TableHead className="text-right font-semibold text-slate-700">الدور</TableHead>
              <TableHead className="text-right font-semibold text-slate-700">تاريخ الانضمام</TableHead>
              <TableHead className="text-right font-semibold text-slate-700">الإجراءات</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.map((member) => {
              const isOwner = member.uid === ownerId;

              return (
                <TableRow key={member.uid} className="table-row-hover">
                  <TableCell className="font-medium">
                    {member.displayName || "-"}
                    {isOwner && (
                      <span className="mr-2 text-xs badge-primary">أنت</span>
                    )}
                  </TableCell>
                  <TableCell dir="ltr" className="text-left">
                    {member.email}
                  </TableCell>
                  <TableCell>
                    {isOwner ? (
                      <span className="badge-success">{USER_ROLE_LABELS[member.role]}</span>
                    ) : (
                      <RoleSelector
                        value={member.role}
                        onChange={(role) => handleRoleChange(member.uid, role)}
                        disabled={updatingUserId === member.uid}
                      />
                    )}
                  </TableCell>
                  <TableCell>
                    {member.approvedAt
                      ? formatShortDate(member.approvedAt)
                      : "-"}
                  </TableCell>
                  <TableCell>
                    {!isOwner && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-slate-400 hover:text-red-600 hover:bg-red-50"
                        onClick={() => handleRemoveAccess(member)}
                        title="إزالة المستخدم"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      {confirmationDialog}
    </>
  );
}
