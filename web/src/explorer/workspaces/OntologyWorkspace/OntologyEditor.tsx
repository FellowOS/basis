import { useCallback, useEffect, useState } from "react";
import { explorerFetch } from "../../host/explorerHttp";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  MarkerType,
  Handle,
  Position,
} from "@xyflow/react";
import type { Connection, Edge, Node, ReactFlowInstance } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  Plus,
  GitBranch,
  User,
  Shield,
  FileText,
  Layout,
  Send,
  Pencil,
  Trash2,
} from "lucide-react";
import {
  explorerApiErrorMessage,
  parseExplorerJson,
} from "../../lib/explorer-api-error";
import { loadOntologyEntityOwner, loadOntologyGraph, loadOntologyRegistry } from "./api";
import { ontologyPath, useOntologyKbId } from "./ontologyKb";
import type { OntologyGraphEdge, OntologyGraphNode } from "./api";
import {
  isEditableEntityType,
  ONTOLOGY_MINIMAP_THEME,
  resolveEditorOntology,
} from "./ontologyEditorModel";
import type { EditorEntityType, RegistryEntry } from "./ontologyEditorModel";
import { Button } from "@/components/ui/button.js";
import { Input } from "@/components/ui/input.js";
import { Label } from "@/components/ui/label.js";
import { clearEntitySelection, readOntologyUrlState, writeEntitySelection } from "./ontologyUrlState";

type OntologyNodeData = {
  label?: string;
  type?: string;
  entityType?: EditorEntityType;
};

type OntologyNode = Node<OntologyNodeData>;
type OntologyEdge = Edge<Record<string, unknown>>;

const nodeHandleClass =
  "!h-2 !w-2 !border-border !bg-primary";

const nodeTypes = {
  classNode: ({ data }: { data: OntologyNodeData }) => (
    <div className="min-w-[140px] rounded-lg border border-border bg-card px-4 py-3 text-center text-sm font-semibold text-foreground shadow-sm">
      <Handle type="target" position={Position.Left} className={nodeHandleClass} />
      <div className="mb-1 text-sm font-bold">{data.label}</div>
      <div className="text-xs font-medium text-muted-foreground">{data.type}</div>
      <Handle type="source" position={Position.Right} className={nodeHandleClass} />
    </div>
  ),
};

const ontologyFlowThemeCss = `
  .ontology-editor-flow.react-flow {
    width: 100%;
    height: 100%;
    min-height: 0;
    background: var(--background);
  }

  .ontology-editor-flow .react-flow__controls {
    overflow: hidden;
    border: 1px solid var(--border);
    border-radius: 9px;
    background: var(--card);
    box-shadow: var(--shadow);
  }

  .ontology-editor-flow .react-flow__controls-button {
    width: 30px;
    height: 30px;
    background: transparent;
    border-bottom-color: var(--border);
    color: var(--muted-foreground);
    transition: color 140ms ease, background 140ms ease;
  }

  .ontology-editor-flow .react-flow__controls-button:hover {
    background: color-mix(in oklch, var(--primary) 12%, var(--card));
    color: var(--foreground);
  }

  .ontology-editor-flow .react-flow__controls-button:focus-visible {
    position: relative;
    z-index: 1;
    outline: 2px solid var(--ring);
    outline-offset: -2px;
  }

  .ontology-editor-flow .react-flow__controls-button:disabled {
    background: var(--muted);
    color: var(--muted-foreground);
    opacity: 0.6;
  }
`;

const canvasMessageClassName =
  "pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-lg border border-border bg-card/95 px-3.5 py-2.5 text-sm text-muted-foreground shadow-sm";

const contextItemClassName =
  "flex w-full cursor-pointer items-center gap-2.5 px-4 py-2 text-left text-sm text-foreground transition-colors hover:bg-muted";

interface DraftDiff {
  added_classes: string[];
  removed_classes: string[];
  modified_classes: Record<string, Record<string, any>>;
  added_properties: string[];
  removed_properties: string[];
  modified_properties: Record<string, Record<string, any>>;
  added_restrictions: Record<string, any>[];
  removed_restrictions: Record<string, any>[];
  added_axioms: Record<string, any>[];
  removed_axioms: Record<string, any>[];
  annotation_changes: Record<string, Record<string, any>>;
}

