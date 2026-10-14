import { useSearchParams } from 'react-router-dom';
import { ModelCatalogTab } from '@/components/model-catalog-tab.js';
import { PageHeader } from '@/components/console-ui/PageHeader.js';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs.js';
import { useI18n } from '@/i18n/context.js';

type ModelTab = 'llm' | 'embed';

export function ModelsPage() {
  const { t } = useI18n();
  const m = t.models;
  const [searchParams, setSearchParams] = useSearchParams();
  const tab: ModelTab = searchParams.get('tab') === 'embed' ? 'embed' : 'llm';

  return (
    <div className="space-y-6">
      <PageHeader crumbs={[{ label: t.menu.models.title }]} />
      <p className="text-sm text-muted-foreground">{t.menu.models.hint}</p>

      <Tabs
        value={tab}
        onValueChange={(value) => setSearchParams({ tab: value }, { replace: true })}
      >
        <TabsList>
          <TabsTrigger value="llm">{m.tabLlm}</TabsTrigger>
          <TabsTrigger value="embed">{m.tabEmbed}</TabsTrigger>
        </TabsList>

        <TabsContent value="llm" className="mt-4">
          <ModelCatalogTab kind="llm" title={m.llmTitle} subtitle={m.llmSubtitle} />
        </TabsContent>

        <TabsContent value="embed" className="mt-4">
          <ModelCatalogTab kind="embed" title={m.embedTitle} subtitle={m.embedSubtitle} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
