import type { LocaleMessages } from '@/i18n/locales/en/index.js';

type Copy = LocaleMessages['kbGraphProjection'];

export function graphProjectionStatusLabel(copy: Copy, status: string): string {
  const labels = copy.projectionStatusLabels as Record<string, string>;
  return labels[status] ?? labels[status.toLowerCase()] ?? status;
}
