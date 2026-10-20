import { PublicIcon } from '@/components/app/shared/primitives/public-icon.js';
import { useI18n } from '@/i18n/context.js';

export function UseCasesSection() {
  const { t } = useI18n();
  const u = t.marketing.useCases;

  return (
    <section
      id="use-cases"
      className="scroll-mt-14 border-t border-border/60 bg-background px-5 py-16 sm:scroll-mt-16 sm:px-8 lg:py-24"
    >
      <div className="w-full">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
          {u.eyebrow}
        </p>
        <h2 className="mt-4 font-display text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          {u.title}
        </h2>

        <div className="mt-10 grid gap-5 sm:grid-cols-3">
          {u.items.map((item) => (
            <article
              key={item.title}
              className="flex flex-col rounded-xl border border-border/70 bg-card/50 p-5"
            >
              <span className="flex size-10 items-center justify-center rounded-lg border border-border/70 bg-background text-[var(--brand-primary,#d4880a)]">
                <PublicIcon name={item.icon} size={20} />
              </span>
              <h3 className="mt-4 text-base font-semibold tracking-tight text-foreground">
                {item.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.body}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
