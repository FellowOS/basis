'use client';

import * as DropdownMenuPrimitive from '@radix-ui/react-dropdown-menu';
import type * as React from 'react';

import { PublicIcon } from '@/components/app/shared/primitives/public-icon.js';
import { cn } from '@/lib/utils.js';

/** Account menu sub-menu row: optional trailing hint + project chevron icon. */
export function AccountMenuSubTrigger({
  className,
  inset,
  children,
  hint,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.SubTrigger> & {
  inset?: boolean;
  hint?: React.ReactNode;
}) {
  return (
    <DropdownMenuPrimitive.SubTrigger
      data-slot="dropdown-menu-sub-trigger"
      data-inset={inset}
      className={cn(
        'flex select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden focus:bg-accent focus:text-accent-foreground data-[inset]:pl-8 data-[state=open]:bg-accent data-[state=open]:text-accent-foreground [&_svg:not([class*="text-"])]:text-muted-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*="size-"])]:size-4',
        className,
      )}
      {...props}
    >
      {children}
      {hint != null ? (
        <span className="ml-auto min-w-0 truncate text-xs text-muted-foreground">{hint}</span>
      ) : null}
      <PublicIcon
        name="chevron-right"
        size={16}
        className={cn('shrink-0', hint == null && 'ml-auto')}
      />
    </DropdownMenuPrimitive.SubTrigger>
  );
}
