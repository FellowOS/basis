import { cn } from "@/lib/utils.js";

/** CSS ring spinner — avoids Phosphor SVG transform / thin-weight visibility issues. */
export function LoadingRing({ className }: { className?: string }) {
	return (
		<span
			className={cn(
				"border-primary/30 border-t-primary size-3.5 shrink-0 animate-spin rounded-full border-2",
				className,
			)}
			aria-hidden
		/>
	);
}
