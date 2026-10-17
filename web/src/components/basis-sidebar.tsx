import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { AppLogo } from '@/components/app-logo.js';
import { KbSwitcher } from '@/components/kb/shell/kb-switcher.js';
import { BasisAccountMenu } from '@/components/basis-account-menu.js';
import { SidebarIcon } from '@/components/sidebar-icon.js';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
  useSidebar,
} from '@/components/ui/sidebar.js';
import { ScrollShadow } from '@/components/ui/scroll-shadow.js';
import { useI18n } from '@/i18n/context.js';
import { formatBadgeCount } from '@/i18n/format.js';
import type { Locale } from '@/i18n/locale.js';
import { api } from '@/lib/api.js';
import { consumeKbAlertsStream, type KbAlertStreamItem } from '@/lib/kb-alerts-stream.js';
import {
  KB_NAV_BY_ZONE,
  KB_WORKSPACE_ZONES,
  type KbNavItem,
  isKbScopedPath,
  kbPath,
  parseKbIdFromPath,
} from '@/lib/nav-config.js';
import { isSetupKbId, resolveSidebarKbId } from '@/lib/kb-active-id.js';
import { useKbCatalog } from '@/lib/kb-context.js';
import { kbNavSegmentEnabled, useKbCapabilities } from '@/lib/kb-capabilities.js';

export function BasisSidebar({ onLogout }: { onLogout: () => void }) {
  const { t, locale } = useI18n();
  const location = useLocation();
  const { isMobile, setOpenMobile } = useSidebar();
  const { kbs } = useKbCatalog();
  const { caps } = useKbCapabilities();

  const kbScoped = isKbScopedPath(location.pathname);
  const pathKbId = parseKbIdFromPath(location.pathname);
  const navKbId = resolveSidebarKbId(location.pathname, kbs);
  const alertsKbId =
    pathKbId && pathKbId !== 'all' && kbScoped ? pathKbId : navKbId;
  const [unreadAlertsCount, setUnreadAlertsCount] = useState(0);
  const [alertsStreamReady, setAlertsStreamReady] = useState(false);
  const streamSinceRef = useRef<string | undefined>(undefined);
  const seenAlertIdsRef = useRef<Set<string>>(new Set());

  const refreshAlertsCount = useCallback(async () => {
    if (!alertsKbId || isSetupKbId(alertsKbId)) {
      setUnreadAlertsCount(0);
      return;
    }
    try {
      const data = await api<{ alerts: KbAlertStreamItem[]; unread_count: number }>(
        `/api/kbs/${alertsKbId}/alerts?limit=50`,
      );
      seenAlertIdsRef.current = new Set(data.alerts.map((a) => a.id));
      setUnreadAlertsCount(data.unread_count ?? data.alerts.length);
      streamSinceRef.current = data.alerts[0]?.created_at ?? new Date().toISOString();
      setAlertsStreamReady(true);
    } catch {
      /* non-blocking */
    }
  }, [alertsKbId]);

  useEffect(() => {
    setAlertsStreamReady(false);
    void refreshAlertsCount();
  }, [refreshAlertsCount]);

  useEffect(() => {
    const onChanged = () => {
      void refreshAlertsCount();
    };
    window.addEventListener('kb-alerts-changed', onChanged);
    return () => window.removeEventListener('kb-alerts-changed', onChanged);
  }, [refreshAlertsCount]);

  useEffect(() => {
    if (!alertsKbId || isSetupKbId(alertsKbId) || !alertsStreamReady) return;
    const ac = new AbortController();
    let backoff = 2000;
    let cancelled = false;

    const run = async () => {
      while (!cancelled && !ac.signal.aborted) {
        try {
          await consumeKbAlertsStream(alertsKbId, {
            since: streamSinceRef.current,
            signal: ac.signal,
            locale,
            onAlert: (alert) => {
              streamSinceRef.current = alert.created_at;
              if (!seenAlertIdsRef.current.has(alert.id)) {
                seenAlertIdsRef.current.add(alert.id);
                setUnreadAlertsCount((prev) => prev + 1);
              }
            },
          });
          backoff = 2000;
        } catch {
          if (ac.signal.aborted || cancelled) break;
          await new Promise((r) => window.setTimeout(r, backoff));
          backoff = Math.min(backoff * 2, 30_000);
        }
      }
    };
    void run();
    return () => {
      cancelled = true;
      ac.abort();
    };
  }, [alertsStreamReady, alertsKbId, locale]);

  function closeMobile() {
    if (isMobile) setOpenMobile(false);
  }

  function isKbActive(segment: string) {
    const prefix = `/kbs/${navKbId}/${segment}`;
    return location.pathname === prefix || location.pathname.startsWith(`${prefix}/`);
  }

  function renderKbNavItem(currentKbId: string, item: KbNavItem) {
    const active = isKbActive(item.segment);
    const label = t.menu.kb[item.labelKey];
    const enabled = kbNavSegmentEnabled(item.segment, caps);
    const isAlerts = item.segment === 'alerts';
    const showBadge = isAlerts && unreadAlertsCount > 0;
    const disabledTooltip =
      caps?.diagnostic === 'explorer_unavailable'
        ? t.menu.capabilities.explorerUnavailable
        : t.menu.capabilities.unavailable;
    return (
      <SidebarMenuItem key={item.segment}>
        {enabled ? (
          <>
            <SidebarMenuButton asChild isActive={active} tooltip={label}>
              <Link to={kbPath(currentKbId, item.segment)} onClick={closeMobile}>
                <span className="relative inline-flex shrink-0">
                  <SidebarIcon name={item.icon} />
                  {showBadge ? (
                    <span className="absolute -right-0.5 -top-0.5 hidden size-2 rounded-full bg-destructive group-data-[collapsible=icon]:block" />
                  ) : null}
                </span>
                <span className="min-w-0 flex-1 truncate group-data-[collapsible=icon]:hidden">
                  {label}
                </span>
              </Link>
            </SidebarMenuButton>
            {showBadge ? (
              <SidebarMenuBadge className="bg-destructive/15 text-destructive">
                {formatBadgeCount(locale as Locale, unreadAlertsCount, 99)}
              </SidebarMenuBadge>
            ) : null}
          </>
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
