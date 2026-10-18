import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { DataSet } from "vis-data";
import { Timeline } from "vis-timeline";
import type { TimelineOptions } from "vis-timeline";
import "vis-timeline/styles/vis-timeline-graph2d.css";
import { Button } from "@/components/ui/button.js";
import {
  graphTimelineCanvasHost,
  graphTimelineControls,
  graphTimelineDate,
  graphTimelineDateActive,
  graphTimelineLabel,
  graphTimelinePlayBtn,
  graphTimelinePlayBtnActive,
  graphTimelineShell,
  graphTimelineVisHost,
} from "@/lib/graph/graph-ui-classes.js";
import { useI18n } from "@/i18n/context.js";
import { fmt, formatLocaleNumber, formatLocaleYearMonth } from "@/i18n/format.js";
import type { Locale } from "@/i18n/locale.js";
import { cn } from "@/lib/utils.js";
import { GRAPH_THEME } from "./graphTheme";
import { DEFAULT_MIN_DATE, resolvePlayStepMs, resolveScrubberBounds } from "./temporalScrubberBounds";
import { buildTimelineAxisFormat } from "./timelineAxisFormat.js";

export interface TimelinePanelProps {
  onTimeChange: (time: Date) => void;
  minDate?: string;
  maxDate?: string;
}

const PLAYHEAD_ID = "playhead";
const PLAY_INTERVAL_MS = 500;
const ONE_DAY_MS = 1000 * 60 * 60 * 24;

const VIS_OVERRIDE_CSS = `
  .sem-timeline-wrap .vis-timeline { border: none !important; background: transparent !important; overflow: visible !important; }
  .sem-timeline-wrap .vis-panel.vis-background, .sem-timeline-wrap .vis-panel.vis-center { background: transparent !important; }
  .sem-timeline-wrap .vis-panel { border-color: ${GRAPH_THEME.ui.timeline.border} !important; }
  .sem-timeline-wrap .vis-time-axis .vis-text {
    color: ${GRAPH_THEME.ui.timeline.text} !important;
    font-size: 11px !important;
    font-family: 'JetBrains Mono', 'Fira Code', monospace !important;
    padding-top: 3px !important;
  }
  .sem-timeline-wrap .vis-time-axis .vis-text.vis-major {
    color: ${GRAPH_THEME.ui.timeline.textStrong} !important;
    font-weight: 700 !important;
    font-size: 12px !important;
  }
  .sem-timeline-wrap .vis-time-axis .vis-grid.vis-minor { border-color: ${GRAPH_THEME.ui.timeline.gridMinor} !important; }
  .sem-timeline-wrap .vis-time-axis .vis-grid.vis-major { border-color: ${GRAPH_THEME.ui.timeline.gridMajor} !important; }
  .sem-timeline-wrap .vis-custom-time.${PLAYHEAD_ID} {
    background: ${GRAPH_THEME.ui.timeline.playheadSoft} !important;
    width: 2px !important;
    cursor: ew-resize !important;
    z-index: 5 !important;
  }
  .sem-timeline-wrap .vis-custom-time.${PLAYHEAD_ID} > .vis-custom-time-marker {
    background: ${GRAPH_THEME.ui.timeline.playhead} !important;
    color: ${GRAPH_THEME.ui.text.inverse} !important;
    font-size: 10px !important;
    font-weight: 700 !important;
    border-radius: 3px !important;
    padding: 1px 5px !important;
    white-space: nowrap !important;
    box-shadow: 0 0 8px rgba(98, 226, 205, 0.45) !important;
  }
  .sem-timeline-wrap .vis-current-time { display: none !important; }
  .sem-timeline-wrap .vis-panel.vis-left { display: none !important; }
`;

