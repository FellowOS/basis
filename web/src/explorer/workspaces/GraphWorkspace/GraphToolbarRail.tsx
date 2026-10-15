import type { ComponentType } from "react";

import { cn } from "@/lib/utils.js";
import { GraphToolButton, GraphToolTower } from "@/components/graph-tool-tower.js";

export type GraphToolbarRailItem = {
  id: string;
  label: string;
  title?: string;
  active?: boolean;
  disabled?: boolean;
  icon?: ComponentType<{ size?: number; strokeWidth?: number; "aria-hidden"?: boolean }>;
  ariaLabel?: string;
  onClick: () => void;
};

export type GraphToolbarRailGroup = {
  id: string;
  label?: string;
  items: GraphToolbarRailItem[];
};

function RailIcon({
  icon: Icon,
}: {
  icon?: GraphToolbarRailItem["icon"];
}) {
  if (!Icon) {
    return null;
  }
  return <Icon size={15} strokeWidth={2.15} aria-hidden />;
}

export function GraphToolbarRail({
  groups,
  expandLabels = "right",
}: {
  groups: GraphToolbarRailGroup[];
  expandLabels?: "left" | "right";
}) {
  const visible = groups.filter((group) => group.items.length > 0);
  if (!visible.length) {
    return null;
  }

  const alignEnd = expandLabels === "left";

  return (
    <div className={cn("flex flex-col gap-2", alignEnd ? "items-end" : "items-start")}>
      {visible.map((group) => (
        <div key={group.id} className={cn("flex flex-col gap-1", alignEnd ? "items-end" : "items-start")}>
          <GraphToolTower expandLabels={expandLabels} aria-label={group.label ?? group.id}>
          {group.items.map((item) => (
            <GraphToolButton
              key={item.id}
              active={item.active}
              label={item.ariaLabel ?? item.label}
              icon={<RailIcon icon={item.icon} />}
              disabled={item.disabled}
              title={item.title}
              onClick={item.onClick}
            />
          ))}
          </GraphToolTower>
        </div>
      ))}
    </div>
  );
}
