import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { chime, droneOff, droneOn, metronome, softCue } from '../audio/engine';
import { ChordChart } from '../components/ChordChart';
import { Fretboard } from '../components/Fretboard';
import { HitTrainer } from '../components/HitTrainer';
import { Tab } from '../components/Tab';
import { ListenWidget, RecallWidget } from '../components/Widgets';
import { BLOCK_INFO, MODULE_INFO } from '../data/exercises';
import { seconds, type Exercise, type Focus } from '../data/types';
import { FOCUS_INFO, bpmFor, type Plan } from '../logic/plan';
import type { AppState, ExerciseResult, HitLog, Rating } from '../logic/state';
import { DEFAULT_BEATS, fillBars } from '../music/meter';
import { getScale } from '../music/scales';
import { TUNING, fretMidi, midiToPc, noteName } from '../music/theory';

interface Props {
  plan: Plan;
  state: AppState;
  onHit: (log: HitLog) => void;
  onFinish: (results: ExerciseResult[], seconds: number) => void;
  onExit: () => void;
}

export const FOCUS_LABEL: Record<Focus, string> = {
  speed: 'Tempo',
  accuracy: 'Treffsicherheit',
  creativity: 'Kreativität',
  scales: 'Skalen',
  rhythm: 'Rhythmus',
  chords: 'Akkorde',
};

const SUB_LABEL: Record<number, string> = { 2: 'Achtel', 3: 'Triolen', 4: 'Sechzehntel' };

const fmt = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

function phaseAt(ex: Exercise, ms: number) {
  let acc = 0;
  for (let i = 0; i < ex.phases.length; i++) {
    acc += ex.phases[i].seconds * 1000;
    if (ms < acc) return { index: i, endsAt: acc };
  }
  return { index: ex.phases.length - 1, endsAt: acc };
}

