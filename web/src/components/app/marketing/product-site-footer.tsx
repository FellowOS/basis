import { Link } from 'react-router-dom';

import { AppLogo } from '@/components/app/shared/shell/app-logo.js';
import { useI18n } from '@/i18n/context.js';
import { fmt } from '@/i18n/format.js';
import { cn } from '@/lib/utils.js';

type FooterLink = {
  label: string;
  to: string;
  external?: boolean;
};

function FooterColumn({ title, links }: { title: string; links: FooterLink[] }) {
  return (
    <nav aria-label={title}>
      <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">{title}</p>
      <ul className="mt-4 space-y-2 text-sm">
        {links.map((link) => (
          <li key={link.label}>
            {link.external ? (
              <a
                href={link.to}
                target="_blank"
                rel="noreferrer"
                className="text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
              >
                {link.label}
              </a>
            ) : (
              <Link
                to={link.to}
                className="text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
              >
                {link.label}
              </Link>
            )}
          </li>
        ))}
      </ul>
    </nav>
  );
}

type ProductSiteFooterProps = {
  className?: string;
};

export function ProductSiteFooter({ className }: ProductSiteFooterProps) {
  const { t } = useI18n();
  const m = t.home.marketing;
  const f = m.footer;
  const year = String(new Date().getFullYear());

  return (
    <footer className={cn('border-t border-border/60 bg-background px-5 py-12 sm:px-8', className)}>
      <div className="grid w-full gap-10 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div>
          <Link to="/" className="inline-flex items-center gap-2.5 text-foreground no-underline">
            <AppLogo size={24} label={m.brand} />
            <span className="font-display text-base font-semibold tracking-tight">{m.brand}</span>
          </Link>
          <p className="mt-3 max-w-xs text-sm leading-relaxed text-muted-foreground">
            {f.description}
          </p>
        </div>

        <FooterColumn
          title={f.product_title}
          links={[
            { label: f.product.product, to: '/#product' },
            { label: f.product.how_it_works, to: '/#how-it-works' },
            { label: f.product.capabilities, to: '/#capabilities' },
            { label: f.product.self_host, to: '/#self-host' },
          ]}
        />
        <FooterColumn
          title={f.developers_title}
          links={[
            { label: f.developers.docs, to: '/docs' },
            { label: f.developers.api, to: '/swagger' },
            { label: f.developers.spec, to: '/openapi/v1.json', external: true },
            {
              label: f.developers.github,
              to: 'https://github.com/coldbuffer/basis',
              external: true,
            },
          ]}
        />
        <FooterColumn
          title={f.resources_title}
          links={[
            { label: f.resources.deployment, to: '/docs/deployment' },
            { label: f.resources.quickstart, to: '/docs/quickstart' },
            {
              label: f.resources.license,
              to: 'https://github.com/coldbuffer/basis/blob/main/LICENSE',
              external: true,
            },
            {
              label: f.resources.security,
              to: 'https://github.com/coldbuffer/basis/blob/main/SECURITY.md',
              external: true,
            },
          ]}
        />
      </div>

      <div className="mt-10 flex flex-col gap-1 border-t border-border/50 pt-4 text-[11px] text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <p>{fmt(m.footer_copyright, { year })}</p>
        <p>{m.footer_tagline}</p>
      </div>
    </footer>
  );
}
