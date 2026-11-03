// Progress, XP/levels and achievements — all derived from the saved logs,
// so nothing can drift out of sync. Only unlock dates are stored.

import { SCALES, SCALE_ROTATION } from '../music/scales';
import { todayKey, type AppState, type SessionLog } from './state';

// ---------------------------------------------------------------------------
// XP & levels
// ---------------------------------------------------------------------------

/** 10 XP per minute, +15 per clean exercise, +20 when all three checks are ticked. */
export function sessionXp(s: SessionLog) {
  const minutes = Math.round(s.seconds / 60);
  const clean = s.results.filter((r) => r.rating === 'clean').length;
  return minutes * 10 + clean * 15 + (s.checks.every(Boolean) ? 20 : 0);
}

export function totalXp(state: AppState) {
  const fromSessions = state.sessions.reduce((a, s) => a + sessionXp(s), 0);
  const fromHits = state.hits.reduce((a, h) => a + h.hits * 2, 0);
  return fromSessions + fromHits;
}

export const LEVEL_TITLES = [
  'Neu am Griffbrett',
  'Riff-Lehrling',
  'Skalen-Scout',
  'Griffbrett-Wanderer',
  'Lick-Schmied',
  'Phrasen-Bauer',
  'Solo-Architekt',
  'Shred-Adept',
  'Drop-C-Virtuose',
  'Griffbrett-Meister',
  'Legende',
];

/** XP needed to reach `level` (level 1 = 0 XP). Grows quadratically. */
export const xpForLevel = (level: number) => 250 * level * (level - 1);

export function levelInfo(xp: number) {
  let level = 1;
  while (xp >= xpForLevel(level + 1)) level++;
  const from = xpForLevel(level);
  const to = xpForLevel(level + 1);
  return {
    level,
    title: LEVEL_TITLES[Math.min(level - 1, LEVEL_TITLES.length - 1)],
    xp,
    into: xp - from,
    span: to - from,
    toNext: to - xp,
  };
}

// ---------------------------------------------------------------------------
// Aggregates
// ---------------------------------------------------------------------------

/** Monday-based week start for a date. */
export function weekStart(d: Date) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x;
}

export function sessionsThisWeek(state: AppState, now = new Date()) {
  const start = weekStart(now).getTime();
  return state.sessions.filter((s) => Date.parse(s.date) >= start).length;
}

/** Best streak ever (consecutive days with a session). */
export function bestStreak(state: AppState) {
  const days = [...new Set(state.sessions.map((s) => todayKey(new Date(s.date))))].sort();
  let best = 0;
  let cur = 0;
  let prev: number | null = null;
  for (const d of days) {
    const t = Date.parse(d + 'T12:00:00');
    cur = prev !== null && Math.round((t - prev) / 86400000) === 1 ? cur + 1 : 1;
    best = Math.max(best, cur);
    prev = t;
  }
  return best;
}

/** Minutes practised per calendar day. */
export function minutesByDay(state: AppState) {
  const m = new Map<string, number>();
  for (const s of state.sessions) {
    const k = todayKey(new Date(s.date));
    m.set(k, (m.get(k) ?? 0) + s.seconds / 60);
  }
  return m;
}

/** Sum of BPM gained over all tracked exercises since their first rating. */
export function bpmGain(state: AppState) {
  return Object.values(state.tempo).reduce((a, t) => a + Math.max(0, t.bpm - (t.history[0]?.bpm ?? t.bpm)), 0);
}

export function maxBpmGain(state: AppState) {
  return Object.values(state.tempo).reduce((a, t) => Math.max(a, t.bpm - (t.history[0]?.bpm ?? t.bpm)), 0);
}

export function hitTotals(state: AppState, modes: string[]) {
  const hs = state.hits.filter((h) => modes.includes(h.mode));
  const hits = hs.reduce((a, h) => a + h.hits, 0);
  const total = hs.reduce((a, h) => a + h.total, 0);
  return { hits, total, rate: total ? hits / total : null };
}

export interface ScaleProgress {
  id: string;
  sessions: number;
  recallBest: number | null;
  earHits: number;
  /** 0–3 stars: played in the scale block · recalled without error · recognised by ear. */
  stars: number;
}

/** Different tonics the scale block was played in. */
export function keysPlayed(state: AppState) {
  return new Set(state.sessions.filter((s) => s.blocks && s.results.some((r) => r.block === 'scale' && !r.skipped)).map((s) => s.root ?? 0)).size;
}

