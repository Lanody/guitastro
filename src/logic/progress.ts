// Progress, XP/levels and achievements — all derived from the saved logs,
// so nothing can drift out of sync. Only unlock dates are stored.

import { SCALES, SCALE_ROTATION } from '../music/scales';
import { DAY_MS, todayKey, type AppState, type HitLog, type SessionLog, type TempoState } from './state';

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
  'Tiefton-Virtuose',
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

/** Days with a session, ascending, as noon timestamps (so DST shifts round away). */
function practiceDays(state: AppState) {
  return [...new Set(state.sessions.map((s) => todayKey(new Date(s.date))))].sort().map((d) => Date.parse(d + 'T12:00:00'));
}

/** Longest run of sorted timestamps that are exactly `step` apart (rounded, for DST). */
function longestRun(times: number[], step: number) {
  let best = 0;
  let cur = 0;
  times.forEach((t, i) => {
    cur = i > 0 && Math.round((t - times[i - 1]) / step) === 1 ? cur + 1 : 1;
    best = Math.max(best, cur);
  });
  return best;
}

/** Best streak ever (consecutive days with a session). */
export const bestStreak = (state: AppState) => longestRun(practiceDays(state), DAY_MS);

/** Minutes practised per calendar day. */
export function minutesByDay(state: AppState) {
  const m = new Map<string, number>();
  for (const s of state.sessions) {
    const k = todayKey(new Date(s.date));
    m.set(k, (m.get(k) ?? 0) + s.seconds / 60);
  }
  return m;
}

/** BPM an exercise gained since its first rating. */
export const tempoGain = (t: TempoState) => t.bpm - (t.history[0]?.bpm ?? t.bpm);

/** Sum of BPM gained over all tracked exercises since their first rating. */
export function bpmGain(state: AppState) {
  return Object.values(state.tempo).reduce((a, t) => a + Math.max(0, tempoGain(t)), 0);
}

export function maxBpmGain(state: AppState) {
  return Object.values(state.tempo).reduce((a, t) => Math.max(a, tempoGain(t)), 0);
}

export function hitTotals(logs: HitLog[], modes: HitLog['mode'][]) {
  const hs = logs.filter((h) => modes.includes(h.mode));
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
  return new Set(state.sessions.filter((s) => s.blocks && playedBlock(s, 'scale')).map((s) => s.root ?? 0)).size;
}

const playedBlock = (x: SessionLog, block: string) => x.results.some((r) => r.block === block && !r.skipped);
const chordSessions = (s: AppState) => s.sessions.filter((x) => playedBlock(x, 'chords')).length;
const fullPlan = (x: SessionLog) => !!x.blocks?.every((b) => playedBlock(x, b));

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
export const totalMinutes = (sessions: SessionLog[]) => Math.round(sessions.reduce((a, x) => a + x.seconds, 0) / 60);
const hourOf = (x: SessionLog) => new Date(x.date).getHours();
const goodRound = (s: AppState, modes: HitLog['mode'][], minTotal: number, rate: number) =>
  s.hits.some((h) => modes.includes(h.mode) && h.total >= minTotal && h.hits / h.total >= rate);
/** Scales played in the scale block (Modul C). */
const playedScales = (s: AppState) => new Set(s.sessions.filter((x) => x.modules.includes('C') && x.scaleId).map((x) => x.scaleId!));
const countPlayed = (s: AppState, ids: string[]) => ids.filter((id) => playedScales(s).has(id)).length;
const scalesRecalled = (s: AppState) => new Set(s.hits.filter((h) => h.mode === 'recall' && h.hits === h.total).map((h) => h.scaleId)).size;

