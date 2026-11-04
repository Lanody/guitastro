import { useEffect, useRef, useState } from 'react';
import { droneOff, droneOn, playSequence } from '../audio/engine';
import { shuffle, rngFrom } from '../data/rng';
import type { HitLog } from '../logic/state';
import { SCALES } from '../music/scales';
import { upAndDown, type ScaleDef } from '../music/theory';

const ROUNDS = 8;

function roundData(seed: string, round: number) {
  const rng = rngFrom(`${seed}:${round}`);
  const target = SCALES[Math.floor(rng() * SCALES.length)];
  const options = shuffle(rng, [target, ...shuffle(rng, SCALES.filter((s) => s.id !== target.id)).slice(0, 3)]);
  return { target, options };
}

/** Hear a scale over the C drone and pick its name. */
export function EarQuiz({ droneVolume, onDone }: { droneVolume: number; onDone: (logs: HitLog[]) => void }) {
  const [seed, setSeed] = useState(() => String(Date.now()));
  const [round, setRound] = useState(0);
  const [answer, setAnswer] = useState<string | null>(null);
  const [log, setLog] = useState<{ scale: ScaleDef; ok: boolean }[]>([]);
  const [started, setStarted] = useState(false);
  const busy = useRef(0);

  const { target, options } = roundData(seed, round);
  const done = round >= ROUNDS;

  useEffect(() => () => droneOff(), []);

  const play = (sc: ScaleDef = target) => {
    clearTimeout(busy.current);
    droneOn(36, droneVolume * 0.7);
    const ms = playSequence(upAndDown(sc.intervals).map((i) => 48 + i), 132);
    busy.current = window.setTimeout(droneOff, ms + 600);
  };

  const pick = (id: string) => {
    if (answer) return;
    setAnswer(id);
    const next = [...log, { scale: target, ok: id === target.id }];
    setLog(next);
    if (next.length === ROUNDS) {
      // One log per scale, so every scale's "recognised by ear" star can count.
      const by = new Map<string, HitLog>();
      for (const r of next) {
        const h = by.get(r.scale.id) ?? { d: new Date().toISOString(), mode: 'ear' as const, hits: 0, total: 0, scaleId: r.scale.id };
        h.total++;
        if (r.ok) h.hits++;
        by.set(r.scale.id, h);
      }
      onDone([...by.values()]);
    }
  };

  if (!started) {
    return (
      <div className="ear">
        <p>Die App spielt eine Skala über dem tiefen C – du tippst, welche es war. {ROUNDS} Runden.</p>
        <button
          className="btn primary"
          onClick={() => {
            setStarted(true);
            play();
          }}
        >
          Quiz starten
        </button>
      </div>
    );
  }

  if (done) {
    const hits = log.filter((l) => l.ok).length;
    return (
      <div className="ear">
        <div className="hit-score">
          <strong>
            {hits}/{ROUNDS}
          </strong>
          <span>Skalen am Klang erkannt</span>
        </div>
        <p className="small muted">Verwechselt: {log.filter((l) => !l.ok).map((l) => l.scale.name).join(', ') || 'nichts'}</p>
        <button
          className="btn"
          onClick={() => {
            const s = String(Date.now());
            setSeed(s);
            setRound(0);
            setLog([]);
            setAnswer(null);
            play(roundData(s, 0).target);
          }}
        >
          Neue Runde
        </button>
      </div>
    );
  }

  return (
    <div className="ear">
      <div className="hit-head">
        <span className="muted">
          Runde {round + 1}/{ROUNDS} · {log.filter((l) => l.ok).length} richtig
        </span>
        <button className="btn ghost small" onClick={() => play()}>
          ▶ Nochmal hören
        </button>
      </div>
      <div className="ear-options">
        {options.map((o) => (
          <button
            key={o.id}
            className={`btn ${answer ? (o.id === target.id ? 'good' : o.id === answer ? 'bad' : 'ghost') : 'ghost'}`}
            onClick={() => pick(o.id)}
          >
            {o.name.replace('C-', '')}
          </button>
        ))}
      </div>
      {answer && (
        <div className="ear-after">
          <p className="small">
            {answer === target.id ? 'Richtig! ' : `Das war ${target.name}. `}
            <span className="muted">Erkennungsmerkmal: {target.colorLabel}.</span>
          </p>
          <button
            className="btn primary"
            onClick={() => {
              const next = round + 1;
              setAnswer(null);
              setRound(next);
              if (next < ROUNDS) play(roundData(seed, next).target);
            }}
          >
            {round + 1 < ROUNDS ? 'Nächste Skala' : 'Ergebnis'}
          </button>
        </div>
      )}
    </div>
  );
}
