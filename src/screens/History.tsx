import { useState } from 'react';
import { Badge, GoalRing, Heatmap, LevelBar } from '../components/Progress';
import { MODULE_INFO } from '../data/exercises';
import { streak } from '../logic/plan';
import { bpmGain, evaluate, keysPlayed, scaleProgress, sessionsThisWeek, totalXp, type AchievementGroup } from '../logic/progress';
import type { AppState, TempoState } from '../logic/state';
import { SCALES, getScale } from '../music/scales';

const GROUPS: AchievementGroup[] = ['Dranbleiben', 'Tempo', 'Treffsicherheit', 'Skalen', 'Spielweise'];

const TITLES: Record<string, string> = {
  A1: 'Synchronisation',
  A2: 'Fingerunabhängigkeit',
  A3: 'Kurzer Lauf',
  A4: 'Legato',
  A5: 'Saitensprünge',
  A6: 'Speed-Bursts',
  B1: 'Chromatik 6 Saiten',
  B2: 'Fingerfolge & Sprünge',
  B3: 'C-Moll-Griffbild',
  B4: 'Griffbild Legato',
  B5: 'Bursts jede Saite',
  D1: '3 gegen 2',
  D2: '2 und 4 gegen 3',
  D3: '3 gegen 4',
  D4: 'Dreier-/Fünfergruppen',
  E1: 'Tremolo-Picking',
  E2: 'Lagenwechsel',
  E3: 'Oktaven',
  R1: 'Unterteilungen',
  R2: 'Gallop',
  R3: 'Offbeats & Synkopen',
  R4: 'Stopps & Abdämpfen',
  K1: 'Akkordwechsel',
};

const RATING_LABEL = { clean: 'sauber', ok: 'ging so', rough: 'unsauber' } as const;