export const ACHIEVEMENTS: AchievementDef[] = [
  // Dranbleiben
  { id: 'first', group: 'Dranbleiben', icon: '🎸', title: 'Erster Ton', text: 'Die erste Einheit gespeichert.', progress: (s) => count(s.sessions.length, 1) },
  { id: 'streak3', group: 'Dranbleiben', icon: '🔥', title: 'Warmgespielt', text: '3 Tage in Folge geübt.', progress: (s) => count(bestStreak(s), 3) },
  { id: 'streak7', group: 'Dranbleiben', icon: '🔥', title: 'Eine Woche am Stück', text: '7 Tage in Folge geübt.', progress: (s) => count(bestStreak(s), 7) },
  { id: 'streak14', group: 'Dranbleiben', icon: '🔥', title: 'Zwei Wochen Disziplin', text: '14 Tage in Folge – lange genug, dass Bewegungen sitzen.', progress: (s) => count(bestStreak(s), 14) },
  { id: 'streak21', group: 'Dranbleiben', icon: '🔥', title: 'Gewohnheit', text: '21 Tage in Folge – aus Üben wird Routine.', progress: (s) => count(bestStreak(s), 21) },
  { id: 'streak30', group: 'Dranbleiben', icon: '🏆', title: 'Monats-Monster', text: '30 Tage in Folge geübt.', progress: (s) => count(bestStreak(s), 30) },
  { id: 'streak50', group: 'Dranbleiben', icon: '🏆', title: 'Fünfzig am Stück', text: '50 Tage in Folge geübt.', progress: (s) => count(bestStreak(s), 50) },
  { id: 'streak100', group: 'Dranbleiben', icon: '👑', title: 'Hundert Tage', text: '100 Tage in Folge geübt.', progress: (s) => count(bestStreak(s), 100) },
  { id: 'streak365', group: 'Dranbleiben', icon: '👑', title: 'Ein ganzes Jahr', text: '365 Tage in Folge geübt.', progress: (s) => count(bestStreak(s), 365) },
  { id: 'weeks4', group: 'Dranbleiben', icon: '📆', title: 'Vier Wochen im Plan', text: 'Das Wochenziel 4 Wochen in Folge erreicht.', progress: (s) => count(bestWeekStreak(s), 4) },
  { id: 'weeks12', group: 'Dranbleiben', icon: '📆', title: 'Ein Quartal im Plan', text: 'Das Wochenziel 12 Wochen in Folge erreicht.', progress: (s) => count(bestWeekStreak(s), 12) },
  { id: 'comeback', group: 'Dranbleiben', icon: '🔁', title: 'Wieder da', text: 'Nach mindestens einer Woche Pause wieder eingestiegen.', progress: (s) => flag(longestBreak(s) >= 8) },
  { id: 'sessions10', group: 'Dranbleiben', icon: '📅', title: 'Zweistellig', text: '10 Einheiten gespeichert.', progress: (s) => count(s.sessions.length, 10) },
  { id: 'sessions50', group: 'Dranbleiben', icon: '📅', title: 'Routine', text: '50 Einheiten gespeichert.', progress: (s) => count(s.sessions.length, 50) },
  { id: 'sessions100', group: 'Dranbleiben', icon: '💯', title: 'Hundert', text: '100 Einheiten gespeichert.', progress: (s) => count(s.sessions.length, 100) },
  { id: 'hours5', group: 'Dranbleiben', icon: '⏱️', title: 'Fünf Stunden', text: '300 Minuten insgesamt geübt.', progress: (s) => count(totalMinutes(s.sessions), 300) },
  { id: 'hours20', group: 'Dranbleiben', icon: '⏱️', title: 'Zwanzig Stunden', text: '1.200 Minuten insgesamt geübt.', progress: (s) => count(totalMinutes(s.sessions), 1200) },
  { id: 'weekgoal', group: 'Dranbleiben', icon: '🎯', title: 'Wochenziel', text: 'Das Wochenziel einmal erreicht.', progress: (s) => count(maxWeekSessions(s), s.settings.weeklyGoal) },
  {
    id: 'full45',
    group: 'Dranbleiben',
    icon: '💪',
    title: 'Volles Programm',
    text: 'Alle Blöcke einer Einheit gespielt, nichts übersprungen.',
    progress: (s) => flag(s.sessions.some((x) => fullPlan(x) || (['A', 'B', 'C'] as const).every((m) => x.modules.includes(m)))),
  },
  { id: 'early', group: 'Dranbleiben', icon: '🌅', title: 'Frühschicht', text: 'Eine Einheit vor 9 Uhr.', progress: (s) => flag(s.sessions.some((x) => hourOf(x) < 9)) },
  { id: 'late', group: 'Dranbleiben', icon: '🌙', title: 'Nachtschicht', text: 'Eine Einheit nach 22 Uhr.', progress: (s) => flag(s.sessions.some((x) => hourOf(x) >= 22)) },
  // Tempo
  { id: 'bpmup', group: 'Tempo', icon: '⬆️', title: 'Erste Steigerung', text: 'Zum ersten Mal +BPM verdient.', progress: (s) => count(maxBpmGain(s), 1) },
  { id: 'bpm10', group: 'Tempo', icon: '🚀', title: '+10 BPM', text: 'Eine Übung 10 BPM schneller als am Anfang.', progress: (s) => count(maxBpmGain(s), 10) },
  { id: 'bpm20', group: 'Tempo', icon: '🚀', title: '+20 BPM', text: 'Eine Übung 20 BPM schneller als am Anfang.', progress: (s) => count(maxBpmGain(s), 20) },
  { id: 'bpm30', group: 'Tempo', icon: '🚀', title: '+30 BPM', text: 'Eine Übung 30 BPM schneller als am Anfang.', progress: (s) => count(maxBpmGain(s), 30) },
  { id: 'bpmsum50', group: 'Tempo', icon: '⚡', title: 'Auf breiter Front', text: 'Zusammen +50 BPM über alle Übungen.', progress: (s) => count(bpmGain(s), 50) },
  { id: 'bpmsum150', group: 'Tempo', icon: '⚡', title: 'Tempo-Lawine', text: 'Zusammen +150 BPM über alle Übungen.', progress: (s) => count(bpmGain(s), 150) },
  { id: 'faster10', group: 'Tempo', icon: '📈', title: 'Überall schneller', text: '10 verschiedene Übungen über ihr Starttempo gebracht.', progress: (s) => count(fasterExercises(s), 10) },
  { id: 'burst90', group: 'Tempo', icon: '⚡', title: 'Burst 90', text: 'Speed-Bursts sauber bei 90 BPM.', progress: (s) => count(cleanAt(s, BURSTS), 90) },
  { id: 'burst100', group: 'Tempo', icon: '⚡', title: 'Burst 100', text: 'Speed-Bursts sauber bei 100 BPM.', progress: (s) => count(cleanAt(s, BURSTS), 100) },
  { id: 'burst120', group: 'Tempo', icon: '🌪️', title: 'Burst 120', text: 'Speed-Bursts sauber bei 120 BPM.', progress: (s) => count(cleanAt(s, BURSTS), 120) },
  { id: 'clean5', group: 'Tempo', icon: '✨', title: 'Blitzsauber', text: '5 Tempo-Übungen in einer Einheit als „sauber“ bewertet.', progress: (s) => count(Math.max(0, ...s.sessions.map((x) => x.results.filter((r) => r.rating === 'clean').length)), 5) },
  { id: 'cleanrun5', group: 'Tempo', icon: '🧊', title: 'Saubere Serie', text: 'Eine Übung 5-mal in Folge als „sauber“ bewertet.', progress: (s) => count(cleanRun(s), 5) },
  { id: 'cleanrun10', group: 'Tempo', icon: '🧊', title: 'Unaufhaltsam', text: 'Eine Übung 10-mal in Folge als „sauber“ bewertet.', progress: (s) => count(cleanRun(s), 10) },
  { id: 'push3', group: 'Tempo', icon: '🏎️', title: 'Gas geben', text: '3 Push-Tage durchgezogen.', progress: (s) => count(s.sessions.filter((x) => x.focus === 'push').length, 3) },
  { id: 'quick2', group: 'Tempo', icon: '⏩', title: 'Schnell gefunden', text: 'Eine Treffer-Runde (ab 8 Zielen, mindestens 80 %) mit Ø unter 2 Sekunden.', progress: (s) => flag(fastRound(s, 2000)) },
  { id: 'quick1', group: 'Tempo', icon: '⚡', title: 'Blitzgriff', text: 'Eine Treffer-Runde (ab 8 Zielen, mindestens 80 %) mit Ø unter 1,2 Sekunden.', progress: (s) => flag(fastRound(s, 1200)) },
  // Treffsicherheit
  { id: 'hit90', group: 'Treffsicherheit', icon: '🎯', title: 'Scharfschütze', text: 'Eine Treffer-Runde (ab 8 Zielen) mit mindestens 90 %.', progress: (s) => flag(goodRound(s, ['mic', 'self'], 8, 0.9)) },
  { id: 'mic100', group: 'Treffsicherheit', icon: '🎙️', title: 'Das Mikro lügt nicht', text: 'Eine Mikrofon-Runde (ab 8 Zielen) fehlerfrei.', progress: (s) => flag(goodRound(s, ['mic'], 8, 1)) },
  { id: 'hits250', group: 'Treffsicherheit', icon: '🧭', title: 'Griffbrett-Kenner', text: '250 Töne auf Anhieb gefunden.', progress: (s) => count(hitTotals(s.hits, ['mic', 'self']).hits, 250) },
  { id: 'ear10', group: 'Treffsicherheit', icon: '👂', title: 'Gutes Gehör', text: '10 Skalen im Hör-Quiz richtig erkannt.', progress: (s) => count(hitTotals(s.hits, ['ear']).hits, 10) },
  // Skalen
  { id: 'scale1', group: 'Skalen', icon: '🎼', title: 'Neue Farbe', text: 'Den Skalen-Block mit einer Skala gespielt.', progress: (s) => count(playedScales(s).size, 1) },
  { id: 'scales3', group: 'Skalen', icon: '🎨', title: 'Drei Farben', text: 'Dorisch, Phrygisch und Harmonisch Moll gespielt.', progress: (s) => count(countPlayed(s, ['dorian', 'phrygian', 'harmonic']), 3) },
  { id: 'scalesAll', group: 'Skalen', icon: '🌈', title: 'Ganze Palette', text: `Alle ${SCALE_ROTATION.length} Skalen der Rotation gespielt.`, progress: (s) => count(countPlayed(s, SCALE_ROTATION), SCALE_ROTATION.length) },
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

/** Sessions per week, keyed by the week's Monday timestamp. */
function weekCounts(s: AppState) {
  const m = new Map<number, number>();
  for (const x of s.sessions) {
    const k = weekStart(new Date(x.date)).getTime();
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return m;
}

const maxWeekSessions = (s: AppState) => Math.max(0, ...weekCounts(s).values());

/** Most consecutive weeks (Monday-based) in which the weekly goal was met. */
function bestWeekStreak(s: AppState) {
  const weeks = [...weekCounts(s)].filter(([, n]) => n >= s.settings.weeklyGoal).map(([k]) => k).sort((a, b) => a - b);
  return longestRun(weeks, 7 * DAY_MS);
}

/** Largest gap in days between two practice days (8 = a full week without practice). */
function longestBreak(s: AppState) {
  const days = practiceDays(s);
  return Math.max(0, ...days.slice(1).map((d, i) => Math.round((d - days[i]) / DAY_MS)));
}

const BURSTS = ['A6', 'B5'];

function cleanAt(s: AppState, keys: string[]) {
  let best = 0;
  for (const k of keys) for (const h of s.tempo[k]?.history ?? []) if (h.r === 'clean') best = Math.max(best, h.bpm);
  return best;
}

/** Exercises whose stored tempo is above their first rated tempo. */
const fasterExercises = (s: AppState) => Object.values(s.tempo).filter((t) => tempoGain(t) > 0).length;

/** Longest run of consecutive "clean" ratings on a single exercise. */
function cleanRun(s: AppState) {
  let best = 0;
  for (const t of Object.values(s.tempo)) {
    let cur = 0;
    for (const h of t.history) {
      cur = h.r === 'clean' ? cur + 1 : 0;
      best = Math.max(best, cur);
    }
  }
  return best;
}

/** A hit round (≥ 8 targets, ≥ 80 % hits) whose average time to a hit is below `ms`. */
const fastRound = (s: AppState, ms: number) =>
  s.hits.some((h) => (h.mode === 'mic' || h.mode === 'self') && h.total >= 8 && h.hits / h.total >= 0.8 && (h.avgMs ?? Infinity) < ms);

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

