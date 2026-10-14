type HeroBackgroundProps = {
  className?: string;
};

/** Gradient hero backdrop (no WebGL / motion deps). */
export function HeroBackground({ className }: HeroBackgroundProps = {}) {
  return (
    <div
      className={['pointer-events-none absolute inset-0 z-0 overflow-hidden', className].filter(Boolean).join(' ')}
      aria-hidden
    >
      <div className="absolute inset-0 bg-[var(--hero-bg)]" />
      <div className="absolute inset-0 overflow-hidden">
        <div
          className="absolute inset-x-0 top-0 h-[360px] opacity-45 sm:h-[420px]"
          style={{
            background: 'var(--hero-glow-wash)',
            maskImage:
              'radial-gradient(ellipse 130% 100% at 50% 0%, #000 0%, #000 42%, rgb(0 0 0 / 0.55) 62%, transparent 78%)',
            WebkitMaskImage:
              'radial-gradient(ellipse 130% 100% at 50% 0%, #000 0%, #000 42%, rgb(0 0 0 / 0.55) 62%, transparent 78%)',
          }}
        />
        <div
          className="absolute top-[-40px] left-1/2 h-[280px] w-[160%] max-w-none -translate-x-1/2 opacity-50 blur-[70px] sm:h-[340px] sm:blur-[100px]"
          style={{ background: 'var(--hero-glow-bloom)' }}
        />
        <div
          className="absolute top-[180px] left-1/2 h-[298px] w-[587px] -translate-x-1/2 rounded-full blur-[40px]"
          style={{
            background: 'radial-gradient(ellipse at center, var(--hero-glow-mid) 0%, transparent 70%)',
          }}
        />
      </div>
    </div>
  );
}
