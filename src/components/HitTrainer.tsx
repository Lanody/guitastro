import { useCallback, useEffect, useRef, useState } from 'react';
import { openMic, pluck } from '../audio/engine';
import { pick, rngFrom } from '../data/rng';
import type { HitLog } from '../logic/state';
import { detectPitch } from '../music/pitch';
import { STRING_DAT, TUNING, freqToMidi, fretMidi, midiToPc, noteName, type ScaleDef } from '../music/theory';
import { Fretboard } from './Fretboard';

interface Target {
  s: number;
  f: number;
  pc: number;
  kind: 'root' | 'color' | 'note';
}

interface Props {
  scale: ScaleDef;
  strings: number[];
  kinds: 'rootColor' | 'all';
  rounds: number;
  from?: number;
  to?: number;
  compact?: boolean;
  onDone?: (log: HitLog) => void;
}

type Mode = 'mic' | 'self';

function makeTargets(p: Props, seed: string): Target[] {
  const rng = rngFrom(seed);
  const from = p.from ?? 3;
  const to = p.to ?? 14;
  const pcs = (p.kinds === 'rootColor' ? [0, ...p.scale.color] : p.scale.intervals).map((d) => midiToPc(p.scale.root + d));
  const out: Target[] = [];
  let guard = 0;
  while (out.length < p.rounds && guard++ < 500) {
    const s = pick(rng, p.strings);
    const pc = pick(rng, pcs);
    const frets = [];
    for (let f = from; f <= to; f++) if (midiToPc(fretMidi(s, f)) === pc) frets.push(f);
    if (!frets.length) continue;
    const f = pick(rng, frets);
    const last = out[out.length - 1];
    if (last && last.s === s && last.pc === pc) continue;
    const deg = midiToPc(pc - p.scale.root);
    out.push({ s, f, pc, kind: deg === 0 ? 'root' : p.scale.color.includes(deg) ? 'color' : 'note' });
  }
  return out;
}

