import type { IconType } from 'react-icons';
import type { ReactNode } from 'react';
import { getPublicIconComponent } from '@/lib/public-icon-map.js';
import { cn } from '@/lib/utils.js';

/** Sidebar menu icon slot — fixed 16×16 layout box, 16px glyph. */
export const SIDEBAR_ICON_PX = 16;

export function getSidebarIconComponent(name: string): IconType {
  return getPublicIconComponent(name);
}

export function SidebarIcon({
  name,
  className,
  iconClassName,
}: {
  name: string;
  className?: string;
  iconClassName?: string;
}) {
  const Icon = getSidebarIconComponent(name);
  return (
    <span
      data-sidebar-icon
      className={cn('flex size-4 shrink-0 items-center justify-center', className)}
    >
      <Icon
        size={SIDEBAR_ICON_PX}
        className={cn('inline-block shrink-0', iconClassName)}
        aria-hidden
      />
    </span>
  );
}

/** Reserved icon column when a row may have no glyph. */
export function SidebarIconSlot({
  children,
  className,
}: {
  children?: ReactNode;
  className?: string;
}) {
  return (
    <span
      data-sidebar-icon
      className={cn('flex size-4 shrink-0 items-center justify-center', className)}
    >
      {children}
    </span>
  );
}
