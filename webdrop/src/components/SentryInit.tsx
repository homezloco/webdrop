"use client";

import { useEffect } from "react";

export default function SentryInit() {
  useEffect(() => {
    // Only initialize if DSN is provided
    const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN || process.env.SENTRY_DSN;
    if (!dsn) return;

    // Dynamically import to avoid including Sentry in the bundle when not used
    import("@sentry/nextjs").then((Sentry) => {
      Sentry.init({
        dsn,
        tracesSampleRate: 0.1,
        replaysOnErrorSampleRate: 0.1,
        replaysSessionSampleRate: 0.0,
        integrations: [],
        enabled: true,
      });
    }).catch(() => {
      // ignore
    });
  }, []);

  return null;
}
