import { Link, useLocation } from 'react-router-dom';
import { AppLogo } from '@/components/app-logo.js';
import { KbSwitcher } from '@/components/kb-switcher.js';
import { SemaAccountMenu } from '@/components/sema-account-menu.js';
import { SidebarIcon } from '@/components/sidebar-icon.js';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
  useSidebar,
} from '@/components/ui/sidebar.js';
import { ScrollShadow } from '@/components/ui/scroll-shadow.js';
import { useI18n } from '@/i18n/context.js';
import {
  KB_NAV_BY_ZONE,
  KB_WORKSPACE_ZONES,
  PLATFORM_NAV,
  isKbScopedPath,
  kbPath,
  parseKbIdFromPath,
} from '@/lib/nav-config.js';
import { useSemaSession } from '@/lib/sema-session.js';
import { kbNavSegmentEnabled, useKbCapabilities } from '@/lib/kb-capabilities.js';

export function SemaSidebar({ onLogout }: { onLogout: () => void }) {
  const { t } = useI18n();
  const location = useLocation();
  const { isMobile, setOpenMobile } = useSidebar();
  const { isAdmin } = useSemaSession();
  const { caps } = useKbCapabilities();

  const kbScoped = isKbScopedPath(location.pathname);
  const kbId = parseKbIdFromPath(location.pathname);

  function closeMobile() {
    if (isMobile) setOpenMobile(false);
  }

  function isPlatformActive(path: string, exact?: boolean) {
    if (exact) return location.pathname === path;
    return location.pathname === path || location.pathname.startsWith(`${path}/`);
  }

  function isKbActive(segment: string) {
    if (!kbId) return false;
    const prefix = `/kbs/${kbId}/${segment}`;
    return location.pathname === prefix || location.pathname.startsWith(`${prefix}/`);
  }

  const platformItems = PLATFORM_NAV.filter((item) => !item.adminOnly || isAdmin);

  return (
    <Sidebar collapsible="icon" className="p-0">
      <SidebarHeader className="flex-row items-center gap-1 group-data-[collapsible=icon]:flex-col group-data-[collapsible=icon]:items-center group-data-[collapsible=icon]:px-0">
        <Link
          to="/kbs"
          onClick={closeMobile}
          className="flex h-8 min-w-0 flex-1 items-center gap-2 overflow-hidden px-2 group-data-[collapsible=icon]:size-8 group-data-[collapsible=icon]:flex-none group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0"
        >
          <AppLogo size={24} />
          <span className="font-display sidebar-nav-text truncate text-sm font-semibold leading-4 tracking-tight group-data-[collapsible=icon]:hidden">
            Sema
          </span>
        </Link>
        <SidebarTrigger
          className="size-8 shrink-0 opacity-70 hover:opacity-100"
          aria-label={t.sidebar.collapseSidebar}
        />
      </SidebarHeader>
      <SidebarContent className="overflow-hidden group-data-[collapsible=icon]:overflow-hidden">
        <ScrollShadow hideScrollBar className="min-h-0 flex-1" fadeColor="var(--sidebar)">
          {kbScoped && kbId ? (
            <SidebarGroup className="group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:items-center">
              <SidebarGroupLabel className="group-data-[collapsible=icon]:hidden">
                {t.menu.groups.knowledgeBase}
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <div className="mb-2 px-1 group-data-[collapsible=icon]:mb-0 group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
                  <KbSwitcher />
                </div>
                <div className="flex flex-col gap-3">
                  {KB_WORKSPACE_ZONES.map((zone) => {
                    const zoneLabel = t.menu.kbZones[zone];
                    const items = KB_NAV_BY_ZONE[zone];
                    return (
                      <div key={zone} className="flex flex-col gap-0.5">
                        <div
                          className="sidebar-nav-text px-2 text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/55 group-data-[collapsible=icon]:hidden"
                        >
                          {zoneLabel}
                        </div>
                        <SidebarMenu>
                          {items.map((item) => {
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
                                    <Link to={kbPath(kbId, item.segment)} onClick={closeMobile}>
                                      <SidebarIcon name={item.icon} />
                                      <span className="sidebar-nav-text min-w-0 flex-1 truncate">
                                        {label}
                                      </span>
                                    </Link>
                                  </SidebarMenuButton>
                                ) : (
                                  <SidebarMenuButton
                                    disabled
                                    isActive={false}
                                    tooltip={`${label} — ${disabledTooltip}`}
                                  >
                                    <SidebarIcon name={item.icon} />
                                    <span className="sidebar-nav-text min-w-0 flex-1 truncate opacity-60">
                                      {label}
                                    </span>
                                  </SidebarMenuButton>
                                )}
                              </SidebarMenuItem>
                            );
                          })}
                        </SidebarMenu>
                      </div>
                    );
                  })}
                </div>
              </SidebarGroupContent>
            </SidebarGroup>
          ) : (
            <SidebarGroup className="group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:items-center">
              <SidebarGroupLabel className="group-data-[collapsible=icon]:hidden">
                {t.menu.groups.platform}
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {platformItems.map((item) => {
                    const active = isPlatformActive(item.to, item.exact);
                    const label = t.menu.platform[item.labelKey];
                    return (
                      <SidebarMenuItem key={item.to}>
                        <SidebarMenuButton asChild isActive={active} tooltip={label}>
                          <Link to={item.to} onClick={closeMobile}>
                            <SidebarIcon name={item.icon} />
                            <span className="sidebar-nav-text min-w-0 flex-1 truncate">{label}</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          )}
        </ScrollShadow>
      </SidebarContent>
      <SidebarFooter className="group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:items-center">
        <SidebarMenu className="w-full min-w-0">
          <SidebarMenuItem className="min-w-0">
            <SemaAccountMenu
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
