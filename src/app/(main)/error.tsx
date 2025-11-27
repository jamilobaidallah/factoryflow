'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Error Page (Main Layout)
 *
 * Handles runtime errors within the authenticated (main) layout area.
 * This preserves the sidebar and header while showing the error.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error('Page error:', error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center py-12 px-4">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-lg border shadow-sm p-8">
          <div className="flex items-center justify-center w-14 h-14 mx-auto bg-red-100 rounded-full mb-4">
            <AlertTriangle className="w-7 h-7 text-red-600" />
          </div>

          <h1 className="text-xl font-bold text-center text-gray-900 mb-2">
            حدث خطأ غير متوقع
          </h1>

          <p className="text-center text-gray-600 text-sm mb-6">
            نعتذر عن هذا الإزعاج. حدث خطأ أثناء تحميل هذه الصفحة.
          </p>

          {process.env.NODE_ENV === 'development' && (
            <div className="mb-6 p-3 bg-gray-100 rounded-lg">
              <p className="text-xs font-mono text-gray-800 break-words">
                {error.message}
              </p>
              {error.digest && (
                <p className="text-xs font-mono text-gray-500 mt-2">
                  Error ID: {error.digest}
                </p>
              )}
            </div>
          )}

          <div className="flex flex-col gap-3">
            <Button onClick={reset} className="w-full">
              <RefreshCw className="w-4 h-4 ml-2" />
              إعادة المحاولة
            </Button>

            <Button variant="outline" asChild className="w-full">
              <Link href="/dashboard">
                <Home className="w-4 h-4 ml-2" />
                العودة للوحة التحكم
              </Link>
            </Button>
          </div>
        </div>

        <p className="mt-4 text-center text-xs text-gray-500">
          إذا استمرت المشكلة، يرجى التواصل مع الدعم الفني.
        </p>
      </div>
    </div>
  );
}
