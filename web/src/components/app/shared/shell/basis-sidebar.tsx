import { Link, useLocation } from 'react-router-dom';
import { AppLogo } from '@/components/app/shared/shell/app-logo.js';
import { KbSwitcher } from '@/components/app/kb/explorer-shell/kb-switcher.js';
import { BasisAccountMenu } from '@/components/app/shared/shell/basis-account-menu.js';
import { SidebarIcon } from '@/components/app/shared/shell/sidebar-icon.js';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
  useSidebar,
} from '@/components/ui/sidebar.js';
import { ScrollShadow } from '@/components/app/shared/primitives/scroll-shadow.js';
import { useI18n } from '@/i18n/context.js';
import {
  KB_NAV_BY_ZONE,
  KB_WORKSPACE_ZONES,
  type KbSidebarNavItem,
  kbPath,
} from '@/lib/nav-config.js';
import { formatBadgeCount } from '@/i18n/format.js';
import type { Locale } from '@/i18n/locale.js';
import { resolveSidebarKbId } from '@/lib/kb-active-id.js';
import { useKbCatalog } from '@/lib/kb-context.js';
import { kbNavSegmentEnabled, useKbCapabilities } from '@/lib/kb-capabilities.js';
import { useKbUnreadAlerts } from '@/lib/use-kb-unread-alerts.js';

export function BasisSidebar({ onLogout }: { onLogout: () => void }) {
  const { t, locale } = useI18n();
  const location = useLocation();
  const { isMobile, setOpenMobile } = useSidebar();
  const { kbs } = useKbCatalog();
  const { caps } = useKbCapabilities();
  const unreadAlertsCount = useKbUnreadAlerts();

  const navKbId = resolveSidebarKbId(location.pathname, kbs);
  const alertsBadgeLabel =
    unreadAlertsCount > 0
      ? formatBadgeCount(locale as Locale, unreadAlertsCount, 99)
      : null;

  function closeMobile() {
    if (isMobile) setOpenMobile(false);
  }

  function isKbActive(segment: string) {
    const prefix = `/kbs/${navKbId}/${segment}`;
    return location.pathname === prefix || location.pathname.startsWith(`${prefix}/`);
  }

  function renderKbNavItem(currentKbId: string, item: KbSidebarNavItem) {
    const active = isKbActive(item.segment);
    const label = t.menu.kb[item.labelKey];
    const enabled = kbNavSegmentEnabled(item.segment, caps);
    const disabledTooltip =
      caps?.diagnostic === 'explorer_unavailable'
        ? t.menu.capabilities.explorerUnavailable
        : t.menu.capabilities.unavailable;
    return (
      <SidebarMenuItem key={item.segment}>
        {enabled ? (
          <SidebarMenuButton asChild isActive={active} tooltip={label}>
            <Link to={kbPath(currentKbId, item.segment)} onClick={closeMobile}>
              <SidebarIcon name={item.icon} />
              <span className="min-w-0 flex-1 truncate group-data-[collapsible=icon]:hidden">
                {label}
              </span>
              {item.segment === 'alerts' && alertsBadgeLabel ? (
                <span
                  className="ml-auto rounded-md bg-destructive/15 px-1.5 text-xs font-medium tabular-nums text-destructive group-data-[collapsible=icon]:hidden"
                  data-testid="kb-sidebar-alerts-badge"
                >
                  {alertsBadgeLabel}
                </span>
              ) : null}
            </Link>
          </SidebarMenuButton>
        ) : (
          <SidebarMenuButton
            disabled
            isActive={false}
            tooltip={`${label} — ${disabledTooltip}`}
          >
            <SidebarIcon name={item.icon} />
            <span className="min-w-0 flex-1 truncate opacity-60 group-data-[collapsible=icon]:hidden">
              {label}
            </span>
          </SidebarMenuButton>
        )}
      </SidebarMenuItem>
    );
  }

  return (
    <Sidebar collapsible="icon" className="p-0">
      <SidebarHeader className="flex-row items-center gap-1 group-data-[collapsible=icon]:flex-col group-data-[collapsible=icon]:items-center group-data-[collapsible=icon]:px-0">
        <Link
          to="/kbs"
          onClick={closeMobile}
          className="flex h-8 min-w-0 flex-1 items-center gap-2 overflow-hidden px-2 group-data-[collapsible=icon]:size-8 group-data-[collapsible=icon]:flex-none group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0"
        >
          <AppLogo size={24} />
          <span className="truncate font-display text-sm font-semibold leading-[1.25] tracking-tight group-data-[collapsible=icon]:hidden">
            Basis
          </span>
        </Link>
        <SidebarTrigger
          className="size-8 shrink-0 opacity-70 hover:opacity-100"
          aria-label={t.sidebar.collapseSidebar}
        />
      </SidebarHeader>
      <SidebarContent className="overflow-hidden group-data-[collapsible=icon]:overflow-hidden">
        <ScrollShadow hideScrollBar className="min-h-0 flex-1" fadeColor="var(--sidebar)">
          <SidebarGroup className="group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:items-center">
            <SidebarGroupContent>
              <div className="mb-3 px-0.5 group-data-[collapsible=icon]:mb-1 group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
                <KbSwitcher />
              </div>
              <div className="flex flex-col gap-3.5 group-data-[collapsible=icon]:gap-2">
                {KB_WORKSPACE_ZONES.map((zone, zoneIndex) => {
                  const zoneLabel = t.menu.kbZones[zone];
                  const items = KB_NAV_BY_ZONE[zone];
                  return (
                    <div key={zone} className="flex flex-col gap-0.5">
                      {zoneIndex > 0 ? (
                        <div className="mx-2 my-1 hidden h-px bg-sidebar-border group-data-[collapsible=icon]:block" />
                      ) : null}
                      <div
                        className="px-2 pb-0.5 text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/50 group-data-[collapsible=icon]:hidden"
                      >
                        {zoneLabel}
                      </div>
                      <SidebarMenu>
                        {items.map((item) => renderKbNavItem(navKbId, item))}
                      </SidebarMenu>
                    </div>
                  );
                })}
              </div>
            </SidebarGroupContent>
          </SidebarGroup>
        </ScrollShadow>
      </SidebarContent>
      <SidebarFooter className="group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:items-center">
        <SidebarMenu className="w-full min-w-0">
          <SidebarMenuItem className="min-w-0">
            <BasisAccountMenu
              onLogout={() => {
                closeMobile();
                void onLogout();
              }}
            />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
