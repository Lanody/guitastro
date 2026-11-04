import { useMemo } from 'react';
import { AchievementTeaser, GoalRing, LevelBar } from '../components/Progress';
import { BLOCK_INFO, FOCUS_LABEL } from '../data/exercises';
import { totalSeconds } from '../data/types';
import { FOCUS_INFO, STAGE_INFO, UNLOCK_DAYS, bpmFor, buildPlan, progressionText, scaleDay, streak, type Plan } from '../logic/plan';
import { nextAchievement, sessionsThisWeek, totalXp } from '../logic/progress';
import { daysBetween, todayKey, type AppState } from '../logic/state';
import { SCALES, getScale } from '../music/scales';
import { CURRENT } from '../music/theory';

interface Props {
  state: AppState;
  onStart: (plan: Plan) => void;
  onReroll: () => void;
  go: (screen: 'trainer' | 'scales' | 'history' | 'guide') => void;
}

export function Home({ state, onStart, onReroll, go }: Props) {
  const plan = useMemo(() => buildPlan(state), [state]);
  const scale = getScale(plan.scaleId, plan.root);
  const total = Math.round(totalSeconds(plan.exercises) / 60);
  const today = todayKey();
  const playedToday = state.sessions.filter((s) => todayKey(new Date(s.date)) === today).length;
  const st = streak(state);
  const unlockIn = state.firstDay ? UNLOCK_DAYS - daysBetween(state.firstDay, today) : UNLOCK_DAYS;
  const dayOfBlock = scaleDay(state).index + 1;

  const hour = new Date().getHours();
  const greeting = hour < 11 ? 'Guten Morgen' : hour < 18 ? 'Hallo' : 'Guten Abend';

  return (
    <div className="home">
      <header className="home-head">
        <div>
          <p className="eyebrow">
            {CURRENT.name.replace(' (7)', '')} · {CURRENT.strings.length} Saiten
          </p>
          <h1>{playedToday ? 'Noch eine Runde?' : `${greeting}. Bereit?`}</h1>
        </div>
        <button className="help-btn" onClick={() => go('guide')} aria-label="Anleitung" title="Anleitung">
          ?
        </button>
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
              · Lektion {dayOfBlock}
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
            'Feste Fingerfolgen und Lagen (Variationen ausgeschaltet).'
          ) : (
            `Übungen wechseln mit jeder Lektion. Fingerfolgen und Lagen bleiben die ersten zwei Wochen gleich, damit sich die Bewegung festigt${state.firstDay ? ` – Variationen in ${Math.max(1, unlockIn)} ${unlockIn === 1 ? 'Tag' : 'Tagen'}` : ''}.`
          )}
        </p>
      </section>

      <AchievementTeaser next={nextAchievement(state)} eyebrow="Nächster Erfolg" onClick={() => go('history')} />

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
