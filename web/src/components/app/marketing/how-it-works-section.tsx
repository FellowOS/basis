import { Link } from 'react-router-dom';

import { Button } from '@/components/ui/button.js';
import { useI18n } from '@/i18n/context.js';
import { i18nIndexedList } from '@/i18n/indexed-list.js';

import { ProductPreview } from './product-preview.js';

export function HowItWorksSection() {
  const { t } = useI18n();
  const h = t.home.marketing.how_it_works;

  return (
    <section
      id="how-it-works"
      className="scroll-mt-14 border-t border-border/60 bg-muted/20 px-5 py-16 sm:scroll-mt-16 sm:px-8 lg:py-24"
    >
      <div className="grid w-full gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
            {h.eyebrow}
          </p>
          <h2 className="mt-4 max-w-xl font-display text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            {h.title}
          </h2>
          <p className="mt-4 max-w-xl text-base leading-relaxed text-muted-foreground">{h.subhead}</p>

          <div className="mt-8 space-y-8">
            {i18nIndexedList(h.steps).map((step) => (
              <div key={step.index} className="relative flex gap-4">
                <span className="relative z-10 flex size-9 shrink-0 items-center justify-center rounded-full border border-border bg-background font-mono text-[11px] text-muted-foreground">
                  {step.index}
                </span>
                <div className="min-w-0">
                  <h3 className="text-base font-semibold tracking-tight text-foreground">{step.title}</h3>
                  <p className="mt-1 max-w-lg text-sm leading-relaxed text-muted-foreground">
                    {step.body}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <Button variant="outline" asChild className="mt-8">
            <Link to="/docs/concepts">{h.cta}</Link>
          </Button>
        </div>

        <ProductPreview />
      </div>
    </section>
  );
}
