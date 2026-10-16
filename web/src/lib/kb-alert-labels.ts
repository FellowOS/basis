import { fmt } from '@/i18n/format.js';
import type { LocaleMessages } from '@/i18n/locales/en/index.js';

type AlertsCopy = LocaleMessages['pages']['alerts'];

export function kbAlertKindLabel(alerts: AlertsCopy, kind: string): string {
  const labels = alerts.kindLabels as Record<string, string>;
  if (labels[kind]) return labels[kind];
  if (kind.startsWith('llm.')) {
    const code = kind.slice(4);
    return fmt(alerts.kindLlmFallback, { code });
  }
  return kind;
}

export function kbAlertSeverityLabel(alerts: AlertsCopy, severity: string): string {
  const normalized = severity.toLowerCase();
  if (normalized === 'critical' || normalized === 'error' || normalized === 'high') {
    return alerts.severityCritical;
  }
  if (normalized === 'warning' || normalized === 'warn' || normalized === 'medium') {
    return alerts.severityWarning;
  }
  return alerts.severityInfo;
}
