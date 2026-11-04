import { AchievementTeaser, LevelBar } from '../components/Progress';
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
  const xpTotal = totalXp(state);
  const l = levelInfo(xpTotal);
  const st = streak(state);
  const levelUp = l.level > levelBefore;
  return (
    <div className="done">
      <div className="done-hero">
        <span className="done-icon" aria-hidden>
          {levelUp ? '🎉' : fresh.length ? '🏅' : '🎸'}
        </span>
        <h1>{levelUp ? `Level ${l.level}: ${l.title}!` : 'Einheit gespeichert'}</h1>
        {st > 1 && <p className="muted">{st} Tage in Folge – weiter so.</p>}
      </div>

      <section className="card">
        <LevelBar xp={xpTotal} gained={xp} />
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

      <AchievementTeaser next={nextAchievement(state)} eyebrow="Als Nächstes in Reichweite" />

      <div className="done-actions">
        <button className="btn primary big wide" onClick={onContinue}>
          Zum Fortschritt
        </button>
      </div>
    </div>
  );
}
