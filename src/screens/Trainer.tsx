import { useState } from 'react';
import { HitTrainer } from '../components/HitTrainer';
import type { AppState, HitLog } from '../logic/state';
import { ROOTS, SCALES, getScale } from '../music/scales';
import { STRING_SHORT } from '../music/theory';

interface Props {
  state: AppState;
  onHit: (log: HitLog) => void;
}

export function Trainer({ state, onHit }: Props) {
  const [scaleId, setScaleId] = useState(state.scale.id);
  const [root, setRoot] = useState(state.scale.root ?? 0);
  const [kinds, setKinds] = useState<'rootColor' | 'all'>('rootColor');
  const [strings, setStrings] = useState([0, 1, 2, 3, 4, 5]);
  const [range, setRange] = useState<'low' | 'mid' | 'all'>('mid');
  const sc = getScale(scaleId, root);
  const [from, to] = range === 'low' ? [0, 7] : range === 'mid' ? [5, 12] : [0, 15];
  const toggleString = (s: number) => {
    const next = strings.includes(s) ? strings.filter((x) => x !== s) : [...strings, s].sort();
    if (next.length) setStrings(next);
  };

  return (
    <div className="trainer">
      <h1>Treffer-Training</h1>
      <p className="muted">
        Die App nennt einen Ton und eine Saite – du spielst ihn. Mit Mikrofon prüft die App selbst, ob du den richtigen Ton triffst; gezählt wird nur der erste Versuch. Trainiert Griffbrettkenntnis
        und Zielsicherheit für Soli.
      </p>

      <section className="card settings-grid">
        <label>
          Skala
          <select value={scaleId} onChange={(e) => setScaleId(e.target.value)}>
            {SCALES.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name.replace('C-', '')}
              </option>
            ))}
          </select>
        </label>
        <label>
          Grundton
          <select value={root} onChange={(e) => setRoot(Number(e.target.value))}>
            {ROOTS.map((x) => (
              <option key={x.pc} value={x.pc}>
                {x.name}
              </option>
            ))}
          </select>
        </label>
        <div>
          <span className="label">Töne</span>
          <div className="seg small">
            <button className={kinds === 'rootColor' ? 'on' : ''} onClick={() => setKinds('rootColor')}>
              Grundton + Farbton
            </button>
            <button className={kinds === 'all' ? 'on' : ''} onClick={() => setKinds('all')}>
              Alle Skalentöne
            </button>
          </div>
        </div>
        <div>
          <span className="label">Bundbereich</span>
          <div className="seg small">
            <button className={range === 'low' ? 'on' : ''} onClick={() => setRange('low')}>
              0–7
            </button>
            <button className={range === 'mid' ? 'on' : ''} onClick={() => setRange('mid')}>
              5–12
            </button>
            <button className={range === 'all' ? 'on' : ''} onClick={() => setRange('all')}>
              0–15
            </button>
          </div>
        </div>
        <div>
          <span className="label">Saiten</span>
          <div className="seg small">
            {[5, 4, 3, 2, 1, 0].map((s) => (
              <button key={s} className={strings.includes(s) ? 'on' : ''} onClick={() => toggleString(s)}>
                {STRING_SHORT[s]}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="card">
        <HitTrainer key={`${scaleId}-${root}-${kinds}-${strings.join()}-${range}`} scale={sc} strings={strings} kinds={kinds} rounds={12} from={from} to={to} onDone={onHit} />
      </section>
    </div>
  );
}
