import { useMemo } from 'react';
import { PublicIcon } from '@/components/ui/public-icon.js';
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
} from '@/components/ui/pagination.js';
import { useI18n } from '@/i18n/context.js';
import { cn } from '@/lib/utils.js';

export function getVisiblePages(page: number, totalPages: number): (number | 'ellipsis')[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }
  if (page <= 4) {
    return [1, 2, 3, 4, 5, 'ellipsis', totalPages];
  }
  if (page >= totalPages - 3) {
    return [
      1,
      'ellipsis',
      totalPages - 4,
      totalPages - 3,
      totalPages - 2,
      totalPages - 1,
      totalPages,
    ];
  }
  return [1, 'ellipsis', page - 1, page, page + 1, 'ellipsis', totalPages];
}

export function TablePagination({
  page,
  totalPages,
  onPageChange,
  className,
}: {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  className?: string;
}) {
  const { t } = useI18n();
  const visiblePages = useMemo(() => getVisiblePages(page, totalPages), [page, totalPages]);

  return (
    <Pagination className={cn('mx-0 w-auto justify-end', className)}>
      <PaginationContent>
        <PaginationItem>
          <PaginationLink
            size="default"
            href="#"
            aria-label={t.common.paginationPreviousAria}
            className={cn('gap-1 px-2.5 sm:pl-2.5', page <= 1 && 'pointer-events-none opacity-50')}
            onClick={(event) => {
              event.preventDefault();
              if (page > 1) onPageChange(Math.max(1, page - 1));
            }}
          >
            <PublicIcon name="chevron-left" size={16} />
            <span className="hidden sm:block">{t.common.paginationPrevious}</span>
          </PaginationLink>
        </PaginationItem>
        {visiblePages.map((item, index) =>
          item === 'ellipsis' ? (
            <PaginationItem key={`ellipsis-${index}`}>
              <PaginationEllipsis />
            </PaginationItem>
          ) : (
            <PaginationItem key={item}>
              <PaginationLink
                href="#"
                isActive={item === page}
                onClick={(event) => {
                  event.preventDefault();
                  onPageChange(item);
                }}
              >
                {item}
              </PaginationLink>
            </PaginationItem>
          ),
        )}
        <PaginationItem>
          <PaginationLink
            size="default"
            href="#"
            aria-label={t.common.paginationNextAria}
            className={cn(
              'gap-1 px-2.5 sm:pr-2.5',
              page >= totalPages && 'pointer-events-none opacity-50',
            )}
            onClick={(event) => {
              event.preventDefault();
              if (page < totalPages) onPageChange(Math.min(totalPages, page + 1));
            }}
          >
            <span className="hidden sm:block">{t.common.paginationNext}</span>
            <PublicIcon name="chevron-right" size={16} />
          </PaginationLink>
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  );
}

export function DataPanelTableFooter({
  countLabel,
  page,
  totalPages,
  onPageChange,
}: {
  countLabel: string;
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}) {
  return (
    <div className="flex flex-col gap-3 border-t border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-xs text-muted-foreground">{countLabel}</p>
      {totalPages > 1 ? (
        <TablePagination page={page} totalPages={totalPages} onPageChange={onPageChange} />
      ) : null}
    </div>
  );
}