export function TimelinePanel({ onTimeChange, minDate, maxDate }: TimelinePanelProps) {
  const { t, locale } = useI18n();
  const ws = t.kbGraphWorkspace.workspace;
  const containerRef = useRef<HTMLDivElement>(null);
  const timelineRef = useRef<Timeline | null>(null);
  const playheadRef = useRef<Date>(DEFAULT_MIN_DATE);
  const playIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const formatPlayhead = useCallback(
    (value: Date) => formatLocaleYearMonth(locale as Locale, value),
    [locale],
  );
  const [displayDate, setDisplayDate] = useState(() =>
    formatLocaleYearMonth(locale as Locale, DEFAULT_MIN_DATE),
  );
  const onTimeChangeRef = useRef(onTimeChange);
  onTimeChangeRef.current = onTimeChange;
  const formatPlayheadRef = useRef(formatPlayhead);
  formatPlayheadRef.current = formatPlayhead;

  // Captured once per mount so re-renders keep the same reference and do not
  // retrigger the timeline effect below.
  const now = useMemo(() => new Date(), []);
  const { minBound, maxBound, defaultTime } = useMemo(
    () => resolveScrubberBounds({ minDate, maxDate, now }),
    [maxDate, minDate, now],
  );
  const axisFormat = useMemo(
    () => buildTimelineAxisFormat(locale as Locale),
    [locale],
  );

  useEffect(() => {
    timelineRef.current?.setOptions({ format: axisFormat });
  }, [axisFormat]);

  useEffect(() => {
    if (!containerRef.current) return;

    const timeline = timelineRef.current;
    if (!timeline) {
      const items = new DataSet([]);
      const options: TimelineOptions = {
        height: "100%",
        min: minBound,
        max: maxBound,
        start: minBound,
        end: maxBound,
        showCurrentTime: false,
        zoomable: true,
        moveable: true,
        zoomMin: ONE_DAY_MS,
        zoomMax: 1000 * 60 * 60 * 24 * 365 * 80,
        showMajorLabels: true,
        showMinorLabels: true,
        orientation: { axis: "bottom" },
        margin: { item: 0, axis: 0 },
        selectable: false,
        stack: false,
      } as TimelineOptions;

      const nextTimeline = new Timeline(containerRef.current, items, options);
      timelineRef.current = nextTimeline;
      playheadRef.current = defaultTime;
      nextTimeline.addCustomTime(defaultTime, PLAYHEAD_ID);
      nextTimeline.on("timechange", (props: { id: string; time: Date }) => {
        if (props.id !== PLAYHEAD_ID) return;
        playheadRef.current = props.time;
        nextTimeline.setCustomTime(props.time, PLAYHEAD_ID);
        onTimeChangeRef.current(props.time);
        setDisplayDate(formatPlayheadRef.current(props.time));
      });
      onTimeChangeRef.current(defaultTime);
      setDisplayDate(formatPlayheadRef.current(defaultTime));
      return () => {
        nextTimeline.destroy();
        timelineRef.current = null;
      };
    }

    timeline.setOptions({ min: minBound, max: maxBound, start: minBound, end: maxBound });
  }, [defaultTime, maxBound, minBound]);

  const startPlay = useCallback(() => {
    if (playIntervalRef.current) return;
    playIntervalRef.current = setInterval(() => {
      const timeline = timelineRef.current;
      if (!timeline) return;
      const next = new Date(playheadRef.current.getTime() + resolvePlayStepMs(minBound, maxBound));
      if (next >= maxBound) {
        next.setTime(minBound.getTime());
      }
      playheadRef.current = next;
      timeline.setCustomTime(next, PLAYHEAD_ID);
      onTimeChangeRef.current(next);
      setDisplayDate(formatPlayheadRef.current(next));
    }, PLAY_INTERVAL_MS);
  }, [maxBound, minBound]);

  const stopPlay = useCallback(() => {
    if (playIntervalRef.current) {
      clearInterval(playIntervalRef.current);
      playIntervalRef.current = null;
    }
  }, []);

  const togglePlay = useCallback(() => {
    setIsPlaying((previous) => {
      if (previous) {
        stopPlay();
        return false;
      }
      startPlay();
      return true;
    });
  }, [startPlay, stopPlay]);

  useEffect(() => () => stopPlay(), [stopPlay]);

  useEffect(() => {
    setDisplayDate(formatPlayhead(playheadRef.current));
  }, [formatPlayhead]);

  return (
    <div className={graphTimelineShell}>
      <style>{VIS_OVERRIDE_CSS}</style>
      <div className={graphTimelineControls}>
        <Button
          id="temporal-play-btn"
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={togglePlay}
          title={isPlaying ? ws.timelinePause : ws.timelinePlay}
          className={cn(graphTimelinePlayBtn, isPlaying && graphTimelinePlayBtnActive)}
        >
          {isPlaying ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" /></svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21" /></svg>
          )}
        </Button>
        <span className={cn(graphTimelineDate, isPlaying && graphTimelineDateActive)}>
          {displayDate}
        </span>
      </div>

      <div className={cn(graphTimelineLabel, "flex min-w-0 flex-col gap-0.5")}>
        <span>
          {fmt(ws.timelineScrubber, {
            minYear: formatLocaleNumber(locale as Locale, minBound.getFullYear()),
            maxYear: formatLocaleNumber(locale as Locale, maxBound.getFullYear()),
          })}
        </span>
        <span
          className="text-[10px] font-normal leading-snug text-muted-foreground"
          data-testid="graph-temporal-hint"
        >
          {ws.temporalPlaybackHint}
        </span>
      </div>

      <div className={graphTimelineVisHost}>
        <div ref={containerRef} className={graphTimelineCanvasHost} />
      </div>
    </div>
  );
}
