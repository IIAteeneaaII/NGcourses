import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NEXT_PUBLIC_ENVIRONMENT || 'production',
  // Captura el 10% de las transacciones de performance
  tracesSampleRate: 0.1,
  // Captura el 100% de las sesiones con error, 1% del resto
  replaysOnErrorSampleRate: 1.0,
  replaysSessionSampleRate: 0.01,
  integrations: [
    Sentry.replayIntegration({
      maskAllText: true,
      blockAllMedia: true,
    }),
  ],
  // No inicializar si no hay DSN configurado
  enabled: Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN),
});