export function HitTrainer(props: Props) {
  const { scale, compact, onDone } = props;
  const [seed, setSeed] = useState(() => String(Date.now()));
  const [targets, setTargets] = useState(() => makeTargets(props, seed));
  const [i, setI] = useState(0);
  const [mode, setMode] = useState<Mode>('self');
  const [revealed, setRevealed] = useState(false);
  const [results, setResults] = useState<{ hit: boolean; ms: number }[]>([]);
  const [heard, setHeard] = useState<{ midi: number; cents: number } | null>(null);
  const [flash, setFlash] = useState<'good' | 'bad' | null>(null);
  const [micError, setMicError] = useState<string | null>(null);
  const shownAt = useRef(performance.now());
  const firstWrong = useRef(false);
  const mic = useRef<Awaited<ReturnType<typeof openMic>> | null>(null);
  const raf = useRef(0);
  const doneRef = useRef(false);
  /** Ignore the mic while the app itself plays a preview tone. */
  const muteUntil = useRef(0);

  const target = targets[i] as Target | undefined;
  const finished = i >= targets.length;

  useEffect(() => {
    shownAt.current = performance.now();
    firstWrong.current = false;
    setRevealed(false);
  }, [i, seed]);

  useEffect(() => {
    if (finished && !doneRef.current && results.length) {
      doneRef.current = true;
      const hits = results.filter((r) => r.hit).length;
      const times = results.filter((r) => r.hit).map((r) => r.ms);
      onDone?.({
        d: new Date().toISOString(),
        mode,
        hits,
        total: results.length,
        avgMs: times.length ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : undefined,
        scaleId: scale.id,
      });
    }
  }, [finished, results, mode, onDone, scale.id]);

  const record = useCallback(
    (hit: boolean) => {
      setResults((r) => [...r, { hit, ms: performance.now() - shownAt.current }]);
      setFlash(hit ? 'good' : 'bad');
      setTimeout(() => setFlash(null), 450);
      setI((x) => x + 1);
    },
    [],
  );

  // Microphone loop: a note counts once it is held steadily for ~150 ms.
  const stopMic = useCallback(() => {
    cancelAnimationFrame(raf.current);
    mic.current?.close();
    mic.current = null;
    setHeard(null);
  }, []);

  useEffect(() => stopMic, [stopMic]);

  const targetRef = useRef(target);
  targetRef.current = target;

  const startMic = async () => {
    setMicError(null);
    try {
      mic.current = await openMic();
    } catch {
      setMicError('Kein Mikrofonzugriff. Erlaube das Mikrofon im Browser (am Handy nur über https oder localhost).');
      setMode('self');
      return;
    }
    setMode('mic');
    const buf = new Float32Array(mic.current.analyser.fftSize);
    let stable = { midi: -1, since: 0 };
    let lock = 0;
    const loop = () => {
      const m = mic.current;
      if (!m) return;
      m.analyser.getFloatTimeDomainData(buf);
      const r = detectPitch(buf, m.sampleRate);
      const now = performance.now();
      if (r && r.clarity > 0.8) {
        const exact = freqToMidi(r.freq);
        const midi = Math.round(exact);
        setHeard({ midi, cents: Math.round((exact - midi) * 100) });
        if (midi !== stable.midi) stable = { midi, since: now };
        const t = targetRef.current;
        if (t && now > lock && now > muteUntil.current && now - stable.since > 150) {
          const fret = midi - TUNING[t.s];
          const right = midiToPc(midi) === t.pc && fret >= 0 && fret <= 20;
          if (right) {
            lock = now + 700;
            record(!firstWrong.current);
          } else if (now - stable.since > 300 && !firstWrong.current) {
            firstWrong.current = true;
            setFlash('bad');
            setTimeout(() => setFlash(null), 450);
          }
        }
      } else if (!r) {
        stable = { midi: -1, since: now };
      }
      raf.current = requestAnimationFrame(loop);
    };
    raf.current = requestAnimationFrame(loop);
  };

  const restart = () => {
    const s = String(Date.now());
    setSeed(s);
    setTargets(makeTargets(props, s));
    setResults([]);
    setI(0);
    doneRef.current = false;
  };

  const hits = results.filter((r) => r.hit).length;

  if (finished) {
    const times = results.filter((r) => r.hit).map((r) => r.ms);
    const avg = times.length ? times.reduce((a, b) => a + b, 0) / times.length / 1000 : 0;
    return (
      <div className="hit-trainer done">
        <div className="hit-score">
          <strong>{Math.round((hits / Math.max(1, results.length)) * 100)} %</strong>
          <span>
            {hits} von {results.length} auf Anhieb getroffen{times.length ? ` · Ø ${avg.toFixed(1)} s` : ''}
          </span>
        </div>
        <button className="btn" onClick={restart}>
          Neue Runde
        </button>
      </div>
    );
  }

  return (
    <div className={`hit-trainer${flash ? ` flash-${flash}` : ''}${compact ? ' compact' : ''}`}>
      <div className="hit-head">
        <span className="muted">
          Ziel {i + 1}/{targets.length} · {hits} Treffer
        </span>
        <div className="seg small">
          <button className={mode === 'self' ? 'on' : ''} onClick={() => { stopMic(); setMode('self'); }}>
            Selbst prüfen
          </button>
          <button className={mode === 'mic' ? 'on' : ''} onClick={() => mode !== 'mic' && startMic()}>
            Mikrofon
          </button>
        </div>
      </div>
      {micError && <p className="warn">{micError}</p>}
      {target && (
        <div className="hit-target">
          <span className={`hit-note ${target.kind}`}>{noteName(target.pc)}</span>
          <span>
            auf der <b>{STRING_DAT[target.s]}</b>
            {target.kind === 'root' ? ' · Grundton' : target.kind === 'color' ? ' · Farbton' : ''}
          </span>
        </div>
      )}
      {mode === 'mic' && (
        <p className="hit-heard">
          {heard ? (
            <>
              Ich höre <b>{noteName(heard.midi)}</b>
              <span className="muted"> {heard.cents >= 0 ? '+' : ''}{heard.cents} ct</span>
            </>
          ) : (
            <span className="muted">Spiel den Ton – ich höre zu …</span>
          )}
        </p>
      )}
      {revealed && target && (
        <Fretboard from={Math.max(0, target.f - 4)} to={target.f + 4} dots={[]} mark={{ s: target.s, f: target.f, tone: 'info' }} />
      )}
      <div className="row">
        {mode === 'self' ? (
          revealed ? (
            <>
              <button className="btn good" onClick={() => record(true)}>
                Getroffen
              </button>
              <button className="btn bad" onClick={() => record(false)}>
                Daneben
              </button>
            </>
          ) : (
            <button className="btn" onClick={() => setRevealed(true)}>
              Spielen, dann aufdecken
            </button>
          )
        ) : (
          <>
            <button
              className="btn ghost"
              onClick={() => {
                if (!target) return;
                muteUntil.current = performance.now() + 1600;
                firstWrong.current = true;
                pluck(fretMidi(target.s, target.f));
              }}
            >
              Ton vorspielen
            </button>
            <button
              className="btn ghost"
              onClick={() => {
                firstWrong.current = true;
                setRevealed(true);
              }}
            >
              Auflösen
            </button>
            <button className="btn ghost" onClick={() => record(false)}>
              Überspringen
            </button>
          </>
        )}
      </div>
    </div>
  );
}
