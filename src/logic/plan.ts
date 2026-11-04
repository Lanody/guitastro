import { BLOCK_ORDER, BUILDERS, scaleBlock, type BuildCtx, type ScaleStage } from '../data/exercises';
import { riffBlock, type RiffWeek } from '../data/riffs';
import { rngFrom } from '../data/rng';
import type { BlockId, Exercise, ModuleId } from '../data/types';
import { namesText, progressionFor, romanText, type Chord } from '../music/chords';
import { ROOT_ROTATION, SCALE_ROTATION, getScale } from '../music/scales';
import { weekStart } from './progress';
import { daysBetween, todayKey, type AppState, type DayFocus, type Rating, type TempoState } from './state';

export const UNLOCK_DAYS = 14;
/** Every exercise starts at (at least) this tempo. */
export const START_BPM = 80;

export function variationUnlocked(state: AppState, today = todayKey()) {
  const v = state.settings.variation;
  if (v === 'always') return true;
  if (v === 'never') return false;
  return !!state.firstDay && daysBetween(state.firstDay, today) >= UNLOCK_DAYS;
}

/**
 * Rotating pools for the technique blocks: each day takes the next `perDay`
 * exercises, so the mix changes daily while every exercise still comes back
 * within five lessons – often enough for the tempo to grow.
 */
export const POOLS: Record<'speed' | 'accuracy' | 'rhythm', { keys: string[]; perDay: number }> = {
  speed: { keys: ['A1', 'A6', 'E5', 'B1', 'E1', 'A4', 'A3', 'B5', 'E8'], perDay: 2 },
  accuracy: { keys: ['A2', 'E4', 'E6', 'A5', 'E2', 'E7', 'B2', 'E3', 'B4'], perDay: 2 },
  rhythm: { keys: ['R1', 'D1', 'R2', 'D4', 'R3', 'D2', 'R4', 'D3'], perDay: 1 },
};

/** Exercises that run longer in the booklet: the phases used in the daily plan. */
const TRIM: Record<string, number[]> = { B5: [0, 1], D1: [0, 1, 2], D2: [1, 2, 3] };

export function poolKeys(block: keyof typeof POOLS, day: number) {
  const { keys, perDay } = POOLS[block];
  return Array.from({ length: perDay }, (_, i) => keys[(day * perDay + i) % keys.length]);
}

/** Lessons until a pool exercise comes back. */
export const poolCycle = (block: keyof typeof POOLS) => Math.ceil(POOLS[block].keys.length / POOLS[block].perDay);

/** Day within the scale block (0-based) and the block's length. */
export function scaleDay(state: AppState) {
  const total = Math.max(1, state.settings.scaleSessions);
  return { index: state.scale.sessions % total, total };
}

/** Which day of the scale block this is: first day learn, last day apply, between deepen. */
export function scaleStage(state: AppState): ScaleStage {
  const { index, total } = scaleDay(state);
  if (index === 0) return 'learn';
  return index === total - 1 ? 'apply' : 'deepen';
}

export const STAGE_INFO: Record<ScaleStage, string> = {
  learn: 'Kennenlernen: hören, finden, Lage 1',
  deepen: 'Vertiefen: Sequenzen und neue Lagen',
  apply: 'Festigen: abrufen, Lagen verbinden, benutzen',
};

const hasRiff = (s: AppState['sessions'][number]) => !!s.blocks?.includes('riff');

/**
 * Riff of the week: every calendar week (Monday to Sunday) with lessons brings
 * the next riff – weeks without practice don't skip one. The lessons already
 * saved this week decide the step (learn, put together, tempo, by heart).
 */
export function riffWeek(state: AppState, today = todayKey()): RiffWeek {
  const start = weekStart(new Date(today + 'T12:00:00')).getTime();
  const before = state.sessions.filter((s) => hasRiff(s) && Date.parse(s.date) < start);
  const weeks = new Set(before.map((s) => weekStart(new Date(s.date)).getTime()));
  const lesson = state.sessions.filter((s) => hasRiff(s) && Date.parse(s.date) >= start).length;
  return { index: weeks.size, lesson };
}

export function dayFocus(state: AppState, today = todayKey()): DayFocus {
  if (!variationUnlocked(state, today)) return 'standard';
  const n = state.sessions.length;
  if (n % 5 === 4) return 'control';
  if (n % 5 === 2) return 'push';
  return 'standard';
}

export const FOCUS_INFO: Record<DayFocus, { title: string; text: string }> = {
  standard: { title: 'Standard', text: 'Gespeichertes Tempo jeder Übung. Sauber vor schnell.' },
  control: {
    title: 'Kontrolltag',
    text: 'Alles 10 % langsamer. Maximale Sauberkeit, lockere Hände, stille Saiten. Zählt nicht für Tempo-Steigerungen.',
  },
  push: { title: 'Push-Tag', text: 'Nur die Burst-Übungen +6 BPM. Kurze Sprints, lange Pausen – kein Dauersprint.' },
};

