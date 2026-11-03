import { memo, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { Note, Step } from '../data/types';
import { DEFAULT_BEATS, barSteps, countLabel } from '../music/meter';
import { STRING_SHORT } from '../music/theory';

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
}

/**
 * Splits steps into lines of equal time: every step is one column of the same width,
 * so every bar has the same length and the rhythm is visible in the spacing.
 * Lines break only at bar lines (default: up to 16 steps per line, at least one bar).
 * `lineLen` (static previews) breaks every n steps instead.
 */
export function layoutTab(len: number, sub: number, lineLen?: number, maxSteps?: number, beats = DEFAULT_BEATS): number[][] {
  const bar = barSteps(sub, beats);
  const per = lineLen ?? Math.max(bar, Math.floor((maxSteps ?? 16) / bar) * bar);
  const lines: number[][] = [];
  for (let i = 0; i < len; i += per) lines.push(Array.from({ length: Math.min(per, len - i) }, (_, k) => i + k));
  return lines;
}

/** String a note keeps ringing on at each step ('hold' after a note), or -1. */
export function sustained(steps: Step[]): number[] {
  let ringing = -1;
  return steps.map((st) => {
    if (typeof st === 'object') ringing = st.s;
    else if (st === 'rest') ringing = -1;
    return st === 'hold' ? ringing : -1;
  });
}

/** Column width in em: wide enough for the longest fret label, wider for eighths. */
function columnWidth(notes: Note[], sub: number) {
  const digits = Math.max(1, ...notes.map((x) => String(x.f).length + (x.t ? 0.6 : 0)));
  return Math.max(sub >= 4 ? 1.4 : 1.9, digits * 0.62 + 0.4);
}

function NoteText({ n }: { n: Note }) {
  return (
    <span className="tab-num">
      {(n.t === 'h' || n.t === 'p') && <span className="tab-tech">{n.t}</span>}
      {n.f}
      {n.t === '~' && <span className="tab-tech">~</span>}
    </span>
  );
}

export const Tab = memo(function Tab({ steps, sub, beats = DEFAULT_BEATS, allStrings, barLen }: Props) {
  const lineRefs = useRef<(HTMLDivElement | null)[]>([]);
  const box = useRef<HTMLDivElement>(null);
  // Narrow screens: if a line overflows, first tighten the columns (fit 1), then one bar per line (fit 2).
  const [fit, setFit] = useState(0);
  const [width, setWidth] = useState(0);
  const notes = steps.filter((x): x is Note => typeof x === 'object');
  const lines = notes.length ? layoutTab(steps.length, sub, barLen, fit === 2 ? 1 : undefined, beats) : [];
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
  const lo = allStrings ? 0 : Math.min(...notes.map((x) => x.s));
  const hi = allStrings ? 5 : Math.max(...notes.map((x) => x.s));
  const strings: number[] = [];
  for (let s = hi; s >= lo; s--) strings.push(s);

  const stepW = columnWidth(notes, sub) * (fit ? 0.82 : 1);
  const bar = barSteps(sub, beats);
  const ring = sustained(steps);

  return (
    <div className={`tab${fit ? ' compact' : ''}`} role="img" aria-label={counted ? `Tabulatur, ${beats}/4-Takt` : 'Tabulatur'} ref={box}>
      {lines.map((idxs, li) => (
        <div
          key={li}
          ref={(el) => {
            lineRefs.current[li] = el;
          }}
          className="tab-line"
          style={{
            gridTemplateColumns: `auto repeat(${idxs.length}, ${stepW}em)`,
            gridTemplateRows: `repeat(${strings.length}, 1.7em)${counted ? ' 1.3em' : ''}`,
          }}
        >
          {strings.map((s, r) => (
            <span key={`l${s}`} className="tab-label" style={{ gridRow: r + 1, gridColumn: 1 }}>
              {STRING_SHORT[s]}
            </span>
          ))}
          {idxs.map((i, c) => {
            const st = steps[i];
            const rest = st === 'rest';
            const barStart = counted && c > 0 && i % bar === 0;
            const cls = `${rest ? ' rest' : ''}${barStart ? ' bar' : ''}`;
            return [
              ...strings.map((s, r) => {
                const note = typeof st === 'object' && st.s === s ? st : null;
                return (
                  <span
                    key={`${i}-${s}`}
                    className={`tab-cell${cls}${ring[i] === s ? ' hold' : ''}`}
                    style={{ gridRow: r + 1, gridColumn: c + 2 }}
                  >
                    {note ? <NoteText n={note} /> : null}
                  </span>
                );
              }),
              counted ? (
                <span key={`${i}-count`} className={`tab-count${cls}${i % sub === 0 ? ' beat' : ''}`} style={{ gridRow: strings.length + 1, gridColumn: c + 2 }}>
                  {countLabel(i, sub, beats)}
                </span>
              ) : null,
            ];
          })}
        </div>
      ))}
    </div>
  );
});
