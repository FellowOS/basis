import { PublicIcon } from "@/components/app/shared/primitives/public-icon.js";
import { useCallback, useEffect, useState } from "react";
import { workspaceFetch } from '@/lib/workspace/ws-http';
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
  wsApiErrorMessage,
  parseWsJson,
} from '@/lib/workspace/ws-api-error';
import { loadOntologyEntityOwner, loadOntologyGraph, loadOntologyRegistry } from '../lib/api.js';
import { ontologyPath, useOntologyWorkspaceId } from "./ontology-workspace-context";
import type { OntologyGraphEdge, OntologyGraphNode } from '../lib/api.js';
import {
  isEditableEntityType,
  ONTOLOGY_MINIMAP_THEME,
  resolveEditorOntology,
} from '../lib/ontology-editor-model.js';
import type { EditorEntityType, RegistryEntry } from '../lib/ontology-editor-model.js';
import { Button } from "@/components/ui/button.js";
import { Input } from "@/components/ui/input.js";
import { Label } from "@/components/ui/label.js";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select.js";
import { clearEntitySelection, readOntologyUrlState, writeEntitySelection } from '../lib/ontology-url-state.js';
import { useI18n } from "@/i18n/context.js";
import { fmt } from "@/i18n/format.js";
import type { Locale } from "@/i18n/locale.js";
import { ontologyOwlTypeLabel } from "../i18n/ontology-editor-copy.js";
import { humanizeRdfLabel } from "../lib/rdf-label.js";
import { exWsListRowHoverPrimary } from "@/lib/ui-classes/ws-ui.js";
import { cn } from "@/lib/utils.js";

type OntologyNodeData = {
  label?: string;
  type?: string;
  typeDisplay?: string;
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
      <div className="text-xs font-medium text-muted-foreground">
        {data.typeDisplay ?? data.type}
      </div>
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
  `flex w-full cursor-pointer items-center gap-2.5 px-4 py-2 text-left text-sm text-foreground ${exWsListRowHoverPrimary}`;

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
  const raw =
    node.content ||
    node.properties?.["rdfs:label"] ||
    node.properties?.["skos:prefLabel"] ||
    "";
  return humanizeRdfLabel(String(raw), node.id);
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

function buildEditorElements(
  apiNodes: OntologyGraphNode[],
  apiEdges: OntologyGraphEdge[],
  locale: Locale,
) {
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
      typeDisplay: ontologyOwlTypeLabel(locale, node.type),
      entityType: classifyEditorNode(node),
    },
  })));
  const edges: OntologyEdge[] = apiEdges.map((edge, index) => ({
    id: edge.id || `${edge.source}:${edge.type}:${edge.target}:${index}`,
    source: edge.source,
    target: edge.target,
    label: ontologyOwlTypeLabel(locale, edge.type),
    type: "default",
    markerEnd: { type: MarkerType.ArrowClosed },
    style: { stroke: "var(--border)", strokeWidth: 1.5 },
    labelStyle: { fill: "var(--foreground)", fontSize: 11, fontWeight: 600 },
    labelBgStyle: { fill: "var(--card)", fillOpacity: 0.95 },
  }));
  return { nodes, edges };
}