const chordSessions = (s: AppState) => s.sessions.filter((x) => x.results.some((r) => r.block === 'chords' && !r.skipped)).length;
const fullPlan = (x: SessionLog) => !!x.blocks?.every((b) => x.results.some((r) => r.block === b && !r.skipped));

export function scaleProgress(state: AppState, id: string): ScaleProgress {
  const sessions = state.sessions.filter((s) => s.scaleId === id && s.modules.includes('C') && s.results.some((r) => r.module === 'C' && !r.skipped)).length;
  const recalls = state.hits.filter((h) => h.mode === 'recall' && h.scaleId === id);
  const recallBest = recalls.length ? Math.max(...recalls.map((h) => h.hits / h.total)) : null;
  const earHits = state.hits.filter((h) => h.mode === 'ear' && h.scaleId === id).reduce((a, h) => a + h.hits, 0);
  const stars = (sessions >= 1 ? 1 : 0) + (recallBest === 1 ? 1 : 0) + (earHits >= 3 ? 1 : 0);
  return { id, sessions, recallBest, earHits, stars };
}

// ---------------------------------------------------------------------------
// Achievements
// ---------------------------------------------------------------------------

export type AchievementGroup = 'Dranbleiben' | 'Tempo' | 'Treffsicherheit' | 'Skalen' | 'Spielweise';

export interface AchievementDef {
  id: string;
  group: AchievementGroup;
  icon: string;
  title: string;
  text: string;
  /** Current value and goal; unlocked when cur >= goal. */
  progress: (s: AppState) => [number, number];
}

const count = (n: number, goal: number): [number, number] => [Math.min(n, goal), goal];
const flag = (b: boolean): [number, number] => [b ? 1 : 0, 1];
const fullChecks = (s: AppState) => s.sessions.filter((x) => x.checks.every(Boolean)).length;
const totalMinutes = (s: AppState) => Math.round(s.sessions.reduce((a, x) => a + x.seconds, 0) / 60);
const hourOf = (x: SessionLog) => new Date(x.date).getHours();
const goodRound = (s: AppState, modes: string[], minTotal: number, rate: number) =>
  s.hits.some((h) => modes.includes(h.mode) && h.total >= minTotal && h.hits / h.total >= rate);
const scalesPlayed = (s: AppState) => new Set(s.sessions.filter((x) => x.modules.includes('C') && x.scaleId).map((x) => x.scaleId)).size;
const scalesRecalled = (s: AppState) => new Set(s.hits.filter((h) => h.mode === 'recall' && h.hits === h.total).map((h) => h.scaleId)).size;

