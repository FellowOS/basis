import { HealthTab } from "./HealthTab";
import { OntologyManager } from "./OntologyManager";
import { OntologyEditor } from "./OntologyEditor";
import { writeEntitySelection } from "./ontologyUrlState";
import { OntologyKbProvider } from "./ontologyKb";

export type OntologyInteriorPanel = "registry" | "editor" | "health";

interface OntologyWorkspaceProps {
  kbId: string;
  panel: OntologyInteriorPanel;
  onJumpToGraphNode?: (nodeId: string) => void;
  pageActionsHosted?: boolean;
  onPageActionsChange?: (actions: { openLoadOntology: () => void } | null) => void;
  onFixInEditor?: (entityUri: string) => void;
}

export function OntologyWorkspace({
  kbId,
  panel,
  pageActionsHosted = false,
  onPageActionsChange,
  onFixInEditor,
}: OntologyWorkspaceProps) {
  const handleFixInEditor =
    onFixInEditor ??
    ((entityUri: string) => {
      writeEntitySelection(entityUri);
    });

  const renderPanel = () => {
    switch (panel) {
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
      <div className="ws-page flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{renderPanel()}</div>
      </div>
    </OntologyKbProvider>
  );
}
