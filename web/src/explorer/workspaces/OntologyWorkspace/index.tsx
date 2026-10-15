import { useCallback, useEffect, useState } from "react";
import { BookMarked, HeartPulse, Sliders } from "lucide-react";
import { HealthTab } from "./HealthTab";
import { OntologyManager } from "./OntologyManager";
import { OntologyEditor } from "./OntologyEditor";
import { readOntologyUrlState, writeEntitySelection, writeTab } from "./ontologyUrlState";
import { OntologyKbProvider } from "./ontologyKb";

export type OntologyHubTab = "registry" | "editor" | "health";

const TABS: { id: OntologyHubTab; label: string; icon: typeof Sliders }[] = [
  { id: "registry", label: "Registry", icon: BookMarked },
  { id: "editor", label: "Editor", icon: Sliders },
  { id: "health", label: "Health", icon: HeartPulse },
];

function readInitialTab(): OntologyHubTab {
  const { tab, entityUri } = readOntologyUrlState();
  if (tab === "registry" || tab === "editor" || tab === "health") {
    return tab;
  }
  if (entityUri) return "editor";
  return "registry";
}

interface OntologyWorkspaceProps {
  kbId: string;
  onJumpToGraphNode?: (nodeId: string) => void;
  pageActionsHosted?: boolean;
  onPageActionsChange?: (actions: { openLoadOntology: () => void } | null) => void;
}

export function OntologyWorkspace({
  kbId,
  pageActionsHosted = false,
  onPageActionsChange,
}: OntologyWorkspaceProps) {
  const [activeTab, setActiveTab] = useState<OntologyHubTab>(readInitialTab);

  useEffect(() => {
    writeTab(activeTab);
  }, [activeTab]);

  const handleTabChange = useCallback((tab: OntologyHubTab) => {
    setActiveTab(tab);
  }, []);

  const handleFixInEditor = useCallback((entityUri: string) => {
    writeEntitySelection(entityUri);
    setActiveTab("editor");
  }, []);

  const renderTab = () => {
    switch (activeTab) {
      case "registry":
        return (
          <OntologyManager
            pageActionsHosted={pageActionsHosted}
            onHubPageActionsChange={onPageActionsChange}
          />
        );
      case "editor":
        return <OntologyEditor />;
      case "health":
        return <HealthTab onFixInEditor={handleFixInEditor} />;
    }
  };

  return (
    <OntologyKbProvider kbId={kbId}>
    <div className="ws-page">
      <div className="flex shrink-0 flex-wrap gap-1 border-b border-border bg-muted/30 px-4 py-2">
        {TABS.map(({ id, label, icon: Icon }) => {
          const active = activeTab === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => handleTabChange(id)}
              className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                active
                  ? "border-border bg-primary/10 text-foreground"
                  : "border-transparent text-muted-foreground hover:bg-muted/50 hover:text-foreground"
              }`}
            >
              <Icon size={13} />
              {label}
            </button>
          );
        })}
      </div>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{renderTab()}</div>
    </div>
    </OntologyKbProvider>
  );
}
