import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import * as Sentry from '@sentry/react'
import { logger } from './lib/logger'
import './index.css'
import App from './App.tsx'

// Initialize Sentry (no-ops gracefully if DSN is not set)
const sentryDsn = import.meta.env.VITE_SENTRY_DSN;
if (sentryDsn) {
  Sentry.init({
    dsn: sentryDsn,
    environment: import.meta.env.MODE,
    sendDefaultPii: true,
  });
}

// Catch unhandled promise rejections globally
window.addEventListener('unhandledrejection', (event) => {
  logger.critical('Unhandled promise rejection', event.reason, {
    promise: String(event.promise),
  });
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
