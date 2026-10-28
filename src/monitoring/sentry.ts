import * as Sentry from '@sentry/react-native';

// Players include children, so no default PII and no session replay.
Sentry.init({
  dsn: 'https://92362aa94f07bd90a99c4c36026634ea@o4509992353660929.ingest.us.sentry.io/4512336357163008',
  environment: __DEV__ ? 'development' : 'production',
  sendDefaultPii: false,
  tracesSampleRate: __DEV__ ? 1.0 : 0.2,
});

export { Sentry };
