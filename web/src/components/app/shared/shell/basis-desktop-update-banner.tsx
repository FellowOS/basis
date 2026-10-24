import { ExternalLink, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button.js';
import { appIsDesktopProduct } from '@/lib/runtime/app-runtime.js';
import { getDesktopAppVersion } from '@/lib/shell/desktop-app-version.js';
import { openDesktopExternalUrl } from '@/lib/shell/desktop-open-external.js';
import {
  desktopUpdateAvailable,
  dismissDesktopUpdate,
  fetchLatestDesktopRelease,
  type DesktopReleaseInfo,
} from '@/lib/shell/desktop-release.js';
import { useI18n } from '@/i18n/context.js';
import { fmt } from '@/i18n/format.js';
import { cn } from '@/lib/utils.js';

export function BasisDesktopUpdateBanner({ className }: { className?: string }) {
  const { t } = useI18n();
  const [release, setRelease] = useState<DesktopReleaseInfo | null>(null);

  useEffect(() => {
    if (!appIsDesktopProduct()) return;
    const current = getDesktopAppVersion();
    if (!current) return;

    let cancelled = false;
    void (async () => {
      try {
        const latest = await fetchLatestDesktopRelease();
        if (cancelled) return;
        setRelease(desktopUpdateAvailable(current, latest));
      } catch {
        /* ignore — offline or rate limit */
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  if (!release) return null;

  const openRelease = () => {
    void openDesktopExternalUrl(release.htmlUrl);
  };

  const dismiss = () => {
    dismissDesktopUpdate(release.version);
    setRelease(null);
  };

  return (
    <div
      role="status"
      className={cn(
        'flex shrink-0 items-center gap-3 border-b border-border bg-muted/80 px-4 py-2 text-sm backdrop-blur-sm',
        '[-webkit-app-region:no-drag]',
        className,
      )}
    >
      <p className="min-w-0 flex-1 text-muted-foreground">
        {fmt(t.core.shell.desktop_update.message, {
          current: getDesktopAppVersion() ?? '',
          latest: release.version,
        })}
      </p>
      <div className="flex shrink-0 items-center gap-1.5">
        <Button type="button" size="sm" variant="secondary" onClick={openRelease}>
          {t.core.shell.desktop_update.open_release}
          <ExternalLink className="size-3.5 opacity-70" aria-hidden />
        </Button>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="size-8"
          aria-label={t.core.shell.desktop_update.dismiss}
          onClick={dismiss}
        >
          <X className="size-4" aria-hidden />
        </Button>
      </div>
    </div>
  );
}
