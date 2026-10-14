import type { GraphColorLegendItem } from "./graphColorLegend";

export function GraphColorLegendDock({ items }: { items: GraphColorLegendItem[] }) {
  if (!items.length) {
    return null;
  }

  return (
    <div
      className="flex flex-wrap items-baseline gap-2 text-xs text-muted-foreground"
      role="group"
      aria-label="Node colors"
    >
      <span
        className="font-medium text-foreground"
        title="Base semantic colors; selection, zoom, and distance effects can change node appearance."
      >
        Node colors
      </span>
      <ul className="flex max-h-20 flex-wrap gap-2 overflow-y-auto">
        {items.map((item) => (
          <li
            key={item.id}
            className="inline-flex items-center gap-1.5"
            title={`${item.group}: ${item.count.toLocaleString()} nodes`}
          >
            <span
              className="size-2 shrink-0 rounded-full"
              style={{ backgroundColor: item.color }}
              aria-hidden="true"
            />
            <span>{item.group}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
