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
});
