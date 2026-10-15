import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ConsolePageLayout } from '@/components/console-ui/index.js';
import { ModelCatalogTab } from '@/components/model-catalog-tab.js';
import { Button } from '@/components/ui/button.js';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs.js';
import { useI18n } from '@/i18n/context.js';

type ModelTab = 'llm' | 'embed';

export function ModelsPage() {
  const { t } = useI18n();
  const m = t.models;
  const [searchParams, setSearchParams] = useSearchParams();
  const tab: ModelTab = searchParams.get('tab') === 'embed' ? 'embed' : 'llm';
  const [addOpen, setAddOpen] = useState(false);

  const tabSubtitle = tab === 'embed' ? m.embedSubtitle : m.llmSubtitle;

  return (
    <ConsolePageLayout
      crumbs={[{ label: t.menu.models.title }]}
      subtitle={tabSubtitle}
      actions={
        <Button type="button" size="sm" onClick={() => setAddOpen(true)}>
          {m.addModel}
        </Button>
      }
    >
      <Tabs
        value={tab}
        onValueChange={(value) => {
          setAddOpen(false);
          setSearchParams({ tab: value }, { replace: true });
        }}
      >
        <TabsList>
          <TabsTrigger value="llm">{m.tabLlm}</TabsTrigger>
          <TabsTrigger value="embed">{m.tabEmbed}</TabsTrigger>
        </TabsList>

        <TabsContent value="llm" className="mt-4">
          <ModelCatalogTab kind="llm" addOpen={addOpen} onAddOpenChange={setAddOpen} />
        </TabsContent>

        <TabsContent value="embed" className="mt-4">
          <ModelCatalogTab kind="embed" addOpen={addOpen} onAddOpenChange={setAddOpen} />
        </TabsContent>
      </Tabs>
    </ConsolePageLayout>
  );
}
