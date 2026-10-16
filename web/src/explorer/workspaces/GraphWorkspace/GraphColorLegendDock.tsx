import { fmt, formatLocaleNumber } from "@/i18n/format.js";
import { graphLegendSwatch, graphSemanticSwatchStyle } from "@/lib/graph/graph-ui-classes.js";

import type { GraphColorLegendItem } from "./graphColorLegend";
import { graphCopy, type GraphWorkspaceLocale } from "./graphWorkspaceCopy";

export function GraphColorLegendDock({
  locale,
  items,
}: {
  locale: GraphWorkspaceLocale;
  items: GraphColorLegendItem[];
}) {
  if (!items.length) {
    return null;
  }

  return (
    <div
      className="flex flex-wrap items-baseline gap-2 text-xs text-muted-foreground"
      role="group"
      aria-label={graphCopy(locale, "colorLegendAria")}
    >
      <span className="font-medium text-foreground" title={graphCopy(locale, "colorLegendHeadingTitle")}>
        {graphCopy(locale, "colorLegendHeading")}
      </span>
      <ul className="flex max-h-20 flex-wrap gap-2 overflow-y-auto">
        {items.map((item) => (
          <li
            key={item.id}
            className="inline-flex items-center gap-1.5"
            title={fmt(graphCopy(locale, "colorLegendItemTitle"), {
              group: item.group,
              count: formatLocaleNumber(locale, item.count),
            })}
          >
            <span
              className={graphLegendSwatch}
              style={graphSemanticSwatchStyle(item.color)}
              aria-hidden="true"
            />
            <span>{item.group}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
