// Chords for the progression block: built from the day's scale (stacked
// thirds), voiced for the current tuning. Power chords sit on three adjacent
// low strings (in drop tunings one finger across all three); triads sit on the
// top three strings, which are tuned like G B e in every supported tuning, so
// the voicings are searched, not hand-written.

import { TOP, TUNING, fretMidi, midiToPc, noteName, type Pos, type ScaleDef } from './theory';

export type Quality = 'maj' | 'min' | 'dim' | 'aug';
export type Voicing = 'power' | 'power-mix' | 'triad';

export interface Chord {
  /** Scale degree, 0-based. */
  degree: number;
  /** Pitch class of the chord root. */
  root: number;
  quality: Quality;
  /** Root, third, fifth as pitch classes. */
  pcs: number[];
  /** "Am", "F", "B°" … */
  name: string;
  /** "i", "♭VI", "V" … relative to the major scale of the tonic. */
  roman: string;
}

/** One chord of a progression, ready to play: grip on the fretboard and the sounding notes. */
export interface ChordSlot {
  name: string;
  roman: string;
  /** Grip: one position per played string. */
  grip: Pos[];
  midis: number[];
  /** Chord tones as pitch classes (for highlighting on the fretboard). */
  pcs: number[];
}

const MAJOR = [0, 2, 4, 5, 7, 9, 11];
const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];

function quality(third: number, fifth: number): Quality {
  if (third === 4) return fifth === 8 ? 'aug' : 'maj';
  return fifth === 6 ? 'dim' : 'min';
}

const SUFFIX: Record<Quality, string> = { maj: '', min: 'm', dim: '°', aug: '+' };

/** Triad on a degree of the scale's harmony (stacked thirds). */
export function triad(scale: ScaleDef, degree: number): Chord {
  const h = scale.harmony;
  const at = (k: number) => h[k % 7] + (k >= 7 ? 12 : 0);
  const r = at(degree);
  const third = at(degree + 2) - r;
  const fifth = at(degree + 4) - r;
  const q = quality(third, fifth);
  const root = midiToPc(scale.root + r);
  const diff = r - MAJOR[degree];
  const acc = diff < 0 ? '♭' : diff > 0 ? '♯' : '';
  const numeral = q === 'min' || q === 'dim' ? ROMAN[degree].toLowerCase() : ROMAN[degree];
  return {
    degree,
    root,
    quality: q,
    pcs: [root, midiToPc(root + third), midiToPc(root + fifth)],
    name: noteName(root) + SUFFIX[q],
    roman: acc + numeral + (q === 'dim' ? '°' : q === 'aug' ? '+' : ''),
  };
}

// ---------------------------------------------------------------------------
// Progressions per scale (degrees, 0-based). Chosen so every chord is
// diatonic to the scale – what you improvise with fits what you strum.
// ---------------------------------------------------------------------------

export const PROGRESSIONS: Record<string, number[][]> = {
  aeolian: [[0, 5, 2, 6], [0, 6, 5, 6], [0, 3, 6, 2], [0, 5, 3, 4]],
  pentatonic: [[0, 3, 0, 4], [0, 6, 5, 6], [0, 5, 6, 0]],
  blues: [[0, 0, 0, 0, 3, 3, 0, 0, 4, 3, 0, 4], [0, 3, 4, 3]],
  ionian: [[0, 4, 5, 3], [0, 3, 4, 0], [1, 4, 0, 0], [0, 5, 3, 4]],
  majpenta: [[0, 3, 0, 4], [0, 4, 5, 3], [0, 5, 3, 4]],
  dorian: [[0, 3], [0, 6, 3, 0], [0, 2, 3, 0]],
  mixolydian: [[0, 6, 3, 0], [0, 4, 6, 3], [0, 6, 0, 3]],
  harmonic: [[0, 3, 4, 0], [0, 5, 4, 0], [0, 3, 5, 4]],
  phrygian: [[0, 1], [0, 1, 2, 1], [0, 6, 5, 1]],
  lydian: [[0, 1], [0, 1, 6, 0], [0, 4, 1, 0]],
  melodic: [[0, 3], [0, 3, 4, 0], [0, 1, 3, 4]],
  phrygdom: [[0, 1], [0, 1, 6, 0], [0, 3, 1, 0]],
  locrian: [[0, 1], [0, 1, 2, 1], [0, 5, 1, 0]],
};

