// This file configures the initialization of Sentry on the client.
// The config you add here will be used whenever a users loads a page in their browser.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Environment configuration
  environment: process.env.NODE_ENV,

  // Performance Monitoring - sample 10% of transactions
  tracesSampleRate: 0.1,

  // Session Replay - sample 10% of sessions, 100% on error
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,

  // Setting this option to true will print useful debug information to console
  debug: false,

  integrations: [
    Sentry.replayIntegration({
      // Privacy: mask sensitive data (Arabic financial text)
      maskAllText: true,
      blockAllMedia: true,
    }),
  ],
});
