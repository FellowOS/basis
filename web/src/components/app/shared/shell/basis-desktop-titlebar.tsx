import { appIsDesktopProduct } from '@/lib/app-runtime.js';
import { getBasisDesktopBridge, isMacDesktop } from '@/lib/desktop-bridge.js';
import { AppLogo } from '@/components/app/shared/shell/app-logo.js';
import { BasisShellBrandMark } from '@/components/app/shared/shell/basis-shell-brand.js';
import { BasisDesktopWindowControls } from '@/components/app/shared/shell/basis-desktop-window-controls.js';
import { useSidebar } from '@/components/ui/sidebar.js';
import { useI18n } from '@/i18n/context.js';
import { cn } from '@/lib/utils.js';

/** CSS length for the desktop titlebar (custom controls on Windows/Linux). */
export const DESKTOP_TITLEBAR_HEIGHT = '28px';

const noDrag = '[-webkit-app-region:no-drag]';

/**
 * App-wide titlebar: drag region + brand row + window controls (Windows/Linux only).
 * Must render inside SidebarProvider.
 */
export function BasisDesktopAppTitlebar({ className }: { className?: string }) {
  if (!appIsDesktopProduct() || isMacDesktop()) return null;

  return <BasisDesktopAppTitlebarInner className={className} />;
}

function BasisDesktopAppTitlebarInner({ className }: { className?: string }) {
  const { t } = useI18n();
  const { open, toggleSidebar } = useSidebar();
  const customControls = getBasisDesktopBridge()?.hasCustomWindowControls;

  return (
    <div
      data-slot="app-titlebar"
      className={cn(
        'bg-muted flex w-full shrink-0 items-stretch [-webkit-app-region:drag]',
        className,
      )}
      style={{
        height: DESKTOP_TITLEBAR_HEIGHT,
        paddingRight: customControls
          ? undefined
          : 'max(0px, calc(100vw - env(titlebar-area-x, 0px) - env(titlebar-area-width, 100%)))',
      }}
    >
      <div
        className={cn(
          'text-sidebar-foreground flex h-full shrink-0 items-center transition-[width] duration-200 ease-linear',
          open ? 'w-(--sidebar-width)' : 'w-(--sidebar-width-icon)',
        )}
      >
        {open ? (
          // Match SidebarHeader (p-2) + pl-2 + size-4 icon column — same as nav SidebarMenuButton.
          <div className="flex h-full w-full items-center px-2">
            <BasisShellBrandMark className="h-full min-w-0 flex-1 px-2" titlebar />
          </div>
        ) : (
          <button
            type="button"
            className={cn(
              'flex h-full w-full items-center justify-center hover:bg-sidebar-accent',
              noDrag,
            )}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              toggleSidebar();
            }}
            title={t.sidebar.brand}
          >
            <AppLogo size={20} className="pointer-events-none" />
          </button>
        )}
      </div>
      <div className="min-w-0 flex-1" aria-hidden />
      <BasisDesktopWindowControls />
    </div>
  );
}

/** Overlay drag strip for full-page views outside the main shell titlebar. */
export function BasisDesktopTitlebarDrag({ className }: { className?: string }) {
  if (!appIsDesktopProduct()) return null;

  return (
    <div
      aria-hidden
      className={cn('fixed z-40 [-webkit-app-region:drag]', className)}
      style={{
        top: 0,
        left: 0,
        right: 0,
        height: DESKTOP_TITLEBAR_HEIGHT,
      }}
    />
  );
}
