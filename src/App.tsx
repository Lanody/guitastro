import { useCallback, useEffect, useState } from 'react';
import { audio } from './audio/engine';
import { advanceScale, applyRating, progressionText, type Plan } from './logic/plan';
import { levelInfo, sessionXp, totalXp, withAchievements, type AchievementDef } from './logic/progress';
import { load, save, todayKey, type AppState, type ExerciseResult, type HitLog, type SessionLog, type Settings } from './logic/state';
import { Done } from './screens/Done';
import { History } from './screens/History';
import { Home } from './screens/Home';
import { Scales } from './screens/Scales';
import { Session } from './screens/Session';
import { SettingsScreen } from './screens/SettingsScreen';
import { Summary } from './screens/Summary';
import { Trainer } from './screens/Trainer';

type Screen = 'home' | 'history' | 'scales' | 'trainer' | 'settings';

const NAV: { id: Screen; label: string }[] = [
  { id: 'home', label: 'Heute' },
  { id: 'trainer', label: 'Treffer' },
  { id: 'scales', label: 'Skalen' },
  { id: 'history', label: 'Fortschritt' },
  { id: 'settings', label: 'Mehr' },
];

export default function App() {
  const [state, setState] = useState<AppState>(load);
  const [screen, setScreen] = useState<Screen>('home');
  const [plan, setPlan] = useState<Plan | null>(null);
  const [finished, setFinished] = useState<{ results: ExerciseResult[]; seconds: number } | null>(null);
  const [done, setDone] = useState<{ xp: number; fresh: AchievementDef[]; levelBefore: number } | null>(null);
  const [toasts, setToasts] = useState<AchievementDef[]>([]);

  useEffect(() => save(state), [state]);

  const update = useCallback((fn: (s: AppState) => AppState) => setState((s) => fn(s)), []);

  const toast = useCallback((fresh: AchievementDef[]) => {
    if (!fresh.length) return;
    setToasts((t) => [...t, ...fresh]);
    setTimeout(() => setToasts((t) => t.filter((x) => !fresh.includes(x))), 4500);
  }, []);

  // Achievements can also unlock outside a session (hit trainer, ear quiz).
  const addHits = useCallback(
    (logs: HitLog[]) => {
      const { state: next, fresh } = withAchievements({ ...state, hits: [...state.hits, ...logs].slice(-2000) });
      setState(next);
      toast(fresh);
    },
    [state, toast],
  );
  const addHit = useCallback((log: HitLog) => addHits([log]), [addHits]);

  const start = (p: Plan) => {
    audio(); // unlock audio on this user gesture (iOS)
    update((s) => (s.firstDay ? s : { ...s, firstDay: todayKey() }));
    setFinished(null);
    setPlan(p);
  };

  const saveSession = (checks: [boolean, boolean, boolean], note: string, results: ExerciseResult[]) => {
    if (!plan || !finished) return;
    const s = state;
    const tempo = { ...s.tempo };
    for (const r of results) {
      if (!r.rating || r.bpm === undefined || r.skipped) continue;
      tempo[r.key] = applyRating(tempo[r.key], r.bpm, r.rating, plan.focus, s.settings.tempoStep).next;
    }
    const didScale = results.some((r) => r.block === 'scale' && !r.skipped);
    const session: SessionLog = {
      id: String(Date.now()),
      date: new Date().toISOString(),
      modules: plan.modules,
      blocks: plan.blocks,
      scaleId: plan.scaleId,
      root: plan.root,
      progression: progressionText(plan.progression),
      focus: plan.focus,
      seconds: finished.seconds,
      results,
      checks,
      note,
    };
    const next: AppState = {
      ...s,
      tempo,
      sessions: [...s.sessions, session],
      nextFocus: note || undefined,
      reroll: 0,
    };
    if (didScale) next.scale = advanceScale(s);
    const { state: withAch, fresh } = withAchievements(next);
    setDone({ xp: sessionXp(session), fresh, levelBefore: levelInfo(totalXp(s)).level });
    setState(withAch);
    setPlan(null);
    setFinished(null);
  };

  const toastList = toasts.length > 0 && (
    <div className="toasts" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className="toast">
          <span aria-hidden>{t.icon}</span>
          <div>
            <b>Erfolg: {t.title}</b>
            <div className="small">{t.text}</div>
          </div>
        </div>
      ))}
    </div>
  );

  if (done) {
    return (
      <main className="app">
        <Done
          state={state}
          {...done}
          onContinue={() => {
            setDone(null);
            setScreen('history');
          }}
        />
      </main>
    );
  }

  if (plan && finished) {
    return (
      <main className="app">
        <Summary plan={plan} state={state} results={finished.results} seconds={finished.seconds} onSave={saveSession} />
        {toastList}
      </main>
    );
  }

  if (plan) {
    return (
      <main className="app">
        <Session
          plan={plan}
          state={state}
          onHit={addHit}
          onFinish={(results, seconds) => (results.length ? setFinished({ results, seconds }) : setPlan(null))}
          onExit={() => setPlan(null)}
        />
        {toastList}
      </main>
    );
  }

  return (
    <>
      <main className="app">
        {screen === 'home' && (
          <Home
            state={state}
            onStart={start}
            onReroll={() => update((s) => ({ ...s, reroll: s.reroll + 1 }))}
            go={setScreen}
          />
        )}
        {screen === 'history' && <History state={state} />}
        {screen === 'scales' && (
          <Scales
            state={state}
            onEar={addHits}
            onChoose={(id, root, pinned) =>
              update((s) => {
                const same = s.scale.id === id && (s.scale.root ?? 0) === root;
                return { ...s, scale: { id, root, pinned, sessions: same ? s.scale.sessions : 0 } };
              })
            }
          />
        )}
        {screen === 'trainer' && <Trainer state={state} onHit={addHit} />}
        {screen === 'settings' && (
          <SettingsScreen
            state={state}
            onSettings={(p: Partial<Settings>) => update((s) => ({ ...s, settings: { ...s.settings, ...p } }))}
            onReplace={setState}
          />
        )}
      </main>
      {toastList}
      <nav className="tabbar">
        {NAV.map((n) => (
          <button key={n.id} className={screen === n.id ? 'on' : ''} onClick={() => setScreen(n.id)}>
            {n.label}
          </button>
        ))}
      </nav>
    </>
  );
}
