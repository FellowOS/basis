import { AppLogo } from '@/components/app/shared/shell/app-logo.js';
import { useI18n } from '@/i18n/context.js';
import { cn } from '@/lib/utils.js';

/** Logo + wordmark aligned to SidebarMenuButton icon column (Fellow sidebar header / titlebar). */
export function BasisShellBrandMark({
  className,
  textClassName,
  titlebar,
}: {
  className?: string;
  textClassName?: string;
  /** Slightly smaller label in the 28px desktop titlebar row. */
  titlebar?: boolean;
}) {
  const { t } = useI18n();

  return (
    <div className={cn('flex min-w-0 items-center gap-2', className)}>
      <span className="flex size-4 shrink-0 items-center justify-center">
        <AppLogo size={20} className="pointer-events-none" />
      </span>
      <span
        className={cn(
          'truncate text-sidebar-foreground',
          titlebar ? 'text-xs tracking-wider' : 'text-sm tracking-wider',
          textClassName,
        )}
      >
        {t.sidebar.brand}
      </span>
    </div>
  );
}
