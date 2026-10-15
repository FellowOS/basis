type GraphNode = { id: string; label?: string };
type GraphEdge = { source: string; target: string };

const SIZE = 420;
const R = 160;

export function GraphOverviewSvg({
  nodes,
  edges,
  focusId,
  onSelect,
}: {
  nodes: GraphNode[];
  edges: GraphEdge[];
  focusId?: string | null;
  onSelect?: (id: string) => void;
}) {
  const capped = nodes.slice(0, 48);
  const positions = new Map<string, { x: number; y: number }>();
  const n = capped.length || 1;
  capped.forEach((node, index) => {
    const angle = (2 * Math.PI * index) / n - Math.PI / 2;
    positions.set(node.id, {
      x: SIZE / 2 + R * Math.cos(angle),
      y: SIZE / 2 + R * Math.sin(angle),
    });
  });

  const visibleEdges = edges.filter(
    (e) => positions.has(e.source) && positions.has(e.target),
  ).slice(0, 80);

  return (
    <svg
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      className="mx-auto w-full max-w-md rounded-md border bg-muted/20"
      role="img"
      aria-label="图谱概览"
    >
      {visibleEdges.map((edge, i) => {
        const a = positions.get(edge.source)!;
        const b = positions.get(edge.target)!;
        return (
          <line
            key={`${edge.source}-${edge.target}-${i}`}
            x1={a.x}
            y1={a.y}
            x2={b.x}
            y2={b.y}
            stroke="currentColor"
            strokeOpacity={0.25}
            strokeWidth={1}
          />
        );
      })}
      {capped.map((node) => {
        const p = positions.get(node.id)!;
        const active = focusId === node.id;
        return (
          <g
            key={node.id}
            className="cursor-pointer"
            onClick={() => onSelect?.(node.id)}
          >
            <circle
              cx={p.x}
              cy={p.y}
              r={active ? 9 : 6}
              className={active ? 'fill-primary' : 'fill-foreground/70'}
            />
            <title>{node.label || node.id}</title>
          </g>
        );
      })}
    </svg>
  );
}