export const ACHIEVEMENTS: AchievementDef[] = [
  // Dranbleiben
  { id: 'first', group: 'Dranbleiben', icon: '🎸', title: 'Erster Ton', text: 'Die erste Einheit gespeichert.', progress: (s) => count(s.sessions.length, 1) },
  { id: 'streak3', group: 'Dranbleiben', icon: '🔥', title: 'Warmgespielt', text: '3 Tage in Folge geübt.', progress: (s) => count(bestStreak(s), 3) },
  { id: 'streak7', group: 'Dranbleiben', icon: '🔥', title: 'Eine Woche am Stück', text: '7 Tage in Folge geübt.', progress: (s) => count(bestStreak(s), 7) },
  { id: 'streak14', group: 'Dranbleiben', icon: '🔥', title: 'Zwei Wochen Disziplin', text: '14 Tage in Folge – genau die Heft-Phase.', progress: (s) => count(bestStreak(s), 14) },
  { id: 'streak30', group: 'Dranbleiben', icon: '🏆', title: 'Monats-Monster', text: '30 Tage in Folge geübt.', progress: (s) => count(bestStreak(s), 30) },
  { id: 'sessions10', group: 'Dranbleiben', icon: '📅', title: 'Zweistellig', text: '10 Einheiten gespeichert.', progress: (s) => count(s.sessions.length, 10) },
  { id: 'sessions50', group: 'Dranbleiben', icon: '📅', title: 'Routine', text: '50 Einheiten gespeichert.', progress: (s) => count(s.sessions.length, 50) },
  { id: 'sessions100', group: 'Dranbleiben', icon: '💯', title: 'Hundert', text: '100 Einheiten gespeichert.', progress: (s) => count(s.sessions.length, 100) },
  { id: 'hours5', group: 'Dranbleiben', icon: '⏱️', title: 'Fünf Stunden', text: '300 Minuten insgesamt geübt.', progress: (s) => count(totalMinutes(s), 300) },
  { id: 'hours20', group: 'Dranbleiben', icon: '⏱️', title: 'Zwanzig Stunden', text: '1.200 Minuten insgesamt geübt.', progress: (s) => count(totalMinutes(s), 1200) },
  { id: 'weekgoal', group: 'Dranbleiben', icon: '🎯', title: 'Wochenziel', text: 'Das Wochenziel einmal erreicht.', progress: (s) => count(maxWeekSessions(s), s.settings.weeklyGoal) },
  {
    id: 'full45',
    group: 'Dranbleiben',
    icon: '💪',
    title: 'Volles Programm',
    text: 'Alle sechs Blöcke einer Einheit gespielt, nichts übersprungen.',
    progress: (s) => flag(s.sessions.some((x) => fullPlan(x) || ['A', 'B', 'C'].every((m) => x.modules.includes(m as 'A')))),
  },
  { id: 'early', group: 'Dranbleiben', icon: '🌅', title: 'Frühschicht', text: 'Eine Einheit vor 9 Uhr.', progress: (s) => flag(s.sessions.some((x) => hourOf(x) < 9)) },
  { id: 'late', group: 'Dranbleiben', icon: '🌙', title: 'Nachtschicht', text: 'Eine Einheit nach 22 Uhr.', progress: (s) => flag(s.sessions.some((x) => hourOf(x) >= 22)) },
  // Tempo
  { id: 'bpmup', group: 'Tempo', icon: '⬆️', title: 'Erste Steigerung', text: 'Zum ersten Mal +BPM verdient.', progress: (s) => count(maxBpmGain(s), 1) },
  { id: 'bpm10', group: 'Tempo', icon: '🚀', title: '+10 BPM', text: 'Eine Übung 10 BPM schneller als am Anfang.', progress: (s) => count(maxBpmGain(s), 10) },
  { id: 'bpm20', group: 'Tempo', icon: '🚀', title: '+20 BPM', text: 'Eine Übung 20 BPM schneller als am Anfang.', progress: (s) => count(maxBpmGain(s), 20) },
  { id: 'bpmsum50', group: 'Tempo', icon: '⚡', title: 'Auf breiter Front', text: 'Zusammen +50 BPM über alle Übungen.', progress: (s) => count(bpmGain(s), 50) },
  { id: 'burst90', group: 'Tempo', icon: '⚡', title: 'Burst 90', text: 'Speed-Bursts sauber bei 90 BPM.', progress: (s) => count(cleanAt(s, ['A6', 'B5']), 90) },
  { id: 'clean5', group: 'Tempo', icon: '✨', title: 'Blitzsauber', text: '5 Tempo-Übungen in einer Einheit als „sauber“ bewertet.', progress: (s) => count(Math.max(0, ...s.sessions.map((x) => x.results.filter((r) => r.rating === 'clean').length)), 5) },
  // Treffsicherheit
  { id: 'hit90', group: 'Treffsicherheit', icon: '🎯', title: 'Scharfschütze', text: 'Eine Treffer-Runde (ab 8 Zielen) mit mindestens 90 %.', progress: (s) => flag(goodRound(s, ['mic', 'self'], 8, 0.9)) },
  { id: 'mic100', group: 'Treffsicherheit', icon: '🎙️', title: 'Das Mikro lügt nicht', text: 'Eine Mikrofon-Runde (ab 8 Zielen) fehlerfrei.', progress: (s) => flag(goodRound(s, ['mic'], 8, 1)) },
  { id: 'hits250', group: 'Treffsicherheit', icon: '🧭', title: 'Griffbrett-Kenner', text: '250 Töne auf Anhieb gefunden.', progress: (s) => count(hitTotals(s, ['mic', 'self']).hits, 250) },
  { id: 'ear10', group: 'Treffsicherheit', icon: '👂', title: 'Gutes Gehör', text: '10 Skalen im Hör-Quiz richtig erkannt.', progress: (s) => count(hitTotals(s, ['ear']).hits, 10) },
  // Skalen
  { id: 'scale1', group: 'Skalen', icon: '🎼', title: 'Neue Farbe', text: 'Den Skalen-Block mit einer Skala gespielt.', progress: (s) => count(scalesPlayed(s), 1) },
  { id: 'scales3', group: 'Skalen', icon: '🎨', title: 'Drei Farben', text: 'Alle drei Skalen aus dem Heft gespielt.', progress: (s) => count(['dorian', 'phrygian', 'harmonic'].filter((id) => s.sessions.some((x) => x.scaleId === id && x.modules.includes('C'))).length, 3) },
  { id: 'scalesAll', group: 'Skalen', icon: '🌈', title: 'Ganze Palette', text: `Alle ${SCALE_ROTATION.length} Skalen der Rotation gespielt.`, progress: (s) => count(SCALE_ROTATION.filter((id) => s.sessions.some((x) => x.scaleId === id && x.modules.includes('C'))).length, SCALE_ROTATION.length) },
  { id: 'recall5', group: 'Skalen', icon: '🧠', title: 'Aus dem Kopf', text: '5 verschiedene Skalen fehlerfrei abgerufen.', progress: (s) => count(scalesRecalled(s), 5) },
  { id: 'master', group: 'Skalen', icon: '⭐', title: 'Skalen-Meister', text: 'Eine Skala mit allen 3 Sternen.', progress: (s) => count(Math.max(...SCALES.map((sc) => scaleProgress(s, sc.id).stars)), 3) },
  { id: 'keys3', group: 'Skalen', icon: '🔑', title: 'Tonarten-Wechsler', text: 'Den Skalen-Block in 3 verschiedenen Tonarten gespielt.', progress: (s) => count(keysPlayed(s), 3) },
  { id: 'keys12', group: 'Skalen', icon: '🗝️', title: 'Alle zwölf', text: 'Den Skalen-Block in allen 12 Tonarten gespielt.', progress: (s) => count(keysPlayed(s), 12) },
  // Spielweise
  { id: 'checks5', group: 'Spielweise', icon: '✅', title: 'Ehrlich zu dir', text: '5 Einheiten mit allen drei Checks abgehakt.', progress: (s) => count(fullChecks(s), 5) },
  { id: 'control3', group: 'Spielweise', icon: '🧘', title: 'Kontrollfreak', text: '3 Kontrolltage durchgezogen.', progress: (s) => count(s.sessions.filter((x) => x.focus === 'control').length, 3) },
  { id: 'notes5', group: 'Spielweise', icon: '📝', title: 'Plan statt Zufall', text: '5-mal einen nächsten Fokus notiert.', progress: (s) => count(s.sessions.filter((x) => x.note).length, 5) },
  { id: 'chords5', group: 'Spielweise', icon: '🎶', title: 'Akkord-Wechsler', text: '5 Akkordfolgen gespielt.', progress: (s) => count(chordSessions(s), 5) },
  { id: 'chords30', group: 'Spielweise', icon: '🎸', title: 'Rhythmusgitarrist', text: '30 Akkordfolgen gespielt.', progress: (s) => count(chordSessions(s), 30) },
];

