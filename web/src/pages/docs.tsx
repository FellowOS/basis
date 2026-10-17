import { Navigate, useParams } from 'react-router-dom';

import { DocsArticle } from '@/components/app/marketing/docs/docs-article.js';
import { DocsShell } from '@/components/app/marketing/docs/docs-shell.js';
import { useI18n } from '@/i18n/context.js';
import { DOC_SLUGS, docSlugFromParam, type DocSlug } from '@/lib/product-docs-nav.js';

function isDocSlug(value: string): value is DocSlug {
  return (DOC_SLUGS as readonly string[]).includes(value);
}

export function DocsPage() {
  const { slug: slugParam } = useParams();
  const { t } = useI18n();

  if (slugParam && !isDocSlug(slugParam)) {
    return <Navigate to="/docs" replace />;
  }

  const slug = docSlugFromParam(slugParam);
  const page = t.docs.pages[slug];

  return (
    <DocsShell activeSlug={slug}>
      <DocsArticle
        title={page.title}
        description={page.description}
        sections={page.sections}
        links={'links' in page && page.links ? page.links : undefined}
      />
    </DocsShell>
  );
}