export function progressionFor(scale: ScaleDef, day: number): Chord[] {
  const list = PROGRESSIONS[scale.id] ?? PROGRESSIONS.aeolian;
  return list[day % list.length].map((d) => triad(scale, d));
}

export const romanText = (chords: Chord[]) => chords.map((c) => c.roman).join(' – ');
export const namesText = (chords: Chord[]) => chords.map((c) => c.name).join(' – ');

// ---------------------------------------------------------------------------
// Voicings
// ---------------------------------------------------------------------------

/** Fifth above the chord root: perfect, or ♭5 / ♯5 for diminished / augmented chords. */
const fifthOf = (c: Chord) => (c.quality === 'dim' ? 6 : c.quality === 'aug' ? 8 : 7);

/**
 * Power chord with the root on string `s`: fifth on the next string, octave on
 * the one after. Frets follow from the tuning – in Drop C on the low strings
 * all three share a fret, in standard tuning fifth and octave sit two frets up.
 */
export function powerGrip(c: Chord | null, s: number, fret: number): Pos[] {
  const fifth = c ? fifthOf(c) : 7;
  return [
    { s, f: fret },
    { s: s + 1, f: fret + fifth - (TUNING[s + 1] - TUNING[s]) },
    { s: s + 2, f: fret + 12 - (TUNING[s + 2] - TUNING[s]) },
  ];
}

const valid = (g: Pos[]) => g.every((p) => p.f >= 0 && p.f <= 15);
/** Where the hand is: average of the fretted notes (open strings don't move the hand). */
const centre = (g: Pos[]) => {
  const fretted = g.filter((p) => p.f > 0);
  return fretted.length ? fretted.reduce((a, p) => a + p.f, 0) / fretted.length : 0;
};

/** All triad grips on the three top strings (F, A, d in Drop C) within a 4-fret span. */
function triadGrips(c: Chord): Pos[][] {
  const out: Pos[][] = [];
  const frets = (s: number) => Array.from({ length: 16 }, (_, f) => f).filter((f) => c.pcs.includes(midiToPc(fretMidi(s, f))));
  for (const a of frets(TOP - 2))
    for (const b of frets(TOP - 1))
      for (const d of frets(TOP)) {
        const g = [{ s: TOP - 2, f: a }, { s: TOP - 1, f: b }, { s: TOP, f: d }];
        const fretted = g.filter((p) => p.f > 0).map((p) => p.f);
        if (fretted.length && Math.max(...fretted) - Math.min(...fretted) > 3) continue;
        // Open strings only together with low frets – an open string next to fret 10 is no real grip.
        if (fretted.length < 3 && Math.max(0, ...fretted) > 4) continue;
        const pcs = new Set(g.map((p) => midiToPc(fretMidi(p.s, p.f))));
        if (pcs.size === 3) out.push(g);
      }
  return out;
}

/** Candidate grips of one voicing type for a chord. */
function candidates(c: Chord, v: Voicing): Pos[][] {
  if (v === 'triad') return triadGrips(c);
  const on = (s: number) => [midiToPc(c.root - TUNING[s]), midiToPc(c.root - TUNING[s]) + 12];
  const power = on(0).map((f) => powerGrip(c, 0, f));
  if (v === 'power') return power.filter(valid);
  return [...power, ...on(1).map((f) => powerGrip(c, 1, f)), ...on(2).map((f) => powerGrip(c, 2, f))].filter(valid);
}

/**
 * Grips for a progression with short hand movements: the first chord near
 * `around`, every following one as close as possible to the previous grip.
 */
export function voiceProgression(chords: Chord[], v: Voicing, around = 5): ChordSlot[] {
  let prev = around;
  return chords.map((c) => {
    const opts = candidates(c, v);
    // Prefer grips close to the previous one, not too high up the neck; for power chords
    // slightly prefer the root on the lowest string (the heavy sound).
    const cost = (g: Pos[]) => Math.abs(centre(g) - prev) + Math.max(0, centre(g) - 12) * 0.5 + (v !== 'triad' && g[0].s > 0 ? 1 : 0);
    const grip = [...opts].sort((a, b) => cost(a) - cost(b))[0];
    prev = centre(grip);
    return {
      name: v === 'triad' ? c.name : `${noteName(c.root)}5${c.quality === 'dim' ? '(♭5)' : c.quality === 'aug' ? '(♯5)' : ''}`,
      roman: c.roman,
      grip,
      midis: grip.map((p) => fretMidi(p.s, p.f)),
      pcs: c.pcs,
    };
  });
}
