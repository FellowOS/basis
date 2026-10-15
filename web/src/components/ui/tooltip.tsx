"use client";

import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import type * as React from "react";

import { cn } from "@/lib/utils.js";

function TooltipProvider({
	delayDuration = 0,
	...props
}: React.ComponentProps<typeof TooltipPrimitive.Provider>) {
	return (
		<TooltipPrimitive.Provider
			data-slot="tooltip-provider"
			delayDuration={delayDuration}
			{...props}
		/>
	);
}

function Tooltip({
	...props
}: React.ComponentProps<typeof TooltipPrimitive.Root>) {
	return (
		<TooltipProvider>
			<TooltipPrimitive.Root data-slot="tooltip" {...props} />
		</TooltipProvider>
	);
}

function TooltipTrigger({
	...props
}: React.ComponentProps<typeof TooltipPrimitive.Trigger>) {
	return <TooltipPrimitive.Trigger data-slot="tooltip-trigger" {...props} />;
}

function TooltipContent({
	className,
	sideOffset,
	children,
	...props
}: React.ComponentProps<typeof TooltipPrimitive.Content>) {
	return (
		<TooltipPrimitive.Portal>
			<TooltipPrimitive.Content
				data-slot="tooltip-content"
				sideOffset={sideOffset ?? 4}
				className={cn(
					"group/tooltip animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 bg-foreground text-background dark:text-foreground z-50 w-fit origin-(--radix-tooltip-content-transform-origin) rounded-md border-0 px-3 py-1.5 text-xs text-balance shadow-xs dark:bg-[#050504]",
					className,
				)}
				{...props}
			>
				{children}
				{/* Outer arrow = border; inner arrow overlaps content edge so the 1px border is covered */}
				<TooltipPrimitive.Arrow
					width={11}
					height={6}
					className="fill-border dark:fill-white/18"
				/>
				<TooltipPrimitive.Arrow
					width={11}
					height={6}
					className="z-50 fill-foreground dark:fill-[#050504] group-data-[side=top]/tooltip:-translate-y-px group-data-[side=bottom]/tooltip:translate-y-px group-data-[side=left]/tooltip:-translate-x-px group-data-[side=right]/tooltip:translate-x-px"
				/>
			</TooltipPrimitive.Content>
		</TooltipPrimitive.Portal>
	);
}

export { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger };
