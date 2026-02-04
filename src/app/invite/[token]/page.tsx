"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/firebase/config";
import { useUser } from "@/firebase/provider";
import { getInvitationByToken, acceptInvitation } from "@/services/invitationService";
import type { Invitation } from "@/types/rbac";
import { USER_ROLE_LABELS } from "@/lib/constants";
import { handleError, getErrorTitle } from "@/lib/error-handling";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { Factory, CheckCircle, XCircle, Clock, UserPlus, LogIn } from "lucide-react";

export default function InvitationPage() {
  const params = useParams();
  const router = useRouter();
  const { user, loading: authLoading } = useUser();
  const { toast } = useToast();

  const [invitation, setInvitation] = useState<Invitation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [accepting, setAccepting] = useState(false);

  // Form states for signup/login
  const [isLogin, setIsLogin] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [formLoading, setFormLoading] = useState(false);

  const token = params.token as string;

  // Fetch invitation details
  useEffect(() => {
    async function fetchInvitation() {
      if (!token) {
        setError("رابط الدعوة غير صالح");
        setLoading(false);
        return;
      }

      try {
        const inv = await getInvitationByToken(token);
        if (!inv) {
          setError("الدعوة غير موجودة أو تم حذفها");
        } else if (inv.status === 'accepted') {
          setError("تم قبول هذه الدعوة مسبقاً");
        } else if (inv.status === 'expired' || new Date() > inv.expiresAt) {
          setError("انتهت صلاحية هذه الدعوة");
        } else if (inv.status === 'revoked') {
          setError("تم إلغاء هذه الدعوة");
        } else {
          setInvitation(inv);
          setEmail(inv.inviteeEmail); // Pre-fill email
        }
      } catch (err) {
        console.error("Error fetching invitation:", err);
        setError("حدث خطأ أثناء تحميل الدعوة");
      } finally {
        setLoading(false);
      }
    }

    fetchInvitation();
  }, [token]);

  // Auto-accept if user is already logged in with matching email
  useEffect(() => {
    async function autoAccept() {
      if (!authLoading && user && invitation && invitation.status === 'pending') {
        // Check if logged-in user's email matches invitation
        const userEmail = user.email?.toLowerCase().trim();
        if (userEmail === invitation.inviteeEmail) {
          setAccepting(true);
          const result = await acceptInvitation(
            token,
            user.uid,
            user.email || "",
            user.displayName || undefined
          );

          if (result.success) {
            toast({
              title: "تم قبول الدعوة بنجاح",
              description: `أنت الآن ${USER_ROLE_LABELS[invitation.role]} في هذا المصنع`,
            });
            // Redirect to dashboard after a short delay to allow state update
            setTimeout(() => {
              router.push("/dashboard");
            }, 1000);
          } else {
            setError(result.error || "حدث خطأ أثناء قبول الدعوة");
          }
          setAccepting(false);
        }
      }
    }

    autoAccept();
  }, [authLoading, user, invitation, token, router, toast]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!invitation) {return;}

    // Validate email matches invitation
    const normalizedEmail = email.toLowerCase().trim();
    if (normalizedEmail !== invitation.inviteeEmail) {
      toast({
        title: "البريد الإلكتروني غير صحيح",
        description: `يرجى استخدام البريد: ${invitation.inviteeEmail}`,
        variant: "destructive",
      });
      return;
    }

    setFormLoading(true);

    try {
      if (isLogin) {
        // Login flow
        await signInWithEmailAndPassword(auth, email, password);
        // The auto-accept useEffect will handle accepting the invitation
      } else {
        // Signup flow - store invitation token for provider to use
        try {
          localStorage.setItem('pendingInvitationToken', token);
        } catch {
          // localStorage not available
        }

        await createUserWithEmailAndPassword(auth, email, password);

        // Accept invitation immediately after signup
        // Note: The auth state will be updated, and we need the new user
        // Wait a bit for auth state to settle
        setTimeout(async () => {
          const currentUser = auth.currentUser;
          if (currentUser) {
            const result = await acceptInvitation(
              token,
              currentUser.uid,
              currentUser.email || "",
              currentUser.displayName || undefined
            );

            if (result.success) {
              toast({
                title: "تم إنشاء الحساب وقبول الدعوة بنجاح",
                description: `مرحباً بك كـ ${USER_ROLE_LABELS[invitation.role]}`,
              });

              // Clear the token
              try {
                localStorage.removeItem('pendingInvitationToken');
              } catch {
                // Ignore
              }

              // Redirect to dashboard
              router.push("/dashboard");
            } else {
              setError(result.error || "حدث خطأ أثناء قبول الدعوة");
            }
          }
        }, 500);
      }
    } catch (err) {
      const appError = handleError(err);
      toast({
        title: getErrorTitle(appError),
        description: appError.message,
        variant: "destructive",
      });
    } finally {
      setFormLoading(false);
    }
  };

  // Loading state
  if (loading || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        <Card className="w-full max-w-md">
          <CardContent className="py-8">
            <div className="flex items-center justify-center gap-2 text-slate-500">
              <Clock className="w-5 h-5 animate-pulse" />
              <span>جاري التحميل...</span>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        <Card className="w-full max-w-md">
          <CardContent className="py-8">
            <div className="flex flex-col items-center gap-4 text-center">
              <div className="p-3 bg-red-100 rounded-full">
                <XCircle className="w-8 h-8 text-red-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-900">الدعوة غير صالحة</h3>
                <p className="text-slate-600 mt-1">{error}</p>
              </div>
              <Button onClick={() => router.push("/")} variant="outline">
                العودة للصفحة الرئيسية
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Accepting state (auto-accept for logged-in users)
  if (accepting) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        <Card className="w-full max-w-md">
          <CardContent className="py-8">
            <div className="flex items-center justify-center gap-2 text-slate-500">
              <Clock className="w-5 h-5 animate-spin" />
              <span>جاري قبول الدعوة...</span>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // User is logged in but email doesn't match
  if (user && invitation && user.email?.toLowerCase().trim() !== invitation.inviteeEmail) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        <Card className="w-full max-w-md">
          <CardContent className="py-8">
            <div className="flex flex-col items-center gap-4 text-center">
              <div className="p-3 bg-yellow-100 rounded-full">
                <XCircle className="w-8 h-8 text-yellow-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-900">بريد إلكتروني مختلف</h3>
                <p className="text-slate-600 mt-1">
                  أنت مسجل دخول بـ <strong>{user.email}</strong>
                </p>
                <p className="text-slate-600 mt-1">
                  الدعوة مخصصة لـ <strong>{invitation.inviteeEmail}</strong>
                </p>
              </div>
              <div className="flex gap-2">
                <Button onClick={() => router.push("/dashboard")} variant="outline">
                  الذهاب للوحة التحكم
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show invitation details and signup/login form
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="p-3 bg-primary rounded-full">
              <Factory className="w-8 h-8 text-white" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold">دعوة للانضمام</CardTitle>
          <CardDescription>
            نظام إدارة المصنع - FactoryFlow
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Invitation Details */}
          {invitation && (
            <div className="bg-slate-50 rounded-lg p-4 space-y-2">
              <div className="flex items-center gap-2 text-success-600">
                <CheckCircle className="w-5 h-5" />
                <span className="font-medium">دعوة صالحة</span>
              </div>
              <div className="text-sm text-slate-600 space-y-1">
                <p>
                  <span className="text-slate-500">من:</span>{" "}
                  <strong>{invitation.ownerDisplayName || invitation.ownerEmail}</strong>
                </p>
                <p>
                  <span className="text-slate-500">الدور:</span>{" "}
                  <strong>{USER_ROLE_LABELS[invitation.role]}</strong>
                </p>
                <p>
                  <span className="text-slate-500">البريد:</span>{" "}
                  <strong>{invitation.inviteeEmail}</strong>
                </p>
              </div>
            </div>
          )}

          {/* Signup/Login Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">البريد الإلكتروني</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={formLoading}
                dir="ltr"
                readOnly // Email is fixed to invitation email
                className="bg-slate-100"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">كلمة المرور</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={formLoading}
                minLength={6}
              />
            </div>

            <Button type="submit" className="w-full gap-2" disabled={formLoading}>
              {formLoading ? (
                <>
                  <Clock className="w-4 h-4 animate-spin" />
                  جاري المعالجة...
                </>
              ) : isLogin ? (
                <>
                  <LogIn className="w-4 h-4" />
                  تسجيل الدخول وقبول الدعوة
                </>
              ) : (
                <>
                  <UserPlus className="w-4 h-4" />
                  إنشاء حساب وقبول الدعوة
                </>
              )}
            </Button>
          </form>

          {/* Toggle Login/Signup */}
          <div className="text-center">
            <button
              type="button"
              onClick={() => setIsLogin(!isLogin)}
              className="text-sm text-primary hover:underline"
              disabled={formLoading}
            >
              {isLogin ? "ليس لديك حساب؟ إنشاء حساب جديد" : "لديك حساب؟ تسجيل الدخول"}
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
