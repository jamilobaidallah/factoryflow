"use client";

import { useState, useEffect, useCallback } from "react";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/firebase/config";
import { handleError, getErrorTitle, ErrorType, AppError } from "@/lib/error-handling";
import { getRateLimiter, RateLimitStatus, RATE_LIMIT_MESSAGES, formatRemainingTime } from "@/lib/rate-limiter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Factory, AlertTriangle, Clock } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function LoginPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [rateLimitStatus, setRateLimitStatus] = useState<RateLimitStatus | null>(null);
  const [lockoutRemaining, setLockoutRemaining] = useState<string>("");
  const { toast } = useToast();

  const rateLimiter = getRateLimiter();

  // Check rate limit status when email changes
  const checkRateLimit = useCallback(() => {
    if (email && isLogin) {
      const status = rateLimiter.checkRateLimit(email);
      setRateLimitStatus(status);
      if (status.isLocked) {
        setLockoutRemaining(status.lockoutRemainingFormatted);
      }
    } else {
      setRateLimitStatus(null);
    }
  }, [email, isLogin, rateLimiter]);

  useEffect(() => {
    checkRateLimit();
  }, [checkRateLimit]);

  // Countdown timer for lockout
  useEffect(() => {
    if (!rateLimitStatus?.isLocked || !rateLimitStatus.lockoutEndTime) {
      return;
    }

    const updateCountdown = () => {
      const now = Date.now();
      const remaining = rateLimitStatus.lockoutEndTime! - now;

      if (remaining <= 0) {
        // Lockout expired, recheck status
        checkRateLimit();
      } else {
        setLockoutRemaining(formatRemainingTime(remaining));
      }
    };

    // Update immediately
    updateCountdown();

    // Update every second
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [rateLimitStatus?.isLocked, rateLimitStatus?.lockoutEndTime, checkRateLimit]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Check rate limit before attempting login (only for login, not signup)
    if (isLogin) {
      const currentStatus = rateLimiter.checkRateLimit(email);
      if (currentStatus.isLocked) {
        const rateLimitError: AppError = {
          type: ErrorType.RATE_LIMITED,
          message: RATE_LIMIT_MESSAGES.locked(currentStatus.lockoutRemainingFormatted),
        };
        toast({
          title: getErrorTitle(rateLimitError),
          description: rateLimitError.message,
          variant: "destructive",
        });
        setRateLimitStatus(currentStatus);
        return;
      }
    }

    setLoading(true);

    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);

        // Record successful login attempt
        const status = rateLimiter.recordAttempt(email, true);
        setRateLimitStatus(status);

        toast({
          title: "تم تسجيل الدخول بنجاح",
          description: "مرحباً بك في نظام إدارة المصنع",
        });
      } else {
        await createUserWithEmailAndPassword(auth, email, password);
        toast({
          title: "تم إنشاء الحساب بنجاح",
          description: "يمكنك الآن استخدام النظام",
        });
      }
    } catch (error) {
      const appError = handleError(error);

      // Record failed login attempt (only for login, not signup)
      if (isLogin) {
        const status = rateLimiter.recordAttempt(email, false);
        setRateLimitStatus(status);

        // Show lockout message if just locked out
        if (status.isLocked) {
          const rateLimitError: AppError = {
            type: ErrorType.RATE_LIMITED,
            message: RATE_LIMIT_MESSAGES.locked(status.lockoutRemainingFormatted),
          };
          toast({
            title: getErrorTitle(rateLimitError),
            description: rateLimitError.message,
            variant: "destructive",
          });
          return;
        }

        // Show warning if running low on attempts
        if (status.remainingAttempts <= 2 && status.remainingAttempts > 0) {
          toast({
            title: getErrorTitle(appError),
            description: `${appError.message}. ${status.remainingAttempts === 1
              ? RATE_LIMIT_MESSAGES.lastAttempt
              : RATE_LIMIT_MESSAGES.warning(status.remainingAttempts)}`,
            variant: "destructive",
          });
          return;
        }
      }

      toast({
        title: getErrorTitle(appError),
        description: appError.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="p-3 bg-primary rounded-full">
              <Factory className="w-8 h-8 text-white" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold">
            {isLogin ? "تسجيل الدخول" : "إنشاء حساب جديد"}
          </CardTitle>
          <CardDescription>
            نظام إدارة المصنع - FactoryFlow
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Rate Limit Lockout Alert */}
          {rateLimitStatus?.isLocked && isLogin && (
            <Alert variant="destructive" className="mb-4">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                <span>
                  تم قفل الحساب مؤقتاً. يرجى الانتظار {lockoutRemaining}
                </span>
              </AlertDescription>
            </Alert>
          )}

          {/* Low Attempts Warning */}
          {!rateLimitStatus?.isLocked && rateLimitStatus?.remainingAttempts !== undefined &&
           rateLimitStatus.remainingAttempts <= 2 && rateLimitStatus.remainingAttempts > 0 && isLogin && (
            <Alert variant="destructive" className="mb-4">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                {rateLimitStatus.remainingAttempts === 1
                  ? RATE_LIMIT_MESSAGES.lastAttempt
                  : RATE_LIMIT_MESSAGES.warning(rateLimitStatus.remainingAttempts)}
              </AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">البريد الإلكتروني</Label>
              <Input
                id="email"
                type="email"
                placeholder="example@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading || rateLimitStatus?.isLocked}
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
                disabled={loading || rateLimitStatus?.isLocked}
                minLength={6}
              />
            </div>
            <Button
              type="submit"
              className="w-full"
              disabled={loading || (isLogin && rateLimitStatus?.isLocked)}
            >
              {loading
                ? "جاري التحميل..."
                : rateLimitStatus?.isLocked && isLogin
                  ? `الانتظار ${lockoutRemaining}`
                  : isLogin
                    ? "تسجيل الدخول"
                    : "إنشاء حساب"}
            </Button>
          </form>
          <div className="mt-4 text-center">
            <button
              type="button"
              onClick={() => setIsLogin(!isLogin)}
              className="text-sm text-primary hover:underline"
              disabled={loading}
            >
              {isLogin ? "ليس لديك حساب؟ إنشاء حساب جديد" : "لديك حساب؟ تسجيل الدخول"}
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
