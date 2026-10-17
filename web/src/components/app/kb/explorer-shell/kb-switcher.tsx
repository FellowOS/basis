import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { KbCreateDialog } from '@/components/app/kb/explorer-shell/kb-create-dialog.js';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu.js';
import { PublicIcon } from '@/components/app/shared/primitives/public-icon.js';
import { SidebarMenuButton, useSidebar } from '@/components/ui/sidebar.js';
import { useI18n } from '@/i18n/context.js';
import { writeActiveKbId } from '@/lib/kb-active-id.js';
import { useKbCatalog } from '@/lib/kb-context.js';
import { kbPath, parseKbIdFromPath } from '@/lib/nav-config.js';

export function KbSwitcher() {
  const { t } = useI18n();
  const { state } = useSidebar();
  const navigate = useNavigate();
  const { kbs, loading, refresh, getKb } = useKbCatalog();
  const location = useLocation();
  const kbId = parseKbIdFromPath(location.pathname);
  const current = kbId ? getKb(kbId) : undefined;
  const createLabel = t.pages.basisKbs.createKb;
  const emptyCatalog = !loading && kbs.length === 0;
  const label = emptyCatalog ? createLabel : (current?.name ?? t.menu.kbSwitcher.label);
  const [createOpen, setCreateOpen] = useState(false);

  async function onCreated(kb: { id: string }) {
    writeActiveKbId(kb.id);
    await refresh();
    navigate(kbPath(kb.id, 'graph'));
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <SidebarMenuButton
            tooltip={label}
            className="h-9 justify-between border border-sidebar-border bg-muted/30 font-medium data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground group-data-[collapsible=icon]:justify-center"
          >
            <span className="min-w-0 flex-1 truncate text-left group-data-[collapsible=icon]:hidden">
              {loading && !current && !emptyCatalog ? t.menu.kbSwitcher.loading : label}
            </span>
            <PublicIcon
              name="chevron-down"
              size={14}
              className="ml-auto shrink-0 text-muted-foreground group-data-[collapsible=icon]:ml-0"
            />
          </SidebarMenuButton>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          side={state === 'collapsed' ? 'right' : 'bottom'}
          className="max-h-[min(24rem,70vh)] w-56 overflow-y-auto"
        >
          {emptyCatalog ? (
            <DropdownMenuItem
              onSelect={() => {
                setCreateOpen(true);
              }}
            >
              <PublicIcon name="plus-01" size={16} />
              {createLabel}
            </DropdownMenuItem>
          ) : (
            kbs.map((kb) => (
              <DropdownMenuItem key={kb.id} asChild>
                <Link to={kbPath(kb.id, 'graph')}>{kb.name}</Link>
              </DropdownMenuItem>
            ))
          )}
          {!emptyCatalog ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={() => {
                  setCreateOpen(true);
                }}
              >
                <PublicIcon name="plus-01" size={16} />
                {createLabel}
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
      <KbCreateDialog open={createOpen} onOpenChange={setCreateOpen} onCreated={onCreated} />
    </>
  );
}
