import { Link } from 'react-router-dom';
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
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu.js';
import { PublicIcon } from '@/components/ui/public-icon.js';
import { SidebarMenuButton } from '@/components/ui/sidebar.js';
import { useI18n } from '@/i18n/context.js';
import { LocaleMenuItems } from '@/i18n/locale-menu.js';
import { useSemaSession } from '@/lib/sema-session.js';
import { useTheme } from '@/lib/theme.js';

function MenuIcon({ name, className }: { name: string; className?: string }) {
  return <PublicIcon name={name} size={16} className={className} />;
}

export function SemaAccountMenu({ onLogout }: { onLogout: () => void }) {
  const { t } = useI18n();
  const { user, isAdmin } = useSemaSession();
  const { theme, setTheme } = useTheme();

  const accountTitle = user?.display_name || user?.email || t.sidebar.accountTitle;
  const accountRole = isAdmin ? t.sidebar.roleSemaAdmin : t.sidebar.roleSemaUser;
  const initials = (accountTitle[0] ?? 'S').toUpperCase();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <SidebarMenuButton
          size="lg"
          className="min-w-0 data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground group-data-[collapsible=icon]:justify-center"
        >
          <Avatar className="size-8">
            <AvatarFallback className="text-xs font-semibold">{initials}</AvatarFallback>
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
          <DropdownMenuSubTrigger
            hint={theme === 'dark' ? t.sidebar.themeDark : t.sidebar.themeLight}
          >
            <MenuIcon name={theme === 'dark' ? 'moon-01' : 'sun-01'} />
            {t.sidebar.theme}
          </DropdownMenuSubTrigger>
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
          <DropdownMenuSubTrigger>
            <MenuIcon name="globe-02" />
            {t.sidebar.language}
          </DropdownMenuSubTrigger>
          <DropdownMenuPortal>
            <DropdownMenuSubContent>
              <LocaleMenuItems />
            </DropdownMenuSubContent>
          </DropdownMenuPortal>
        </DropdownMenuSub>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/tokens">
            <MenuIcon name="key-01" />
            {t.menu.platformTokens.title}
          </Link>
        </DropdownMenuItem>
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
  );
}
