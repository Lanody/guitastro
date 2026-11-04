import { levelInfo, minutesByDay, type AchievementDef, type evaluate } from '../logic/progress';
import { todayKey } from '../logic/state';

export function LevelBar({ xp, gained }: { xp: number; gained?: number }) {
  const l = levelInfo(xp);
  const pct = (l.into / l.span) * 100;
  const before = gained ? Math.max(0, ((l.into - gained) / l.span) * 100) : pct;
  return (
    <div className="level">
      <div className="level-top">
        <span className="level-badge">{l.level}</span>
        <div>
          <b>{l.title}</b>
          <div className="small muted">
            {l.xp.toLocaleString('de-DE')} XP · noch {l.toNext.toLocaleString('de-DE')} bis Level {l.level + 1}
          </div>
        </div>
        {gained ? <span className="xp-gain">+{gained} XP</span> : null}
      </div>
      <div className="level-track" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
        <div className="level-before" style={{ width: `${before}%` }} />
        <div className="level-fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function GoalRing({ done, goal }: { done: number; goal: number }) {
  const r = 26;
  const c = 2 * Math.PI * r;
  const p = Math.min(1, done / goal);
  return (
    <div className="goal" title={`${done} von ${goal} Einheiten diese Woche`}>
      <svg viewBox="0 0 64 64" width="64" height="64" aria-hidden>
        <circle cx="32" cy="32" r={r} className="goal-bg" />
        <circle cx="32" cy="32" r={r} className="goal-fg" strokeDasharray={`${c * p} ${c}`} transform="rotate(-90 32 32)" />
        <text x="32" y="37" textAnchor="middle">
          {done}/{goal}
        </text>
      </svg>
      <span>{p >= 1 ? 'Wochenziel geschafft!' : 'Wochenziel'}</span>
    </div>
  );
}

export function Badge({
  def,
  unlocked,
  cur,
  goal,
  date,
  selected,
  onClick,
}: {
  def: AchievementDef;
  unlocked: boolean;
  cur: number;
  goal: number;
  date?: string;
  selected?: boolean;
  onClick?: () => void;
}) {
  return (
    <button className={`badge${unlocked ? ' on' : ''}${selected ? ' sel' : ''}`} onClick={onClick} title={def.text} aria-pressed={selected}>
      <span className="badge-icon" aria-hidden>
        {def.icon}
      </span>
      <b>{def.title}</b>
      {selected && <span className="small muted">{def.text}</span>}
      {unlocked ? (
        <span className="small badge-date">{date ? new Date(date).toLocaleDateString('de-DE') : 'erreicht'}</span>
      ) : (
        <BadgeTrack cur={cur} goal={goal} />
      )}
    </button>
  );
}

/** Progress towards an achievement (hidden for yes/no achievements). */
function BadgeTrack({ cur, goal }: { cur: number; goal: number }) {
  if (goal <= 1) return null;
  return (
    <span className="badge-track" aria-label={`${cur} von ${goal}`}>
      <span style={{ width: `${(cur / goal) * 100}%` }} />
      <small>
        {cur}/{goal}
      </small>
    </span>
  );
}

/** The locked achievement closest to done; a button when it leads somewhere. */
export function AchievementTeaser({ next, eyebrow, onClick }: { next: ReturnType<typeof evaluate>[number] | undefined; eyebrow: string; onClick?: () => void }) {
  if (!next) return null;
  const body = (
    <>
      <span className="eyebrow">{eyebrow}</span>
      <div className="teaser-row">
        <span className="badge-icon" aria-hidden>
          {next.def.icon}
        </span>
        <div>
          <b>{next.def.title}</b>
          <div className="small muted">{next.def.text}</div>
          <BadgeTrack cur={next.cur} goal={next.goal} />
        </div>
      </div>
    </>
  );
  return onClick ? (
    <button className="card teaser" onClick={onClick}>
      {body}
    </button>
  ) : (
    <section className="card teaser">{body}</section>
  );
}

/** Practice calendar: last N weeks, one cell per day, shade = minutes. */
export function Heatmap({ state, weeks = 15 }: { state: Parameters<typeof minutesByDay>[0]; weeks?: number }) {
  const mins = minutesByDay(state);
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7) - (weeks - 1) * 7);
  const level = (m: number) => (m <= 0 ? 0 : m < 15 ? 1 : m < 30 ? 2 : m < 45 ? 3 : 4);
  const cells = [];
  for (let w = 0; w < weeks; w++) {
    for (let d = 0; d < 7; d++) {
      const day = new Date(start);
      day.setDate(start.getDate() + w * 7 + d);
      const key = todayKey(day);
      const m = Math.round(mins.get(key) ?? 0);
      const future = day > today;
      cells.push(
        <rect
          key={key}
          x={w * 16}
          y={d * 16}
          width={13}
          height={13}
          rx={3}
          className={future ? 'hm-future' : `hm-${level(m)}`}
        >
          <title>{`${day.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' })}: ${m ? `${m} Min` : 'nicht geübt'}`}</title>
        </rect>,
      );
    }
  }
  return (
    <div className="heatmap">
      <svg viewBox={`-22 0 ${weeks * 16 + 22} ${7 * 16}`} role="img" aria-label="Übungskalender">
        {['Mo', '', 'Mi', '', 'Fr', '', 'So'].map((l, i) => (
          <text key={i} x={-6} y={i * 16 + 10.5} className="hm-label" textAnchor="end">
            {l}
          </text>
        ))}
        {cells}
      </svg>
      <div className="hm-legend small muted">
        weniger
        {[0, 1, 2, 3, 4].map((l) => (
          <svg key={l} width="13" height="13" aria-hidden>
            <rect width="13" height="13" rx="3" className={`hm-${l}`} />
          </svg>
        ))}
        mehr <span className="hm-keys">(0 · &lt;15 · &lt;30 · &lt;45 · 45+ Min)</span>
      </div>
    </div>
  );
}
