/**
 * Sentry Client Configuration
 *
 * This file configures the initialization of Sentry on the client (browser).
 * The config you add here will be used whenever a user loads a page in their browser.
 */

import * as Sentry from '@sentry/nextjs';

// Only initialize Sentry if DSN is configured
if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

    // Environment configuration
    environment: process.env.NODE_ENV,

    // Performance Monitoring
    // Capture 10% of transactions in production for performance monitoring
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

    // Session Replay
    // Capture 10% of sessions for replay in production
    replaysSessionSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 0,
    // Capture 100% of sessions with errors for replay
    replaysOnErrorSampleRate: 1.0,

    // Enable Session Replay integration (only in production)
    integrations: process.env.NODE_ENV === 'production'
      ? [
          Sentry.replayIntegration({
            // Mask all text content for privacy
            maskAllText: true,
            // Block all media for privacy
            blockAllMedia: true,
          }),
        ]
      : [],

    // Debug mode in development
    debug: process.env.NODE_ENV === 'development',

    // Filter out common non-actionable errors
    beforeSend(event, hint) {
      const error = hint.originalException;

      // Ignore network errors that are user-side issues
      if (error instanceof Error) {
        // Ignore cancelled requests
        if (error.message.includes('AbortError')) {
          return null;
        }
        // Ignore offline errors
        if (error.message.includes('Failed to fetch') && !navigator.onLine) {
          return null;
        }
      }

      // Add additional context
      if (event.tags) {
        event.tags.locale = document.documentElement.lang || 'ar';
      }

      return event;
    },

    // Filter breadcrumbs to reduce noise
    beforeBreadcrumb(breadcrumb) {
      // Filter out noisy console breadcrumbs in development
      if (breadcrumb.category === 'console' && process.env.NODE_ENV !== 'production') {
        return null;
      }
      return breadcrumb;
    },
  });
}
