"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { useUser } from "@/firebase/provider";
import { createInvitation, generateInvitationLink } from "@/services/invitationService";
import { USER_ROLE_LABELS } from "@/lib/constants";
import { UserPlus, Copy, Check, Mail, Link as LinkIcon } from "lucide-react";

interface InviteMemberDialogProps {
  onInvitationCreated?: () => void;
}

export function InviteMemberDialog({ onInvitationCreated }: InviteMemberDialogProps) {
  const { user } = useUser();
  const { toast } = useToast();

  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<'accountant' | 'viewer'>('accountant');
  const [loading, setLoading] = useState(false);
  const [invitationLink, setInvitationLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) return;

    setLoading(true);

    const result = await createInvitation(
      user.uid,
      user.email || "",
      user.displayName || undefined,
      email,
      role,
      {
        uid: user.uid,
        email: user.email || "",
        displayName: user.displayName || undefined,
      }
    );

    setLoading(false);

    if (result.success && result.invitation) {
      const link = generateInvitationLink(result.invitation.token);
      setInvitationLink(link);

      toast({
        title: "تم إنشاء الدعوة بنجاح",
        description: "يمكنك الآن مشاركة الرابط مع المدعو",
      });

      onInvitationCreated?.();
    } else {
      toast({
        title: "خطأ",
        description: result.error || "حدث خطأ أثناء إنشاء الدعوة",
        variant: "destructive",
      });
    }
  };

  const handleCopyLink = async () => {
    if (!invitationLink) return;

    try {
      await navigator.clipboard.writeText(invitationLink);
      setCopied(true);
      toast({
        title: "تم النسخ",
        description: "تم نسخ رابط الدعوة",
      });

      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast({
        title: "خطأ",
        description: "فشل نسخ الرابط",
        variant: "destructive",
      });
    }
  };

  const handleClose = () => {
    setOpen(false);
    // Reset form after dialog closes
    setTimeout(() => {
      setEmail("");
      setRole('accountant');
      setInvitationLink(null);
      setCopied(false);
    }, 200);
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => isOpen ? setOpen(true) : handleClose()}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <UserPlus className="h-4 w-4" />
          دعوة عضو جديد
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>دعوة عضو جديد</DialogTitle>
          <DialogDescription>
            أدخل البريد الإلكتروني للشخص الذي تريد دعوته واختر دوره في النظام
          </DialogDescription>
        </DialogHeader>

        {invitationLink ? (
          // Show invitation link after creation
          <div className="space-y-4 py-4">
            <Alert className="bg-success-50 border-success-200">
              <Check className="h-4 w-4 text-success-600" />
              <AlertDescription className="text-success-700">
                تم إنشاء الدعوة بنجاح! شارك الرابط مع المدعو.
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <Label>رابط الدعوة</Label>
              <div className="flex gap-2">
                <Input
                  value={invitationLink}
                  readOnly
                  dir="ltr"
                  className="font-mono text-sm"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={handleCopyLink}
                >
                  {copied ? (
                    <Check className="h-4 w-4 text-success-600" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <p className="text-xs text-slate-500">
                الرابط صالح لمدة 7 أيام
              </p>
            </div>

            <div className="bg-slate-50 rounded-lg p-3 text-sm text-slate-600 space-y-1">
              <p className="flex items-center gap-2">
                <Mail className="h-4 w-4" />
                <span>المدعو: <strong>{email}</strong></span>
              </p>
              <p className="flex items-center gap-2">
                <LinkIcon className="h-4 w-4" />
                <span>الدور: <strong>{USER_ROLE_LABELS[role]}</strong></span>
              </p>
            </div>

            <DialogFooter>
              <Button onClick={handleClose}>
                إغلاق
              </Button>
            </DialogFooter>
          </div>
        ) : (
          // Show form to create invitation
          <form onSubmit={handleSubmit}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="email">البريد الإلكتروني</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="employee@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loading}
                  dir="ltr"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="role">الدور</Label>
                <Select
                  value={role}
                  onValueChange={(value) => setRole(value as 'accountant' | 'viewer')}
                  disabled={loading}
                >
                  <SelectTrigger id="role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="accountant">
                      {USER_ROLE_LABELS.accountant} - يمكنه إنشاء وتعديل البيانات
                    </SelectItem>
                    <SelectItem value="viewer">
                      {USER_ROLE_LABELS.viewer} - يمكنه عرض البيانات فقط
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleClose} disabled={loading}>
                إلغاء
              </Button>
              <Button type="submit" disabled={loading} className="gap-2">
                {loading ? (
                  "جاري الإنشاء..."
                ) : (
                  <>
                    <UserPlus className="h-4 w-4" />
                    إنشاء الدعوة
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
