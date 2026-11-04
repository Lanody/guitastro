import type { MapDot } from '../data/types';
import { STRINGS, STRING_SHORT, TOP, allStrings, fretMidi, noteName } from '../music/theory';

interface Props {
  from: number;
  to: number;
  dots: MapDot[];
  /** Show note names inside dots. */
  names?: boolean;
  /** Highlight one position (e.g. last detected / revealed). */
  mark?: { s: number; f: number; tone: 'good' | 'bad' | 'info' } | null;
  onTap?: (s: number, f: number) => void;
  caption?: string;
}

const MARKERS = [3, 5, 7, 9, 12, 15, 17];

export function Fretboard({ from, to, dots, names = true, mark, onTap, caption }: Props) {
  const frets = to - from + 1;
  const colW = 42;
  const rowH = 30;
  const left = 26;
  const top = 22;
  const w = left + frets * colW + 8;
  const h = top + STRINGS * rowH;
  const x = (f: number) => left + (f - from + 0.5) * colW;
  const y = (s: number) => top + (TOP - s + 0.5) * rowH;

  return (
    <figure className="fretboard">
      {/* Up to ~9 frets scale to the screen; wider maps scroll sideways instead of shrinking. */}
      <svg viewBox={`0 0 ${w} ${h}`} style={{ minWidth: frets > 9 ? frets * 34 : undefined }} role="img" aria-label="Griffbrett">
        {Array.from({ length: frets }, (_, i) => from + i).map((f) => (
          <g key={f}>
            <text x={x(f)} y={13} className="fb-num">
              {f}
            </text>
            {MARKERS.includes(f) && <rect x={left + (f - from) * colW} y={top} width={colW} height={STRINGS * rowH} className="fb-marker" />}
            <line x1={left + (f - from + 1) * colW} x2={left + (f - from + 1) * colW} y1={top + rowH * 0.3} y2={top + rowH * (STRINGS - 0.3)} className="fb-fret" />
          </g>
        ))}
        {allStrings().map((s) => (
          <g key={s}>
            <text x={10} y={y(s) + 4} className="fb-str">
              {STRING_SHORT[s]}
            </text>
            <line x1={left} x2={w - 8} y1={y(s)} y2={y(s)} className="fb-string" style={{ strokeWidth: 0.8 + (TOP - s) * 0.25 }} />
            {onTap &&
              Array.from({ length: frets }, (_, i) => from + i).map((f) => (
                <rect
                  key={f}
                  x={left + (f - from) * colW}
                  y={y(s) - rowH / 2}
                  width={colW}
                  height={rowH}
                  className="fb-hit"
                  onClick={() => onTap(s, f)}
                />
              ))}
          </g>
        ))}
        {dots.map((d) => (
          <g key={`${d.s}-${d.f}`} className={`fb-dot ${d.kind}`} pointerEvents="none">
            <circle cx={x(d.f)} cy={y(d.s)} r={12} />
            {names && (
              <text x={x(d.f)} y={y(d.s) + 3.5}>
                {noteName(fretMidi(d.s, d.f))}
              </text>
            )}
          </g>
        ))}
        {mark && (
          <g className={`fb-mark ${mark.tone}`} pointerEvents="none">
            <circle cx={x(mark.f)} cy={y(mark.s)} r={13} />
            <text x={x(mark.f)} y={y(mark.s) + 3.5}>
              {noteName(fretMidi(mark.s, mark.f))}
            </text>
          </g>
        )}
      </svg>
      {caption && <figcaption>{caption}</figcaption>}
    </figure>
  );
}
