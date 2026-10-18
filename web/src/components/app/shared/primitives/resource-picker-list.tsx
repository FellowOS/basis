import type { ReactNode } from "react";
import { useMemo } from "react";
import { Checkbox } from "@/components/ui/checkbox.js";
import { PublicIcon } from "@/components/app/shared/primitives/public-icon.js";
import { cn } from "@/lib/utils.js";

export type ResourcePickerOption = {
	id: string;
	label?: string;
	hint?: string;
	folder?: string;
};

export function ResourcePickerList({
	options,
	exclude,
	search = "",
	picked,
	onToggle,
	emptyLabel,
	disabled = false,
	interactive = true,
	folderRootLabel,
	renderExtra,
}: {
	options: ResourcePickerOption[];
	exclude?: Set<string>;
	search?: string;
	picked: Set<string>;
	onToggle: (id: string) => void;
	emptyLabel: string;
	disabled?: boolean;
	interactive?: boolean;
	folderRootLabel?: string;
	renderExtra?: (option: ResourcePickerOption) => ReactNode;
}) {
	const filtered = useMemo(() => {
		const q = search.trim().toLowerCase();
		return options.filter((option) => {
			if (exclude?.has(option.id)) return false;
			if (!q) return true;
			return (
				option.id.toLowerCase().includes(q) ||
				option.label?.toLowerCase().includes(q) ||
				option.hint?.toLowerCase().includes(q) ||
				option.folder?.toLowerCase().includes(q)
			);
		});
	}, [options, exclude, search]);

	return (
		<ul className="max-h-[min(42vh,320px)] divide-y divide-border overflow-y-auto rounded-lg border border-border bg-muted/20">
			{filtered.length === 0 ? (
				<li className="text-muted-foreground px-4 py-8 text-center text-sm">
					{emptyLabel}
				</li>
			) : (
				filtered.map((option) => {
					const active = picked.has(option.id);
					const content = (
						<>
							{interactive ? (
								<Checkbox
									checked={active}
									disabled={disabled}
									onCheckedChange={() => onToggle(option.id)}
									className="mt-0.5"
									aria-label={option.label ?? option.id}
								/>
							) : null}
							<span className="min-w-0 flex-1">
								<span className="block font-medium leading-snug">
									{option.label ?? option.id}
								</span>
								{option.hint ? (
									<span className="text-muted-foreground mt-0.5 line-clamp-2 block text-xs leading-relaxed">
										{option.hint}
									</span>
								) : null}
								{folderRootLabel !== undefined ? (
									<span className="text-muted-foreground mt-0.5 inline-flex items-center gap-1 text-[10px]">
										<PublicIcon
											name="folder"
											size={10}
											className="shrink-0 opacity-70"
										/>
										{option.folder?.trim() || folderRootLabel}
									</span>
								) : null}
								{renderExtra?.(option)}
							</span>
						</>
					);

					if (!interactive) {
						return (
							<li key={option.id} className="px-3 py-2.5 text-sm">
								<div className="flex items-start gap-3">{content}</div>
							</li>
						);
					}

					return (
						<li key={option.id}>
							<label
								className={cn(
									"flex w-full cursor-pointer items-start gap-3 px-3 py-2.5 text-left text-sm transition-colors",
									"hover:bg-[color-mix(in_oklch,var(--primary)_7%,var(--card))]",
									disabled && "pointer-events-none opacity-60",
								)}
							>
								{content}
							</label>
						</li>
					);
				})
			)}
		</ul>
	);
}
