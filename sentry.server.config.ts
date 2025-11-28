/**
 * Sentry Server Configuration
 *
 * This file configures the initialization of Sentry on the server.
 * The config you add here will be used whenever the server handles a request.
 */

import * as Sentry from '@sentry/nextjs';

// Only initialize Sentry if DSN is configured
if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

    // Environment configuration
    environment: process.env.NODE_ENV,

    // Performance Monitoring
    // Capture 10% of transactions in production
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

    // Debug mode in development
    debug: process.env.NODE_ENV === 'development',

    // Filter out common non-actionable errors
    beforeSend(event, hint) {
      const error = hint.originalException;

      // Ignore known non-actionable errors
      if (error instanceof Error) {
        // Ignore network timeouts that may be client-side
        if (error.message.includes('ETIMEDOUT')) {
          return null;
        }
      }

      return event;
    },
  });
}
