import type { IconType } from "react-icons";
import { getPublicIconComponent } from "@/lib/public-icon-map.js";
import { cn } from "@/lib/utils.js";

type PublicIconProps = {
	name: string;
	className?: string;
	size?: number;
};

export function getPublicIcon(name: string): IconType {
	return getPublicIconComponent(name);
}

export function PublicIcon({ name, className, size = 16 }: PublicIconProps) {
	const Icon = getPublicIconComponent(name);

	return (
		<Icon
			size={size}
			className={cn("inline-block shrink-0", className)}
			aria-hidden
		/>
	);
}
