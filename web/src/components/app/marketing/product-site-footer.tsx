import { useI18n } from '@/i18n/context.js';
import { fmt } from '@/i18n/format.js';
import { cn } from '@/lib/utils.js';

type ProductSiteFooterProps = {
  className?: string;
  /** Keep copy in the left column on the split login hero (default). */
  splitLayout?: boolean;
};

export function ProductSiteFooter({ className, splitLayout = true }: ProductSiteFooterProps) {
  const { t } = useI18n();
  const m = t.marketing;
  const year = String(new Date().getFullYear());

  return (
    <footer
      id="self-host"
      className={cn(
        'relative z-10 shrink-0 scroll-mt-24 border-t border-border/50 px-5 py-3 text-[11px] text-muted-foreground sm:px-8 sm:text-xs',
        splitLayout && 'sm:pr-[62%] lg:pr-[58%]',
        className,
      )}
    >
      <p>{fmt(m.footerCopyright, { year })}</p>
    </footer>
  );
}
