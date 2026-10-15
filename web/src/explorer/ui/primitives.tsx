/** Styles for `sem-*` classes: global `styles/explorer/` (Basis theme), scoped under `.kb-explorer-console` / `.kb-graph-workspace`. */
import type { ReactNode } from "react";

type SurfaceTone = "default" | "subtle" | "accent";
type SurfacePadding = "default" | "tight" | "none";

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export function SurfaceCard({
  children,
  tone = "default",
  padding = "default",
  className,
}: {
  children: ReactNode;
  tone?: SurfaceTone;
  padding?: SurfacePadding;
  className?: string;
}) {
  return (
    <div className={cx("sem-surface", tone !== "default" && `sem-surface--${tone}`, className)}>
      {padding === "none" ? children : <div className={cx("sem-surface-body", padding === "tight" && "sem-surface-body--tight")}>{children}</div>}
    </div>
  );
}

export function InspectorPanel({
  children,
  open = true,
  className,
}: {
  children: ReactNode;
  open?: boolean;
  className?: string;
}) {
  return (
    <SurfaceCard className={cx("sem-inspector", open ? "block" : "hidden", className)} padding="none">
      {children}
    </SurfaceCard>
  );
}
