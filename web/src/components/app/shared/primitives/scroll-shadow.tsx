"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils.js";

interface ScrollShadowProps {
	children: React.ReactNode;
	className?: string;
	size?: number;
	hideScrollBar?: boolean;
	orientation?: "vertical" | "horizontal";
	/** Overlay fade color. Defaults to the page background. */
	fadeColor?: string;
}

/**
 * Softens the hard cut-off at scrollable edges by overlaying a gradient
 * that fades from the container's background color to transparent.
 */
export function ScrollShadow({
	children,
	className,
	size = 40,
	hideScrollBar = false,
	orientation = "vertical",
	fadeColor = "var(--background)",
}: ScrollShadowProps) {
	const ref = useRef<HTMLDivElement>(null);
	const [showStart, setShowStart] = useState(false);
	const [showEnd, setShowEnd] = useState(false);

	const check = useCallback(() => {
		const el = ref.current;
		if (!el) return;
		if (orientation === "vertical") {
			const overflow = el.scrollHeight > el.clientHeight;
			setShowStart(overflow && el.scrollTop > 2);
			setShowEnd(
				overflow && el.scrollTop + el.clientHeight < el.scrollHeight - 2,
			);
		} else {
			const overflow = el.scrollWidth > el.clientWidth;
			setShowStart(overflow && el.scrollLeft > 2);
			setShowEnd(
				overflow && el.scrollLeft + el.clientWidth < el.scrollWidth - 2,
			);
		}
	}, [orientation]);

	useEffect(() => {
		const el = ref.current;
		if (!el) return;
		check();
		el.addEventListener("scroll", check, { passive: true });
		const ro = new ResizeObserver(check);
		ro.observe(el);
		if (el.firstElementChild) ro.observe(el.firstElementChild);
		return () => {
			el.removeEventListener("scroll", check);
			ro.disconnect();
		};
	}, [check]);

	const isV = orientation === "vertical";

	return (
		<div className={cn("relative overflow-hidden", className)}>
			{/* Top / Left fade */}
			<div
				aria-hidden
				className={cn(
					"pointer-events-none absolute z-10 transition-opacity duration-300",
					isV ? "top-0 right-0 left-0" : "top-0 bottom-0 left-0",
				)}
				style={{
					height: isV ? size : undefined,
					width: isV ? undefined : size,
					background: isV
						? `linear-gradient(to bottom, ${fadeColor}, transparent)`
						: `linear-gradient(to right, ${fadeColor}, transparent)`,
					opacity: showStart ? 1 : 0,
				}}
			/>
			{/* Bottom / Right fade */}
			<div
				aria-hidden
				className={cn(
					"pointer-events-none absolute z-10 transition-opacity duration-300",
					isV ? "right-0 bottom-0 left-0" : "top-0 right-0 bottom-0",
				)}
				style={{
					height: isV ? size : undefined,
					width: isV ? undefined : size,
					background: isV
						? `linear-gradient(to top, ${fadeColor}, transparent)`
						: `linear-gradient(to left, ${fadeColor}, transparent)`,
					opacity: showEnd ? 1 : 0,
				}}
			/>
			<div
				ref={ref}
				className={cn(
					"h-full w-full",
					isV ? "overflow-y-auto" : "overflow-x-auto",
					hideScrollBar && "scrollbar-none",
				)}
			>
				{children}
			</div>
		</div>
	);
}
