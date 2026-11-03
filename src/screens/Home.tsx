import { useMemo } from 'react';
import { GoalRing, LevelBar } from '../components/Progress';
import { BLOCK_INFO } from '../data/exercises';
import { nextAchievement, sessionsThisWeek, totalXp } from '../logic/progress';
import { seconds } from '../data/types';
import { FOCUS_INFO, STAGE_INFO, UNLOCK_DAYS, bpmFor, buildPlan, progressionText, streak, type Plan } from '../logic/plan';
import { daysBetween, todayKey, type AppState } from '../logic/state';
import { SCALES, getScale } from '../music/scales';
import { FOCUS_LABEL } from './Session';

interface Props {
  state: AppState;
  onStart: (plan: Plan) => void;
  onReroll: () => void;
  go: (screen: 'trainer' | 'scales' | 'history') => void;
}

export function Home({ state, onStart, onReroll, go }: Props) {
  const plan = useMemo(() => buildPlan(state), [state]);
  const scale = getScale(plan.scaleId, plan.root);
  const total = Math.round(plan.exercises.reduce((a, e) => a + seconds(e), 0) / 60);
  const today = todayKey();
  const playedToday = state.sessions.filter((s) => todayKey(new Date(s.date)) === today).length;
  const st = streak(state);
  const unlockIn = state.firstDay ? UNLOCK_DAYS - daysBetween(state.firstDay, today) : UNLOCK_DAYS;
  const dayOfBlock = (state.scale.sessions % Math.max(1, state.settings.scaleSessions)) + 1;

  const greeting = (() => {
    const h = new Date().getHours();
    return h < 11 ? 'Guten Morgen' : h < 18 ? 'Hallo' : 'Guten Abend';
  })();

  return (
    <div className="home">
      <header className="home-head">
        <div>
          <p className="eyebrow">Drop C · Gitarren-Training</p>
          <h1>{playedToday ? 'Noch eine Runde?' : `${greeting}. Bereit?`}</h1>
        </div>
        <div className="streak" title="Tage in Folge geübt">
          <strong>{st}</strong>
          <span>{st === 1 ? 'Tag' : 'Tage'} in Folge</span>
        </div>
      </header>

      <button className="card motivation" onClick={() => go('history')}>
        <LevelBar xp={totalXp(state)} />
        <GoalRing done={sessionsThisWeek(state)} goal={state.settings.weeklyGoal} />
      </button>

      <section className="card today">
        <p className="eyebrow">Heute · {total} Minuten in {plan.blocks.length} Blöcken</p>

        <div className="scale-week">
          <span className="dot gold" />
          <div>
            <b>{scale.name}</b>
            <span className="muted">
              {' '}
              · Tag {dayOfBlock}
              {state.scale.pinned ? ' (fixiert)' : ` von ${state.settings.scaleSessions}`}
            </span>
            <p className="small">{STAGE_INFO[plan.stage]}</p>
            <p className="small muted">
              Akkordfolge: <b>{progressionText(plan.progression)}</b>
            </p>
          </div>
        </div>

        {plan.focus !== 'standard' && (
          <div className={`focus-banner ${plan.focus}`}>
            <b>{FOCUS_INFO[plan.focus].title}</b> – {FOCUS_INFO[plan.focus].text}
          </div>
        )}

        {plan.blocks.map((b) => (
          <div key={b} className="block">
            <h3 className="block-head">
              <span>{BLOCK_INFO[b].name}</span>
              <span className="muted small">{BLOCK_INFO[b].minutes} Min</span>
            </h3>
            <ol className="ex-list">
              {plan.exercises
                .filter((e) => e.block === b)
                .map((e) => (
                  <li key={e.key}>
                    <span className="ex-id">
                      {e.module}
                      {e.num}
                    </span>
                    <span className="ex-name">
                      {e.title}
                      {e.variant && <small className="variant"> · {e.variant}</small>}
                    </span>
                    <span className="ex-meta">
                      {e.tracksTempo ? `${bpmFor(state, e, plan.focus)} BPM` : <span className={`chip tiny focus-${e.focus}`}>{FOCUS_LABEL[e.focus]}</span>}
                    </span>
                  </li>
                ))}
            </ol>
          </div>
        ))}

        <button className="btn primary big wide" onClick={() => onStart(plan)}>
          Lektion starten
        </button>

        <p className="small muted center">
          {plan.vary ? (
            <>
              Variationen aktiv – Fingerfolgen, Lagen und Saiten wechseln zusätzlich.{' '}
              <button className="link" onClick={onReroll}>
                Neu würfeln
              </button>
            </>
          ) : state.settings.variation === 'never' ? (
            'Heft-Version (Variationen ausgeschaltet).'
          ) : (
            `Übungen wechseln täglich. Fingerfolgen und Lagen bleiben die ersten zwei Wochen wie im Heft${state.firstDay ? ` – Variationen in ${Math.max(1, unlockIn)} ${unlockIn === 1 ? 'Tag' : 'Tagen'}` : ''}.`
          )}
        </p>
      </section>

      {(() => {
        const next = nextAchievement(state);
        return next ? (
          <button className="card teaser" onClick={() => go('history')}>
            <span className="eyebrow">Nächster Erfolg</span>
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
          </button>
        ) : null;
      })()}

      {state.nextFocus && (
        <section className="card note-card">
          <span className="eyebrow">Dein nächster Fokus</span>
          <p>{state.nextFocus}</p>
        </section>
      )}

      <section className="quick">
        <button className="card quick-btn" onClick={() => go('trainer')}>
          <b>Treffer-Training</b>
          <span className="muted small">Töne auf dem Griffbrett finden – mit Mikrofon-Erkennung</span>
        </button>
        <button className="card quick-btn" onClick={() => go('scales')}>
          <b>Skalen-Bibliothek</b>
          <span className="muted small">{`${SCALES.length} Skalen in allen 12 Tonarten`}</span>
        </button>
      </section>
    </div>
  );
}
