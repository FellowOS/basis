export type MixBarItem = {
  name: string;
  value: number;
  max?: number;
  pct?: number;
  color: string;
  detail?: string;
};

export function MixBarList({ items }: { items: MixBarItem[] }) {
  return (
    <div className="flex flex-col gap-4">
      {items.map((item) => {
        const pct =
          item.pct ??
          (item.max && item.max > 0 ? Math.round((item.value / item.max) * 100) : item.value);
        return (
          <div key={item.name}>
            <div className="mb-1.5 flex items-baseline justify-between gap-3">
              <span className="text-[13px] font-semibold text-muted-foreground">{item.name}</span>
              <div className="flex items-center gap-2">
                {item.detail ? (
                  <span className="font-mono text-xs font-bold text-foreground">{item.detail}</span>
                ) : (
                  <span className="font-mono text-xs font-bold text-foreground">{item.value}</span>
                )}
                <span className="text-[11.5px] text-muted-foreground">{pct}%</span>
              </div>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${Math.min(100, Math.max(0, pct))}%`, background: item.color }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
