import { Link, useLocation } from 'react-router-dom';
import { Avatar, AvatarFallback } from '@/components/ui/avatar.js';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu.js';
import { AccountMenuSubTrigger } from '@/components/app/shared/shell/account-menu-sub-trigger.js';
import { PublicIcon } from '@/components/app/shared/primitives/public-icon.js';
import { SidebarMenuBadge, SidebarMenuButton } from '@/components/ui/sidebar.js';
import { useI18n } from '@/i18n/context.js';
import { formatBadgeCount } from '@/i18n/format.js';
import type { Locale } from '@/i18n/locale.js';
import { LocaleMenuItems } from '@/i18n/locale-menu.js';
import { isSetupKbId } from '@/lib/kb-active-id.js';
import { useBasisSession } from '@/lib/basis-session.js';
import {
  kbPath,
  platformAdminEntryPath,
  visiblePlatformNavItems,
} from '@/lib/nav-config.js';
import { useKbAlertsNavKbId, useKbUnreadAlerts } from '@/lib/use-kb-unread-alerts.js';
import { useTheme } from '@/lib/theme.js';
import { cn } from '@/lib/utils.js';
import { useSettingsAccess } from '@/lib/use-settings-access.js';

function MenuIcon({ name, className }: { name: string; className?: string }) {
  return <PublicIcon name={name} size={16} className={className} />;
}

function AlertsUnreadDot({ className }: { className?: string }) {
  return (
    <span className={cn('size-2 shrink-0 rounded-full bg-destructive', className)} aria-hidden />
  );
}

export function BasisAccountMenu({ onLogout }: { onLogout: () => void }) {
  const { t, locale } = useI18n();
  const location = useLocation();
  const { user, isAdmin } = useBasisSession();
  const alertsKbId = useKbAlertsNavKbId();
  const unreadAlertsCount = useKbUnreadAlerts();
  const showAlertsLink = !isSetupKbId(alertsKbId);
  const alertsActive =
    showAlertsLink &&
    (location.pathname === kbPath(alertsKbId, 'alerts') ||
      location.pathname.startsWith(`${kbPath(alertsKbId, 'alerts')}/`));
  const canSettings = useSettingsAccess();
  const { theme, setTheme } = useTheme();

  const accountTitle = user?.display_name || user?.email || t.sidebar.accountTitle;
  const accountRole = isAdmin ? t.sidebar.roleBasisAdmin : t.sidebar.roleBasisUser;
  const initials = (accountTitle[0] ?? 'S').toUpperCase();

  const settingsReady = isAdmin || canSettings !== null;
  const platformItems = settingsReady
    ? visiblePlatformNavItems(isAdmin, canSettings === true)
    : [];
  const showManagement = platformItems.length > 0;
  const managementHref = showManagement
    ? platformAdminEntryPath(isAdmin, canSettings === true)
    : null;
  const showAlertsBadge = showAlertsLink && unreadAlertsCount > 0;
  const alertsBadgeLabel = formatBadgeCount(locale as Locale, unreadAlertsCount, 99);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <SidebarMenuButton
            size="lg"
            className="min-w-0 data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground group-data-[collapsible=icon]:justify-center"
          >
            <Avatar className="relative size-8 shrink-0">
              <AvatarFallback className="text-xs font-semibold">{initials}</AvatarFallback>
              {showAlertsBadge ? (
                <AlertsUnreadDot className="absolute -right-0.5 -top-0.5 hidden group-data-[collapsible=icon]:block" />
              ) : null}
            </Avatar>
            <div className="min-w-0 flex-1 text-left group-data-[collapsible=icon]:hidden">
              <div className="text-sidebar-foreground truncate text-xs leading-4">{accountTitle}</div>
              <div className="text-muted-foreground truncate text-[11px] leading-4">{accountRole}</div>
            </div>
            <PublicIcon
              name="sort-vertical-01"
              size={16}
              className="text-muted-foreground group-data-[collapsible=icon]:hidden"
            />
          </SidebarMenuButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
        align="end"
        side="top"
        sideOffset={4}
      >
        <DropdownMenuLabel className="flex min-w-0 items-center gap-2 font-normal">
          <Avatar className="size-8">
            <AvatarFallback className="text-xs font-semibold">{initials}</AvatarFallback>
          </Avatar>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium">{accountTitle}</span>
            {user?.email && user.email !== accountTitle ? (
              <span className="text-muted-foreground block truncate text-xs">{user.email}</span>
            ) : null}
            <span className="text-muted-foreground block truncate text-xs">{accountRole}</span>
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuSub>
          <AccountMenuSubTrigger
            hint={theme === 'dark' ? t.sidebar.themeDark : t.sidebar.themeLight}
          >
            <MenuIcon name={theme === 'dark' ? 'moon-01' : 'sun-01'} />
            {t.sidebar.theme}
          </AccountMenuSubTrigger>
          <DropdownMenuPortal>
            <DropdownMenuSubContent>
              <DropdownMenuItem onClick={() => setTheme('light')}>
                <MenuIcon name="sun-01" />
                {t.sidebar.themeLight}
                {theme === 'light' ? <MenuIcon name="check-01" className="ml-auto" /> : null}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTheme('dark')}>
                <MenuIcon name="moon-01" />
                {t.sidebar.themeDark}
                {theme === 'dark' ? <MenuIcon name="check-01" className="ml-auto" /> : null}
              </DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuPortal>
        </DropdownMenuSub>
        <DropdownMenuSub>
          <AccountMenuSubTrigger>
            <MenuIcon name="globe-02" />
            {t.sidebar.language}
          </AccountMenuSubTrigger>
          <DropdownMenuPortal>
            <DropdownMenuSubContent>
              <LocaleMenuItems />
            </DropdownMenuSubContent>
          </DropdownMenuPortal>
        </DropdownMenuSub>
        {showAlertsLink ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild data-active={alertsActive ? true : undefined}>
              <Link to={kbPath(alertsKbId, 'alerts')}>
                <MenuIcon name="bell-01" />
                {t.menu.kb.alerts}
                {showAlertsBadge ? (
                  <span
                    className="ml-auto rounded-md bg-destructive/15 px-1.5 text-xs font-medium tabular-nums text-destructive"
                    data-testid="kb-account-alerts-badge"
                  >
                    {alertsBadgeLabel}
                  </span>
                ) : null}
              </Link>
            </DropdownMenuItem>
          </>
        ) : null}
        {managementHref ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link to={managementHref}>
                <MenuIcon name="settings" />
                {t.sidebar.management}
              </Link>
            </DropdownMenuItem>
          </>
        ) : null}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => {
            onLogout();
          }}
        >
          <MenuIcon name="logout-01" />
          {t.sidebar.logout}
        </DropdownMenuItem>
      </DropdownMenuContent>
      </DropdownMenu>
      {showAlertsBadge ? (
        <SidebarMenuBadge className="min-w-0 bg-transparent p-0">
          <AlertsUnreadDot />
        </SidebarMenuBadge>
      ) : null}
    </>
  );
}
