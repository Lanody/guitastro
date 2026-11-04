import { useEffect, useState } from 'react';
import { droneOff, droneOn, playSequence, pluck } from '../audio/engine';
import { EarQuiz } from '../components/EarQuiz';
import { Fretboard } from '../components/Fretboard';
import { Tab } from '../components/Tab';
import { PathTab } from '../components/Widgets';
import type { MapDot } from '../data/types';
import { scaleProgress } from '../logic/progress';
import type { AppState, HitLog } from '../logic/state';
import { ROOTS, SCALES, SCALE_ROTATION, getScale } from '../music/scales';
import {
  STRINGS,
  STRING_DAT,
  STRING_LONG,
  TOP,
  degreeOf,
  fretMidi,
  fretRange,
  fretboardNotes,
  lowRoot,
  noteName,
  oneStringOctave,
  scalePositions,
  sixStringPath,
  type Pos,
  type ScaleDef,
} from '../music/theory';

interface Props {
  state: AppState;
  /** Make this scale and key the current scale block (optionally pinned). */
  onChoose: (id: string, root: number, pinned: boolean) => void;
  onEar: (logs: HitLog[]) => void;
}

/** Scale notes in a fret window; with `only`, notes outside that position are dimmed. */
function dots(sc: ScaleDef, from = 0, to = 15, only?: Pos[]): MapDot[] {
  const inPos = only && new Set(only.map((p) => `${p.s}:${p.f}`));
  return fretboardNotes(sc, from, to).map((p) => {
    const deg = degreeOf(sc, fretMidi(p.s, p.f));
    if (inPos && !inPos.has(`${p.s}:${p.f}`)) return { ...p, kind: 'dim' };
    return { ...p, kind: deg === 0 ? 'root' : sc.color.includes(deg) ? 'color' : 'note' };
  });
}

