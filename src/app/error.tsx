'use client';

import { useEffect } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Error Page
 *
 * Handles runtime errors in the application.
 * This is a Next.js convention file that must be a Client Component.
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
    console.error('Application error:', error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <div className="flex items-center justify-center w-16 h-16 mx-auto bg-red-100 rounded-full mb-4">
            <AlertTriangle className="w-8 h-8 text-red-600" />
          </div>

          <h1 className="text-2xl font-bold text-center text-gray-900 mb-2">
            حدث خطأ غير متوقع
          </h1>

          <p className="text-center text-gray-600 mb-6">
            نعتذر عن هذا الإزعاج. حدث خطأ أثناء تشغيل التطبيق.
          </p>

          {process.env.NODE_ENV === 'development' && (
            <div className="mb-6 p-4 bg-gray-100 rounded-lg">
              <p className="text-sm font-mono text-gray-800 break-words">
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

            <Button
              variant="outline"
              onClick={() => (window.location.href = '/dashboard')}
              className="w-full"
            >
              <Home className="w-4 h-4 ml-2" />
              العودة للصفحة الرئيسية
            </Button>
          </div>
        </div>

        <p className="mt-6 text-center text-sm text-gray-500">
          إذا استمرت المشكلة، يرجى التواصل مع الدعم الفني.
        </p>
      </div>
    </div>
  );
}
