/**
 * Error Reporting Service
 *
 * Provides centralized error reporting using Sentry for production environments.
 * Falls back to console logging in development.
 */

import * as Sentry from '@sentry/nextjs';
import { AppError, ErrorType } from './error-handling';

// ======================
// Types
// ======================

export interface ErrorContext {
  /** Additional data to attach to the error */
  extra?: Record<string, unknown>;
  /** Tags for filtering errors in Sentry */
  tags?: Record<string, string>;
  /** User information */
  user?: {
    id?: string;
    email?: string;
    username?: string;
  };
  /** The level of the error */
  level?: 'fatal' | 'error' | 'warning' | 'info' | 'debug';
  /** Component or page where error occurred */
  componentName?: string;
  /** React error info if available */
  componentStack?: string;
}

// ======================
// Initialization
// ======================

/**
 * Check if Sentry is enabled (has DSN configured)
 */
export function isSentryEnabled(): boolean {
  return typeof process.env.NEXT_PUBLIC_SENTRY_DSN === 'string' &&
    process.env.NEXT_PUBLIC_SENTRY_DSN.length > 0;
}

/**
 * Check if we're in production environment
 */
function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}

// ======================
// Error Capture Functions
// ======================

/**
 * Capture an exception and send to error reporting service
 */
export function captureException(
  error: Error | unknown,
  context?: ErrorContext
): string | undefined {
  // In development, just log to console
  if (!isProduction()) {
    console.error('[Error Report]', error);
    if (context) {
      console.error('[Error Context]', context);
    }
    return undefined;
  }

  // In production, send to Sentry
  if (!isSentryEnabled()) {
    console.error('[Sentry disabled] Error:', error);
    return undefined;
  }

  return Sentry.captureException(error, (scope) => {
    if (context?.extra) {
      scope.setExtras(context.extra);
    }
    if (context?.tags) {
      scope.setTags(context.tags);
    }
    if (context?.user) {
      scope.setUser(context.user);
    }
    if (context?.level) {
      scope.setLevel(context.level);
    }
    if (context?.componentName) {
      scope.setTag('component', context.componentName);
    }
    if (context?.componentStack) {
      scope.setContext('react', { componentStack: context.componentStack });
    }
    return scope;
  });
}

/**
 * Capture an AppError with proper context
 */
export function captureAppError(
  appError: AppError,
  context?: ErrorContext
): string | undefined {
  const error = new Error(appError.message);
  error.name = `AppError.${appError.type}`;

  return captureException(error, {
    ...context,
    extra: {
      ...context?.extra,
      errorType: appError.type,
      errorCode: appError.code,
      errorField: appError.field,
      errorDetails: appError.details,
    },
    tags: {
      ...context?.tags,
      errorType: appError.type,
      ...(appError.code && { errorCode: appError.code }),
    },
    level: getErrorLevel(appError.type),
  });
}

/**
 * Capture a message (for non-error events)
 */
export function captureMessage(
  message: string,
  level: 'fatal' | 'error' | 'warning' | 'info' | 'debug' = 'info',
  context?: ErrorContext
): string | undefined {
  if (!isProduction()) {
    console.log(`[${level.toUpperCase()}]`, message, context?.extra);
    return undefined;
  }

  if (!isSentryEnabled()) {
    console.log(`[Sentry disabled] ${level}:`, message);
    return undefined;
  }

  return Sentry.captureMessage(message, (scope) => {
    scope.setLevel(level);
    if (context?.extra) {
      scope.setExtras(context.extra);
    }
    if (context?.tags) {
      scope.setTags(context.tags);
    }
    if (context?.user) {
      scope.setUser(context.user);
    }
    return scope;
  });
}

// ======================
// User Context
// ======================

/**
 * Set the current user for error reporting context
 */
export function setUser(user: { id: string; email?: string; username?: string } | null): void {
  if (!isProduction() || !isSentryEnabled()) {
    return;
  }

  if (user) {
    Sentry.setUser(user);
  } else {
    Sentry.setUser(null);
  }
}

/**
 * Add a breadcrumb for debugging
 */
export function addBreadcrumb(
  message: string,
  category: string,
  data?: Record<string, unknown>,
  level: 'fatal' | 'error' | 'warning' | 'info' | 'debug' = 'info'
): void {
  if (!isProduction() || !isSentryEnabled()) {
    if (process.env.NODE_ENV === 'development') {
      console.debug(`[Breadcrumb:${category}]`, message, data);
    }
    return;
  }

  Sentry.addBreadcrumb({
    message,
    category,
    data,
    level,
    timestamp: Date.now() / 1000,
  });
}

// ======================
// Performance Monitoring
// ======================

/**
 * Start a performance transaction
 */
export function startTransaction(
  name: string,
  op: string
): ReturnType<typeof Sentry.startSpan> | null {
  if (!isProduction() || !isSentryEnabled()) {
    return null;
  }

  return Sentry.startSpan({ name, op }, () => {});
}

// ======================
// React Error Boundary Integration
// ======================

/**
 * Capture React error boundary errors
 */
export function captureReactError(
  error: Error,
  errorInfo: React.ErrorInfo,
  componentName?: string
): string | undefined {
  return captureException(error, {
    componentName,
    componentStack: errorInfo.componentStack || undefined,
    tags: {
      errorBoundary: 'true',
      ...(componentName && { component: componentName }),
    },
    level: 'error',
  });
}

/**
 * Capture Next.js page errors (error.tsx)
 */
export function capturePageError(
  error: Error & { digest?: string },
  pagePath?: string
): string | undefined {
  return captureException(error, {
    extra: {
      digest: error.digest,
      pagePath,
    },
    tags: {
      errorType: 'page_error',
      ...(pagePath && { pagePath }),
      ...(error.digest && { digest: error.digest }),
    },
    level: 'error',
  });
}

// ======================
// Helper Functions
// ======================

/**
 * Map AppError types to Sentry severity levels
 */
function getErrorLevel(
  errorType: ErrorType
): 'fatal' | 'error' | 'warning' | 'info' | 'debug' {
  switch (errorType) {
    case ErrorType.PERMISSION:
    case ErrorType.NETWORK:
      return 'error';
    case ErrorType.VALIDATION:
    case ErrorType.DUPLICATE:
    case ErrorType.NOT_FOUND:
    case ErrorType.RATE_LIMITED:
      return 'warning';
    case ErrorType.FIREBASE:
    case ErrorType.UNKNOWN:
    default:
      return 'error';
  }
}

/**
 * Flush pending events (useful before page navigation or app shutdown)
 */
export async function flushEvents(timeout: number = 2000): Promise<boolean> {
  if (!isProduction() || !isSentryEnabled()) {
    return true;
  }

  return Sentry.flush(timeout);
}

/**
 * Create a wrapped async function that automatically captures errors
 */
export function withErrorReporting<T extends (...args: unknown[]) => Promise<unknown>>(
  fn: T,
  context?: Omit<ErrorContext, 'level'>
): T {
  return (async (...args: Parameters<T>) => {
    try {
      return await fn(...args);
    } catch (error) {
      captureException(error, { ...context, level: 'error' });
      throw error;
    }
  }) as T;
}