export function Scales({ state, onChoose, onEar }: Props) {
  const [sel, setSel] = useState(state.scale.id);
  const [root, setRoot] = useState(state.scale.root ?? 0);
  const [drone, setDrone] = useState(false);
  const [tapped, setTapped] = useState<{ s: number; f: number } | null>(null);
  /** Position shown in "Alle Lagen" (-1 = all at once). */
  const [lage, setLage] = useState(-1);
  useEffect(() => () => droneOff(), []);
  // The drone follows the selected key.
  useEffect(() => {
    if (drone) droneOn(lowRoot(root), state.settings.droneVolume);
    else droneOff();
  }, [drone, root, state.settings.droneVolume]);
  const sc = getScale(sel, root);
  const r = noteName(root);
  const current = state.scale.id === sc.id && (state.scale.root ?? 0) === root;
  const path = sixStringPath(sc);
  const positions = scalePositions(sc);
  const shownLage = lage < positions.length ? lage : -1;
  // All positions: the whole neck. One position: a window around it, neighbouring notes dimmed.
  const win: [number, number] = (() => {
    if (shownLage < 0) return [0, 17];
    const [lo, hi] = fretRange(positions[shownLage]);
    const from = Math.max(0, lo - 2);
    return [from, Math.min(17, Math.max(hi + 2, from + 8))];
  })();
  const octave = oneStringOctave(sc);
  const base = 48 + root;

  return (
    <div className="scales">
      <h1>Skalen</h1>
      <div className="scale-tabs">
        {SCALES.map((s) => (
          <button key={s.id} className={`chip${s.id === sel ? ' on' : ''}`} onClick={() => setSel(s.id)}>
            {s.name.replace('C-', '')}
            {s.id === state.scale.id && ' ●'}
            {scaleProgress(state, s.id).stars > 0 && <span className="chip-stars"> {'★'.repeat(scaleProgress(state, s.id).stars)}</span>}
          </button>
        ))}
      </div>

      <div className="scale-tabs root-tabs" aria-label="Grundton">
        {ROOTS.map((x) => (
          <button key={x.pc} className={`chip${x.pc === root ? ' on' : ''}`} onClick={() => setRoot(x.pc)}>
            {x.name}
          </button>
        ))}
      </div>

      <section className="card">
        <p className="eyebrow">Skala {SCALE_ROTATION.indexOf(sc.id) + 1} der Rotation</p>
        <h2 className="scale-name">{sc.name}</h2>
        <p className="scale-notes">
          {sc.intervals.map((iv, i) => (
            <span key={i} className={iv === 0 ? 'root' : sc.color.includes(iv) ? 'color' : ''}>
              {noteName(root + iv)}
            </span>
          ))}
        </p>
        <p className="muted small">Intervalle ab {r}: {sc.degrees.join(' – ')}</p>
        <p>{sc.compare}</p>
        <p className="muted">{sc.feel}</p>
        {current ? (
          <p className="small try">
            <b>Das ist deine aktuelle Skala.</b> Sie läuft im Skalen-Block der täglichen 30 Minuten.
          </p>
        ) : (
          <button className="btn primary wide try" onClick={() => onChoose(sc.id, root, false)}>
            Ab der nächsten Einheit üben: {sc.name}
          </button>
        )}
        <div className="row wrap">
          <button className="btn ghost small" onClick={() => playSequence([...sc.intervals, 12, ...[...sc.intervals].reverse()].map((i) => base + i), 140)}>
            ▶ Skala
          </button>
          <button className="btn ghost small" onClick={() => playSequence(sc.motif.map(([s, f]) => fretMidi(s, f)), 90)}>
            ▶ Motiv
          </button>
          <button
            className={`btn small ${drone ? 'on' : 'ghost'}`}
            onClick={() => setDrone(!drone)}
          >
            Drone {r}
          </button>
          {current && (
            <button className="btn small ghost" onClick={() => onChoose(sc.id, root, !state.scale.pinned)}>
              {state.scale.pinned ? 'Fixierung lösen' : 'Länger bei dieser Skala bleiben'}
            </button>
          )}
        </div>
      </section>

      <section className="card">
        <h3>Griffbrett · Bünde 0–15</h3>
        <p className="small muted">Tippe auf einen Ton zum Anhören – mit Drone hörst du, wie er über {r} klingt.</p>
        <Fretboard
          from={0}
          to={15}
          dots={dots(sc)}
          mark={tapped ? { ...tapped, tone: 'info' } : null}
          onTap={(s, f) => {
            pluck(fretMidi(s, f));
            setTapped({ s, f });
          }}
          caption={`Gold: ${r} · Türkis: ${sc.colorLabel} · ${STRING_LONG[TOP]} oben`}
        />
      </section>

      <section className="card">
        <h3>Alle Lagen · das ganze Griffbrett</h3>
        <p className="small muted">
          {sc.name} hat {positions.length} Lagen. Zusammen decken sie jeden Ton der Skala auf jeder Saite ab – ab Bund 12 wiederholt sich alles eine Oktave höher. Im Skalen-Block lernst du sie
          der Reihe nach.
        </p>
        <div className="scale-tabs" aria-label="Lage">
          <button className={`chip${shownLage === -1 ? ' on' : ''}`} onClick={() => setLage(-1)}>
            Alle
          </button>
          {positions.map((_, i) => (
            <button key={i} className={`chip${shownLage === i ? ' on' : ''}`} onClick={() => setLage(i)}>
              Lage {i + 1}
            </button>
          ))}
        </div>
        <Fretboard
          from={win[0]}
          to={win[1]}
          dots={dots(sc, win[0], win[1], shownLage >= 0 ? positions[shownLage] : undefined)}
          caption={shownLage >= 0 ? `Lage ${shownLage + 1}: Bund ${fretRange(positions[shownLage]).join('–')} · blass = Töne der anderen Lagen` : `Alle Töne von ${sc.name} bis Bund 17`}
        />
        {shownLage >= 0 && (
          <button className="btn ghost small" onClick={() => playSequence(positions[shownLage].map((p) => fretMidi(p.s, p.f)), 120)}>
            ▶ Lage {shownLage + 1} anhören
          </button>
        )}
      </section>

      <section className="card">
        <h3>Weg über alle {STRINGS} Saiten · Lage 1</h3>
        <PathTab scale={sc} />
        <p className="small muted">
          Ab Bund {path[0].f}: vom tiefen {noteName(fretMidi(path[0].s, path[0].f))} zum hohen {noteName(fretMidi(path[path.length - 1].s, path[path.length - 1].f))}. Anschließend rückwärts spielen. Der Startton ändert nicht das tonale Zentrum {r}.
        </p>
        <button className="btn ghost small" onClick={() => playSequence(path.map((p) => fretMidi(p.s, p.f)), 120)}>
          ▶ Anhören
        </button>
      </section>

      <section className="card">
        <h3>Horizontal · eine Oktave auf der {STRING_DAT[octave[0].s]}</h3>
        <Tab steps={octave.map((p) => ({ s: p.s, f: p.f }))} sub={2} barLen={8} />
        <p className="small muted">
          {r} bis {r}. Langsam spielen und die Hand passend mitverschieben.
        </p>
      </section>

      <section className="card">
        <h3>Höraufgabe und Mini-Motiv</h3>
        <p>{sc.listen}</p>
        <p className="small muted">{sc.motifText}</p>
      </section>

      <section className="card">
        <h3>Hör-Quiz: Welche Skala ist das?</h3>
        <EarQuiz droneVolume={state.settings.droneVolume} onDone={onEar} />
      </section>
    </div>
  );
}
