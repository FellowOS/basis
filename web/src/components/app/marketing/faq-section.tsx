import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion.js';
import { useI18n } from '@/i18n/context.js';
import { i18nIndexedList } from '@/i18n/indexed-list.js';

export function FaqSection() {
  const { t } = useI18n();
  const f = t.home.marketing.faq;

  return (
    <section
      id="faq"
      className="scroll-mt-14 border-t border-border/60 bg-muted/20 px-5 py-16 sm:scroll-mt-16 sm:px-8 lg:py-24"
    >
      <div className="grid w-full gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
            {f.eyebrow}
          </p>
          <h2 className="mt-4 max-w-md font-display text-3xl font-semibold tracking-tight text-foreground sm:max-w-none sm:text-4xl sm:whitespace-nowrap">
            {f.title}
          </h2>
        </div>

        <Accordion type="single" collapsible className="w-full">
          {i18nIndexedList(f.items).map((item) => (
            <AccordionItem key={item.q} value={item.q}>
              <AccordionTrigger className="text-base">{item.q}</AccordionTrigger>
              <AccordionContent className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
                {item.a}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}
