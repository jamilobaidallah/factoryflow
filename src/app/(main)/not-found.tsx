import Link from 'next/link';
import { FileQuestion, Home, Search } from 'lucide-react';

/**
 * 404 Not Found Page (Main Layout)
 *
 * Displayed when a user navigates to a route that doesn't exist
 * within the authenticated (main) layout area.
 */
export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4">
      <div className="max-w-md w-full text-center">
        <div className="bg-white rounded-lg border shadow-sm p-8">
          <div className="flex items-center justify-center w-16 h-16 mx-auto bg-blue-100 rounded-full mb-4">
            <FileQuestion className="w-8 h-8 text-blue-600" />
          </div>

          <h1 className="text-5xl font-bold text-gray-900 mb-2">404</h1>

          <h2 className="text-lg font-semibold text-gray-700 mb-3">
            الصفحة غير موجودة
          </h2>

          <p className="text-gray-600 text-sm mb-6">
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
              href="/search"
              className="inline-flex items-center justify-center w-full h-10 px-4 py-2 border border-input bg-background rounded-md text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors"
            >
              <Search className="w-4 h-4 ml-2" />
              البحث في النظام
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
