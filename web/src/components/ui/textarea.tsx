import type * as React from "react";

import { cn } from "@/lib/utils.js";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
	const isGroupControl =
		(props as React.ComponentProps<"textarea"> & { "data-slot"?: string })["data-slot"] ===
		"input-group-control";

	return (
		<textarea
			data-slot="textarea"
			className={cn(
				!isGroupControl &&
					"h-auto max-w-full rounded-md border-0 bg-[var(--control)] p-2.5 text-[13px] leading-none shadow-none transition-[background-color,box-shadow] duration-150 hover:bg-[color-mix(in_oklch,var(--foreground)_6%,var(--control))] focus-visible:shadow-[0_0_0_3px_var(--focus)]",
				"placeholder:text-muted-foreground/60 aria-invalid:shadow-[0_0_0_3px_color-mix(in_oklch,var(--destructive)_30%,transparent)] flex field-sizing-content h-auto w-full disabled:cursor-not-allowed md:text-sm",
				isGroupControl
					? "min-h-0 border-0 bg-transparent p-0 shadow-none focus-visible:shadow-none"
					: "min-h-16",
				className,
			)}
			{...props}
		/>
	);
}

export { Textarea };
