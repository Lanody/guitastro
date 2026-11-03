import { LevelBar } from '../components/Progress';
import { streak } from '../logic/plan';
import { levelInfo, nextAchievement, totalXp, type AchievementDef } from '../logic/progress';
import type { AppState } from '../logic/state';

interface Props {
  state: AppState;
  xp: number;
  fresh: AchievementDef[];
  levelBefore: number;
  onContinue: () => void;
}

export function Done({ state, xp, fresh, levelBefore, onContinue }: Props) {
  const l = levelInfo(totalXp(state));
  const st = streak(state);
  const next = nextAchievement(state);
  return (
    <div className="done">
      <div className="done-hero">
        <span className="done-icon" aria-hidden>
          {l.level > levelBefore ? '🎉' : fresh.length ? '🏅' : '🎸'}
        </span>
        <h1>{l.level > levelBefore ? `Level ${l.level}: ${l.title}!` : 'Einheit gespeichert'}</h1>
        {st > 1 && <p className="muted">{st} Tage in Folge – weiter so.</p>}
      </div>

      <section className="card">
        <LevelBar xp={totalXp(state)} gained={xp} />
      </section>

      {fresh.length > 0 && (
        <section className="card">
          <h2>Neu freigeschaltet</h2>
          <ul className="fresh">
            {fresh.map((f) => (
              <li key={f.id}>
                <span className="badge-icon pop" aria-hidden>
                  {f.icon}
                </span>
                <div>
                  <b>{f.title}</b>
                  <div className="small muted">{f.text}</div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {next && (
        <section className="card teaser">
          <span className="eyebrow">Als Nächstes in Reichweite</span>
          <div className="teaser-row">
            <span className="badge-icon" aria-hidden>
              {next.def.icon}
            </span>
            <div>
              <b>{next.def.title}</b>
              <div className="small muted">{next.def.text}</div>
              {next.goal > 1 && (
                <span className="badge-track">
                  <span style={{ width: `${(next.cur / next.goal) * 100}%` }} />
                  <small>
                    {next.cur}/{next.goal}
                  </small>
                </span>
              )}
            </div>
          </div>
        </section>
      )}

      <div className="done-actions">
        <button className="btn primary big wide" onClick={onContinue}>
          Zum Fortschritt
        </button>
      </div>
    </div>
  );
}
