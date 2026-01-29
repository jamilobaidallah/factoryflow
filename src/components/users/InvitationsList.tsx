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
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { revokeInvitation, generateInvitationLink } from "@/services/invitationService";
import { USER_ROLE_LABELS } from "@/lib/constants";
import type { Invitation } from "@/types/rbac";
import { Copy, Check, Trash2, Clock, Mail } from "lucide-react";
import { useUser } from "@/firebase/provider";

interface InvitationsListProps {
  invitations: Invitation[];
  ownerId: string;
  onInvitationUpdated: () => void;
}

export function InvitationsList({
  invitations,
  ownerId,
  onInvitationUpdated,
}: InvitationsListProps) {
  const { user } = useUser();
  const { toast } = useToast();
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [revoking, setRevoking] = useState<string | null>(null);

  const handleCopyLink = async (invitation: Invitation) => {
    const link = generateInvitationLink(invitation.token);

    try {
      await navigator.clipboard.writeText(link);
      setCopiedId(invitation.id);
      toast({
        title: "تم النسخ",
        description: "تم نسخ رابط الدعوة",
      });

      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      toast({
        title: "خطأ",
        description: "فشل نسخ الرابط",
        variant: "destructive",
      });
    }
  };

  const handleRevoke = async (invitation: Invitation) => {
    if (!user) return;

    setRevoking(invitation.id);

    const result = await revokeInvitation(invitation.id, ownerId, {
      uid: user.uid,
      email: user.email || "",
      displayName: user.displayName || undefined,
    });

    setRevoking(null);

    if (result.success) {
      toast({
        title: "تم إلغاء الدعوة",
        description: `تم إلغاء الدعوة لـ ${invitation.inviteeEmail}`,
      });
      onInvitationUpdated();
    } else {
      toast({
        title: "خطأ",
        description: result.error || "حدث خطأ أثناء إلغاء الدعوة",
        variant: "destructive",
      });
    }
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString("ar-IQ", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const getDaysRemaining = (expiresAt: Date) => {
    const now = new Date();
    const expiry = new Date(expiresAt);
    const diffTime = expiry.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  if (invitations.length === 0) {
    return (
      <div className="text-center py-8 text-slate-500">
        <Mail className="w-12 h-12 mx-auto mb-4 opacity-50" />
        <p>لا توجد دعوات معلقة</p>
        <p className="text-sm mt-1">استخدم زر &quot;دعوة عضو جديد&quot; لإرسال دعوات</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="text-right">البريد الإلكتروني</TableHead>
            <TableHead className="text-right">الدور</TableHead>
            <TableHead className="text-right">تاريخ الإنشاء</TableHead>
            <TableHead className="text-right">الصلاحية</TableHead>
            <TableHead className="text-right">الإجراءات</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {invitations.map((invitation) => {
            const daysRemaining = getDaysRemaining(invitation.expiresAt);

            return (
              <TableRow key={invitation.id}>
                <TableCell className="font-medium" dir="ltr">
                  {invitation.inviteeEmail}
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{USER_ROLE_LABELS[invitation.role]}</Badge>
                </TableCell>
                <TableCell>{formatDate(invitation.createdAt)}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-1 text-sm">
                    <Clock className="w-4 h-4 text-slate-400" />
                    <span className={daysRemaining <= 2 ? "text-yellow-600" : ""}>
                      {daysRemaining > 0 ? `${daysRemaining} أيام` : "منتهية"}
                    </span>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleCopyLink(invitation)}
                      className="gap-1"
                    >
                      {copiedId === invitation.id ? (
                        <>
                          <Check className="w-4 h-4 text-success-600" />
                          تم النسخ
                        </>
                      ) : (
                        <>
                          <Copy className="w-4 h-4" />
                          نسخ الرابط
                        </>
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleRevoke(invitation)}
                      disabled={revoking === invitation.id}
                      className="gap-1 text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="w-4 h-4" />
                      {revoking === invitation.id ? "جاري الإلغاء..." : "إلغاء"}
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
