/**
 * Error Boundary Components
 *
 * Catches React errors and displays helpful fallback UI
 */

"use client";

import React, { Component, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import * as Sentry from '@sentry/nextjs';
import { Button } from './ui/button';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: (error: Error, reset: () => void) => ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * Main Error Boundary Component
 *
 * Catches JavaScript errors anywhere in the child component tree,
 * logs those errors, and displays a fallback UI.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log error to console
    console.error('Error Boundary caught an error:', error, errorInfo);

    // Send to Sentry with React component stack
    Sentry.withScope((scope) => {
      scope.setExtras({ componentStack: errorInfo.componentStack });
      Sentry.captureException(error);
    });

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  resetError = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError && this.state.error) {
      // Custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.resetError);
      }

      // Default fallback UI
      return <DefaultErrorFallback error={this.state.error} reset={this.resetError} />;
    }

    return this.props.children;
  }
}

/**
 * Default Error Fallback UI
 */
function DefaultErrorFallback({ error, reset }: { error: Error; reset: () => void }) {
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
            </div>
          )}

          <div className="flex flex-col gap-3">
            <Button onClick={reset} className="w-full">
              <RefreshCw className="w-4 h-4 ml-2" />
              إعادة المحاولة
            </Button>

            <Button
              variant="outline"
              onClick={() => window.location.href = '/dashboard'}
              className="w-full"
            >
              <Home className="w-4 h-4 ml-2" />
              العودة للصفحة الرئيسية
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Page-level Error Boundary
 * Smaller fallback for page-level errors
 */
export function PageErrorBoundary({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary
      fallback={(error, reset) => (
        <div className="flex flex-col items-center justify-center py-12 px-4">
          <div className="bg-white rounded-lg border border-red-200 p-8 max-w-md w-full">
            <div className="flex items-center justify-center w-12 h-12 mx-auto bg-red-100 rounded-full mb-4">
              <AlertTriangle className="w-6 h-6 text-red-600" />
            </div>

            <h2 className="text-lg font-semibold text-center text-gray-900 mb-2">
              خطأ في تحميل الصفحة
            </h2>

            <p className="text-center text-gray-600 text-sm mb-6">
              حدث خطأ أثناء تحميل هذه الصفحة
            </p>

            {process.env.NODE_ENV === 'development' && (
              <div className="mb-4 p-3 bg-gray-100 rounded text-xs font-mono text-gray-700 break-words">
                {error.message}
              </div>
            )}

            <Button onClick={reset} className="w-full" size="sm">
              <RefreshCw className="w-4 h-4 ml-2" />
              إعادة المحاولة
            </Button>
          </div>
        </div>
      )}
    >
      {children}
    </ErrorBoundary>
  );
}

/**
 * Component-level Error Boundary
 * Even smaller fallback for component-level errors
 */
export function ComponentErrorBoundary({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary
      fallback={(error, reset) => (
        <div className="border border-red-200 rounded-lg p-4 bg-red-50">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="text-sm font-medium text-red-900 mb-1">
                خطأ في المكون
              </h3>
              <p className="text-xs text-red-700 mb-3">
                حدث خطأ في هذا المكون
              </p>
              {process.env.NODE_ENV === 'development' && (
                <p className="text-xs font-mono text-red-600 mb-3 break-words">
                  {error.message}
                </p>
              )}
              <Button onClick={reset} variant="outline" size="sm">
                <RefreshCw className="w-3 h-3 ml-1" />
                إعادة المحاولة
              </Button>
            </div>
          </div>
        </div>
      )}
    >
      {children}
    </ErrorBoundary>
  );
}

/**
 * Hook to use error boundary in functional components
 * Note: This is for demonstration - actual usage requires React 18+
 */
export function useErrorHandler() {
  const [error, setError] = React.useState<Error | null>(null);

  React.useEffect(() => {
    if (error) {
      throw error;
    }
  }, [error]);

  return setError;
}
