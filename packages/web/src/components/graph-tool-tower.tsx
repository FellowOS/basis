import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";

import { cn } from "@/lib/utils.js";

/** Vertical tool group on the graph canvas (Utopia / onto-style expand-on-hover labels). */
export function GraphToolTower({
  className,
  expandLabels = "right",
  children,
}: {
  className?: string;
  /** `left`: labels grow toward the canvas (right-side rails). */
  expandLabels?: "left" | "right";
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "graph-tool-tower group flex flex-col overflow-hidden rounded-md border border-border bg-background/95 shadow-sm backdrop-blur-sm",
        expandLabels === "left" && "graph-tool-tower--expand-left",
        className,
      )}
    >
      {children}
    </div>
  );
}

export const GraphToolButton = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & {
    active?: boolean;
    label: string;
    icon: ReactNode;
  }
>(function GraphToolButton(
  { active, label, icon, className, type = "button", ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      title={label}
      aria-label={label}
      className={cn("graph-tool-button", active && "is-active", className)}
      {...props}
    >
      {icon}
      <span className="graph-tool-tower-label">{label}</span>
    </button>
  );
});
