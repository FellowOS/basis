import { cn } from '@/lib/utils.js';

export type KbExplorerZoneTab = {
  id: string;
  label: string;
};

export function KbExplorerZoneTabs({
  tabs,
  activeId,
  onChange,
  className,
  variant = 'explorer',
}: {
  tabs: KbExplorerZoneTab[];
  activeId: string;
  onChange: (id: string) => void;
  className?: string;
  /** `console` uses Sema shell tokens for document-style workspaces. */
  variant?: 'explorer' | 'console';
}) {
  const isConsole = variant === 'console';
  return (
    <div
      className={cn(
        'flex shrink-0 gap-1 border-b px-3 py-2 backdrop-blur',
        isConsole
          ? 'border-border bg-background/95'
          : 'border-white/10 bg-[#060d1a]/95',
        className,
      )}
      role="tablist"
    >
      {tabs.map((tab) => {
        const active = tab.id === activeId;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={active}
            className={cn(
              'rounded-md px-3 py-1.5 text-xs font-semibold tracking-wide transition-colors',
              isConsole
                ? active
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                : active
                  ? 'bg-[#4aa3ff]/20 text-[#7fc6ff]'
                  : 'text-[#8fa8c6] hover:bg-white/5 hover:text-[#ddeeff]',
            )}
            onClick={() => onChange(tab.id)}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
