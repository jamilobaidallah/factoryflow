/**
 * Sentry Edge Configuration
 *
 * This file configures the initialization of Sentry for edge features (middleware, edge routes).
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
  });
}
