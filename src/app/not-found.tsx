import Link from 'next/link';
import { FileQuestion, Home, ArrowRight } from 'lucide-react';

/**
 * 404 Not Found Page
 *
 * Displayed when a user navigates to a route that doesn't exist.
 * This is a Next.js convention file.
 */
export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full text-center">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <div className="flex items-center justify-center w-20 h-20 mx-auto bg-blue-100 rounded-full mb-6">
            <FileQuestion className="w-10 h-10 text-blue-600" />
          </div>

          <h1 className="text-6xl font-bold text-gray-900 mb-2">404</h1>

          <h2 className="text-xl font-semibold text-gray-700 mb-4">
            الصفحة غير موجودة
          </h2>

          <p className="text-gray-600 mb-8">
            عذراً، الصفحة التي تبحث عنها غير موجودة أو تم نقلها.
          </p>

          <div className="flex flex-col gap-3">
            <Link
              href="/dashboard"
              className="inline-flex items-center justify-center w-full h-10 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              <Home className="w-4 h-4 ml-2" />
              الذهاب إلى لوحة التحكم
            </Link>

            <Link
              href="/"
              className="inline-flex items-center justify-center w-full h-10 px-4 py-2 border border-input bg-background rounded-md text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors"
            >
              <ArrowRight className="w-4 h-4 ml-2" />
              العودة للصفحة الرئيسية
            </Link>
          </div>
        </div>

        <p className="mt-6 text-sm text-gray-500">
          إذا كنت تعتقد أن هذا خطأ، يرجى التواصل مع الدعم الفني.
        </p>
      </div>
    </div>
  );
}
