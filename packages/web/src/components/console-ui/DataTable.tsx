import type { ReactNode } from 'react';
import { useI18n } from '@/i18n/context.js';
import { cn } from '@/lib/utils.js';

export interface DataTableColumn<T> {
  key: string;
  header: ReactNode;
  render: (row: T) => ReactNode;
  hideBelow?: 'sm' | 'md' | 'lg';
  align?: 'left' | 'right' | 'center';
  width?: string;
}

export interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  data: T[];
  rowKey: (row: T) => string | number;
  onRowClick?: (row: T) => void;
  emptyMessage?: string;
  className?: string;
}

const hideBelowClasses: Record<NonNullable<DataTableColumn<unknown>['hideBelow']>, string> = {
  sm: 'hidden sm:table-cell',
  md: 'hidden md:table-cell',
  lg: 'hidden lg:table-cell',
};

const alignClasses = {
  left: 'text-left',
  right: 'text-right',
  center: 'text-center',
};

export function DataTable<T>({
  columns,
  data,
  rowKey,
  onRowClick,
  emptyMessage,
  className,
}: DataTableProps<T>) {
  const { t } = useI18n();
  const message = emptyMessage ?? t.common.noRecords;
  if (data.length === 0) {
    return (
      <div className={cn('py-10 text-center text-sm text-muted-foreground', className)}>
        {message}
      </div>
    );
  }

  return (
    <div className={cn('overflow-x-auto rounded-[var(--radius-vela-lg)] border border-line bg-bg-2', className)}>
      <table className="w-full min-w-[640px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-border">
            {columns.map((col) => (
              <th
                key={col.key}
                style={{ width: col.width }}
                className={cn(
                  'px-4 py-3 text-[10.5px] font-bold tracking-wide text-muted-foreground uppercase',
                  alignClasses[col.align ?? 'left'],
                  col.hideBelow && hideBelowClasses[col.hideBelow],
                )}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row) => (
            <tr
              key={rowKey(row)}
              data-clickable={onRowClick ? 'true' : undefined}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              className={cn(
                'border-b border-border/60 transition-colors last:border-0',
                onRowClick && 'hover:bg-muted/50',
              )}
            >
              {columns.map((col) => (
                <td
                  key={col.key}
                  className={cn(
                    'px-4 py-3 text-foreground',
                    alignClasses[col.align ?? 'left'],
                    col.hideBelow && hideBelowClasses[col.hideBelow],
                  )}
                >
                  {col.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
