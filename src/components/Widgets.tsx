import { useState } from 'react';
import { droneActive, droneOff, droneOn, playSequence, pluck } from '../audio/engine';
import type { Step } from '../data/types';
import type { HitLog } from '../logic/state';
import { STRINGS, STRING_DAT, fretMidi, lowRoot, midiToPc, noteName, oneStringOctave, sixStringPath, type ScaleDef } from '../music/theory';
import { Tab } from './Tab';

/** C1 · Hören: compare the reference tone with the scale's colour tone over the tonic. */
export function ListenWidget({ scale, droneVolume }: { scale: ScaleDef; droneVolume: number }) {
  const [drone, setDrone] = useState(droneActive());
  const base = 48 + scale.root;
  const r = noteName(scale.root);
  const play = (steps: number[]) => playSequence(steps.map((x) => base + x), 70);
  const motif = scale.motif.map(([s, f]) => fretMidi(s, f));
  const color = scale.color[0];
  return (
    <div className="widget listen">
      <div className="row wrap">
        <button
          className={`btn ${drone ? 'on' : 'ghost'}`}
          onClick={() => {
            if (drone) droneOff();
            else droneOn(lowRoot(scale.root), droneVolume);
            setDrone(!drone);
          }}
        >
          {drone ? `Drone ${r} aus` : `Drone ${r} an`}
        </button>
        {scale.ref && (
          <button className="btn ghost" onClick={() => play([0, scale.ref!.tone, 0])}>
            {scale.ref.name}: {r} – {noteName(scale.root + scale.ref.tone)} – {r}
          </button>
        )}
        <button className="btn ghost" onClick={() => play([0, color, 0])}>
          Farbe: {r} – {noteName(scale.root + color)} – {r}
        </button>
        <button className="btn ghost" onClick={() => playSequence(motif, 80)}>
          Motiv vorspielen
        </button>
        <button className="btn ghost" onClick={() => play([...scale.intervals, 12])}>
          Skala vorspielen
        </button>
      </div>
      <p className="muted small">
        Erst anhören, dann selbst über der Drone spielen. Die Drone hält das tiefe {r} als Bezugston – so hörst du, wie jeder Skalenton zum Grundton klingt.
      </p>
    </div>
  );
}

const CHROMATIC = Array.from({ length: 12 }, (_, i) => i);

/** C5 · Abrufen: name the seven notes from memory, then play. */
export function RecallWidget({ scale, onDone }: { scale: ScaleDef; onDone?: (log: HitLog) => void }) {
  const [entered, setEntered] = useState<number[]>([]);
  const [errors, setErrors] = useState(0);
  const [wrong, setWrong] = useState<number | null>(null);
  const [showOctave, setShowOctave] = useState(false);
  const done = entered.length >= scale.intervals.length;

  const tap = (pc: number) => {
    if (done) return;
    const expected = midiToPc(scale.root + scale.intervals[entered.length]);
    if (pc === expected) {
      const next = [...entered, pc];
      setEntered(next);
      // Ascending from the tonic, so the octave fits the scale.
      pluck(48 + scale.root + scale.intervals[entered.length], 0, 0.6, 0.35);
      if (next.length === scale.intervals.length) {
        const total = scale.intervals.length;
        onDone?.({ d: new Date().toISOString(), mode: 'recall', hits: Math.max(0, total - errors), total, scaleId: scale.id });
      }
    } else {
      setErrors((e) => e + 1);
      setWrong(pc);
      setTimeout(() => setWrong(null), 400);
    }
  };

  const octavePos = oneStringOctave(scale);
  const octave: Step[] = octavePos.map((p) => ({ s: p.s, f: p.f }));
  const r = noteName(scale.root);

  return (
    <div className="widget recall">
      <p>
        Tippe die Töne von {scale.name} aufsteigend ab {r}:
      </p>
      <div className="recall-slots">
        {scale.intervals.map((iv, k) => (
          <span key={k} className={`slot${k < entered.length ? ' filled' : ''}${scale.color.includes(iv) && k < entered.length ? ' color' : ''}`}>
            {k < entered.length ? noteName(entered[k]) : '?'}
          </span>
        ))}
      </div>
      <div className="keys">
        {CHROMATIC.map((pc) => (
          <button key={pc} className={`key${wrong === pc ? ' wrong' : ''}`} onClick={() => tap(pc)} disabled={done}>
            {noteName(pc)}
          </button>
        ))}
      </div>
      {done && (
        <div className="recall-done">
          <p>
            <b>{errors === 0 ? 'Fehlerfrei!' : `${errors} Fehlversuch${errors > 1 ? 'e' : ''}.`}</b> Jetzt die Ein-Saiten-Oktave auf der {STRING_DAT[octavePos[0].s]} aus dem
            Kopf spielen, danach eine kurze Phrase mit Ziel {r}.
          </p>
          <div className="row">
            <button className="btn ghost" onClick={() => setShowOctave(!showOctave)}>
              {showOctave ? 'Verbergen' : 'Oktave nachsehen'}
            </button>
            <button
              className="btn ghost"
              onClick={() => {
                setEntered([]);
                setErrors(0);
              }}
            >
              Nochmal
            </button>
          </div>
          {showOctave && <Tab steps={octave} sub={2} barLen={octave.length} />}
        </div>
      )}
    </div>
  );
}

/** Static preview of a scale's path over all strings (used on the scale cards). */
export function PathTab({ scale }: { scale: ScaleDef }) {
  const steps: Step[] = sixStringPath(scale).map((p) => ({ s: p.s, f: p.f }));
  // Half the strings per bar keeps the path readable on a phone.
  const perBar = steps.filter((p) => typeof p === 'object' && p.s < Math.ceil(STRINGS / 2)).length;
  return <Tab steps={steps} sub={2} barLen={perBar} allStrings />;
}
