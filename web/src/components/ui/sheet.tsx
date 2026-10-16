"use client";

import * as SheetPrimitive from "@radix-ui/react-dialog";
import type * as React from "react";

import { PublicIcon } from "@/components/ui/public-icon.js";
import { useI18n } from "@/i18n/context.js";
import { cn } from "@/lib/utils.js";

function Sheet({ ...props }: React.ComponentProps<typeof SheetPrimitive.Root>) {
	return <SheetPrimitive.Root data-slot="sheet" {...props} />;
}

function SheetTrigger({
	...props
}: React.ComponentProps<typeof SheetPrimitive.Trigger>) {
	return <SheetPrimitive.Trigger data-slot="sheet-trigger" {...props} />;
}

function SheetClose({
	...props
}: React.ComponentProps<typeof SheetPrimitive.Close>) {
	return <SheetPrimitive.Close data-slot="sheet-close" {...props} />;
}

function SheetPortal({
	...props
}: React.ComponentProps<typeof SheetPrimitive.Portal>) {
	return <SheetPrimitive.Portal data-slot="sheet-portal" {...props} />;
}

function SheetOverlay({
	className,
	...props
}: React.ComponentProps<typeof SheetPrimitive.Overlay>) {
	return (
		<SheetPrimitive.Overlay
			data-slot="sheet-overlay"
			className={cn("fixed inset-0 z-50 bg-black/50", className)}
			{...props}
		/>
	);
}

function SheetContent({
	className,
	overlayClassName,
	children,
	side = "right",
	hideClose = false,
	...props
}: React.ComponentProps<typeof SheetPrimitive.Content> & {
	side?: "top" | "right" | "bottom" | "left";
	overlayClassName?: string;
	hideClose?: boolean;
}) {
	const { t } = useI18n();
	return (
		<SheetPortal>
			<SheetOverlay className={overlayClassName} />
			<SheetPrimitive.Content
				className={cn(
					"bg-background fixed z-50 flex flex-col gap-4 shadow-lg",
					side === "right" &&
						"inset-y-0 right-0 h-full w-3/4 sm:max-w-sm",
					side === "left" &&
						"inset-y-0 left-0 h-full w-3/4 sm:max-w-sm",
					side === "top" && "inset-x-0 top-0 h-auto",
					side === "bottom" && "inset-x-0 bottom-0 h-auto",
					className,
				)}
				{...props}
				data-slot="sheet-content"
				data-side={side}
			>
				{children}
				{hideClose ? null : (
					<SheetPrimitive.Close className="ring-offset-background focus:ring-ring data-[state=open]:bg-secondary absolute top-4 right-4 rounded-xs opacity-70 transition-opacity hover:opacity-100 focus:ring-2 focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none">
						<PublicIcon name="x-02" size={16} />
						<span className="sr-only">{t.common.close}</span>
					</SheetPrimitive.Close>
				)}
			</SheetPrimitive.Content>
		</SheetPortal>
	);
}

function SheetHeader({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="sheet-header"
			className={cn("flex flex-col gap-1.5 p-4", className)}
			{...props}
		/>
	);
}

function SheetFooter({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="sheet-footer"
			className={cn("mt-auto flex flex-col gap-2 p-4", className)}
			{...props}
		/>
	);
}

function SheetTitle({
	className,
	...props
}: React.ComponentProps<typeof SheetPrimitive.Title>) {
	return (
		<SheetPrimitive.Title
			data-slot="sheet-title"
			className={cn("text-foreground font-semibold", className)}
			{...props}
		/>
	);
}

function SheetDescription({
	className,
	...props
}: React.ComponentProps<typeof SheetPrimitive.Description>) {
	return (
		<SheetPrimitive.Description
			data-slot="sheet-description"
			className={cn("text-muted-foreground text-sm", className)}
			{...props}
		/>
	);
}

export {
	Sheet,
	SheetClose,
	SheetContent,
	SheetDescription,
	SheetFooter,
	SheetHeader,
	SheetTitle,
	SheetTrigger,
};
