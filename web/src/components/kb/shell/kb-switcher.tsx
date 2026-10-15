import { Link } from 'react-router-dom';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu.js';
import { PublicIcon } from '@/components/ui/public-icon.js';
import { SidebarMenuButton, useSidebar } from '@/components/ui/sidebar.js';
import { SidebarIcon } from '@/components/sidebar-icon.js';
import { useI18n } from '@/i18n/context.js';
import { kbPath, parseKbIdFromPath } from '@/lib/nav-config.js';
import { useKbCatalog } from '@/lib/kb-context.js';
import { useLocation } from 'react-router-dom';

export function KbSwitcher() {
  const { t } = useI18n();
  const { state } = useSidebar();
  const { kbs, loading, getKb } = useKbCatalog();
  const location = useLocation();
  const kbId = parseKbIdFromPath(location.pathname);
  const current = kbId ? getKb(kbId) : undefined;
  const label = current?.name ?? t.menu.kbSwitcher.label;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <SidebarMenuButton
          variant="outline"
          tooltip={label}
          className="h-9 justify-between border-sidebar-border/80 bg-muted/30 font-medium shadow-none data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground group-data-[collapsible=icon]:justify-center"
        >
          <SidebarIcon name="folder-down-01" />
          <span className="sidebar-nav-text min-w-0 flex-1 truncate text-left group-data-[collapsible=icon]:hidden">
            {loading && !current ? t.menu.kbSwitcher.loading : label}
          </span>
          <PublicIcon
            name="chevron-down"
            size={14}
            className="ml-auto shrink-0 text-muted-foreground group-data-[collapsible=icon]:hidden"
          />
        </SidebarMenuButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        side={state === 'collapsed' ? 'right' : 'bottom'}
        className="max-h-[min(24rem,70vh)] w-56 overflow-y-auto"
      >
        <DropdownMenuLabel>{t.menu.kbSwitcher.label}</DropdownMenuLabel>
        {kbs.length === 0 && !loading ? (
          <DropdownMenuItem disabled>{t.menu.kbSwitcher.empty}</DropdownMenuItem>
        ) : (
          kbs.map((kb) => (
            <DropdownMenuItem key={kb.id} asChild>
              <Link to={kbPath(kb.id, 'graph')}>{kb.name}</Link>
            </DropdownMenuItem>
          ))
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/kbs">{t.menu.kbSwitcher.allKbs}</Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
