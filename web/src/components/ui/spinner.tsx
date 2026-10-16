import { useI18n } from "@/i18n/context.js"
import { PublicIcon } from "@/components/ui/public-icon"
import { cn } from "@/lib/utils"

function Spinner({ className }: { className?: string }) {
  const { t } = useI18n()
  return (
    <span data-slot="spinner" className="inline-flex" role="status" aria-label={t.common.loading}>
      <PublicIcon
        name="loader-01"
        size={16}
        className={cn("animate-spin", className)}
      />
    </span>
  )
}

export { Spinner }
