import { useI18n } from '@/i18n/context.js';

const NODE_W = 104;
const NODE_H = 36;
const NODE_R = 8;

type PreviewNode = {
  x: number;
  y: number;
  label: string;
};

function nodeRect(node: PreviewNode) {
  return {
    x: node.x - NODE_W / 2,
    y: node.y - NODE_H / 2,
  };
}

export function ProductPreview() {
  const { t } = useI18n();
  const h = t.home.marketing.how_it_works;
  const p = h.preview;

  const nodes: PreviewNode[] = [
    { x: 74, y: 64, label: p.customer },
    { x: 210, y: 138, label: p.order },
    { x: 346, y: 64, label: p.invoice },
    { x: 210, y: 240, label: p.review },
  ];
  const edges: [number, number][] = [
    [0, 1],
    [1, 2],
    [0, 2],
    [1, 3],
  ];

  return (
    <figure className="overflow-hidden rounded-xl border border-border/70 bg-card/60 shadow-sm">
      <div className="flex items-center gap-2 border-b border-border/60 px-4 py-2.5">
        <span className="size-2 rounded-full bg-red-400/70" aria-hidden />
        <span className="size-2 rounded-full bg-amber-400/70" aria-hidden />
        <span className="size-2 rounded-full bg-emerald-400/70" aria-hidden />
        <span className="ml-2 truncate text-[11px] text-muted-foreground">
          {h.preview_title} / {p.graph_tab}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-[1fr_190px]">
        <div className="relative min-h-[260px] bg-background/40 p-3">
          <svg
            viewBox="0 0 420 300"
            className="h-full w-full"
            role="img"
            aria-label={h.preview_caption}
          >
            <g stroke="var(--border)" strokeWidth="1">
              {edges.map(([from, to]) => {
                const start = nodes[from];
                const end = nodes[to];
                if (!start || !end) return null;
                return (
                  <line
                    key={`${from}-${to}`}
                    x1={start.x}
                    y1={start.y}
                    x2={end.x}
                    y2={end.y}
                    strokeDasharray={to === 3 ? '4 4' : undefined}
                  />
                );
              })}
            </g>
            {nodes.map((node, index) => {
              const rect = nodeRect(node);
              return (
                <g key={node.label}>
                  <rect
                    x={rect.x}
                    y={rect.y}
                    width={NODE_W}
                    height={NODE_H}
                    rx={NODE_R}
                    fill="var(--card)"
                    stroke={index === 3 ? 'var(--login-gold, var(--border))' : 'var(--border)'}
                  />
                  <circle
                    cx={rect.x + 14}
                    cy={node.y}
                    r="3"
                    fill={index === 3 ? 'var(--login-gold, var(--border))' : 'var(--muted-foreground)'}
                  />
                  <text
                    x={node.x + 4}
                    y={node.y}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    style={{ fill: 'var(--foreground)', fontSize: 10, fontWeight: 500 }}
                  >
                    {node.label}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        <div className="hidden border-l border-border/60 p-4 sm:block">
          <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            {p.evidence}
          </p>
          <div className="mt-3 rounded-md border border-border/60 bg-background/50 p-2.5">
            <p className="font-mono text-[10px] font-medium text-foreground">customer.tier</p>
            <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">
              {p.source}: CRM · customers#42
            </p>
          </div>
          <div className="mt-2 rounded-md border border-border/60 bg-background/50 p-2.5">
            <p className="font-mono text-[10px] font-medium text-foreground">order.total</p>
            <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">
              {p.source}: ERP · orders#8812
            </p>
          </div>
          <span className="mt-4 inline-flex rounded-full border border-border/70 px-2.5 py-0.5 text-[10px] text-muted-foreground">
            {p.pending}
          </span>
        </div>
      </div>

      <figcaption className="border-t border-border/60 px-4 py-2 text-[11px] text-muted-foreground">
        {h.preview_caption}
      </figcaption>
    </figure>
  );
}
