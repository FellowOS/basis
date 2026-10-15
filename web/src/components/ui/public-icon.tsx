import type { Icon } from "@phosphor-icons/react";
import { PHOSPHOR_ICON_WEIGHT } from "@/lib/phosphor-icon.js";
import { getPublicIconComponent } from "@/lib/public-icon-map.js";
import { cn } from "@/lib/utils.js";

type PublicIconProps = {
	name: string;
	className?: string;
	size?: number;
};

export function getPublicIcon(name: string): Icon {
	return getPublicIconComponent(name);
}

export function PublicIcon({ name, className, size = 16 }: PublicIconProps) {
	const Icon = getPublicIconComponent(name);

	return (
		<Icon
			size={size}
			weight={PHOSPHOR_ICON_WEIGHT}
			className={cn("inline-block shrink-0", className)}
			aria-hidden
		/>
	);
}
