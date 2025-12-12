"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Send, CheckCircle, Clock, AlertCircle } from "lucide-react";
import { useUser } from "@/firebase/provider";
import { submitAccessRequest, hasPendingRequest } from "@/services/userService";

interface AccessRequestFormProps {
  onSuccess?: () => void;
}

export function AccessRequestForm({ onSuccess }: AccessRequestFormProps) {
  const { user } = useUser();
  const [ownerEmail, setOwnerEmail] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [hasPending, setHasPending] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(true);

  // Check if user already has a pending request
  useEffect(() => {
    async function checkPendingStatus() {
      if (!user?.uid) {
        setCheckingStatus(false);
        return;
      }

      try {
        const pending = await hasPendingRequest(user.uid);
        setHasPending(pending);
      } catch (err) {
        console.error("Error checking pending status:", err);
      } finally {
        setCheckingStatus(false);
      }
    }

    checkPendingStatus();
  }, [user?.uid]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setLoading(true);
    setError(null);

    const result = await submitAccessRequest(
      user.uid,
      user.email || "",
      user.displayName || user.email || "",
      ownerEmail,
      message
    );

    setLoading(false);

    if (result.success) {
      setSuccess(true);
      setHasPending(true);
      onSuccess?.();
    } else {
      setError(result.error || "حدث خطأ غير متوقع");
    }
  };

  if (checkingStatus) {
    return (
      <Card className="max-w-md mx-auto">
        <CardContent className="py-8">
          <div className="flex items-center justify-center gap-2 text-slate-500">
            <Clock className="w-5 h-5 animate-pulse" />
            <span>جاري التحقق...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (success || hasPending) {
    return (
      <Card className="max-w-md mx-auto">
        <CardContent className="py-8">
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="p-3 bg-green-100 rounded-full">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-900">تم إرسال الطلب</h3>
              <p className="text-slate-600 mt-1">
                طلبك قيد المراجعة. سيتم إعلامك عند الموافقة.
              </p>
            </div>
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <Clock className="w-4 h-4" />
              <span>في انتظار موافقة المالك</span>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="max-w-md mx-auto">
      <CardHeader>
        <CardTitle>طلب الوصول</CardTitle>
        <CardDescription>
          أدخل البريد الإلكتروني لمالك المصنع الذي تريد الانضمام إليه
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="ownerEmail">البريد الإلكتروني للمالك</Label>
            <Input
              id="ownerEmail"
              type="email"
              placeholder="owner@example.com"
              value={ownerEmail}
              onChange={(e) => setOwnerEmail(e.target.value)}
              required
              dir="ltr"
            />
            <p className="text-xs text-slate-500">
              البريد الإلكتروني لمالك المصنع الذي تريد الوصول إليه
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="message">رسالة (اختياري)</Label>
            <Textarea
              id="message"
              placeholder="أخبر المالك لماذا تحتاج الوصول..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
            />
          </div>

          <Button type="submit" className="w-full gap-2" disabled={loading}>
            {loading ? (
              <>
                <Clock className="w-4 h-4 animate-spin" />
                جاري الإرسال...
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                إرسال الطلب
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
