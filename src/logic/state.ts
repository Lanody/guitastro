import type { BlockId, ModuleId } from '../data/types';
import { DEFAULT_TUNING } from '../music/theory';

export type Rating = 'clean' | 'ok' | 'rough';
export const RATING_LABEL: Record<Rating, string> = { clean: 'sauber', ok: 'ging so', rough: 'unsauber' };
export type DayFocus = 'standard' | 'control' | 'push';

export interface Settings {
  /** auto = booklet versions for the first 14 days, then variations. */
  variation: 'auto' | 'always' | 'never';
  tempoStep: number;
  /** Days per scale block before the next scale (with a new tonic) comes up. */
  scaleSessions: number;
  clickVolume: number;
  droneVolume: number;
  clickSub: boolean;
  /** Soft cue at 0:50 of each minute: 50 s work, 10 s relax. */
  restCue: boolean;
  /** Next exercise starts automatically after rating. */
  autoStart: boolean;
  /** Sessions per week for the weekly goal ring. */
  weeklyGoal: number;
  /** Tuning id (see TUNINGS); also fixes the number of strings. */
  tuning: string;
  /** Setup and tour done (shown once, also to existing users). */
  onboarded: boolean;
}

export interface TempoState {
  bpm: number;
  clean: number;
  rough: number;
  history: { d: string; bpm: number; r: Rating }[];
}

export interface ExerciseResult {
  key: string;
  title: string;
  module: ModuleId;
  block?: BlockId;
  bpm?: number;
  sub?: number;
  rating?: Rating;
  /** BPM change from this rating (+2 / −2). */
  change?: number;
  skipped?: boolean;
}

export interface SessionLog {
  id: string;
  date: string; // ISO
  modules: ModuleId[];
  /** Daily blocks (sessions since the 30-minute plan). */
  blocks?: BlockId[];
  scaleId?: string;
  /** Tonic of the scale block (pitch class). */
  root?: number;
  /** Chord progression of the day, e.g. "i – ♭VI – ♭III – ♭VII · Am – F – C – G". */
  progression?: string;
  focus: DayFocus;
  seconds: number;
  results: ExerciseResult[];
  checks: [boolean, boolean, boolean];
  note: string;
}

export interface HitLog {
  d: string;
  mode: 'mic' | 'self' | 'recall' | 'ear';
  hits: number;
  total: number;
  avgMs?: number;
  scaleId?: string;
}

export interface AppState {
  version: 1;
  settings: Settings;
  tempo: Record<string, TempoState>;
  sessions: SessionLog[];
  /** Current scale block: scale, tonic and how many days of it are done. */
  scale: { id: string; root?: number; sessions: number; pinned: boolean };
  hits: HitLog[];
  firstDay?: string;
  /** Bumped by "Neu würfeln" to reroll today's variations. */
  reroll: number;
  /** Next focus noted after the last session. */
  nextFocus?: string;
  /** Achievement id → ISO date it was unlocked. */
  achievements: Record<string, string>;
}

export const DEFAULT_SETTINGS: Settings = {
  variation: 'auto',
  tempoStep: 2,
  scaleSessions: 3,
  clickVolume: 0.7,
  droneVolume: 0.35,
  clickSub: false,
  restCue: true,
  autoStart: false,
  weeklyGoal: 4,
  tuning: DEFAULT_TUNING,
  onboarded: false,
};

export const initialState = (): AppState => ({
  version: 1,
  settings: { ...DEFAULT_SETTINGS },
  tempo: {},
  sessions: [],
  scale: { id: 'aeolian', root: 0, sessions: 0, pinned: false },
  hits: [],
  reroll: 0,
  achievements: {},
});

const KEY = 'drop-c-trainer:v1';

export function load(): AppState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return initialState();
    const s = JSON.parse(raw) as AppState;
    return { ...initialState(), ...s, settings: { ...DEFAULT_SETTINGS, ...s.settings } };
  } catch {
    return initialState();
  }
}

export function save(s: AppState) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* storage full or blocked – app keeps working for this session */
  }
}

export const todayKey = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export const DAY_MS = 86400000;

export function daysBetween(a: string, b: string) {
  return Math.round((Date.parse(b) - Date.parse(a)) / DAY_MS);
}
