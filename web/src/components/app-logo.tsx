import type { OrbSize } from 'thinking-orbs';

import { AgentThinkingOrb, type OrbState } from '@/components/agent-thinking-orb.js';
import { cn } from '@/lib/utils.js';

/** Map layout px to thinking-orbs presets (only 20 and 64 are tuned). */
function orbSizeForLayout(size: number): OrbSize {
  return size > 32 ? 64 : 20;
}

export function AppLogo({
  size = 24,
  className,
  label,
  state = 'working',
  paused,
}: {
  size?: number;
  className?: string;
  /** When set, exposed to assistive tech; otherwise decorative. */
  label?: string;
  state?: OrbState;
  paused?: boolean;
}) {
  const orbSize = orbSizeForLayout(size);
  const scale = size / orbSize;

  return (
    <span
      className={cn('inline-flex shrink-0 items-center justify-center', className)}
      style={{ width: size, height: size }}
    >
      <span
        className="inline-flex items-center justify-center"
        style={
          scale === 1
            ? undefined
            : { transform: `scale(${scale})`, transformOrigin: 'center' }
        }
      >
        <AgentThinkingOrb
          state={state}
          size={orbSize}
          paused={paused}
          {...(label ? { 'aria-label': label } : { 'aria-hidden': true })}
        />
      </span>
    </span>
  );
}
