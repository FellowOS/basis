import { PublicIcon } from "@/components/ui/public-icon"
import { cn } from "@/lib/utils"

function Spinner({ className }: { className?: string }) {
  return (
    <span data-slot="spinner" className="inline-flex" role="status" aria-label="Loading">
      <PublicIcon
        name="loader-01"
        size={16}
        className={cn("animate-spin", className)}
      />
    </span>
  )
}

export { Spinner }
