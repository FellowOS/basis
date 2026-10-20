import { Link } from 'react-router-dom';

import { Button } from '@/components/ui/button.js';
import { useI18n } from '@/i18n/context.js';

const COMMANDS = [
  'git clone https://github.com/fellowos/basis.git',
  'cd basis && cp .env.example .env',
  'uv sync --extra dev && uv run basis',
  'cd web && npm install && npm run dev',
].join('\n');

export function SelfHostSection() {
  const { t } = useI18n();
  const m = t.marketing;

  return (
    <section
      id="self-host"
      className="scroll-mt-14 border-t border-border/60 bg-muted/20 px-5 py-16 sm:scroll-mt-16 sm:px-8 lg:py-24"
    >
      <div className="grid w-full gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
            {m.selfHostEyebrow}
          </p>
          <h2 className="mt-4 font-display text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            {m.selfHostTitle}
          </h2>
          <p className="mt-4 max-w-xl text-base leading-relaxed text-muted-foreground">
            {m.selfHostBody}
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button asChild>
              <Link to="/docs/deployment">{m.selfHostDocs}</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/docs/quickstart">{m.selfHostQuickstart}</Link>
            </Button>
            <Button variant="ghost" asChild>
              <a href="https://github.com/fellowos/basis" target="_blank" rel="noreferrer">
                {m.selfHostGithub}
              </a>
            </Button>
          </div>
        </div>

        <div className="max-w-2xl rounded-xl border border-border/70 bg-card/60 p-5 shadow-sm">
          <div className="flex items-center gap-1.5" aria-hidden>
            <span className="size-2 rounded-full bg-red-400/70" />
            <span className="size-2 rounded-full bg-amber-400/70" />
            <span className="size-2 rounded-full bg-emerald-400/70" />
          </div>
          <pre className="mt-4 overflow-x-auto font-mono text-[11px] leading-relaxed text-foreground/80">
            {COMMANDS}
          </pre>
        </div>
      </div>
    </section>
  );
}
