import { Link } from 'react-router-dom';

import { cn } from '@/lib/utils.js';

export type DocsSection = {
  heading: string;
  paragraphs: readonly string[];
  bullets?: readonly string[];
};

export type DocsLink = {
  label: string;
  href: string;
  external?: boolean;
};

type DocsArticleProps = {
  title: string;
  description: string;
  sections: readonly DocsSection[];
  links?: readonly DocsLink[];
  className?: string;
};

export function DocsArticle({ title, description, sections, links, className }: DocsArticleProps) {
  return (
    <article className={cn('min-w-0 max-w-3xl', className)}>
      <header className="mb-8 border-b border-border pb-6">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">{title}</h1>
        <p className="mt-3 text-base leading-relaxed text-muted-foreground">{description}</p>
      </header>
      <div className="flex flex-col gap-8">
        {sections.map((section) => (
          <section key={section.heading}>
            <h2 className="text-lg font-semibold tracking-tight text-foreground">{section.heading}</h2>
            <div className="mt-3 space-y-3 text-sm leading-relaxed text-muted-foreground">
              {section.paragraphs.map((p) => (
                <p key={p}>{p}</p>
              ))}
            </div>
            {section.bullets?.length ? (
              <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-muted-foreground">
                {section.bullets.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            ) : null}
          </section>
        ))}
      </div>
      {links?.length ? (
        <nav className="mt-10 flex flex-col gap-2 border-t border-border pt-6" aria-label={title}>
          {links.map((link) =>
            link.external ? (
              <a
                key={link.href}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-medium text-foreground underline-offset-4 hover:underline"
              >
                {link.label}
              </a>
            ) : (
              <Link
                key={link.href}
                to={link.href}
                className="text-sm font-medium text-foreground underline-offset-4 hover:underline"
              >
                {link.label}
              </Link>
            ),
          )}
        </nav>
      ) : null}
    </article>
  );
}
