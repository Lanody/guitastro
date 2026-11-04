import type { ChordSlot } from '../music/chords';
import type { Pos } from '../music/theory';

/** h = hammer-on onto this note, p = pull-off onto it, ~ = vibrato. */
export type Tech = 'h' | 'p' | '~';
/** Pick direction, shown above the tab where it matters (sweep picking). */
export type Stroke = 'down' | 'up';
export interface Note {
  s: number;
  f: number;
  t?: Tech;
  stroke?: Stroke;
  /** Further notes struck together with this one (power chords in riffs). */
  chord?: Pos[];
  /** Palm-muted. */
  pm?: boolean;
}
/** One grid step: a note, a rest, or the previous note ringing on. */
export type Step = Note | 'rest' | 'hold';

/**
 * Where an exercise comes from: A/B/C = booklet modules (C = scales), D = polyrhythm,
 * E = extra technique, R = rhythm, W = riff of the week, K = chords (Akkorde), I = improvisation.
 */
export type ModuleId = 'A' | 'B' | 'C' | 'D' | 'E' | 'R' | 'W' | 'K' | 'I';
export type Focus = 'speed' | 'accuracy' | 'creativity' | 'scales' | 'rhythm' | 'chords';

/** The six parts of the daily 30 minutes. */
export type BlockId = 'speed' | 'accuracy' | 'rhythm' | 'riff' | 'scale' | 'chords' | 'improv';

/** A chord progression shown (and optionally played along) during a phase. */
export interface PhaseChords {
  slots: ChordSlot[];
  /** Beats each chord lasts. */
  beatsPer: number;
  /** Grips covered (play from memory); can be revealed. */
  hide?: boolean;
  /** Mark the current chord's tones on the fretboard map. */
  highlight?: boolean;
}

export interface Phase {
  label: string;
  seconds: number;
  /** Grid steps per beat: 2 = eighths, 4 = sixteenths. */
  sub: number;
  /** Slower note value the player may fall back to in this phase (switch shown only then). */
  alt?: number;
  /** Beats per bar (time signature x/4); default 4 = 4/4. */
  beats?: number;
  text: string;
  pattern?: Step[];
  /** Pattern is note groups of n steps, one per bar; the tab fills each bar with rest beats (one narrow column per beat). */
  groups?: number;
  /** Phase lets the player choose a string; pattern depends on it. */
  pick?: { label: string; options: { value: number; label: string }[]; build: (v: number) => Step[] };
  /** Interactive tool shown in this phase instead of / next to the tab. */
  widget?: Widget;
  /** Hide the fretboard map (recall tasks). */
  hideMap?: boolean;
  metronome?: boolean;
  /** The metronome also plays the pattern's rhythm as a second voice (listen along). */
  layer?: boolean;
  chords?: PhaseChords;
  /** Backing chords sound by default in this phase. */
  backing?: boolean;
  /** The app plays the pattern along (riffs); can be switched on and off. */
  demo?: boolean;
  /** Tab covered (play from memory); can be revealed. */
  hideTab?: boolean;
}

export type Widget = 'listen' | 'find' | 'recall' | 'notes';

export interface MapDot extends Pos {
  /** dim = scale note outside the position shown. */
  kind: 'root' | 'color' | 'note' | 'target' | 'dim';
}

export interface FretMap {
  from: number;
  to: number;
  dots: MapDot[];
  caption?: string;
}

export interface Exercise {
  key: string;
  module: ModuleId;
  /** Daily block this exercise is played in (set by the plan). */
  block?: BlockId;
  num: number;
  title: string;
  focus: Focus;
  intro: string;
  variant?: string;
  pattern?: Step[];
  /** Finger numbers shown under notes, parallel to pattern notes (optional). */
  fingers?: string;
  phases: Phase[];
  tracksTempo: boolean;
  /** Speed exercises get the "push" day bonus. */
  burst?: boolean;
  drone?: boolean;
  map?: FretMap;
  prompts?: string[];
  scaleId?: string;
  /** Tonic of `scaleId` when it differs from the day's key (e.g. transposing). */
  root?: number;
}

export const seconds = (e: Exercise) => e.phases.reduce((a, p) => a + p.seconds, 0);
export const totalSeconds = (exs: Exercise[]) => exs.reduce((a, e) => a + seconds(e), 0);
