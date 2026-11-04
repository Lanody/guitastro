import { describe, expect, it } from 'vitest';
import { ACHIEVEMENTS, bestStreak, evaluate, levelInfo, scaleProgress, sessionXp, totalXp, withAchievements, xpForLevel } from './progress';
import { initialState, type SessionLog } from './state';

const session = (date: string, extra: Partial<SessionLog> = {}): SessionLog => ({
  id: date,
  date,
  modules: ['A', 'C'],
  scaleId: 'dorian',
  focus: 'standard',
  seconds: 1800,
  results: [
    { key: 'A1', title: 'Synchronisation', module: 'A', bpm: 60, rating: 'clean' },
    { key: 'C1', title: 'Hören', module: 'C' },
  ],
  checks: [true, true, true],
  note: '',
  ...extra,
});

describe('xp & levels', () => {
  it('awards minutes, clean ratings and checks', () => {
    expect(sessionXp(session('2026-11-02T18:00:00'))).toBe(300 + 15 + 20);
  });
  it('level thresholds grow', () => {
    expect(levelInfo(0).level).toBe(1);
    expect(levelInfo(xpForLevel(2)).level).toBe(2);
    expect(levelInfo(xpForLevel(2) - 1).level).toBe(1);
    const l = levelInfo(700);
    expect(l.level).toBe(2);
    expect(l.into + l.toNext).toBe(l.span);
  });
});

describe('achievements', () => {
  it('ids are unique', () => {
    expect(new Set(ACHIEVEMENTS.map((a) => a.id)).size).toBe(ACHIEVEMENTS.length);
  });
  it('fresh state unlocks nothing', () => {
    expect(evaluate(initialState()).filter((a) => a.unlocked)).toEqual([]);
  });
  it('unlocks first session and streak, only once', () => {
    const s = initialState();
    s.sessions = ['2026-10-31T18:00:00', '2026-11-01T18:00:00', '2026-11-02T07:30:00'].map((d) => session(d));
    expect(bestStreak(s)).toBe(3);
    const r = withAchievements(s);
    const ids = r.fresh.map((f) => f.id);
    expect(ids).toEqual(expect.arrayContaining(['first', 'streak3', 'scale1', 'early']));
    expect(ids).not.toContain('streak7');
    expect(withAchievements(r.state).fresh).toEqual([]);
  });
  it('scale stars', () => {
    const s = initialState();
    s.sessions = [session('2026-11-02T18:00:00')];
    s.hits = [
      { d: '', mode: 'recall', hits: 7, total: 7, scaleId: 'dorian' },
      { d: '', mode: 'ear', hits: 3, total: 3, scaleId: 'dorian' },
    ];
    expect(scaleProgress(s, 'dorian').stars).toBe(3);
    expect(scaleProgress(s, 'phrygian').stars).toBe(0);
    expect(totalXp(s)).toBe(335 + 20);
  });

  const unlocked = (s: ReturnType<typeof initialState>) => new Set(evaluate(s).filter((a) => a.unlocked).map((a) => a.def.id));

  it('weekly-goal streak needs consecutive weeks', () => {
    const s = initialState();
    s.settings.weeklyGoal = 2;
    // Mondays: Oct 5, 12, 19, 26 (2026) – two sessions each.
    s.sessions = ['05', '12', '19', '26'].flatMap((d) => [session(`2026-10-${d}T18:00:00`), session(`2026-10-${d}T19:00:00`)]);
    expect(unlocked(s).has('weeks4')).toBe(true);
    s.sessions = s.sessions.filter((x) => !x.date.startsWith('2026-10-19'));
    expect(unlocked(s).has('weeks4')).toBe(false);
  });

  it('comeback after a week off', () => {
    const s = initialState();
    s.sessions = [session('2026-10-01T18:00:00'), session('2026-10-08T18:00:00')];
    expect(unlocked(s).has('comeback')).toBe(false);
    s.sessions.push(session('2026-10-16T18:00:00'));
    expect(unlocked(s).has('comeback')).toBe(true);
  });

  it('clean runs and bursts', () => {
    const s = initialState();
    const hist = (rs: string, bpm = 80) => [...rs].map((r) => ({ d: '', bpm, r: (r === 'c' ? 'clean' : 'ok') as 'clean' | 'ok' }));
    s.tempo = { A1: { bpm: 84, clean: 0, rough: 0, history: hist('cccocccc') }, A6: { bpm: 100, clean: 0, rough: 0, history: hist('c', 100) } };
    const ids = unlocked(s);
    expect(ids.has('cleanrun5')).toBe(false);
    expect(ids.has('burst100')).toBe(true);
    expect(ids.has('burst120')).toBe(false);
    s.tempo.A1.history = hist('ccccc');
    expect(unlocked(s).has('cleanrun5')).toBe(true);
  });

  it('fast hit rounds need accuracy too', () => {
    const s = initialState();
    s.hits = [{ d: '', mode: 'self', hits: 6, total: 10, avgMs: 900 }];
    expect(unlocked(s).has('quick2')).toBe(false);
    s.hits.push({ d: '', mode: 'mic', hits: 9, total: 10, avgMs: 1500 });
    expect(unlocked(s).has('quick2')).toBe(true);
    expect(unlocked(s).has('quick1')).toBe(false);
  });
});