function requestedEntityUri(): string {
  return readOntologyUrlState().entityUri || "";
}

function nodeLabel(node: OntologyGraphNode): string {
  const explicit = String(node.content || node.properties?.["rdfs:label"] || "").trim();
  if (explicit && explicit !== node.id) {
    return explicit;
  }
  const trimmed = node.id.replace(/[/#]+$/, "");
  return trimmed.split("#").pop() || trimmed.split("/").pop() || node.id;
}

// The backend's remaining kinds (concept, scheme, individual, unknown) have no
// editor affordances, so they collapse into the read-only "external" kind. That
// reading belongs here rather than on the wire: "external reference material"
// is what the editor does about an unnameable type, not what the type is.
function classifyEditorNode(node: OntologyGraphNode): OntologyNodeData["entityType"] {
  switch (node.entity_type) {
    case "ontology":
    case "class":
    case "property":
      return node.entity_type;
    default:
      return "external";
  }
}

const LAYOUT_COL_GAP = 196;
const LAYOUT_ROW_GAP = 104;
const LAYOUT_PAD = 36;

function gridColumns(count: number, maxCols: number): number {
  if (count <= 0) return 1;
  return Math.min(maxCols, Math.max(1, Math.ceil(Math.sqrt(count))));
}

/** Place nodes in a compact grid (avoids single-column strips that grow with node count). */
function placeNodeGrid(
  nodes: OntologyNode[],
  startX: number,
  startY: number,
  maxCols: number,
  positions: Map<string, { x: number; y: number }>,
): { width: number; height: number } {
  if (!nodes.length) return { width: 0, height: 0 };
  const cols = gridColumns(nodes.length, maxCols);
  nodes.forEach((node, index) => {
    const col = index % cols;
    const row = Math.floor(index / cols);
    positions.set(node.id, {
      x: startX + col * LAYOUT_COL_GAP,
      y: startY + row * LAYOUT_ROW_GAP,
    });
  });
  const rows = Math.ceil(nodes.length / cols);
  return {
    width: cols * LAYOUT_COL_GAP,
    height: rows * LAYOUT_ROW_GAP,
  };
}

function layoutEditorNodes(inputNodes: OntologyNode[]): OntologyNode[] {
  const ontologies = inputNodes.filter((node) => node.data.entityType === "ontology");
  const properties = inputNodes.filter((node) => node.data.entityType === "property");
  const classes = inputNodes.filter((node) => (
    node.data.entityType === "class" || node.data.entityType === "external"
  ));
  const positions = new Map<string, { x: number; y: number }>();

  let y = LAYOUT_PAD;
  if (ontologies.length) {
    const band = placeNodeGrid(ontologies, LAYOUT_PAD, y, 4, positions);
    y += band.height + LAYOUT_ROW_GAP;
  }

  const propBand = placeNodeGrid(properties, LAYOUT_PAD, y, 4, positions);
  const classStartX = properties.length
    ? LAYOUT_PAD + propBand.width + 80
    : LAYOUT_PAD;
  placeNodeGrid(classes, classStartX, y, 6, positions);

  return inputNodes.map((node) => ({
    ...node,
    position: positions.get(node.id) ?? node.position,
  }));
}

function buildEditorElements(apiNodes: OntologyGraphNode[], apiEdges: OntologyGraphEdge[]) {
  const sortedNodes = [...apiNodes].sort((left, right) => {
    const typeDelta = left.type.localeCompare(right.type);
    return typeDelta || left.id.localeCompare(right.id);
  });
  const nodes = layoutEditorNodes(sortedNodes.map((node) => ({
    id: node.id,
    type: "classNode",
    position: { x: 0, y: 0 },
    data: {
      label: nodeLabel(node),
      type: node.type,
      entityType: classifyEditorNode(node),
    },
  })));
  const edges: OntologyEdge[] = apiEdges.map((edge, index) => ({
    id: edge.id || `${edge.source}:${edge.type}:${edge.target}:${index}`,
    source: edge.source,
    target: edge.target,
    label: edge.type,
    type: "default",
    markerEnd: { type: MarkerType.ArrowClosed },
    style: { stroke: "var(--border)", strokeWidth: 1.5 },
    labelStyle: { fill: "var(--foreground)", fontSize: 11, fontWeight: 600 },
    labelBgStyle: { fill: "var(--card)", fillOpacity: 0.95 },
  }));
  return { nodes, edges };
}

export function OntologyEditor() {
  const kbId = useOntologyKbId();
  const [nodes, setNodes, onNodesChange] = useNodesState<OntologyNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<OntologyEdge>([]);
  const [selectedElement, setSelectedElement] = useState<OntologyNode | OntologyEdge | null>(null);
  const hasDetailPanel = selectedElement !== null;
  const [registry, setRegistry] = useState<RegistryEntry[]>([]);
  const [ontologyUri, setOntologyUri] = useState<string>("");
  const [flowInstance, setFlowInstance] = useState<ReactFlowInstance<OntologyNode, OntologyEdge> | null>(null);
  const [isLoadingGraph, setIsLoadingGraph] = useState(false);
  const [graphError, setGraphError] = useState("");
  const [unownedEntity, setUnownedEntity] = useState("");
  const [draftDiff, setDraftDiff] = useState<DraftDiff>({
    added_classes: [],
    removed_classes: [],
    modified_classes: {},
    added_properties: [],
    removed_properties: [],
    modified_properties: {},
    added_restrictions: [],
    removed_restrictions: [],
    added_axioms: [],
    removed_axioms: [],
    annotation_changes: {},
  });
  const [isSaving, setIsSaving] = useState(false);
  const [showContext, setShowContext] = useState<{ x: number; y: number; type: string; element: OntologyNode | OntologyEdge } | null>(null);

  useEffect(() => {
    let cancelled = false;
    const requested = requestedEntityUri();
    Promise.all([
      loadOntologyRegistry(kbId).catch(() => [] as RegistryEntry[]),
      requested
        ? loadOntologyEntityOwner(kbId, requested).catch(() => undefined)
        : Promise.resolve(undefined),
    ])
      .then(([entries, ownerVerdict]: [RegistryEntry[], string | null | undefined]) => {
        if (cancelled) return;
        setRegistry(entries);
        const resolution = resolveEditorOntology(entries, requested, ownerVerdict);
        // The registry default is the right landing place for "no entity asked
        // for", but not for "the backend says nothing owns the entity that was
        // asked for" — that would open an arbitrary ontology whose graph
        // excludes the entity, and report nothing about why.
        if (resolution.status === "unowned") {
          setUnownedEntity(resolution.entityUri);
          return;
        }
        setUnownedEntity("");
        const resolvedOntology = resolution.status === "resolved" ? resolution.uri : undefined;
        setOntologyUri((current) => current || resolvedOntology || entries[0]?.uri || "");
      })
      .catch((error) => {
        console.error("Failed to load ontology registry:", error);
      });
    return () => {
      cancelled = true;
    };
  }, [kbId]);

  useEffect(() => {
    if (!ontologyUri) {
      setNodes([]);
      setEdges([]);
      setSelectedElement(null);
      return;
    }

    const controller = new AbortController();
    setIsLoadingGraph(true);
    setGraphError("");
    loadOntologyGraph(kbId, ontologyUri, controller.signal)
      .then((payload) => {
        const elements = buildEditorElements(payload.nodes, payload.edges);
        setNodes(elements.nodes);
        setEdges(elements.edges);
        const requested = requestedEntityUri();
        setSelectedElement(elements.nodes.find((node) => node.id === requested) || null);
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        setNodes([]);
        setEdges([]);
        setSelectedElement(null);
        setGraphError(explorerApiErrorMessage(error));
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoadingGraph(false);
      });

    return () => controller.abort();
  }, [kbId, ontologyUri, setEdges, setNodes]);

  useEffect(() => {
    if (!flowInstance || nodes.length === 0) return;
    const frame = window.requestAnimationFrame(() => {
      void flowInstance.fitView({ padding: 0.22, duration: 320, maxZoom: 1.25 });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [flowInstance, hasDetailPanel, nodes.length, ontologyUri]);

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge({ ...params, markerEnd: { type: MarkerType.ArrowClosed } }, eds)),
    [setEdges]
  );

  const addClass = useCallback(() => {
    const newId = `class_${Date.now()}`;
    const newNode: OntologyNode = {
      id: newId,
      type: "classNode",
      position: { x: Math.random() * 400, y: Math.random() * 300 },
      data: { label: "NewClass", type: "owl:Class", entityType: "class" },
    };
    setNodes((nds) => [...nds, newNode]);
    setDraftDiff((prev) => ({
      ...prev,
      added_classes: [...prev.added_classes, newId],
    }));
  }, [setNodes]);

  const addProperty = useCallback(() => {
    if (nodes.length < 2) {
      alert("Add at least two classes before creating a property edge.");
      return;
    }
    const newId = `prop_${Date.now()}`;
    const newEdge: OntologyEdge = {
      id: newId,
      source: nodes[0].id,
      target: nodes[1].id,
      label: "hasProperty",
      type: "smoothstep",
      animated: true,
    };
    setEdges((eds) => [...eds, newEdge]);
    setDraftDiff((prev) => ({
      ...prev,
      added_properties: [...prev.added_properties, newId],
    }));
  }, [nodes, setEdges]);

  const addIndividual = useCallback(() => {
    const newId = `ind_${Date.now()}`;
    const newNode: OntologyNode = {
      id: newId,
      type: "classNode",
      position: { x: Math.random() * 400, y: Math.random() * 300 },
      data: { label: "NewIndividual", type: "owl:NamedIndividual", entityType: "external" },
    };
    setNodes((nds) => [...nds, newNode]);
  }, [setNodes]);

  const addRestriction = useCallback(() => {
    setDraftDiff((prev) => ({
      ...prev,
      added_restrictions: [...prev.added_restrictions, { type: "someValuesFrom", value: "" }],
    }));
  }, []);

  const addAxiom = useCallback(() => {
    setDraftDiff((prev) => ({
      ...prev,
      added_axioms: [...prev.added_axioms, { type: "subClassOf", value: "" }],
    }));
  }, []);

  const autoLayout = useCallback(() => {
    setNodes(layoutEditorNodes(nodes));
  }, [nodes, setNodes]);

  const selectNode = useCallback((node: OntologyNode) => {
    setSelectedElement(node);
    writeEntitySelection(node.id);
  }, []);

  const saveDraft = useCallback(async () => {
    if (!ontologyUri) {
      alert("Please select an ontology first");
      return;
    }
    setIsSaving(true);
    try {
      const response = await explorerFetch(ontologyPath(kbId, "draft"), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ontology_uri: ontologyUri,
          diff: draftDiff,
          author: "user",
          summary: "Visual editor changes",
        }),
      });
      const data = await parseExplorerJson<{ draft_id: string }>(response, "Failed to save draft");
      alert(`Draft saved: ${data.draft_id}`);
    } catch (error) {
      console.error("Failed to save draft:", error);
      alert(explorerApiErrorMessage(error));
    } finally {
      setIsSaving(false);
    }
  }, [kbId, ontologyUri, draftDiff]);

  const handleNodeContextMenu = useCallback((event: React.MouseEvent, node: OntologyNode) => {
    event.preventDefault();
    setSelectedElement(node);
    setShowContext({ x: event.clientX, y: event.clientY, type: "node", element: node });
  }, []);

  const handleEdgeContextMenu = useCallback((event: React.MouseEvent, edge: OntologyEdge) => {
    event.preventDefault();
    setSelectedElement(edge);
    setShowContext({ x: event.clientX, y: event.clientY, type: "edge", element: edge });
  }, []);

  const deleteSelected = useCallback(() => {
    const target = showContext?.element ?? selectedElement;
    if (target) {
      if ("source" in target) {
        setEdges((eds) => eds.filter((e) => e.id !== target.id));
        setDraftDiff((prev) => ({
          ...prev,
          removed_properties: [...prev.removed_properties, target.id],
        }));
      } else if (isEditableEntityType(target.data.entityType)) {
        setNodes((nds) => nds.filter((n) => n.id !== target.id));
        setDraftDiff((prev) => target.data.entityType === "property"
          ? { ...prev, removed_properties: [...prev.removed_properties, target.id] }
          : { ...prev, removed_classes: [...prev.removed_classes, target.id] });
      }
      setSelectedElement(null);
    }
    setShowContext(null);
  }, [selectedElement, setNodes, setEdges, showContext]);

  const renameSelected = useCallback(() => {
    const target = showContext?.element ?? selectedElement;
    if (target && !("source" in target) && isEditableEntityType(target.data.entityType)) {
      const newLabel = prompt("Enter new name:", String(target.data.label ?? ""));
      if (newLabel) {
        setNodes((nds) =>
          nds.map((n) => (n.id === target.id ? { ...n, data: { ...n.data, label: newLabel } } : n))
        );
        setDraftDiff((prev) => target.data.entityType === "property"
          ? {
              ...prev,
              modified_properties: { ...prev.modified_properties, [target.id]: { label: newLabel } },
            }
          : {
              ...prev,
              modified_classes: { ...prev.modified_classes, [target.id]: { label: newLabel } },
            });
      }
    }
    setShowContext(null);
  }, [selectedElement, setNodes, showContext]);

  useEffect(() => {
    const handleClick = () => setShowContext(null);
    window.addEventListener("click", handleClick);
    return () => window.removeEventListener("click", handleClick);
  }, []);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-background">
      <style>{ontologyFlowThemeCss}</style>
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border bg-card px-4 py-3">
        <select
          aria-label="Active ontology"
          value={ontologyUri}
          onChange={(event) => {
            setOntologyUri(event.target.value);
            setSelectedElement(null);
            setUnownedEntity("");
            clearEntitySelection();
          }}
          className="min-w-[260px] rounded-md border border-input bg-background px-3 py-2 text-xs text-foreground"
        >
          <option value="">Select ontology...</option>
          {registry.map((entry) => (
            <option key={entry.uri} value={entry.uri}>
              {entry.name || entry.uri}
            </option>
          ))}
        </select>
        <Button type="button" size="sm" variant="outline" className="h-8" onClick={addClass}>
          <Plus size={14} />
          Add Class
        </Button>
        <Button type="button" size="sm" variant="outline" className="h-8" onClick={addProperty} disabled={nodes.length < 2}>
          <GitBranch size={14} />
          Add Property
        </Button>
        <Button type="button" size="sm" variant="outline" className="h-8" onClick={addIndividual}>
          <User size={14} />
          Add Individual
        </Button>
        <Button type="button" size="sm" variant="outline" className="h-8" onClick={addRestriction}>
          <Shield size={14} />
          Add Restriction
        </Button>
        <Button type="button" size="sm" variant="outline" className="h-8" onClick={addAxiom}>
          <FileText size={14} />
          Add Axiom
        </Button>
        <Button type="button" size="sm" variant="outline" className="h-8" onClick={autoLayout}>
          <Layout size={14} />
          Auto Layout
        </Button>
        <div className="flex-1" />
        <Button type="button" size="sm" className="h-8" onClick={saveDraft} disabled={isSaving}>
          <Send size={14} />
          {isSaving ? "Saving..." : "Propose"}
        </Button>
      </div>

      <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden">
        <div className="relative min-h-[min(58vh,680px)] w-full min-w-0 flex-1 overflow-hidden">
          <div className="absolute inset-0">
            <ReactFlow
              className="ontology-editor-flow h-full w-full"
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onInit={setFlowInstance}
              onNodeClick={(_, node) => selectNode(node)}
              onEdgeClick={(_, edge) => setSelectedElement(edge)}
              onNodeContextMenu={handleNodeContextMenu}
              onEdgeContextMenu={handleEdgeContextMenu}
              nodeTypes={nodeTypes}
              fitView
            >
              <Background color="var(--border)" gap={20} />
              <Controls />
              <MiniMap {...ONTOLOGY_MINIMAP_THEME} />
            </ReactFlow>
          </div>

          {isLoadingGraph && (
            <div className={canvasMessageClassName}>Loading ontology structure…</div>
          )}
          {!isLoadingGraph && graphError && (
            <div className={`${canvasMessageClassName} text-destructive`}>{graphError}</div>
          )}
          {!isLoadingGraph && !graphError && unownedEntity && (
            <div className={`${canvasMessageClassName} text-warn`}>
              No registered ontology owns {unownedEntity}. Pick an ontology above to start editing.
            </div>
          )}
          {!isLoadingGraph && !graphError && !unownedEntity && !ontologyUri && (
            <div className={canvasMessageClassName}>
              Select an ontology from the dropdown above to view and edit its structure.
            </div>
          )}
          {!isLoadingGraph && !graphError && !unownedEntity && ontologyUri && nodes.length === 0 && (
            <div className={canvasMessageClassName}>This ontology has no editable classes or properties.</div>
          )}

          {showContext && (
            <div
              className="fixed z-[1000] min-w-[180px] rounded-lg border border-border bg-popover py-1 shadow-lg"
              style={{ left: showContext.x, top: showContext.y }}
            >
              {"source" in showContext.element || isEditableEntityType(showContext.element.data.entityType) ? (
                <>
                  {!("source" in showContext.element) && (
                    <button type="button" className={contextItemClassName} onClick={renameSelected}>
                      <Pencil size={14} />
                      Rename
                    </button>
                  )}
                  <button type="button" className={contextItemClassName} onClick={deleteSelected}>
                    <Trash2 size={14} />
                    Delete
                  </button>
                </>
              ) : (
                <div className={`${contextItemClassName} cursor-default text-muted-foreground`}>
                  This term is read-only
                </div>
              )}
            </div>
          )}
        </div>

        {selectedElement && (
          <aside className="box-border w-80 min-w-80 shrink-0 overflow-auto border-l border-border bg-card p-5">
            <h3 className="mb-4 text-base font-semibold text-foreground">
              {"source" in selectedElement
                ? "Relationship Details"
                : selectedElement.data.entityType === "property"
                  ? "Property Details"
                  : selectedElement.data.entityType === "ontology"
                    ? "Ontology Details"
                    : selectedElement.data.entityType === "external"
                      ? "External Term Details"
                      : "Class Details"}
            </h3>
            <div className="mb-3">
              <Label className="text-muted-foreground">ID</Label>
              <div className="mt-1 break-all text-sm text-foreground">{selectedElement.id}</div>
            </div>
            {!("source" in selectedElement) && (
              <>
                <div className="mb-3">
                  <Label className="text-muted-foreground">Label</Label>
                  <Input
                    className="mt-1 h-9 text-sm"
                    value={String(selectedElement.data.label ?? "")}
                    readOnly={!isEditableEntityType(selectedElement.data.entityType)}
                    onChange={(e) => {
                      if (!isEditableEntityType(selectedElement.data.entityType)) return;
                      setNodes((nds) =>
                        nds.map((n) =>
                          n.id === selectedElement.id
                            ? { ...n, data: { ...n.data, label: e.target.value } }
                            : n
                        )
                      );
                      setDraftDiff((prev) => ({
                        ...prev,
                        ...(selectedElement.data.entityType === "property"
                          ? {
                              modified_properties: {
                                ...prev.modified_properties,
                                [selectedElement.id]: { label: e.target.value },
                              },
                            }
                          : {
                              modified_classes: {
                                ...prev.modified_classes,
                                [selectedElement.id]: { label: e.target.value },
                              },
                            }),
                      }));
                    }}
                  />
                </div>
                <div className="mb-3">
                  <Label className="text-muted-foreground">Type</Label>
                  <div className="mt-1 text-sm text-foreground">
                    {selectedElement.data.type || "owl:Class"}
                  </div>
                </div>
              </>
            )}
          </aside>
        )}
      </div>
    </div>
  );
}
