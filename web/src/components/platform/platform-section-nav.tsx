import { Link, useLocation } from 'react-router-dom';
import { SidebarIcon } from '@/components/sidebar-icon.js';
import { useI18n } from '@/i18n/context.js';
import type { NavItem } from '@/lib/nav-config.js';
import { platformPathActive } from '@/lib/nav-config.js';
import { cn } from '@/lib/utils.js';

type PlatformSectionNavProps = {
  items: NavItem[];
};

export function PlatformSectionNav({ items }: PlatformSectionNavProps) {
  const { t } = useI18n();
  const { pathname } = useLocation();

  if (items.length === 0) return null;

  return (
    <nav
      aria-label={t.sidebar.platformAdmin}
      className="mb-6 flex flex-wrap gap-1 border-b border-border pb-px"
    >
      {items.map((item) => {
        const active = platformPathActive(pathname, item.to, item.exact);
        const label = t.menu.platform[item.labelKey];
        return (
          <Link
            key={item.to}
            to={item.to}
            className={cn(
              '-mb-px inline-flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition-colors',
              active
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:border-border hover:text-foreground',
            )}
          >
            <SidebarIcon name={item.icon} className="size-4 shrink-0 opacity-80" />
            <span className="truncate">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
