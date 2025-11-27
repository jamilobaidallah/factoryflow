'use client';

import { useEffect } from 'react';
import { AlertOctagon, RefreshCw } from 'lucide-react';

/**
 * Global Error Page
 *
 * Handles errors in the root layout.
 * This is a Next.js convention file that must include its own <html> and <body> tags.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error('Global application error:', error);
  }, [error]);

  return (
    <html lang="ar" dir="rtl">
      <head>
        <title>خطأ في التطبيق - FactoryFlow</title>
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Cairo:wght@200..1000&display=swap"
        />
      </head>
      <body className="font-cairo">
        <div className="min-h-screen flex items-center justify-center bg-gray-100 px-4">
          <div className="max-w-md w-full">
            <div className="bg-white rounded-lg shadow-xl p-8">
              <div className="flex items-center justify-center w-20 h-20 mx-auto bg-red-100 rounded-full mb-6">
                <AlertOctagon className="w-10 h-10 text-red-600" />
              </div>

              <h1 className="text-2xl font-bold text-center text-gray-900 mb-2">
                خطأ حرج في التطبيق
              </h1>

              <p className="text-center text-gray-600 mb-6">
                نعتذر بشدة، حدث خطأ غير متوقع في التطبيق. يرجى إعادة المحاولة.
              </p>

              {process.env.NODE_ENV === 'development' && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm font-mono text-red-800 break-words">
                    {error.message}
                  </p>
                  {error.digest && (
                    <p className="text-xs font-mono text-red-600 mt-2">
                      Error ID: {error.digest}
                    </p>
                  )}
                </div>
              )}

              <button
                onClick={reset}
                className="w-full inline-flex items-center justify-center h-11 px-6 bg-red-600 text-white rounded-md font-medium hover:bg-red-700 transition-colors"
              >
                <RefreshCw className="w-5 h-5 ml-2" />
                إعادة تحميل التطبيق
              </button>
            </div>

            <p className="mt-6 text-center text-sm text-gray-500">
              إذا استمرت المشكلة، يرجى التواصل مع الدعم الفني.
            </p>
          </div>
        </div>
      </body>
    </html>
  );
}
