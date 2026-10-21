import { Fragment } from 'react';
import { Link } from 'react-router-dom';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb.js';
import { useI18n } from '@/i18n/context.js';
import { cn } from '@/lib/utils.js';

export interface Crumb {
  label: string;
  to?: string;
}

export interface PageHeaderProps {
  crumbs: Crumb[];
  className?: string;
}

export function PageHeader({ crumbs, className }: PageHeaderProps) {
  const { t } = useI18n();

  return (
    <Breadcrumb
      aria-label={t.core.common.breadcrumbNavAria}
      className={cn('box-border flex h-(--console-chrome-row) shrink-0 items-center', className)}
    >
      <BreadcrumbList className="text-[12.5px]">
        {crumbs.map((item, i) => (
          <Fragment key={`${item.label}-${i}`}>
            {i > 0 ? <BreadcrumbSeparator /> : null}
            <BreadcrumbItem>
              {item.to ? (
                <BreadcrumbLink asChild>
                  <Link to={item.to}>{item.label}</Link>
                </BreadcrumbLink>
              ) : (
                <BreadcrumbPage>{item.label}</BreadcrumbPage>
              )}
            </BreadcrumbItem>
          </Fragment>
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
