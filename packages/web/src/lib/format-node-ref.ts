/** Display label for graph / ledger node ids (falls back to shortened id). */
export function formatNodeRef(id: string, labels: Record<string, string | null | undefined>): string {
  const label = labels[id]?.trim();
  if (label) {
    return label;
  }
  if (id.length > 14) {
    return `${id.slice(0, 8)}…${id.slice(-4)}`;
  }
  return id;
}

export function formatNodeRefDetail(
  id: string,
  labels: Record<string, string | null | undefined>,
): { title: string; subtitle: string | null } {
  const label = labels[id]?.trim();
  if (label) {
    return { title: label, subtitle: id };
  }
  return { title: formatNodeRef(id, labels), subtitle: null };
}
