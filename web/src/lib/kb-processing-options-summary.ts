import { fmt } from '@/i18n/format.js';
import type { LocaleMessages } from '@/i18n/locales/en/index.js';

type ProcessingCopy = LocaleMessages['kbProcessing'];

function flag(options: Record<string, unknown>, key: string): boolean {
  return options[key] === true;
}

function stringOpt(options: Record<string, unknown>, key: string): string | null {
  const v = options[key];
  return typeof v === 'string' && v.trim() ? v.trim() : null;
}

function numberOpt(options: Record<string, unknown>, key: string): number | null {
  const v = options[key];
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() && Number.isFinite(Number(v))) return Number(v);
  return null;
}

/** Human-readable processing pipeline flags for job detail (F-SRC-05). */
export function processingOptionsSummaryLines(
  options: Record<string, unknown>,
  copy: ProcessingCopy,
): string[] {
  const lines: string[] = [];
  if (flag(options, 'chunk')) {
    const method = stringOpt(options, 'chunk_method');
    const size = numberOpt(options, 'chunk_size');
    const overlap = numberOpt(options, 'chunk_overlap');
    lines.push(
      fmt(copy.optionsChunkLine, {
        method: method ?? copy.optionsUnset,
        size: size != null ? String(size) : copy.optionsUnset,
        overlap: overlap != null ? String(overlap) : copy.optionsUnset,
      }),
    );
  }
  if (flag(options, 'extract')) {
    const ner = stringOpt(options, 'ner_method');
    const nerModel = stringOpt(options, 'ner_model');
    const llm = stringOpt(options, 'llm_model') ?? stringOpt(options, 'model');
    lines.push(
      fmt(copy.optionsExtractLine, {
        ner: ner ?? copy.optionsUnset,
        nerModel: nerModel ?? copy.optionsUnset,
        llm: llm ?? copy.optionsUnset,
      }),
    );
  }
  if (flag(options, 'extract_relations')) {
    lines.push(copy.optionsRelationsOn);
  }
  if (flag(options, 'embed') || flag(options, 'embedding')) {
    lines.push(copy.optionsEmbedOn);
  }
  const requestId = stringOpt(options, 'request_id');
  if (requestId) {
    lines.push(fmt(copy.optionsRequestId, { id: requestId }));
  }
  return lines;
}
