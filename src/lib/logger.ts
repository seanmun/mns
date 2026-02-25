import * as Sentry from '@sentry/react';
import { sendTelegramMessage } from '../utils/telegram';

type LogLevel = 'info' | 'warn' | 'error' | 'critical';

interface LogContext {
  [key: string]: unknown;
}

function formatContext(ctx?: LogContext): string {
  if (!ctx || Object.keys(ctx).length === 0) return '';
  return ' ' + JSON.stringify(ctx);
}

function formatTelegramMessage(level: LogLevel, message: string, error?: unknown, ctx?: LogContext): string {
  const emoji = level === 'critical' ? '🚨' : '⚠️';
  const lines = [
    `${emoji} *MNS ${level.toUpperCase()}*`,
    ``,
    `\`${message}\``,
  ];

  if (error instanceof Error) {
    lines.push(``, `Error: \`${error.message}\``);
  }

  if (ctx) {
    const entries = Object.entries(ctx).map(([k, v]) => `${k}: ${v}`).join('\n');
    if (entries) lines.push(``, entries);
  }

  lines.push(``, `Page: ${window.location.pathname}`);

  return lines.join('\n');
}

export const logger = {
  info(message: string, ctx?: LogContext) {
    console.log(`[MNS] ${message}${formatContext(ctx)}`);
  },

  warn(message: string, ctx?: LogContext) {
    console.warn(`[MNS] ${message}${formatContext(ctx)}`);
  },

  error(message: string, error?: unknown, ctx?: LogContext) {
    console.error(`[MNS] ${message}`, error || '', ctx || '');
    if (error instanceof Error) {
      Sentry.captureException(error, { extra: { message, ...ctx } });
    } else if (error) {
      Sentry.captureMessage(message, { level: 'error', extra: { error, ...ctx } });
    }
  },

  critical(message: string, error?: unknown, ctx?: LogContext) {
    console.error(`[MNS CRITICAL] ${message}`, error || '', ctx || '');
    if (error instanceof Error) {
      Sentry.captureException(error, { level: 'fatal', extra: { message, ...ctx } });
    } else {
      Sentry.captureMessage(message, { level: 'fatal', extra: { error, ...ctx } });
    }
    // Fire-and-forget Telegram alert for critical errors
    sendTelegramMessage(formatTelegramMessage('critical', message, error, ctx)).catch(() => {});
  },
};
