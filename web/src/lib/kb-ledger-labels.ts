import type { LocaleMessages } from '@/i18n/locales/en/index.js';

type LedgerCopy = LocaleMessages['kbLedger'];

export function ledgerStatementStatusLabel(ledger: LedgerCopy, status: string): string {
  const labels = ledger.statementStatusLabels as Record<string, string>;
  return labels[status] ?? labels[status.toLowerCase()] ?? status;
}

export function ledgerChunkOriginLabel(ledger: LedgerCopy, origin: string): string {
  const labels = ledger.chunkOriginLabels as Record<string, string>;
  return labels[origin] ?? labels[origin.toLowerCase()] ?? origin;
}
