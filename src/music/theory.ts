// Drop-C tuning and scale engine.
// String index 0 = lowest (thick) C string, 5 = high d string.

export const TUNING = [36, 43, 48, 53, 57, 62]; // C2 G2 C3 F3 A3 D4 (MIDI)
export const STRING_SHORT = ['C', 'G', 'C', 'F', 'A', 'd'];
export const STRING_LONG = ['tiefe C-Saite', 'G-Saite', 'mittlere C-Saite', 'F-Saite', 'A-Saite', 'hohe d-Saite'];
/** Dative forms: "auf der …". */
export const STRING_DAT = ['tiefen C-Saite', 'G-Saite', 'mittleren C-Saite', 'F-Saite', 'A-Saite', 'hohen d-Saite'];

const FLAT_NAMES = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'G♭', 'G', 'A♭', 'A', 'B♭', 'B'];
const SHARP_NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];

/** Default tonic: the booklet centres everything on C. */
export const ROOT_PC = 0;

export interface ScaleDef {
  id: string;
  /** Name in its key, e.g. "D-Dorisch". */
  name: string;
  /** Tonic as pitch class (0 = C). */
  root: number;
  /** Semitones above the tonic, ascending, starting with 0. */
  intervals: number[];
  /** Interval labels, parallel to `intervals`. */
  degrees: string[];
  /** Characteristic tones (semitones above the tonic), highlighted in teal. */
  color: number[];
  colorLabel: string;
  compare: string;
  feel: string;
  /** Listening task & mini motif. Motif notes are [string, fret]. */
  listen: string;
  motif: [number, number][];
  motifText: string;
  /** Comparison tone (semitones above the tonic) for the "Hören" step, and the scale it comes from. */
  ref?: { name: string; tone: number };
  /** Seven-note scale the chords are built from (pentatonics borrow their parent's). */
  harmony: number[];
}

/** Scale card as written in scales.ts: centred on C, texts with degree tokens like {b6}. */
export interface ScaleCard extends Omit<ScaleDef, 'root' | 'colorLabel' | 'motifText' | 'harmony'> {
  colorName: string;
  harmony?: number[];
}

const DEGREE: Record<string, number> = { '1': 0, b2: 1, '2': 2, b3: 3, '3': 4, '4': 5, '#4': 6, b5: 6, '5': 7, b6: 8, '6': 9, b7: 10, '7': 11 };

