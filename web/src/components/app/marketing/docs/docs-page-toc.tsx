import { useEffect, useState } from 'react';

import { useI18n } from '@/i18n/context.js';
import { cn } from '@/lib/utils.js';

type TocItem = {
  id: string;
  text: string;
};

type DocsPageTocProps = {
  className?: string;
};

export function DocsPageToc({ className }: DocsPageTocProps) {
  const { t } = useI18n();
  const [items, setItems] = useState<TocItem[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    const article = document.querySelector('[data-doc-article]');
    if (!article) return;

    let scrollSpy: IntersectionObserver | undefined;

    const scanHeadings = () => {
      const headings = Array.from(article.querySelectorAll('h2[id]'));
      const toc = headings
        .map((el) => ({
          id: el.id,
          text: el.textContent?.trim() ?? el.id,
        }))
        .filter((item) => item.text.length > 0);

      setItems(toc);

      scrollSpy?.disconnect();
      if (headings.length === 0) return;

      scrollSpy = new IntersectionObserver(
        (entries) => {
          const visible = entries
            .filter((entry) => entry.isIntersecting)
            .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
          if (visible[0]?.target.id) {
            setActiveId(visible[0].target.id);
          }
        },
        { rootMargin: '-20% 0px -70% 0px', threshold: [0, 1] },
      );

      for (const heading of headings) {
        scrollSpy.observe(heading);
      }
    };

    scanHeadings();

    // MarkdownHooks renders headings after Shiki (async); rescan when article DOM updates.
    const domObserver = new MutationObserver(() => {
      scanHeadings();
    });
    domObserver.observe(article, { childList: true, subtree: true });

    return () => {
      domObserver.disconnect();
      scrollSpy?.disconnect();
    };
  }, []);

  if (items.length < 2) return null;

  return (
    <nav aria-label={t.docs.page.toc_aria} className={cn('text-sm', className)}>
      <p className="mb-3 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
        {t.docs.page.toc_title}
      </p>
      <ul className="space-y-1.5 border-l border-border pl-3">
        {items.map((item) => (
          <li key={item.id}>
            <a
              href={`#${item.id}`}
              className={cn(
                'block py-0.5 leading-snug break-words transition-colors',
                activeId === item.id
                  ? 'font-medium text-foreground'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {item.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
