import { useMemo, useState } from 'react';
import { applyRating, type Plan } from '../logic/plan';
import { RATING_LABEL, type AppState, type ExerciseResult } from '../logic/state';
import { getScale } from '../music/scales';
import { noteName } from '../music/theory';

interface Props {
  plan: Plan;
  state: AppState;
  results: ExerciseResult[];
  seconds: number;
  onSave: (checks: [boolean, boolean, boolean], note: string, results: ExerciseResult[]) => void;
}

const CHECKS = [
  'War der Puls gleichmäßig, auch beim Saitenwechsel?',
  'Waren die Hände am Ende noch locker, und blieben unbenutzte Saiten still?',
  'Finde ich die heutige Skala ohne Karte wieder und wechsle die Akkorde, ohne hinzuschauen?',
];

type Row = ExerciseResult & { nextBpm?: number };

export function Summary({ plan, state, results, seconds, onSave }: Props) {
  const [checks, setChecks] = useState<[boolean, boolean, boolean]>([false, false, false]);
  const [note, setNote] = useState('');

  // Preview the tempo changes that saving will apply.
  const withChanges = useMemo<Row[]>(
    () =>
      results.map((r) => {
        if (!r.rating || r.bpm === undefined) return r;
        const { change, next } = applyRating(state.tempo[r.key], r.bpm, r.rating, plan.focus, state.settings.tempoStep);
        return { ...r, change, nextBpm: next.bpm };
      }),
    [results, state, plan.focus],
  );

  const ups = withChanges.filter((r) => (r.change ?? 0) > 0);
  const mins = Math.max(1, Math.round(seconds / 60));
  const suggestions = [
    ...withChanges.filter((r) => r.rating === 'rough' && r.block !== 'chords').map((r) => `${r.key} ${r.title} langsamer und sauberer`),
    `${getScale(plan.scaleId, plan.root).name}: Farbton ohne Karte finden`,
    results.some((r) => r.block === 'chords' && r.rating === 'rough') ? `Akkordwechsel in ${noteName(plan.root)} langsamer, Griffe vorausdenken` : '',
  ].filter(Boolean);

  return (
    <div className="summary">
      <p className="eyebrow">Einheit abgeschlossen</p>
      <h1>Stark – {mins} {mins === 1 ? 'Minute' : 'Minuten'} geübt.</h1>
      {ups.length > 0 && (
        <div className="card up-card">
          <b>Tempo steigt beim nächsten Mal:</b>
          {ups.map((r) => (
            <p key={r.key}>
              {r.title}: {r.bpm} → <b>{r.nextBpm} BPM</b>
            </p>
          ))}
        </div>
      )}

      <section className="card">
        <h2>Ergebnisse</h2>
        <ul className="results">
          {withChanges.map((r) => (
            <li key={r.module + r.key}>
              <span className="ex-id">{r.key}</span>
              <span className="ex-name">{r.title}</span>
              <span className="ex-meta">
                {r.skipped ? (
                  <span className="muted">übersprungen</span>
                ) : r.bpm !== undefined ? (
                  <>
                    {r.bpm} BPM{r.rating && <span className={`rating ${r.rating}`}> · {RATING_LABEL[r.rating]}</span>}
                    {!!r.change && <span className={r.change > 0 ? 'up' : 'down'}> {r.change > 0 ? '+' : ''}{r.change}</span>}
                  </>
                ) : (
                  <span className="muted">✓</span>
                )}
              </span>
            </li>
          ))}
        </ul>
        {plan.focus === 'control' && <p className="small muted">Kontrolltag: Tempo wird nur notiert, nicht verändert.</p>}
      </section>

      <section className="card">
        <h2>Drei kurze Checks</h2>
        {CHECKS.map((c, i) => (
          <label key={i} className="check">
            <input
              type="checkbox"
              checked={checks[i]}
              onChange={(e) => setChecks((c) => c.map((x, j) => (j === i ? e.target.checked : x)) as typeof c)}
            />
            <span>{c}</span>
          </label>
        ))}
      </section>

      <section className="card">
        <h2>Nächster Fokus</h2>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="z. B. Pull-offs in A4 gleich laut, Saitensprung F→d sauberer" rows={3} />
        {suggestions.length > 0 && (
          <div className="suggest">
            {suggestions.map((s) => (
              <button key={s} className="chip" onClick={() => setNote((n) => (n ? `${n}; ${s}` : s))}>
                + {s}
              </button>
            ))}
          </div>
        )}
      </section>

      <button
        className="btn primary big wide"
        onClick={() => onSave(checks, note.trim(), withChanges.map(({ nextBpm, ...r }) => r))}
      >
        Speichern
      </button>
    </div>
  );
}