function maxWeekSessions(s: AppState) {
  const m = new Map<number, number>();
  for (const x of s.sessions) {
    const k = weekStart(new Date(x.date)).getTime();
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return Math.max(0, ...m.values());
}

function cleanAt(s: AppState, keys: string[]) {
  let best = 0;
  for (const k of keys) for (const h of s.tempo[k]?.history ?? []) if (h.r === 'clean') best = Math.max(best, h.bpm);
  return best;
}

export function evaluate(state: AppState) {
  return ACHIEVEMENTS.map((def) => {
    const [cur, goal] = def.progress(state);
    return { def, cur, goal, unlocked: cur >= goal, date: state.achievements[def.id] };
  });
}

/** Records newly reached achievements; returns the new state and what was just unlocked. */
export function withAchievements(state: AppState): { state: AppState; fresh: AchievementDef[] } {
  const fresh = evaluate(state).filter((a) => a.unlocked && !state.achievements[a.def.id]).map((a) => a.def);
  if (!fresh.length) return { state, fresh };
  const now = new Date().toISOString();
  const achievements = { ...state.achievements };
  fresh.forEach((d) => (achievements[d.id] = now));
  return { state: { ...state, achievements }, fresh };
}

/** The locked achievement that is closest to done – shown as a teaser. */
export function nextAchievement(state: AppState) {
  return evaluate(state)
    .filter((a) => !a.unlocked)
    .sort((a, b) => b.cur / b.goal - a.cur / a.goal)[0];
}

