import { PageHeader } from '@/components/console-ui/PageHeader.js';
import { EmptyState } from '@/components/console-ui/EmptyState.js';
import type { Crumb } from '@/components/console-ui/PageHeader.js';
import { useI18n } from '@/i18n/context.js';

export function PlaceholderPage({
  crumbs,
  title,
}: {
  crumbs: Crumb[];
  title: string;
}) {
  const { t } = useI18n();
  return (
    <div className="space-y-6">
      <PageHeader crumbs={crumbs} />
      <EmptyState title={title || t.menu.placeholder.title} description={t.menu.placeholder.hint} />
    </div>
  );
}
