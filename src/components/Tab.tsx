import { memo, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { Note, Step } from '../data/types';
import { DEFAULT_BEATS, barSteps, countLabel, padBar } from '../music/meter';
import { STRING_SHORT, TOP, type Pos } from '../music/theory';

interface Props {
  steps: Step[];
  /** Grid steps per beat — a bar is sub * beats steps long. */
  sub: number;
  /** Beats per bar (default 4 = 4/4). */
  beats?: number;
  /** Show all six strings even if unused. */
  allStrings?: boolean;
  /** Static preview: n steps per line, no bar lines, no count row. */
  barLen?: number;
  /** Group view: note groups of n steps, each bar's rests shrunk to one column per beat; one line (two on narrow screens). */
  groups?: number;
  /** Column sounding right now (tab playback), highlighted. */
  playhead?: number;
}

/**
 * Splits steps into lines of equal time: every step is one column of the same width,
 * so every bar has the same length and the rhythm is visible in the spacing.
 * Lines break only at bar lines (default: two bars per line, so sparse sixteenth bars
 * like speed bursts don't each get their own staff). `lineLen` (static previews) breaks
 * every n steps instead.
 */
export function layoutTab(len: number, sub: number, lineLen?: number, barsPerLine = 2, beats = DEFAULT_BEATS): number[][] {
  const per = lineLen ?? barSteps(sub, beats) * barsPerLine;
  const lines: number[][] = [];
  for (let i = 0; i < len; i += per) lines.push(Array.from({ length: Math.min(per, len - i) }, (_, k) => i + k));
  return lines;
}

/** Strings that keep ringing at each step ('hold' after a note or chord). */
export function sustained(steps: Step[]): number[][] {
  let ringing: number[] = [];
  return steps.map((st) => {
    if (typeof st === 'object') ringing = [st.s, ...(st.chord ?? []).map((p) => p.s)];
    else if (st === 'rest') ringing = [];
    return st === 'hold' ? ringing : [];
  });
}

/**
 * Palm-mute marks above the tab: "PM" where a muted run starts, "–" while it
 * lasts (holds and rests inside the run included), nothing elsewhere.
 */
export function palmMarks(steps: Step[]): string[] {
  const out = steps.map(() => '');
  let on = false;
  steps.forEach((st, i) => {
    if (typeof st === 'object') {
      out[i] = st.pm ? (on ? '–' : 'PM') : '';
      on = !!st.pm;
    } else if (on) {
      const next = steps.slice(i + 1).find((x): x is Note => typeof x === 'object');
      if (next?.pm) out[i] = '–';
      else on = false;
    }
  });
  return out;
}

/** Column width in em: wide enough for the longest fret label, wider for eighths. */
function columnWidth(notes: (Note | Pos)[], sub: number) {
  const digits = Math.max(1, ...notes.map((x) => String(x.f).length + ('t' in x && x.t ? 0.6 : 0)));
  return Math.max(sub >= 4 ? 1.4 : 1.9, digits * 0.62 + 0.4);
}

/** Down- and upstroke marks as in printed tab. */
const STROKE_MARK = { down: '⊓', up: 'V' } as const;

function NoteText({ n }: { n: Note }) {
  return (
    <span className="tab-num">
      {(n.t === 'h' || n.t === 'p') && <span className="tab-tech">{n.t}</span>}
      {n.f}
      {n.t === '~' && <span className="tab-tech">~</span>}
    </span>
  );
}

/** Group view: all groups in one line, or half of them per line when it doesn't fit. */
export function groupLines(len: number, group: number, split: boolean): number[][] {
  const count = Math.ceil(len / group);
  return layoutTab(len, 1, (split ? Math.ceil(count / 2) : count) * group);
}

/**
 * Group view: each note group is followed by the rest of its bar as one narrow rest
 * column per beat (not one per step), so every bar still counts 1 … 4.
 */
export function withRestBeats(steps: Step[], group: number, sub: number, beats = DEFAULT_BEATS) {
  const played = Math.ceil(group / sub);
  const pause = Math.max(0, beats - played);
  const out: Step[] = [];
  for (let i = 0; i < steps.length; i += group) out.push(...steps.slice(i, i + group), ...Array.from({ length: pause }, () => 'rest' as const));
  const bar = group + pause;
  /** Count label and whether the column starts a beat. */
  const count = (i: number): [string, boolean] => {
    const p = i % bar;
    return p < group ? [countLabel(p, sub, beats), p % sub === 0] : [String(played + p - group + 1), true];
  };
  return { steps: out, bar, count };
}

/**
 * The tab in time, for playback: the steps to play and, per step, the column it is
 * shown in (-1 = none). Group view plays each group followed by the rest of its bar.
 */
export function playback(steps: Step[], sub: number, beats = DEFAULT_BEATS, group?: number) {
  if (!group) return { steps, column: (i: number) => i };
  const len = barSteps(sub, beats);
  const played = Math.ceil(group / sub);
  const shownBar = group + Math.max(0, beats - played);
  const out: Step[] = [];
  for (let i = 0; i < steps.length; i += group) out.push(...padBar(steps.slice(i, i + group), sub, beats));
  const column = (i: number) => {
    const p = i % len;
    const base = Math.floor(i / len) * shownBar;
    if (p < group) return base + p;
    const b = Math.floor(p / sub);
    return b >= played ? base + group + b - played : -1;
  };
  return { steps: out, column };
}

export const Tab = memo(function Tab({ steps, sub, beats = DEFAULT_BEATS, allStrings, barLen, groups, playhead }: Props) {
  const lineRefs = useRef<(HTMLDivElement | null)[]>([]);
  const box = useRef<HTMLDivElement>(null);
  // Narrow screens: if a line overflows, first tighten the columns (fit 1), then one bar per line (fit 2).
  const [fit, setFit] = useState(0);
  const [width, setWidth] = useState(0);
  const notes = steps.filter((x): x is Note => typeof x === 'object');
  const grouped = groups ? withRestBeats(steps, groups, sub, beats) : null;
  const cols = grouped?.steps ?? steps;
  const lines = !notes.length ? [] : grouped ? groupLines(cols.length, grouped.bar, fit === 2) : layoutTab(steps.length, sub, barLen, fit === 2 ? 1 : 2, beats);
  const counted = barLen === undefined;

  useEffect(() => {
    const el = box.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  useLayoutEffect(() => setFit(0), [steps, sub, beats, width]);
  useLayoutEffect(() => {
    const el = box.current;
    if (fit < 2 && el && lineRefs.current.some((l) => l && l.offsetWidth > el.clientWidth + 1)) setFit(fit + 1);
  });

  if (!notes.length) return null;
  const spots = notes.flatMap((x) => [x, ...(x.chord ?? [])]);
  const lo = allStrings ? 0 : Math.min(...spots.map((x) => x.s));
  const hi = allStrings ? TOP : Math.max(...spots.map((x) => x.s));
  const strings: number[] = [];
  for (let s = hi; s >= lo; s--) strings.push(s);

  // Pick directions get their own row above the strings (only when a pattern marks them).
  const strokes = notes.some((x) => x.stroke) ? 1 : 0;
  const pm = notes.some((x) => x.pm) ? 1 : 0;
  const marks = pm ? palmMarks(cols) : [];
  const head = strokes + pm;
  const stepW = columnWidth(spots, sub) * (fit ? 0.82 : 1);
  const bar = grouped?.bar ?? barSteps(sub, beats);
  const ring = sustained(cols);
  const count = grouped?.count ?? ((i: number): [string, boolean] => [countLabel(i, sub, beats), i % sub === 0]);

  return (
    <div className={`tab${fit ? ' compact' : ''}`} role="img" aria-label={`Tabulatur${counted ? `, ${beats}/4-Takt` : ''}${strokes ? ', mit Anschlagsrichtung (⊓ ab, V auf)' : ''}${pm ? ', PM = Palm-Mute' : ''}`} ref={box}>
      {lines.map((idxs, li) => (
        <div
          key={li}
          ref={(el) => {
            lineRefs.current[li] = el;
          }}
          className="tab-line"
          style={{
            gridTemplateColumns: `auto repeat(${idxs.length}, ${stepW}em)`,
            gridTemplateRows: `${strokes ? '1.2em ' : ''}${pm ? '1.1em ' : ''}repeat(${strings.length}, 1.7em)${counted ? ' 1.3em' : ''}`,
          }}
        >
          {strings.map((s, r) => (
            <span key={`l${s}`} className="tab-label" style={{ gridRow: r + 1 + head, gridColumn: 1 }}>
              {STRING_SHORT[s]}
            </span>
          ))}
          {idxs.map((i, c) => {
            const st = cols[i];
            const rest = st === 'rest';
            const barStart = counted && c > 0 && i % bar === 0;
            const [label, beat] = count(i);
            const cls = `${rest ? ' rest' : ''}${barStart ? ' bar' : ''}${i === playhead ? ' now' : ''}`;
            return [
              strokes ? (
                <span key={`${i}-stroke`} className="tab-stroke" style={{ gridRow: 1, gridColumn: c + 2 }}>
                  {typeof st === 'object' && st.stroke ? STROKE_MARK[st.stroke] : null}
                </span>
              ) : null,
              pm ? (
                <span key={`${i}-pm`} className="tab-pm" style={{ gridRow: 1 + strokes, gridColumn: c + 2 }}>
                  {c === 0 && marks[i] === '–' ? 'PM' : marks[i]}
                </span>
              ) : null,
              ...strings.map((s, r) => {
                const note = typeof st === 'object' ? (st.s === s ? st : st.chord?.find((p) => p.s === s)) : null;
                return (
                  <span
                    key={`${i}-${s}`}
                    className={`tab-cell${cls}${ring[i].includes(s) ? ' hold' : ''}`}
                    style={{ gridRow: r + 1 + head, gridColumn: c + 2 }}
                  >
                    {note ? <NoteText n={note} /> : null}
                  </span>
                );
              }),
              counted ? (
                <span key={`${i}-count`} className={`tab-count${cls}${beat ? ' beat' : ''}`} style={{ gridRow: strings.length + 1 + head, gridColumn: c + 2 }}>
                  {label}
                </span>
              ) : null,
            ];
          })}
        </div>
      ))}
    </div>
  );
});
