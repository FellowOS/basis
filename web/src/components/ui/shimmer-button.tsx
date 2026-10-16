import { forwardRef, type ComponentPropsWithoutRef, type CSSProperties } from 'react';
import { cn } from '@/lib/utils.js';

export type ShimmerButtonProps = ComponentPropsWithoutRef<'button'> & {
  shimmerColor?: string;
  shimmerSize?: string;
  borderRadius?: string;
  shimmerDuration?: string;
  background?: string;
};

export const ShimmerButton = forwardRef<HTMLButtonElement, ShimmerButtonProps>(
  (
    {
      shimmerColor = '#ffffff',
      shimmerSize = '0.05em',
      shimmerDuration = '3s',
      borderRadius = '100px',
      background = 'rgba(0, 0, 0, 1)',
      className,
      children,
      ...props
    },
    ref,
  ) => {
    return (
      <button
        style={
          {
            '--spread': '90deg',
            '--shimmer-color': shimmerColor,
            '--radius': borderRadius,
            '--speed': shimmerDuration,
            '--cut': shimmerSize,
            '--bg': background,
            borderRadius,
            background,
          } as CSSProperties
        }
        className={cn(
          'group relative z-0 flex cursor-pointer items-center justify-center overflow-hidden border border-white/10 px-6 py-3 whitespace-nowrap text-white',
          'transform-gpu transition-transform duration-300 ease-in-out active:translate-y-px',
          className,
        )}
        ref={ref}
        {...props}
      >
        <div
          className="pointer-events-none absolute inset-0 -z-30 overflow-visible blur-[2px]"
          style={{ containerType: 'size' }}
        >
          <div
            className="absolute inset-0 animate-shimmer-slide rounded-none motion-reduce:animate-none"
            style={{ height: '100cqh', aspectRatio: '1' }}
          >
            <div
              className="absolute w-auto animate-spin-around motion-reduce:animate-none"
              style={{
                inset: '-100%',
                background:
                  'conic-gradient(from calc(270deg - (var(--spread) * 0.5)), transparent 0, var(--shimmer-color) var(--spread), transparent var(--spread))',
              }}
            />
          </div>
        </div>

        <span className="relative z-10 inline-flex items-center">{children}</span>

        <div
          className={cn(
            'pointer-events-none absolute inset-0',
            'shadow-[inset_0_-8px_10px_#ffffff1f]',
            'transform-gpu transition-all duration-300 ease-in-out',
            'group-hover:shadow-[inset_0_-6px_10px_#ffffff3f]',
            'group-active:shadow-[inset_0_-10px_10px_#ffffff3f]',
          )}
        />

        <div
          className="pointer-events-none absolute -z-20"
          style={{
            inset: 'var(--cut)',
            borderRadius: 'var(--radius)',
            background: 'var(--bg)',
          }}
        />
      </button>
    );
  },
);

ShimmerButton.displayName = 'ShimmerButton';