function Sparkline({ t }: { t: TempoState }) {
  const pts = t.history.slice(-20);
  if (pts.length < 2) return <span className="muted small">noch zu wenig Daten</span>;
  const w = 160;
  const h = 40;
  const min = Math.min(...pts.map((p) => p.bpm)) - 2;
  const max = Math.max(...pts.map((p) => p.bpm)) + 2;
  const x = (i: number) => 4 + (i / (pts.length - 1)) * (w - 8);
  const y = (v: number) => h - 4 - ((v - min) / (max - min)) * (h - 8);
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.bpm).toFixed(1)}`).join(' ');
  return (
    <svg className="spark" viewBox={`0 0 ${w} ${h}`} role="img" aria-label={`Tempo von ${pts[0].bpm} auf ${pts[pts.length - 1].bpm} BPM`}>
      <path d={d} />
      {pts.map((p, i) => (
        <g key={i}>
          {i === pts.length - 1 && <circle cx={x(i)} cy={y(p.bpm)} r={3.5} className="last" />}
          {/* bigger invisible hit target carries the tooltip */}
          <circle cx={x(i)} cy={y(p.bpm)} r={8} className="hit">
            <title>{`${new Date(p.d).toLocaleDateString('de-DE')} · ${p.bpm} BPM · ${RATING_LABEL[p.r]}`}</title>
          </circle>
        </g>
      ))}
    </svg>
  );
}

export function History({ state }: { state: AppState }) {
  const [onlyOpen, setOnlyOpen] = useState(false);
  const [sel, setSel] = useState<string | null>(null);
  const [allSessions, setAllSessions] = useState(false);
  const ach = evaluate(state);
  const unlockedCount = ach.filter((a) => a.unlocked).length;
  const sessions = [...state.sessions].reverse();
  const totalMin = Math.round(state.sessions.reduce((a, s) => a + s.seconds, 0) / 60);
  const weekAgo = Date.now() - 7 * 86400000;
  const week = state.sessions.filter((s) => Date.parse(s.date) > weekAgo);
  const weekMin = Math.round(week.reduce((a, s) => a + s.seconds, 0) / 60);
  const recentHits = state.hits.filter((h) => Date.parse(h.d) > Date.now() - 14 * 86400000);
  const hitRate = (mode: 'mic' | 'self' | 'recall') => {
    const hs = recentHits.filter((h) => h.mode === mode);
    const total = hs.reduce((a, h) => a + h.total, 0);
    return total ? Math.round((hs.reduce((a, h) => a + h.hits, 0) / total) * 100) : null;
  };
  const tracked = Object.keys(TITLES).filter((k) => state.tempo[k]);
  const fingerRate = hitRate('mic') ?? hitRate('self');
  const recallRate = hitRate('recall');

  return (
    <div className="history">
      <div className="title-row">
        <h1>Fortschritt</h1>
      </div>

      <section className="card level-card">
        <LevelBar xp={totalXp(state)} />
        <GoalRing done={sessionsThisWeek(state)} goal={state.settings.weeklyGoal} />
      </section>

      <section className="card">
        <h2>Übungskalender</h2>
        <Heatmap state={state} />
      </section>

      <div className="stats">
        <div className="stat">
          <strong>{streak(state)}</strong>
          <span>Tage in Folge</span>
        </div>
        <div className="stat">
          <strong>{weekMin}</strong>
          <span>Min. diese Woche</span>
        </div>
        <div className="stat">
          <strong>{totalMin}</strong>
          <span>Min. gesamt</span>
        </div>
        <div className="stat">
          <strong>{fingerRate === null ? '–' : `${fingerRate} %`}</strong>
          <span>Trefferquote Griffbrett (14 T.)</span>
        </div>
        <div className="stat">
          <strong>{recallRate === null ? '–' : `${recallRate} %`}</strong>
          <span>Skalen-Abruf (14 T.)</span>
        </div>
        <div className="stat">
          <strong>+{bpmGain(state)}</strong>
          <span>BPM gewonnen (alle Übungen)</span>
        </div>
        <div className="stat">
          <strong>{keysPlayed(state)}/12</strong>
          <span>Tonarten im Skalen-Block</span>
        </div>
      </div>

      <section className="card">
        <div className="title-row">
          <h2>
            Erfolge <span className="muted">{unlockedCount}/{ach.length}</span>
          </h2>
          <div className="seg small">
            <button className={!onlyOpen ? 'on' : ''} onClick={() => setOnlyOpen(false)}>
              Alle
            </button>
            <button className={onlyOpen ? 'on' : ''} onClick={() => setOnlyOpen(true)}>
              Offen
            </button>
          </div>
        </div>
        <p className="small muted">Tippe auf einen Erfolg für die Beschreibung.</p>
        {GROUPS.map((g) => {
          const items = ach.filter((a) => a.def.group === g && (!onlyOpen || !a.unlocked));
          if (!items.length) return null;
          return (
            <div key={g}>
              <h3 className="group-title">{g}</h3>
              <div className="badges">
                {items.map((a) => (
                  <Badge
                    key={a.def.id}
                    def={a.def}
                    unlocked={a.unlocked}
                    cur={a.cur}
                    goal={a.goal}
                    date={a.date}
                    selected={sel === a.def.id}
                    onClick={() => setSel(sel === a.def.id ? null : a.def.id)}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </section>

      <section className="card">
        <h2>Skalen-Repertoire</h2>
        <p className="small muted">★ im Skalen-Block gespielt · ★ fehlerfrei abgerufen · ★ 3× am Klang erkannt</p>
        <ul className="scale-list">
          {SCALES.map((sc) => {
            const p = scaleProgress(state, sc.id);
            return (
              <li key={sc.id}>
                <span className="stars" aria-label={`${p.stars} von 3 Sternen`}>
                  {[0, 1, 2].map((i) => (
                    <span key={i} className={i < p.stars ? 'on' : ''}>
                      ★
                    </span>
                  ))}
                </span>
                <span className="ex-name">{sc.name}</span>
                <span className="ex-meta">{p.sessions ? `${p.sessions}× gespielt` : <span className="muted">neu</span>}</span>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="card">
        <h2>Tempo pro Übung</h2>
        {tracked.length === 0 ? (
          <p className="muted">Nach der ersten bewerteten Übung siehst du hier, wie dein Tempo wächst.</p>
        ) : (
          <table className="tempo-table">
            <thead>
              <tr>
                <th>Übung</th>
                <th>Verlauf</th>
                <th className="num">Aktuell</th>
              </tr>
            </thead>
            <tbody>
              {tracked.map((k) => {
                const t = state.tempo[k];
                const first = t.history[0]?.bpm ?? t.bpm;
                const diff = t.bpm - first;
                return (
                  <tr key={k}>
                    <td>
                      <span className="ex-id">{k}</span> {TITLES[k]}
                      <div className="small muted">{t.clean > 0 ? `${t.clean}/2 saubere Einheiten bis +BPM` : 'nächste saubere Einheit zählt'}</div>
                    </td>
                    <td>
                      <Sparkline t={t} />
                    </td>
                    <td className="num">
                      <b>{t.bpm}</b>
                      {diff !== 0 && <div className={`small ${diff > 0 ? 'up' : 'down'}`}>{diff > 0 ? '+' : ''}{diff}</div>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      <section className="card">
        <h2>Einheiten</h2>
        {sessions.length === 0 && <p className="muted">Noch keine Einheit gespeichert.</p>}
        <ul className="log">
          {sessions.slice(0, allSessions ? 200 : 8).map((s) => (
            <li key={s.id}>
              <div className="log-head">
                <b>{new Date(s.date).toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' })}</b>
                <span>
                  {s.blocks && s.scaleId ? getScale(s.scaleId, s.root).name : s.modules.map((m) => `${m} · ${MODULE_INFO[m].name}`).join(' + ')}
                </span>
                <span className="muted">{Math.round(s.seconds / 60)} Min</span>
              </div>
              {s.progression && <div className="small muted">Akkorde: {s.progression}</div>}
              <div className="small muted">
                {s.scaleId && !s.blocks && s.modules.includes('C') ? `${getScale(s.scaleId).name} · ` : ''}
                {s.results
                  .filter((r) => r.bpm !== undefined && !r.skipped)
                  .map((r) => `${r.key} ${r.bpm}${r.rating === 'clean' ? '✓' : r.rating === 'rough' ? '✗' : ''}`)
                  .join(' · ')}
              </div>
              {s.note && <div className="small">→ {s.note}</div>}
            </li>
          ))}
        </ul>
        {sessions.length > 8 && (
          <button className="btn ghost small wide" onClick={() => setAllSessions(!allSessions)}>
            {allSessions ? 'Weniger anzeigen' : `Alle ${sessions.length} Einheiten anzeigen`}
          </button>
        )}
      </section>
    </div>
  );
}
