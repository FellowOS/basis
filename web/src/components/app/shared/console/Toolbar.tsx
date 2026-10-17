import type { ComponentProps, ReactNode } from 'react';
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group.js';
import { PublicIcon } from '@/components/app/shared/primitives/public-icon.js';
import { cn } from '@/lib/utils.js';

export function Toolbar({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={className}>{children}</div>;
}

export function ToolbarRow({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div
      className={cn(
        'flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between',
        className,
      )}
    >
      {children}
    </div>
  );
}

export function ToolbarStart({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={cn('flex min-w-0 flex-1 flex-wrap items-center gap-2', className)}>
      {children}
    </div>
  );
}

export function ToolbarEnd({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={cn('flex shrink-0 flex-wrap items-center gap-2', className)}>{children}</div>
  );
}

export function ToolbarSearch({ className, ...props }: ComponentProps<typeof InputGroupInput>) {
  return (
    <InputGroup className={cn('max-w-xl', className)}>
      <InputGroupAddon>
        <PublicIcon name="search-01" size={16} className="opacity-50" />
      </InputGroupAddon>
      <InputGroupInput {...props} />
    </InputGroup>
  );
}

export function ToolbarMeta({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <span className={cn('text-[12px] font-semibold text-muted-foreground', className)}>
      {children}
    </span>
  );
}
