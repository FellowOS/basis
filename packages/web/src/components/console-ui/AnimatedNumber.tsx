import { useEffect, useRef, useState } from 'react';

interface Parsed {
  prefix: string;
  suffix: string;
  target: number;
  decimals: boolean;
}

/** Split "$84,210" / "3.42%" / "1,284" into prefix, numeric target, suffix. */
function parse(value: string | number): Parsed | null {
  const str = String(value);
  const m = str.match(/^(\D*?)([\d,]+(?:\.\d+)?)(.*)$/);
  if (!m) return null;
  const prefix = m[1] ?? '';
  const num = m[2];
  const suffix = m[3] ?? '';
  if (!num) return null;
  const target = parseFloat(num.replace(/,/g, ''));
  if (Number.isNaN(target)) return null;
  return { prefix, suffix, target, decimals: num.includes('.') };
}

const prefersReduced =
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/**
 * Counts up from 0 to a numeric value on mount, preserving the original
 * currency prefix, %/unit suffix, decimal precision and thousands separators.
 * Non-numeric values (e.g. "N/A") render unchanged.
 */
export function AnimatedNumber({
  value,
  duration = 1100,
  className,
}: {
  value: string | number;
  duration?: number;
  className?: string;
}) {
  const parsed = parse(value);
  const [display, setDisplay] = useState(() =>
    parsed && !prefersReduced ? format(parsed, 0) : String(value),
  );
  const frame = useRef<number>(0);

  useEffect(() => {
    if (!parsed || prefersReduced) {
      setDisplay(String(value));
      return;
    }
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      // easeOutCubic
      const eased = 1 - (1 - t) ** 3;
      setDisplay(format(parsed, parsed.target * eased));
      if (t < 1) frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, duration]);

  return <span className={className}>{display}</span>;
}

function format(p: Parsed, n: number): string {
  const num = p.decimals
    ? n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : Math.round(n).toLocaleString();
  return `${p.prefix}${num}${p.suffix}`;
}