export function OntologyEditor() {
  const { t, locale } = useI18n();
  const e = t.ontology.hub.editor;
  const workspaceId = useOntologyWorkspaceId();
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
      loadOntologyRegistry(workspaceId, { locale }).catch(() => [] as RegistryEntry[]),
      requested
        ? loadOntologyEntityOwner(workspaceId, requested).catch(() => undefined)
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
        console.error(t.ontology.hub.manager.api.load_registry_failed, error);
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceId, locale, t.ontology.hub.manager.api.load_registry_failed]);

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
    loadOntologyGraph(workspaceId, ontologyUri, { signal: controller.signal, locale })
      .then((payload) => {
        const elements = buildEditorElements(payload.nodes, payload.edges, locale as Locale);
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
        setGraphError(wsApiErrorMessage(error, locale as Locale));
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoadingGraph(false);
      });

    return () => controller.abort();
  }, [workspaceId, locale, ontologyUri, setEdges, setNodes]);

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
      data: {
        label: e.new_class_label,
        type: "owl:Class",
        typeDisplay: ontologyOwlTypeLabel(locale as Locale, "owl:Class"),
        entityType: "class",
      },
    };
    setNodes((nds) => [...nds, newNode]);
    setDraftDiff((prev) => ({
      ...prev,
      added_classes: [...prev.added_classes, newId],
    }));
  }, [e.new_class_label, setNodes]);

  const addProperty = useCallback(() => {
    if (nodes.length < 2) {
      alert(e.need_two_classes);
      return;
    }
    const newId = `prop_${Date.now()}`;
    const newEdge: OntologyEdge = {
      id: newId,
      source: nodes[0].id,
      target: nodes[1].id,
      label: e.default_property_label,
      type: "smoothstep",
      animated: true,
    };
    setEdges((eds) => [...eds, newEdge]);
    setDraftDiff((prev) => ({
      ...prev,
      added_properties: [...prev.added_properties, newId],
    }));
  }, [e.default_property_label, e.need_two_classes, nodes, setEdges]);

  const addIndividual = useCallback(() => {
    const newId = `ind_${Date.now()}`;
    const newNode: OntologyNode = {
      id: newId,
      type: "classNode",
      position: { x: Math.random() * 400, y: Math.random() * 300 },
      data: {
        label: e.new_individual_label,
        type: "owl:NamedIndividual",
        typeDisplay: ontologyOwlTypeLabel(locale as Locale, "owl:NamedIndividual"),
        entityType: "external",
      },
    };
    setNodes((nds) => [...nds, newNode]);
  }, [e.new_individual_label, setNodes]);

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
      alert(e.select_ontology_first);
      return;
    }
    setIsSaving(true);
    try {
      const response = await workspaceFetch(ontologyPath(workspaceId, "draft"), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ontology_uri: ontologyUri,
          diff: draftDiff,
          author: "user",
          summary: e.draft_summary,
        }),
      });
      const data = await parseWsJson<{ draft_id: string }>(response, e.draft_save_failed);
      alert(fmt(e.draft_saved, { id: data.draft_id }));
    } catch (error) {
      console.error(e.draft_save_failed, error);
      alert(wsApiErrorMessage(error, locale as Locale));
    } finally {
      setIsSaving(false);
    }
  }, [draftDiff, e, workspaceId, locale, ontologyUri]);

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
      const newLabel = prompt(e.rename_prompt, String(target.data.label ?? ""));
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
  }, [e.rename_prompt, selectedElement, setNodes, showContext]);

  useEffect(() => {
    const handleClick = () => setShowContext(null);
    window.addEventListener("click", handleClick);
    return () => window.removeEventListener("click", handleClick);
  }, []);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-background">
      <style>{ontologyFlowThemeCss}</style>
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border bg-card px-4 py-3">
        <NativeSelect
          aria-label={e.active_ontology_aria}
          value={ontologyUri}
          onChange={(event) => {
            setOntologyUri(event.target.value);
            setSelectedElement(null);
            setUnownedEntity("");
            clearEntitySelection();
          }}
          className="min-w-[260px] text-xs"
          size="sm"
        >
          <NativeSelectOption value="">{e.select_ontology}</NativeSelectOption>
          {registry.map((entry) => (
            <NativeSelectOption key={entry.uri} value={entry.uri}>
              {entry.name || entry.uri}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        <Button type="button" size="sm" variant="outline" className="h-8" onClick={addClass}>
          <PublicIcon name="plus-01" size={14} />
          {e.add_class}
        </Button>
        <Button type="button" size="sm" variant="outline" className="h-8" onClick={addProperty} disabled={nodes.length < 2}>
          <PublicIcon name="git-branch-01" size={14} />
          {e.add_property}
        </Button>
        <Button type="button" size="sm" variant="outline" className="h-8" onClick={addIndividual}>
          <PublicIcon name="user-profile-01" size={14} />
          {e.add_individual}
        </Button>
        <Button type="button" size="sm" variant="outline" className="h-8" onClick={addRestriction}>
          <PublicIcon name="shield-01" size={14} />
          {e.add_restriction}
        </Button>
        <Button type="button" size="sm" variant="outline" className="h-8" onClick={addAxiom}>
          <PublicIcon name="file-01" size={14} />
          {e.add_axiom}
        </Button>
        <Button type="button" size="sm" variant="outline" className="h-8" onClick={autoLayout}>
          <PublicIcon name="layout" size={14} />
          {e.auto_layout}
        </Button>
        <div className="flex-1" />
        <Button type="button" size="sm" className="h-8" onClick={saveDraft} disabled={isSaving}>
          <PublicIcon name="paper-plane" size={14} />
          {isSaving ? e.saving : e.propose}
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
            <div className={canvasMessageClassName}>{e.loading_structure}</div>
          )}
          {!isLoadingGraph && graphError && (
            <div className={`${canvasMessageClassName} text-destructive`}>{graphError}</div>
          )}
          {!isLoadingGraph && !graphError && unownedEntity && (
            <div className={`${canvasMessageClassName} text-warn`}>
              {fmt(e.unowned_entity, { entity: unownedEntity })}
            </div>
          )}
          {!isLoadingGraph && !graphError && !unownedEntity && !ontologyUri && (
            <div className={canvasMessageClassName}>
              {e.pick_ontology_hint}
            </div>
          )}
          {!isLoadingGraph && !graphError && !unownedEntity && ontologyUri && nodes.length === 0 && (
            <div className={canvasMessageClassName}>{e.empty_editable}</div>
          )}

          {showContext && (
            <div
              className="fixed z-[1000] min-w-[180px] rounded-lg border border-border bg-popover py-1 shadow-lg"
              style={{ left: showContext.x, top: showContext.y }}
            >
              {"source" in showContext.element || isEditableEntityType(showContext.element.data.entityType) ? (
                <>
                  {!("source" in showContext.element) && (
                    <Button
                      type="button"
                      variant="ghost"
                      className={cn(contextItemClassName, "h-auto w-full justify-start rounded-none font-normal")}
                      onClick={renameSelected}
                    >
                      <PublicIcon name="edit-01" size={14} />
                      {e.rename}
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="ghost"
                    className={cn(contextItemClassName, "h-auto w-full justify-start rounded-none font-normal")}
                    onClick={deleteSelected}
                  >
                    <PublicIcon name="trash-01" size={14} />
                    {e.delete}
                  </Button>
                </>
              ) : (
                <div className={`${contextItemClassName} cursor-default text-muted-foreground`}>
                  {e.read_only_term}
                </div>
              )}
            </div>
          )}
        </div>

        {selectedElement && (
          <aside className="box-border w-80 min-w-80 shrink-0 overflow-auto border-l border-border bg-card p-5">
            <h3 className="mb-4 text-base font-semibold text-foreground">
              {"source" in selectedElement
                ? e.panel_relationship
                : selectedElement.data.entityType === "property"
                  ? e.panel_property
                  : selectedElement.data.entityType === "ontology"
                    ? e.panel_ontology
                    : selectedElement.data.entityType === "external"
                      ? e.panel_external
                      : e.panel_class}
            </h3>
            <div className="mb-3">
              <Label className="text-muted-foreground">{e.field_id}</Label>
              <div className="mt-1 break-all text-sm text-foreground">{selectedElement.id}</div>
            </div>
            {!("source" in selectedElement) && (
              <>
                <div className="mb-3">
                  <Label className="text-muted-foreground">{e.field_label}</Label>
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
                  <Label className="text-muted-foreground">{e.field_type}</Label>
                  <div className="mt-1 text-sm text-foreground">
                    {ontologyOwlTypeLabel(
                      locale as Locale,
                      selectedElement.data.type || "owl:Class",
                    )}
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
