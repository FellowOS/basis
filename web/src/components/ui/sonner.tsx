import type { CSSProperties } from "react"
import { Toaster as Sonner, type ToasterProps } from "sonner"

import { PublicIcon } from "@/components/ui/public-icon"
import { useTheme } from "@/lib/theme"

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme } = useTheme()

  return (
    <Sonner
      theme={theme}
      className="toaster group"
      icons={{
        success: <PublicIcon name="check-01" size={16} />,
        info: <PublicIcon name="information-circle-contained" size={16} />,
        warning: <PublicIcon name="alert-triangle" size={16} />,
        error: <PublicIcon name="alert-circle" size={16} />,
        loading: <PublicIcon name="loader-01" size={16} className="animate-spin" />,
      }}
      style={
        {
          "--normal-bg": "var(--card)",
          "--normal-text": "var(--foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)",
        } as CSSProperties
      }
      {...props}
    />
  )
}

export { Toaster }
