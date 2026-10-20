import { Link } from 'react-router-dom';

import { useI18n } from '@/i18n/context.js';

export function CapabilitiesSection() {
  const { t } = useI18n();
  const m = t.marketing;

  return (
    <section
      id="capabilities"
      className="scroll-mt-14 border-t border-border/60 bg-background px-5 py-16 sm:scroll-mt-16 sm:px-8 lg:py-24"
    >
      <div className="w-full">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
          {m.capabilitiesEyebrow}
        </p>
        <h2 className="mt-4 font-display text-3xl font-semibold tracking-tight text-foreground whitespace-nowrap sm:text-4xl">
          {m.capabilitiesTitle}
        </h2>
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted-foreground">
          {m.capabilitiesSubhead}
        </p>

        <div className="mt-10 grid gap-5 sm:grid-cols-2 2xl:grid-cols-4">
          {m.highlights.map((item) => (
            <article
              key={item.index}
              className="flex flex-col rounded-xl border border-border/70 bg-card/50 p-5"
            >
              <div className="flex items-baseline justify-between gap-3">
                <span className="font-mono text-xs text-muted-foreground">{item.index}</span>
                <span className="rounded-full border border-border/70 px-2.5 py-0.5 text-[11px] text-muted-foreground">
                  {item.tag}
                </span>
              </div>
              <h3 className="mt-4 text-lg font-semibold tracking-tight text-foreground">
                {item.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.body}</p>
              <p className="mt-4 text-[11px] uppercase tracking-wide text-muted-foreground/80">
                {item.protocol}
              </p>
              <code className="mt-2 block overflow-x-auto rounded-md bg-muted/60 px-3 py-2 font-mono text-[11px] leading-relaxed text-foreground/80">
                {item.code}
              </code>
              <Link
                to={item.href}
                aria-label={`${item.title} — ${m.learnMore}`}
                className="mt-auto inline-flex items-center gap-1 pt-4 text-xs font-medium text-foreground underline-offset-4 hover:underline"
              >
                {m.learnMore}
                <span aria-hidden>→</span>
              </Link>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
