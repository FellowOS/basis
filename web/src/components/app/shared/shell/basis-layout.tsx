import type { CSSProperties } from 'react';
import { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { isSetupWorkspaceId, writeActiveWorkspaceId } from '@/lib/workspace/active-id.js';
import { parseWorkspaceIdFromPath } from '@/lib/nav/nav-config.js';
import { BasisSidebar } from '@/components/app/shared/shell/basis-sidebar.js';
import {
  BasisDesktopAppTitlebar,
  DESKTOP_TITLEBAR_HEIGHT,
} from '@/components/app/shared/shell/basis-desktop-titlebar.js';
import { WorkspaceCatalogProvider } from '@/lib/workspace/context.js';
import { WorkspaceCapabilitiesProvider } from '@/lib/workspace/capabilities.js';
import { appIsDesktopProduct } from '@/lib/runtime/app-runtime.js';
import { isMacDesktop } from '@/lib/shell/desktop-bridge.js';
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar.js';
import { Toaster } from '@/components/ui/sonner.js';
import { TooltipProvider } from '@/components/ui/tooltip.js';
import { useI18n } from '@/i18n/context.js';
import { cn } from '@/lib/utils.js';

/** Graph canvas only — other workspace routes use normal console page padding. */
function isWorkspaceGraphFullBleedPath(pathname: string): boolean {
  return /^\/workspaces\/[^/]+\/graph\/?$/.test(pathname);
}

export function BasisLayout({ onLogout }: { onLogout: () => void }) {
  const { t } = useI18n();
  const { pathname } = useLocation();
  const graphCanvas = isWorkspaceGraphFullBleedPath(pathname);
  const isDesktop = appIsDesktopProduct();
  const isMac = isDesktop && isMacDesktop();
  const shellStyle =
    isDesktop && !isMac
      ? ({ '--basis-titlebar-height': DESKTOP_TITLEBAR_HEIGHT } as CSSProperties)
      : undefined;

  useEffect(() => {
    const workspaceId = parseWorkspaceIdFromPath(pathname);
    if (workspaceId && !isSetupWorkspaceId(workspaceId)) writeActiveWorkspaceId(workspaceId);
  }, [pathname]);

  return (
    <TooltipProvider delayDuration={0}>
      <WorkspaceCatalogProvider>
      <WorkspaceCapabilitiesProvider>
      <div
        className="flex h-svh max-h-svh min-h-0 flex-col overflow-hidden"
        style={shellStyle}
        data-basis-desktop-shell={isDesktop ? '' : undefined}
      >
        <SidebarProvider className="flex min-h-0 flex-1 flex-col overflow-hidden bg-background">
          <BasisDesktopAppTitlebar />
          <div className="relative flex min-h-0 min-w-0 flex-1 overflow-hidden bg-background">
            <BasisSidebar onLogout={onLogout} />
            <SidebarInset
              data-basis-app=""
              className={cn(
                'relative flex min-h-0 min-w-0 w-0 flex-1 flex-col overflow-hidden',
                isDesktop ? 'bg-background' : 'bg-transparent',
              )}
            >
              {isMac ? (
                <div
                  aria-hidden
                  className="absolute top-0 left-0 right-0 z-40 h-5 [-webkit-app-region:drag]"
                />
              ) : null}
              <div
                className={
                  graphCanvas
                    ? 'relative flex min-h-0 flex-1 flex-col overflow-hidden'
                    : 'relative flex min-h-0 flex-1 flex-col overflow-y-auto'
                }
              >
                <div className="pointer-events-none absolute inset-x-0 top-0 z-50 flex items-center gap-2 p-3 md:hidden">
                  <SidebarTrigger
                    aria-label={t.core.shell.sidebar.open_sidebar}
                    className={cn(
                      'pointer-events-auto size-auto h-auto w-auto rounded-md border border-border bg-background/90 p-1.5 text-muted-foreground shadow-sm backdrop-blur hover:bg-accent hover:opacity-100 [&_svg]:size-[18px]',
                      isDesktop && '[-webkit-app-region:no-drag]',
                    )}
                  />
                </div>
                <div
                  className={
                    graphCanvas
                      ? 'flex min-h-0 w-full flex-1 flex-col pt-11 md:pt-0'
                      : 'flex w-full min-h-0 flex-1 flex-col p-4 pt-11 md:p-8 md:pt-4'
                  }
                >
                  <Outlet />
                </div>
              </div>
            </SidebarInset>
          </div>
        </SidebarProvider>
      </div>
      </WorkspaceCapabilitiesProvider>
      </WorkspaceCatalogProvider>
      <Toaster position="bottom-right" richColors closeButton />
    </TooltipProvider>
  );
}
