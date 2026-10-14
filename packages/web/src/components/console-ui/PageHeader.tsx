import { Link } from 'react-router-dom';
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
  return (
    <nav
      className={cn(
        'console-page-header flex items-center gap-1.5 text-[12.5px] text-muted-foreground',
        className,
      )}
    >
      {crumbs.map((item, i) => (
        <span key={item.to ?? item.label} className="flex items-center gap-1.5">
          {i > 0 && <span className="text-muted-foreground/70">/</span>}
          {item.to ? (
            <Link to={item.to} className="hover:text-foreground">
              {item.label}
            </Link>
          ) : (
            <span className="font-semibold text-foreground">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
