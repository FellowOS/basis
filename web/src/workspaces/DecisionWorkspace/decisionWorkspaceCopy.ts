import type { LocaleMessages } from '@/i18n/locales/en/index.js';

type Copy = LocaleMessages['kbDecisions'];

export function decisionCategoryLabel(copy: Copy, category: string): string {
  const labels = copy.categoryLabels as Record<string, string>;
  return labels[category] ?? labels[category.toLowerCase()] ?? category;
}

export function decisionOutcomeLabel(copy: Copy, outcome: string): string {
  if (!outcome) return copy.outcomeUnknown;
  const labels = copy.outcomeLabels as Record<string, string>;
  const direct = labels[outcome] ?? labels[outcome.toLowerCase()];
  if (direct) return direct;
  const normalized = outcome.toLowerCase();
  for (const [key, label] of Object.entries(labels)) {
    if (normalized.includes(key)) return label;
  }
  return outcome;
}

export function decisionChainStepTypeLabel(copy: Copy, type: string): string {
  const labels = copy.stepTypeLabels as Record<string, string>;
  return labels[type] ?? labels[type.toLowerCase()] ?? type;
}

export function decisionChainRelationshipLabel(copy: Copy, relationship: string): string {
  if (!relationship) return copy.chainArrow;
  const labels = copy.relationshipLabels as Record<string, string>;
  return labels[relationship] ?? labels[relationship.toLowerCase()] ?? relationship;
}
