import { Outlet, useLocation } from 'react-router-dom';
import { BasisSidebar } from '@/components/basis-sidebar.js';
import { KbProvider } from '@/lib/kb-context.js';
import { KbCapabilitiesProvider } from '@/lib/kb-capabilities.js';
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar.js';
import { Toaster } from '@/components/ui/sonner.js';
import { TooltipProvider } from '@/components/ui/tooltip.js';
import { useI18n } from '@/i18n/context.js';

/** Graph canvas only — other KB workspaces use normal console page padding. */
function isKbGraphFullBleedPath(pathname: string): boolean {
  return /^\/kbs\/[^/]+\/graph\/?$/.test(pathname);
}

export function BasisLayout({ onLogout }: { onLogout: () => void }) {
  const { t } = useI18n();
  const { pathname } = useLocation();
  const graphCanvas = isKbGraphFullBleedPath(pathname);

  return (
    <TooltipProvider delayDuration={0}>
      <KbProvider>
      <KbCapabilitiesProvider>
      <SidebarProvider className="console-bench relative flex h-svh max-h-svh min-h-0 overflow-hidden">
        <BasisSidebar onLogout={onLogout} />
        <SidebarInset className="relative flex min-h-0 min-w-0 w-0 flex-1 flex-col overflow-hidden bg-transparent">
          <div
            className={
              graphCanvas
                ? 'relative flex min-h-0 flex-1 flex-col overflow-hidden'
                : 'console-page-scroll relative flex min-h-0 flex-1 flex-col overflow-y-auto'
            }
          >
            <div className="pointer-events-none absolute inset-x-0 top-0 z-50 flex items-center justify-between gap-2 p-3 md:hidden">
              <SidebarTrigger
                aria-label={t.sidebar.openSidebar}
                className="pointer-events-auto size-auto h-auto w-auto rounded-md border border-border bg-background/90 p-1.5 text-muted-foreground shadow-sm backdrop-blur hover:bg-accent hover:opacity-100 [&_svg]:size-[18px]"
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
      </SidebarProvider>
      </KbCapabilitiesProvider>
      </KbProvider>
      <Toaster position="bottom-right" richColors closeButton />
    </TooltipProvider>
  );
}
