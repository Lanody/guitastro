import { useState } from 'react';
import type { PhaseChords } from '../data/types';
import { STRING_SHORT, TOP, allStrings, type Pos } from '../music/theory';

const SPAN = 4;

/** Small grip diagram, oriented like the tab: highest string on top, frets left to right. */
export function ChordBox({ grip }: { grip: Pos[] }) {
  const fretted = grip.filter((p) => p.f > 0).map((p) => p.f);
  const max = Math.max(0, ...fretted);
  const from = max <= SPAN ? 1 : Math.min(...fretted);
  const colW = 17;
  const rowH = 11;
  const left = 22;
  const top = 6;
  const w = left + SPAN * colW + 4;
  const h = top + TOP * rowH + 16;
  const x = (f: number) => left + (f - from + 0.5) * colW;
  const y = (s: number) => top + (TOP - s) * rowH;
  return (
    <svg className="chord-box" viewBox={`0 0 ${w} ${h}`} role="img" aria-label={grip.map((p) => `${STRING_SHORT[p.s]} ${p.f}`).join(', ')}>
      {allStrings().map((s) => {
        const p = grip.find((g) => g.s === s);
        return (
          <g key={s}>
            <line x1={left} x2={w - 4} y1={y(s)} y2={y(s)} className="cb-string" />
            <text x={4} y={y(s) + 3.5} className="cb-label">
              {STRING_SHORT[s]}
            </text>
            {!p && (
              <text x={left - 6} y={y(s) + 3.5} className="cb-mute">
                ×
              </text>
            )}
            {p?.f === 0 && <circle cx={left - 6} cy={y(s)} r={3} className="cb-open" />}
            {p && p.f > 0 && <circle cx={x(p.f)} cy={y(s)} r={4.6} className="cb-dot" />}
          </g>
        );
      })}
      {Array.from({ length: SPAN + 1 }, (_, k) => (
        <line key={k} x1={left + k * colW} x2={left + k * colW} y1={y(TOP)} y2={y(0)} className={k === 0 && from === 1 ? 'cb-nut' : 'cb-fret'} />
      ))}
      <text x={x(from)} y={h - 3} className="cb-num">
        {from}
      </text>
    </svg>
  );
}

const BEATS: Record<number, string> = { 2: 'halber Takt', 4: '1 Takt', 8: '2 Takte' };

/** The phase's progression: one card per chord, the sounding one highlighted. */
export function ChordChart({ chords, current }: { chords: PhaseChords; current: number }) {
  const [reveal, setReveal] = useState(false);
  const hidden = chords.hide && !reveal;
  return (
    <section className="card chord-card">
      <div className="chord-row">
        {chords.slots.map((c, i) => (
          <div key={i} className={`chord${i === current ? ' on' : ''}`}>
            <b>{c.name}</b>
            <span className="small muted" title="Stufe in der Tonart">Stufe {c.roman}</span>
            {hidden ? <span className="chord-hidden">?</span> : <ChordBox grip={c.grip} />}
          </div>
        ))}
      </div>
      <div className="row wrap chord-foot">
        <span className="small muted">Jeder Akkord: {BEATS[chords.beatsPer] ?? `${chords.beatsPer} Schläge`} · Bundzahl unter dem Griff</span>
        {chords.hide && (
          <button className="btn ghost small" onClick={() => setReveal(!reveal)}>
            {reveal ? 'Griffe abdecken' : 'Griffe aufdecken'}
          </button>
        )}
      </div>
    </section>
  );
}
