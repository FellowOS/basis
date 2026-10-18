import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button.js';
import { DatePicker } from '@/components/app/shared/primitives/date-picker.js';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible.js';
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field.js';
import { Input } from '@/components/ui/input.js';
import { PublicIcon } from '@/components/app/shared/primitives/public-icon.js';
import { Spinner } from '@/components/ui/spinner.js';
import { useI18n } from '@/i18n/context.js';
import {
  calendarDateFromIso,
  endOfLocalDayIso,
  startOfLocalDay,
  startOfLocalDayIso,
} from '@/lib/temporal/day-range.js';
import { parseInstantMs } from '@/lib/temporal/instant.js';
import { resolveScrubberBounds } from '@/lib/temporal/scrubber-bounds.js';
import { TemporalRangeTimeline } from '@/lib/temporal/TemporalRangeTimeline.js';

export function KbTemporalRangePicker({
  fromTime,
  toTime,
  onFromChange,
  onToChange,
  ledgerMin,
  ledgerMax,
  boundsLoading = false,
  disabled = false,
}: {
  fromTime: string;
  toTime: string;
  onFromChange: (iso: string) => void;
  onToChange: (iso: string) => void;
  ledgerMin?: string;
  ledgerMax?: string;
  boundsLoading?: boolean;
  disabled?: boolean;
}) {
  const { t } = useI18n();
  const copy = t.kbGraphDiff;
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const now = useMemo(() => new Date(), []);

  const { minBound, maxBound } = useMemo(
    () =>
      resolveScrubberBounds({
        minDate: ledgerMin,
        maxDate: ledgerMax,
        now,
      }),
    [ledgerMax, ledgerMin, now],
  );

  const minDay = startOfLocalDay(minBound);
  const maxDay = startOfLocalDay(maxBound);
  const disabledMatchers = [{ before: minDay }, { after: maxDay }] as const;

  const fromDay = fromTime.trim() ? calendarDateFromIso(fromTime) : undefined;
  const toDay = toTime.trim() ? calendarDateFromIso(toTime) : undefined;

  function onSelectFrom(day: Date | undefined) {
    if (!day) return;
    const fromIso = startOfLocalDayIso(day);
    onFromChange(fromIso);
    const toMs = parseInstantMs(toTime);
    const fromMs = parseInstantMs(fromIso);
    if (toMs === null || fromMs === null || toMs < fromMs) {
      onToChange(endOfLocalDayIso(day));
    }
  }

  function onSelectTo(day: Date | undefined) {
    if (!day) return;
    const toIso = endOfLocalDayIso(day);
    const toMs = parseInstantMs(toIso);
    const fromMs = parseInstantMs(fromTime);
    if (fromMs !== null && toMs !== null && toMs < fromMs) {
      onFromChange(startOfLocalDayIso(day));
    }
    onToChange(toIso);
  }

  const showTimeline =
    advancedOpen && !boundsLoading && Boolean(fromTime.trim() && toTime.trim());

  return (
    <div className="space-y-4">
      <Field>
        <FieldDescription>{copy.dayRangeHint}</FieldDescription>
        {boundsLoading ? (
          <div className="mt-3 flex min-h-[2.75rem] items-center justify-center rounded-lg border border-border bg-muted/20">
            <Spinner className="size-5" />
            <span className="sr-only">{copy.boundsLoading}</span>
          </div>
        ) : (
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="graph-diff-from-date">{copy.fromDateLabel}</FieldLabel>
              <DatePicker
                id="graph-diff-from-date"
                value={fromDay}
                onChange={onSelectFrom}
                placeholder={copy.pickDate}
                disabled={disabled}
                disabledMatchers={[...disabledMatchers]}
                defaultMonth={fromDay ?? minDay}
                startMonth={minDay}
                endMonth={maxDay}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="graph-diff-to-date">{copy.toDateLabel}</FieldLabel>
              <DatePicker
                id="graph-diff-to-date"
                value={toDay}
                onChange={onSelectTo}
                placeholder={copy.pickDate}
                disabled={disabled}
                disabledMatchers={[...disabledMatchers]}
                defaultMonth={toDay ?? maxDay}
                startMonth={minDay}
                endMonth={maxDay}
              />
            </Field>
          </div>
        )}
      </Field>

      <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
        <CollapsibleTrigger asChild>
          <Button type="button" variant="ghost" size="sm" className="h-8 gap-1.5 px-2 text-xs">
            <PublicIcon name="settings" size={14} />
            {copy.advancedTimeToggle}
            <PublicIcon
              name="chevron-down"
              size={14}
              className={advancedOpen ? 'rotate-180 transition-transform' : 'transition-transform'}
            />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-4 pt-3">
          {showTimeline ? (
            <>
              <TemporalRangeTimeline
                ledgerMin={ledgerMin ?? fromTime}
                ledgerMax={ledgerMax ?? toTime}
                fromIso={fromTime}
                toIso={toTime}
                onFromIsoChange={onFromChange}
                onToIsoChange={onToChange}
                disabled={disabled}
              />
              <p className="text-[11px] text-muted-foreground" data-testid="graph-diff-scrubber-hint">
                {copy.scrubberHint}
              </p>
            </>
          ) : boundsLoading ? null : (
            <p className="text-[11px] text-muted-foreground">{copy.scrubberUnavailable}</p>
          )}
          <Field>
            <FieldDescription>{copy.rangeDialogDesc}</FieldDescription>
            <div className="mt-2 grid gap-4 md:grid-cols-2">
              <Input
                id="graph-diff-from"
                value={fromTime}
                onChange={(e) => onFromChange(e.target.value)}
                className="font-mono text-xs"
                autoComplete="off"
                spellCheck={false}
                disabled={disabled}
                aria-label={copy.fromLabel}
              />
              <Input
                id="graph-diff-to"
                value={toTime}
                onChange={(e) => onToChange(e.target.value)}
                className="font-mono text-xs"
                autoComplete="off"
                spellCheck={false}
                disabled={disabled}
                aria-label={copy.toLabel}
              />
            </div>
          </Field>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