export function Session({ plan, state, onHit, onFinish, onExit }: Props) {
  const { settings } = state;
  const exercises = plan.exercises;
  const [idx, setIdx] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(false);
  const [stage, setStage] = useState<'play' | 'rate'>('play');
  const [results, setResults] = useState<ExerciseResult[]>([]);
  const [bpms, setBpms] = useState<Record<string, number>>(() =>
    Object.fromEntries(exercises.map((e) => [e.key, bpmFor(state, e, plan.focus)])),
  );
  const [subOverride, setSubOverride] = useState<number | null>(null);
  const [pickVal, setPickVal] = useState<number | null>(null);
  const [click, setClick] = useState(true);
  const [drone, setDrone] = useState(false);
  const [droneAuto, setDroneAuto] = useState(true);
  const [showMap, setShowMap] = useState(false);
  const [backing, setBacking] = useState(false);
  const [chordIdx, setChordIdx] = useState(-1);
  const practiced = useRef(0);
  const lastTick = useRef(0);
  const cueMinute = useRef(-1);

  const ex = exercises[idx];
  const total = seconds(ex) * 1000;
  const { index: phaseIdx, endsAt } = phaseAt(ex, elapsed);
  const phase = ex.phases[phaseIdx];
  const pattern = useMemo(
    () => (phase.pick && pickVal !== null ? phase.pick.build(pickVal) : phase.pattern ?? ex.pattern),
    [phase, pickVal, ex],
  );
  const sub = subOverride ?? phase.sub;
  const beats = phase.beats ?? DEFAULT_BEATS;
  // The tab shows whole bars, so the pattern's first note is always on the "1".
  const shown = useMemo(() => pattern && fillBars(pattern, sub, beats), [pattern, sub, beats]);
  const bpm = bpms[ex.key];
  const usesMetronome = phase.metronome !== false;
  const scale = getScale(ex.scaleId ?? plan.scaleId, ex.root ?? plan.root);
  const rootName = noteName(scale.root);
  const sameBlock = exercises.filter((e) => (ex.block ? e.block === ex.block : e.module === ex.module));
  const modIndex = sameBlock.indexOf(ex);
  const modCount = sameBlock.length;
  const chords = phase.chords;
  const overall = (exercises.slice(0, idx).reduce((a, e) => a + seconds(e), 0) * 1000 + elapsed) / (exercises.reduce((a, e) => a + seconds(e), 0) * 1000);
  const relaxing = settings.restCue && ex.tracksTempo && running && Math.floor(elapsed / 1000) % 60 >= 50;

  // Clock
  useEffect(() => {
    if (!running) return;
    lastTick.current = performance.now();
    const t = window.setInterval(() => {
      const now = performance.now();
      const d = now - lastTick.current;
      lastTick.current = now;
      practiced.current += d;
      setElapsed((e) => e + d);
    }, 200);
    return () => clearInterval(t);
  }, [running]);

  // End of exercise
  useEffect(() => {
    if (elapsed >= total && stage === 'play') {
      setRunning(false);
      setStage('rate');
      chime();
    }
  }, [elapsed, total, stage]);

  // 50 s work / 10 s relax cue (booklet: "der Minuten-Timer läuft weiter")
  useEffect(() => {
    if (!settings.restCue || !ex.tracksTempo || !running) return;
    const sec = Math.floor(elapsed / 1000);
    const minute = Math.floor(sec / 60);
    if (sec % 60 === 50 && cueMinute.current !== minute) {
      cueMinute.current = minute;
      softCue();
    }
  }, [elapsed, running, ex.tracksTempo, settings.restCue]);

  // New phase → booklet note value again, backing as the phase suggests.
  useEffect(() => {
    setSubOverride(null);
    setPickVal(null);
    setBacking(!!phase.backing);
  }, [phaseIdx, idx, phase.backing]);

  // Metronome follows play state and settings. It also runs (silently, if the click is off) to keep chord time.
  const layer = useMemo(() => (phase.layer && shown && click ? { sub, hits: shown.map((st) => typeof st === 'object') } : null), [phase.layer, shown, sub, click]);
  const chordId = `${idx}:${phaseIdx}`;
  const metroChords = useMemo(
    () => (chords ? { id: chordId, midis: chords.slots.map((c) => c.midis), beatsPer: chords.beatsPer, audible: backing } : null),
    [chords, chordId, backing],
  );
  useEffect(() => {
    metronome.set({ bpm, sub, beatsPerBar: beats, clickSub: settings.clickSub, volume: settings.clickVolume, layer, click: click && usesMetronome, chords: metroChords });
  }, [bpm, sub, beats, settings.clickSub, settings.clickVolume, layer, click, usesMetronome, metroChords]);

  const shouldRun = running && stage === 'play' && (usesMetronome || !!chords);
  useEffect(() => {
    if (shouldRun) metronome.start();
    else metronome.stop();
  }, [shouldRun]);
  useEffect(() => () => metronome.stop(), []);

  // Which chord is sounding – read from the audio clock.
  useEffect(() => {
    if (!chords || !shouldRun) {
      setChordIdx(-1);
      return;
    }
    const t = window.setInterval(() => setChordIdx(metronome.chordNow()), 50);
    return () => clearInterval(t);
  }, [chords, shouldRun]);

  // Drone on the tonic of the exercise's key.
  const droneMidi = TUNING[0] + scale.root;
  useEffect(() => {
    if (drone) droneOn(droneMidi, settings.droneVolume);
    else droneOff();
  }, [drone, droneMidi, settings.droneVolume]);
  useEffect(() => () => droneOff(), []);

  // Keep the screen awake while practising.
  useEffect(() => {
    let lock: { release: () => Promise<void> } | null = null;
    const nav = navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<{ release: () => Promise<void> }> } };
    nav.wakeLock?.request('screen').then((l) => (lock = l)).catch(() => {});
    return () => void lock?.release().catch(() => {});
  }, []);

  const setBpm = useCallback((v: number) => setBpms((b) => ({ ...b, [ex.key]: Math.min(240, Math.max(30, Math.round(v))) })), [ex.key]);

  const toggleRun = useCallback(() => {
    if (stage !== 'play') return;
    if (!running && elapsed === 0 && ex.drone && droneAuto) setDrone(true);
    setRunning((r) => !r);
  }, [stage, running, elapsed, ex.drone, droneAuto]);

  const goTo = useCallback(
    (next: number, res: ExerciseResult[]) => {
      if (next >= exercises.length) {
        setRunning(false);
        setDrone(false);
        onFinish(res, Math.round(practiced.current / 1000));
        return;
      }
      setIdx(next);
      setElapsed(0);
      setStage('play');
      cueMinute.current = -1;
      const nextEx = exercises[next];
      if (!nextEx.drone) setDrone(false);
      const auto = settings.autoStart;
      setRunning(auto);
      if (auto && nextEx.drone && droneAuto) setDrone(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    [exercises, onFinish, settings.autoStart, droneAuto],
  );

  const finishExercise = (rating?: Rating, skipped = false) => {
    const r: ExerciseResult = {
      key: ex.key,
      title: ex.title,
      module: ex.module,
      block: ex.block,
      bpm: ex.tracksTempo ? bpm : undefined,
      sub: ex.tracksTempo ? sub : undefined,
      rating,
      skipped,
    };
    const res = [...results.filter((x) => x.key !== ex.key || x.module !== ex.module), r];
    setResults(res);
    goTo(idx + 1, res);
  };

  // Keyboard: space = start/pause, ↑/↓ = tempo, → = skip
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT' || (e.target as HTMLElement)?.tagName === 'TEXTAREA') return;
      if (e.code === 'Space') {
        e.preventDefault();
        toggleRun();
      } else if (e.code === 'ArrowUp') {
        e.preventDefault();
        setBpm(bpm + (e.shiftKey ? 5 : 1));
      } else if (e.code === 'ArrowDown') {
        e.preventDefault();
        setBpm(bpm - (e.shiftKey ? 5 : 1));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toggleRun, setBpm, bpm]);

  const exit = () => {
    if (results.length === 0 && elapsed < 5000) {
      onExit();
      return;
    }
    if (confirm('Einheit beenden? Bisherige Ergebnisse werden gespeichert.')) {
      setRunning(false);
      setDrone(false);
      onFinish(results, Math.round(practiced.current / 1000));
    }
  };

  const mapVisible = ex.map && (!phase.hideMap || showMap);
  const remainingPhase = endsAt - elapsed;
  // Improvising: the current chord's tones light up on the map.
  const map = useMemo(() => {
    if (!ex.map || !chords?.highlight) return ex.map;
    const pcs = chords.slots[Math.max(0, chordIdx)]?.pcs ?? [];
    return {
      ...ex.map,
      dots: ex.map.dots.map((d) => {
        const pc = midiToPc(fretMidi(d.s, d.f));
        return { ...d, kind: pc === scale.root ? ('root' as const) : pcs.includes(pc) ? ('color' as const) : ('note' as const) };
      }),
    };
  }, [ex.map, chords, chordIdx, scale.root]);
  const firstOfBlock = idx === 0 || exercises[idx - 1].block !== ex.block;

  return (
    <div className="session">
      <header className="session-top">
        <button className="btn ghost small" onClick={exit}>
          ✕ Beenden
        </button>
        <div className="session-where">
          {ex.block ? BLOCK_INFO[ex.block].name : `Modul ${ex.module} · ${MODULE_INFO[ex.module].name}`} · {modIndex + 1}/{modCount}
        </div>
        <div className="progress" aria-hidden>
          <div style={{ width: `${Math.min(100, overall * 100)}%` }} />
        </div>
      </header>

      <section className="ex-head">
        <div className="chips">
          <span className={`chip focus-${ex.focus}`}>{FOCUS_LABEL[ex.focus]}</span>
          {(ex.module === 'C' || ex.module === 'I' || ex.key === 'E4') && <span className="chip">{scale.name}</span>}
          {plan.focus !== 'standard' && ex.tracksTempo && <span className="chip warn-chip">{FOCUS_INFO[plan.focus].title}</span>}
        </div>
        <h1>
          {ex.num}. {ex.title}
        </h1>
        {ex.variant && <p className="variant">Variation: {ex.variant}</p>}
      </section>

      <section className="timer-card">
        <div className="timer-main">
          <span className="timer-big">{fmt(total - elapsed)}</span>
          <span className="muted">übrig</span>
        </div>
        <div className="phases">
          {ex.phases.map((p, i) => (
            <div key={i} className={`phase-pill${i === phaseIdx ? ' on' : i < phaseIdx ? ' past' : ''}`}>
              <span>{p.label}</span>
              {i === phaseIdx && <small>{fmt(remainingPhase)}</small>}
            </div>
          ))}
        </div>
      </section>

      <div className={`relax${relaxing ? ' show' : ''}`} aria-live="polite">
        Lockern – Hände ausschütteln. Der Timer läuft weiter.
      </div>

      <section className="phase-text">
        <p>{phase.text}</p>
        {ex.prompts && ex.prompts.length > 0 && (
          <div className="prompt">
            <span>Heutige Aufgabe</span>
            {ex.prompts.map((p) => (
              <p key={p}>{p}</p>
            ))}
          </div>
        )}
      </section>

      {phase.pick && (
        <div className="pick">
          <span className="muted">{phase.pick.label}:</span>
          {phase.pick.options.map((o) => (
            <button key={o.value} className={`btn small ${pickVal === o.value ? 'on' : 'ghost'}`} onClick={() => setPickVal(o.value)}>
              {o.label}
            </button>
          ))}
        </div>
      )}

      {shown && (
        <section className="card tab-card">
          <div className="tab-meta muted small">
            {beats}/4 · {SUB_LABEL[sub]} · {bpm} BPM
          </div>
          <Tab steps={shown} sub={sub} beats={beats} />
        </section>
      )}

      {phase.widget === 'listen' && <ListenWidget scale={scale} droneVolume={settings.droneVolume} />}
      {phase.widget === 'find' && (
        <HitTrainer key={`find-${idx}`} scale={scale} strings={pickThree(plan.date, ex.key)} kinds="rootColor" rounds={8} from={3} to={14} compact onDone={onHit} />
      )}
      {phase.widget === 'recall' && <RecallWidget key={`recall-${idx}`} scale={scale} onDone={onHit} />}
      {phase.widget === 'notes' && (
        <HitTrainer key={`notes-${idx}`} scale={scale} strings={pickThree(plan.date, ex.key)} kinds="all" rounds={12} from={0} to={12} compact onDone={onHit} />
      )}

      {chords && <ChordChart key={chordId} chords={chords} current={chordIdx} />}

      {map && (
        <section className="card">
          {mapVisible ? (
            <Fretboard {...map} caption={map.caption} />
          ) : (
            <button className="btn ghost wide" onClick={() => setShowMap(true)}>
              Griffbrett ist abgedeckt – nur bei Unsicherheit aufdecken
            </button>
          )}
        </section>
      )}

      <details key={idx} className="card howto" open={firstOfBlock || ex.module === 'C' || ex.module === 'D'}>
        <summary>Anleitung</summary>
        <p>{ex.intro}</p>
      </details>

      <footer className="controls">
        <div className="tempo">
          <button className="round" onClick={() => setBpm(bpm - 2)} aria-label="langsamer">
            −
          </button>
          <div className="bpm">
            <strong>{bpm}</strong>
            <span>BPM</span>
          </div>
          <button className="round" onClick={() => setBpm(bpm + 2)} aria-label="schneller">
            +
          </button>
        </div>
        <div className="toggles">
          {ex.pattern && ex.tracksTempo && (
            <div className="seg small">
              {[2, 4].map((v) => (
                <button key={v} className={sub === v ? 'on' : ''} onClick={() => setSubOverride(v)}>
                  {SUB_LABEL[v]}
                </button>
              ))}
            </div>
          )}
          <button className={`btn small ${click && usesMetronome ? 'on' : 'ghost'}`} onClick={() => setClick(!click)} disabled={!usesMetronome}>
            Klick
          </button>
          {chords && (
            <button className={`btn small ${backing ? 'on' : 'ghost'}`} onClick={() => setBacking(!backing)}>
              Begleitung
            </button>
          )}
          <button
            className={`btn small ${drone ? 'on' : 'ghost'}`}
            onClick={() => {
              setDrone(!drone);
              setDroneAuto(!drone);
            }}
          >
            Drone {rootName}
          </button>
        </div>
        <button className={`btn big ${running ? 'ghost' : 'primary'}`} onClick={toggleRun}>
          {running ? 'Pause' : elapsed > 0 ? 'Weiter' : 'Start'}
        </button>
        <button className="btn ghost small" onClick={() => { setRunning(false); setStage('rate'); }}>
          Übung beenden →
        </button>
      </footer>

      {stage === 'rate' && (
        <div className="sheet-backdrop">
          <div className="sheet">
            {ex.tracksTempo ? (
              <>
                <h2>Wie lief's bei {bpm} BPM?</h2>
                <p className="muted">
                  {SUB_LABEL[sub]} · Zwei saubere Einheiten in Folge = +{settings.tempoStep} BPM beim nächsten Mal.
                </p>
                <div className="rate">
                  <button className="btn good" onClick={() => finishExercise('clean')}>
                    Sauber &amp; locker
                  </button>
                  <button className="btn" onClick={() => finishExercise('ok')}>
                    Ging so
                  </button>
                  <button className="btn bad" onClick={() => finishExercise('rough')}>
                    Unsauber / verkrampft
                  </button>
                </div>
              </>
            ) : (
              <>
                <h2>{ex.title} – geschafft</h2>
                <p className="muted">Weiter zur nächsten Übung.</p>
                <div className="rate">
                  <button className="btn primary" onClick={() => finishExercise()}>
                    Weiter
                  </button>
                </div>
              </>
            )}
            <div className="row center">
              <button
                className="btn ghost small"
                onClick={() => {
                  setStage('play');
                  setElapsed(Math.min(elapsed, total - 1000));
                }}
              >
                Noch nicht fertig
              </button>
              {ex.tracksTempo && (
                <button className="btn ghost small" onClick={() => finishExercise(undefined, true)}>
                  Ohne Bewertung weiter
                </button>
              )}
            </div>
            {idx + 1 < exercises.length && (
              <p className="next-up">
                Als Nächstes: {exercises[idx + 1].module}
                {exercises[idx + 1].num} · {exercises[idx + 1].title}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/** Three strings for the "find root and colour tone" task, stable per day. */
function pickThree(date: string, key: string) {
  let h = 0;
  for (const c of date + key) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const start = h % 4; // 0..3 → three adjacent strings
  return [start, start + 1, start + 2];
}
