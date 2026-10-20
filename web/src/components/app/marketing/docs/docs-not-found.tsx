import { Link } from 'react-router-dom';

import { Button } from '@/components/ui/button.js';
import { useI18n } from '@/i18n/context.js';
import { fmt } from '@/i18n/format.js';

type DocsNotFoundProps = {
  path: string;
};

export function DocsNotFound({ path }: DocsNotFoundProps) {
  const { t } = useI18n();

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col items-start py-10">
      <p className="text-xs font-semibold tracking-[0.2em] text-muted-foreground">404</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight text-foreground">
        {t.docs.notFoundTitle}
      </h1>
      <p className="mt-3 text-base leading-relaxed text-muted-foreground">
        {fmt(t.docs.notFoundBody, { path })}
      </p>
      <div className="mt-6 flex flex-wrap gap-3">
        <Button asChild>
          <Link to="/docs">{t.docs.notFoundBack}</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link to="/docs/quickstart">{t.docs.notFoundQuickstart}</Link>
        </Button>
      </div>
    </div>
  );
}
