import { type OrbState, ThinkingOrb, type ThinkingOrbProps } from 'thinking-orbs';

import { useTheme } from '@/lib/theme.js';
import { cn } from '@/lib/utils.js';

export type { OrbState };

/**
 * Inline agent-status orb. Theme follows the app ThemeProvider (not OS
 * prefers-color-scheme) so Electron Desktop matches Web when the UI theme
 * and system theme disagree — `thinking-orbs` `auto` falls back to OS.
 */
export function AgentThinkingOrb({
  state = 'working',
  size = 20,
  theme: themeProp,
  className,
  'aria-label': ariaLabel,
  ...rest
}: ThinkingOrbProps) {
  const { theme: appTheme } = useTheme();
  // thinking-orbs: theme="dark" → light ink for dark backgrounds (and vice versa).
  const theme = themeProp ?? (appTheme === 'dark' ? 'dark' : 'light');

  return (
    <ThinkingOrb
      state={state}
      size={size}
      theme={theme}
      aria-label={ariaLabel}
      className={cn('shrink-0', className)}
      {...rest}
    />
  );
}
