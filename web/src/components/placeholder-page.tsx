import { ConsolePageLayout } from '@/components/console-ui/ConsolePageLayout.js';
import { EmptyState } from '@/components/console-ui/EmptyState.js';
import type { Crumb } from '@/components/console-ui/PageHeader.js';
import { useI18n } from '@/i18n/context.js';

export function PlaceholderPage({
  crumbs,
  title,
  subtitle,
}: {
  crumbs: Crumb[];
  title: string;
  subtitle?: string;
}) {
  const { t } = useI18n();
  return (
    <ConsolePageLayout crumbs={crumbs} subtitle={subtitle}>
      <EmptyState title={title || t.menu.placeholder.title} description={t.menu.placeholder.hint} />
    </ConsolePageLayout>
  );
}
