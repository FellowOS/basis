import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

import { cn } from "@/lib/utils.js";

/**
 * App CTA button — always `rounded-md`. Do not override radius with
 * `rounded-full` / `rounded-lg` / `rounded-xl` at call sites.
 *
 * Variants:
 * - `default` — primary action (one per screen/footer)
 * - `outline` — secondary / cancel / parallel tools
 * - `ghost` — toolbar / low-emphasis icon actions
 * - `destructive` — irreversible danger
 * - `secondary` / `link` — rare; prefer outline/ghost first
 *
 * Sizes: `xs` compact cards; `sm` settings/toolbars; `default` page CTAs;
 * `lg` login/landing; `icon` / `icon-xs` / `icon-sm` / `icon-lg` for icon-only.
 *
 * Not for: SidebarMenuButton, Tabs pills, search inputs, filter chips.
 */
const buttonVariants = cva(
	"inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md font-sans text-sm font-medium transition-[color,background-color,border-color,box-shadow] duration-150 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
	{
		variants: {
			variant: {
				default:
					"bg-primary text-primary-foreground hover:bg-primary/90",
				destructive:
					"bg-destructive text-white hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60",
				outline:
					"max-w-full border-0 bg-[var(--control)] leading-none shadow-none transition-[background-color,box-shadow] duration-150 hover:bg-[color-mix(in_oklch,var(--foreground)_6%,var(--control))] focus-visible:border-transparent focus-visible:ring-0 focus-visible:shadow-[0_0_0_3px_var(--focus)]",
				secondary:
					"bg-secondary text-secondary-foreground hover:bg-secondary/80",
				ghost:
					"hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50",
				link: "text-primary underline-offset-4 hover:underline",
			},
			size: {
				default: "h-9 px-4 py-2 has-[>svg]:px-3",
				sm: "h-8 rounded-md gap-1.5 px-3 has-[>svg]:px-2.5",
				xs: "h-7 gap-1 px-2 text-xs has-[>svg]:px-1.5 [&_svg:not([class*='size-'])]:size-3.5",
				lg: "h-10 rounded-md px-6 has-[>svg]:px-4",
				icon: "size-9",
				"icon-xs": "size-7 [&_svg:not([class*='size-'])]:size-3.5",
				"icon-sm": "size-8",
				"icon-lg": "size-10",
			},
		},
		compoundVariants: [
			{
				variant: "outline",
				class: "h-8 px-2.5 text-[13px]",
			},
		],
		defaultVariants: {
			variant: "default",
			size: "default",
		},
	},
);

const Button = React.forwardRef<
	HTMLButtonElement,
	React.ComponentProps<"button"> &
		VariantProps<typeof buttonVariants> & {
			asChild?: boolean;
		}
>(function Button(
	{ className, variant = "default", size = "default", asChild = false, ...props },
	ref,
) {
	const Comp = asChild ? Slot : "button";

	return (
		<Comp
			ref={ref}
			data-slot="button"
			{...(variant !== undefined && { "data-variant": variant })}
			{...(size !== undefined && { "data-size": size })}
			className={cn(buttonVariants({ variant, size, className }))}
			{...props}
		/>
	);
});

Button.displayName = "Button";

export { Button, buttonVariants };
