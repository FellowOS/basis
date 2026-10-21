import { Copy, Minus, Square, X } from 'lucide-react';
import { useEffect, useState } from 'react';

import { getBasisDesktopBridge } from '@/lib/shell/desktop-bridge.js';
import { cn } from '@/lib/utils.js';

const noDrag = '[-webkit-app-region:no-drag]';

export function BasisDesktopWindowControls({ className }: { className?: string }) {
  const desktop = getBasisDesktopBridge();
  const enabled = desktop?.hasCustomWindowControls === true;
  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    if (!enabled || !desktop) return;
    let cancelled = false;
    void desktop.isWindowMaximized?.().then((value) => {
      if (!cancelled) setMaximized(value);
    });
    const unsub = desktop.onWindowMaximizedChange?.((value) => setMaximized(value));
    return () => {
      cancelled = true;
      unsub?.();
    };
  }, [desktop, enabled]);

  if (!enabled || !desktop) return null;

  return (
    <div className={cn('flex h-full shrink-0 items-stretch', noDrag, className)}>
      <button
        type="button"
        className="text-muted-foreground hover:bg-foreground/10 hover:text-foreground flex h-full w-11 items-center justify-center transition-colors"
        aria-label="Minimize"
        onClick={() => desktop.windowMinimize?.()}
      >
        <Minus className="size-3.5" aria-hidden />
      </button>
      <button
        type="button"
        className="text-muted-foreground hover:bg-foreground/10 hover:text-foreground flex h-full w-11 items-center justify-center transition-colors"
        aria-label={maximized ? 'Restore' : 'Maximize'}
        onClick={() => desktop.windowMaximize?.()}
      >
        {maximized ? (
          <Copy className="size-3.5" aria-hidden />
        ) : (
          <Square className="size-3" aria-hidden />
        )}
      </button>
      <button
        type="button"
        className="text-muted-foreground flex h-full w-11 items-center justify-center transition-colors hover:bg-[#e81123] hover:text-white"
        aria-label="Close"
        onClick={() => desktop.windowClose?.()}
      >
        <X className="size-3.5" aria-hidden />
      </button>
    </div>
  );
}