export function bpmFor(state: AppState, ex: Exercise, focus: DayFocus) {
  const base = Math.max(START_BPM, state.tempo[ex.key]?.bpm ?? START_BPM);
  if (!ex.tracksTempo) return base;
  if (focus === 'control') return Math.max(40, Math.round(base * 0.9));
  if (focus === 'push' && ex.burst) return base + 6;
  return base;
}

export interface Plan {
  date: string;
  blocks: BlockId[];
  /** Source modules of the exercises (for the log). */
  modules: ModuleId[];
  scaleId: string;
  root: number;
  stage: ScaleStage;
  progression: Chord[];
  focus: DayFocus;
  vary: boolean;
  exercises: Exercise[];
}

/** The day's 30 minutes: six blocks, technique from the rotating pools, scale and chords in the block's key. */
export function buildPlan(state: AppState, today = todayKey()): Plan {
  const vary = variationUnlocked(state, today);
  const day = state.sessions.length;
  const scale = getScale(state.scale.id, state.scale.root ?? 0);
  const stage = scaleStage(state);
  const progression = progressionFor(scale, day);
  const seed = `${today}#${day}#${state.reroll}`;
  const blockDay = scaleDay(state);
  const riff = riffWeek(state, today);
  const ctxFor = (k: string): BuildCtx => ({ rng: rngFrom(`${seed}:${k}`), vary, scale, stage, blockDay, progression, riff });
  const trim = (e: Exercise) => (TRIM[e.key] ? { ...e, phases: TRIM[e.key].map((i) => e.phases[i]) } : e);
  const exercises: Exercise[] = [];
  for (const block of BLOCK_ORDER) {
    const list =
      block === 'scale'
        ? scaleBlock(ctxFor('scale'))
        : block === 'riff'
          ? [riffBlock(ctxFor('riff'))]
          : block === 'chords'
            ? [BUILDERS.K1(ctxFor('K1'))]
            : block === 'improv'
              ? [BUILDERS.I1(ctxFor('I1'))]
              : poolKeys(block, day).map((k) => trim(BUILDERS[k](ctxFor(k))));
    exercises.push(...list.map((e) => ({ ...e, block })));
  }
  return {
    date: today,
    blocks: BLOCK_ORDER,
    modules: [...new Set(exercises.map((e) => e.module))],
    scaleId: scale.id,
    root: scale.root,
    stage,
    progression,
    focus: dayFocus(state, today),
    vary,
    exercises,
  };
}

export const progressionText = (p: Chord[]) => `${romanText(p)} · ${namesText(p)}`;

/**
 * Booklet rule: after two clean, relaxed sessions raise that exercise by 2 BPM.
 * Two rough sessions in a row bring it down again (not below START_BPM). Control days only record.
 */
export function applyRating(
  t: TempoState | undefined,
  played: number,
  rating: Rating,
  focus: DayFocus,
  step: number,
  date = todayKey(),
): { next: TempoState; change: number } {
  const cur: TempoState = t ?? { bpm: played, clean: 0, rough: 0, history: [] };
  const history = [...cur.history, { d: date, bpm: played, r: rating }].slice(-60);
  if (focus === 'control') return { next: { ...cur, history }, change: 0 };
  // Push days play above the stored tempo on purpose; don't store the boost.
  const base = focus === 'push' && played > cur.bpm ? cur.bpm : played;
  let { clean, rough } = cur;
  let bpm = base;
  let change = 0;
  if (rating === 'clean') {
    clean++;
    rough = 0;
    if (clean >= 2) {
      bpm = base + step;
      change = step;
      clean = 0;
    }
  } else if (rating === 'rough') {
    clean = 0;
    rough++;
    if (rough >= 2) {
      bpm = Math.max(START_BPM, base - step);
      change = -step;
      rough = 0;
    }
  }
  return { next: { bpm, clean, rough, history }, change };
}

/** After a day with the scale block: count it; when the block is done, the next scale comes with a new tonic. */
export function advanceScale(state: AppState): AppState['scale'] {
  const s = state.scale;
  const sessions = s.sessions + 1;
  if (s.pinned || sessions < state.settings.scaleSessions) return { ...s, sessions };
  const i = SCALE_ROTATION.indexOf(s.id);
  const r = ROOT_ROTATION.indexOf(s.root ?? 0);
  return { id: SCALE_ROTATION[(i + 1) % SCALE_ROTATION.length], root: ROOT_ROTATION[(r + 1) % ROOT_ROTATION.length], sessions: 0, pinned: false };
}

export function streak(state: AppState, today = todayKey()) {
  const days = new Set(state.sessions.map((s) => todayKey(new Date(s.date))));
  let n = 0;
  const d = new Date(today + 'T12:00:00');
  if (!days.has(today)) d.setDate(d.getDate() - 1); // today not yet played: streak still alive
  while (days.has(todayKey(d))) {
    n++;
    d.setDate(d.getDate() - 1);
  }
  return n;
}
