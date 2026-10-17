import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs.js';
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
  /** `console` uses Basis shell tokens for document-style workspaces. */
  variant?: 'explorer' | 'console';
}) {
  const isConsole = variant === 'console';

  return (
    <Tabs
      value={activeId}
      onValueChange={onChange}
      className={cn('gap-0', className)}
    >
      <TabsList
        variant="line"
        className={cn(
          'h-auto w-full shrink-0 justify-start gap-1 rounded-none border-b px-3 py-2 backdrop-blur',
          isConsole
            ? 'border-border bg-background/95'
            : 'border-white/10 bg-[#060d1a]/95',
        )}
      >
        {tabs.map((tab) => (
          <TabsTrigger
            key={tab.id}
            value={tab.id}
            className={cn(
              'h-auto flex-none rounded-md px-3 py-1.5 text-xs font-semibold tracking-wide shadow-none after:hidden',
              'data-[state=active]:shadow-none dark:data-[state=active]:border-transparent dark:data-[state=active]:bg-transparent',
              isConsole
                ? 'text-muted-foreground hover:bg-muted hover:text-foreground data-[state=active]:bg-primary/10 data-[state=active]:text-primary'
                : 'text-[#8fa8c6] hover:bg-white/5 hover:text-[#ddeeff] data-[state=active]:bg-[#4aa3ff]/20 data-[state=active]:text-[#7fc6ff]',
            )}
          >
            {tab.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
