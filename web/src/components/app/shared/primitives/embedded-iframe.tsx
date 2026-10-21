"use client";

import type { ComponentProps } from "react";
import {
	appendInlinePreviewQuery,
	injectInlinePreviewScrollbarStyle,
} from "@/components/app/shared/primitives/lib/inline-preview-style.js";
import { cn } from "@/lib/utils.js";

type EmbeddedIframeProps = Omit<ComponentProps<"iframe">, "src" | "srcDoc"> & {
	src?: string;
	srcDoc?: string;
	thinScrollbar?: boolean;
};

function markedSrc(src: string): string {
	try {
		const url = new URL(src);
		if (url.protocol === "http:" || url.protocol === "https:") {
			return appendInlinePreviewQuery(src);
		}
	} catch {
		// Relative and opaque URLs cannot carry the Fellow UI marker.
	}
	return src;
}

/** Shared iframe shell with optional thin-scrollbar support for HTML content. */
export function EmbeddedIframe({
	src,
	srcDoc,
	thinScrollbar = false,
	className,
	...props
}: EmbeddedIframeProps) {
	return (
		<iframe
			{...props}
			src={src && thinScrollbar ? markedSrc(src) : src}
			srcDoc={
				srcDoc && thinScrollbar
					? injectInlinePreviewScrollbarStyle(srcDoc)
					: srcDoc
			}
			className={cn("size-full min-h-0 border-0", className)}
		/>
	);
}