/** Replaces degree tokens ({1}, {b3}, {#4} …) with note names in the given key. */
export function fillDegrees(text: string, root: number) {
  return text.replace(/\{([b#]?\d)\}/g, (_, d: string) => {
    const pc = midiToPc(root + DEGREE[d]);
    return d.startsWith('#') ? SHARP_NAMES[pc] : FLAT_NAMES[pc];
  });
}

/** "B" is the German H – spelled out where a single note is named. */
const withH = (name: string) => (name === 'B' ? 'B (= H)' : name);

/** Moves the C motif into another key, staying on the same strings and inside frets 0–17. */
function transposeMotif(motif: [number, number][], root: number): [number, number][] {
  const r = midiToPc(root);
  const fits = (d: number) => motif.every(([, f]) => f + d >= 0 && f + d <= 17);
  const d = [r, r - 12].filter(fits).sort((a, b) => Math.abs(a) - Math.abs(b))[0] ?? 0;
  return motif.map(([s, f]) => [s, f + d]);
}

/** "G-Saite: 5–7–8 | mittlere C-Saite: 7–9" */
export function positionsText(ps: [number, number][]) {
  const parts: string[] = [];
  let cur = -1;
  for (const [s, f] of ps) {
    if (s !== cur) parts.push(`${STRING_LONG[s]}: ${f}`);
    else parts[parts.length - 1] += `–${f}`;
    cur = s;
  }
  const t = parts.join(' | ');
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/** A scale card in a given key: names, texts and motif follow the tonic. */
export function inKey(card: ScaleCard, root = ROOT_PC): ScaleDef {
  const r = midiToPc(root);
  const motif = transposeMotif(card.motif, r);
  const { colorName, ...rest } = card;
  return {
    ...rest,
    root: r,
    name: card.name.replace(/^C-/, `${noteName(r)}-`),
    colorLabel: `${card.color.map((c) => withH(noteName(r + c))).join(' + ')} · ${colorName}`,
    compare: fillDegrees(card.compare, r),
    listen: fillDegrees(card.listen, r),
    motif,
    motifText: positionsText(motif),
    harmony: card.harmony ?? card.intervals,
  };
}

export const NAT_MINOR = [0, 2, 3, 5, 7, 8, 10];

export function midiToPc(midi: number) {
  return ((midi % 12) + 12) % 12;
}

/** Note name with flats; "B" means German H. */
export function noteName(midiOrPc: number) {
  return FLAT_NAMES[midiToPc(midiOrPc)];
}

export function midiToFreq(midi: number) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

export function freqToMidi(freq: number) {
  return 69 + 12 * Math.log2(freq / 440);
}

export function fretMidi(string: number, fret: number) {
  return TUNING[string] + fret;
}

export function inScale(scale: { intervals: number[]; root?: number }, midi: number) {
  return scale.intervals.includes(midiToPc(midi - (scale.root ?? ROOT_PC)));
}

/** Semitones above the tonic (0–11) of a sounding note. */
export function degreeOf(scale: { root?: number }, midi: number) {
  return midiToPc(midi - (scale.root ?? ROOT_PC));
}

export interface Pos {
  s: number;
  f: number;
}

/** All scale positions in a fret window, for the fretboard map. */
export function fretboardNotes(scale: { intervals: number[]; root?: number }, from = 5, to = 12): Pos[] {
  const out: Pos[] = [];
  for (let s = 0; s < 6; s++) {
    for (let f = from; f <= to; f++) if (inScale(scale, fretMidi(s, f))) out.push({ s, f });
  }
  return out;
}

/** Ascending scale notes (MIDI) starting at `start`. */
export function scaleRun(scale: { intervals: number[]; root?: number }, start: number, count: number): number[] {
  const out: number[] = [];
  for (let m = start; out.length < count; m++) if (inScale(scale, m)) out.push(m);
  return out;
}

/**
 * Path over all six strings, the way the booklet builds it: start on the low
 * C string (on the fifth below the tonic when the scale contains it – G for C),
 * up to three notes per string, never wider than `maxSpan` frets on one string.
 */
export function sixStringPath(
  scale: { intervals: number[]; root?: number },
  startMidi?: number,
  maxSpan = 4,
): Pos[] {
  // Default: the fifth below the tonic on the low string (G2 for C), else the next lower scale note.
  if (startMidi === undefined) return placed(scale, midiToPc(7 + (scale.root ?? ROOT_PC)), maxSpan);
  const notes = scaleRun(scale, startMidi, 40);
  const path: Pos[] = [];
  let i = 0;
  for (let s = 0; s < 6; s++) {
    let count = 0;
    let first = -1;
    while (i < notes.length && count < 3) {
      const f = notes[i] - TUNING[s];
      if (f < 0) break;
      if (first < 0) first = f;
      if (f - first > maxSpan) break;
      // Leave the note for the next string when it fits there comfortably
      // and this string already has two notes (keeps 5/6-note scales compact).
      if (s < 5 && count >= 2 && scale.intervals.length < 7 && notes[i] - TUNING[s + 1] >= first - 1) break;
      path.push({ s, f });
      count++;
      i++;
    }
  }
  return path;
}

const shapeOf = (path: Pos[]) => path.map((p) => `${p.s}:${p.f - path[0].f}`).join(' ');
const playable = (path: Pos[]) => new Set(path.map((p) => p.s)).size === 6 && path.every((p) => p.f >= 0 && p.f <= 17);

/** Path from `fret` on the low string, or from the next lower scale note if that fret isn't in the scale. */
function pathFrom(scale: { intervals: number[]; root?: number }, fret: number, maxSpan: number) {
  let start = TUNING[0] + fret;
  while (!inScale(scale, start)) start--;
  return sixStringPath(scale, start, maxSpan);
}

/**
 * The path from `fret` (0–11) or an octave higher – whichever keeps the shape
 * the scale has away from the nut and stays inside frets 0–17. Near the nut a
 * shape would need frets below 0, so G scales, for example, move up to fret 14.
 */
function placed(scale: { intervals: number[]; root?: number }, fret: number, maxSpan: number): Pos[] {
  const ref = shapeOf(pathFrom({ intervals: scale.intervals, root: midiToPc((scale.root ?? ROOT_PC) - fret + 7) }, 7, maxSpan));
  const tries = [fret, fret + 12].map((f) => pathFrom(scale, f, maxSpan));
  return tries.find((p) => playable(p) && shapeOf(p) === ref) ?? tries.find(playable) ?? tries[0];
}

/** Second position: the same scale from the tonic on the low string – five or seven frets away from the first. */
export function secondPosition(scale: { intervals: number[]; root?: number }): Pos[] {
  const root = scale.root ?? ROOT_PC;
  const p = placed(scale, midiToPc(root), 4);
  if (playable(p)) return p;
  // Rare (blues in E♭): neither octave fits – start on the next scale note above the tonic instead.
  for (let f = midiToPc(root) + 1; f < 15; f++) {
    if (!inScale(scale, TUNING[0] + f)) continue;
    const q = sixStringPath(scale, TUNING[0] + f);
    if (playable(q)) return q;
  }
  return p;
}

/**
 * One octave tonic → tonic on a single string (horizontal path). Prefers the
 * G string (as the booklet does for C, frets 5–17); keys whose tonic sits
 * elsewhere move to the middle C or F string, so the octave ends by fret 17.
 */
export function oneStringOctave(scale: { intervals: number[]; root?: number }, string?: number): Pos[] {
  const root = scale.root ?? ROOT_PC;
  const first = (s: number) => midiToPc(root - TUNING[s]);
  const s = string ?? [1, 2, 3].find((x) => first(x) >= 1 && first(x) <= 5) ?? 1;
  const startFret = first(s);
  const base = string !== undefined && startFret < 3 ? startFret + 12 : startFret;
  const out: Pos[] = [];
  for (let f = base; f <= base + 12; f++) if (inScale(scale, fretMidi(s, f))) out.push({ s, f });
  return out;
}

/**
 * Three notes on a lower string, then three on a higher string — the shape of
 * the short run (adjacent strings) and the string-skip exercise.
 * The upper group starts on the first scale note above the lower group that
 * sits no lower than two frets below the starting fret (keeps the hand in place).
 */
export function twoStringGroup(
  scale: { intervals: number[]; root?: number },
  low: number,
  high: number,
  startFret: number,
): { low: Pos[]; high: Pos[] } {
  const startMidi = fretMidi(low, startFret);
  const lowNotes = scaleRun(scale, startMidi, 3);
  let m = lowNotes[2] + 1;
  while (!(inScale(scale, m) && m - TUNING[high] >= startFret - 2)) m++;
  const highNotes = scaleRun(scale, m, 3);
  return {
    low: lowNotes.map((n) => ({ s: low, f: n - TUNING[low] })),
    high: highNotes.map((n) => ({ s: high, f: n - TUNING[high] })),
  };
}

export function scaleNoteNames(scale: ScaleDef) {
  return scale.intervals.map((i) => noteName(scale.root + i));
}
