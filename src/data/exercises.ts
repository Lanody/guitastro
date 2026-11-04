// Exercises from the Drop-C booklet (Modul A, B, C), turned into playable
// patterns, plus the parts the daily plan adds: extra technique (E), rhythm (R),
// chord progressions (K) and improvisation (I). Each booklet builder returns the
// booklet version unless variation is active; then it may pick a variant
// (other fingering, position, strings…).
//
// Other tunings: booklet strings are counted from the top (bs()), booklet frets
// stay the same, so the booklet key C becomes HOME (D in Drop D, C♯ in Drop C♯ …).
// Anything tied to the lowest strings (octaves, power chords, open-string
// rhythms) is computed from the tuning.

import { powerGrip, triad, voiceProgression, namesText, romanText, type Chord, type ChordSlot, type Voicing } from '../music/chords';
import { padBar } from '../music/meter';
import { getScale } from '../music/scales';
import {
  CURRENT,
  HOME,
  STRINGS,
  STRING_DAT,
  STRING_LONG,
  STRING_SHORT,
  TOP,
  TUNING,
  allStrings,
  bs,
  degreeOf,
  isDrop,
  fretboardNotes,
  fretMidi,
  midiToPc,
  noteName,
  fretRange,
  oneStringOctave,
  scalePositions,
  scaleRun,
  sixStringPath,
  stringsWord,
  twoStringGroup,
  type Pos,
  type ScaleDef,
} from '../music/theory';
import type { RiffWeek } from './riffs';
import { pick, shuffle, type Rng } from './rng';
import type { BlockId, Exercise, FretMap, MapDot, Note, Phase, Step, Stroke } from './types';

/** Day 1 of a scale block: learn it · middle days: deepen · last day: recall, transpose, use. */
export type ScaleStage = 'learn' | 'deepen' | 'apply';

export interface BuildCtx {
  rng: Rng;
  /** Variation unlocked (after the first two weeks, or by setting). */
  vary: boolean;
  /** The day's scale in the day's key. */
  scale: ScaleDef;
  stage?: ScaleStage;
  /** Day within the scale block (0-based) and the block's length in days. */
  blockDay?: { index: number; total: number };
  /** The day's chord progression (in the scale's key). */
  progression?: Chord[];
  /** Riff of the week and the lesson within the week. */
  riff?: RiffWeek;
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

const n = (s: number, f: number, t?: Note['t']): Note => (t ? { s, f, t } : { s, f });
/** A picked note with its pick direction. */
const picked = (s: number, f: number, stroke: Stroke): Note => ({ s, f, stroke });
const rests = (k: number): Step[] => Array.from({ length: k }, () => 'rest' as const);
const holds = (k: number): Step[] => Array.from({ length: k }, () => 'hold' as const);

/** Fret for finger digit with one finger per fret from `base`. */
const permFrets = (perm: string, base: number) => perm.split('').map((d) => base + Number(d) - 1);

/** Sensible fingering for a 2–3 note group on one string. */
export function fingering(frets: number[]): string {
  const min = Math.min(...frets);
  const span = Math.max(...frets) - min;
  if (span <= 3) return frets.map((f) => f - min + 1).join('–');
  return frets.map((f, i) => (i === 0 ? 1 : i === frets.length - 1 ? 4 : f - min <= 2 ? 2 : 3)).join('–');
}

const dash = (perm: string) => perm.split('').join('–');

/** Natural minor in the booklet key (C in Drop C). */
const homeMinor = () => getScale('aeolian', HOME);
/** Name of the booklet key on this guitar ("C" in Drop C). */
const homeName = () => noteName(HOME);
/** "6" for the lowest string of a six-string, "7" on a seven-string. */
const stringNo = (s: number) => STRINGS - s;
const fretsTxt = (ps: Pos[]) => ps.map((p) => p.f).join('–');

/** Booklet version first; with variation on, ~35% booklet, else a random variant. */
function choose<T>(ctx: BuildCtx, variants: T[]): { v: T; orig: boolean } {
  if (!ctx.vary || variants.length === 1 || ctx.rng() < 0.35) return { v: variants[0], orig: true };
  return { v: pick(ctx.rng, variants.slice(1)), orig: false };
}

function scaleMap(scale: ScaleDef, from = 5, to = 12, caption?: string): FretMap {
  const dots: MapDot[] = fretboardNotes(scale, from, to).map((p) => {
    const deg = degreeOf(scale, fretMidi(p.s, p.f));
    return { ...p, kind: deg === 0 ? 'root' : scale.color.includes(deg) ? 'color' : 'note' };
  });
  return { from, to, dots, caption };
}

/** Scale map over the fret window of some positions (at least 8 frets wide). */
function mapAround(scale: ScaleDef, ps: Pos[], caption?: string): FretMap {
  const lo = Math.max(0, Math.min(...ps.map((p) => p.f)) - 1);
  const hi = Math.max(lo + 7, Math.max(...ps.map((p) => p.f)) + 1);
  return scaleMap(scale, lo, Math.min(17, hi), caption ?? `Gold = ${noteName(scale.root)} (Grundton) · Türkis = ${scale.colorLabel}`);
}

function pathUpDown(path: Pos[], tech?: 'legato'): { up: Step[]; down: Step[] } {
  const up = path.map((p, i) => {
    const prev = path[i - 1];
    return n(p.s, p.f, tech && prev && prev.s === p.s ? 'h' : undefined);
  });
  const rev = [...path].reverse();
  const down = rev.map((p, i) => {
    const prev = rev[i - 1];
    return n(p.s, p.f, tech && prev && prev.s === p.s ? 'p' : undefined);
  });
  return { up, down };
}

export const CREATIVE_PROMPTS = [
  'Nur drei Töne – aber fünf verschiedene Rhythmen.',
  'Frage & Antwort: Phrase 1 endet offen (nicht auf dem Grundton), Phrase 2 landet auf dem Grundton.',
  'Beginne jede Phrase auf „und“ statt auf der Eins.',
  'Wiederhole ein Motiv dreimal und ändere nur den letzten Ton.',
  'Mehr Luft als Töne: nach jeder Phrase einen ganzen Takt Pause.',
  'Jede Phrase endet auf einem gehaltenen Ton mit leichtem Vibrato.',
  'Rhythmus „kurz – kurz – lang“ – Töne variieren, Rhythmus bleibt.',
  'Starte hoch und lande tief – dann genau umgekehrt.',
  'Erst als Achtel, dann dieselbe Idee als Triolen.',
  'Ein Ton darf zweimal hintereinander kommen – Repetition ist ein Stilmittel.',
  'Einen Slide in jede Phrase einbauen.',
  'Leise anfangen, dieselbe Phrase laut wiederholen – Dynamik ist Ausdruck.',
  'Sing die Phrase zuerst innerlich, dann spiel sie.',
  'Maximal vier Töne pro Phrase, aber jede Phrase klar mit Anfang und Ende.',
  'Eine gute Idee behalten und nur den Rhythmus ändern – keine neuen Töne suchen.',
];

export const RHYTHM_IDEAS = [
  '„kurz – kurz – lang“',
  '„lang – kurz – kurz“',
  'punktiert: „lang – kurz“, „lang – kurz“',
  'Auftakt: auf „und“ von 4 beginnen',
  'Triolen: drei Töne pro Klick',
  'Synkope: einen Ton über den nächsten Schlag hinweg halten',
];

const prompts = (ctx: BuildCtx, k: number) => shuffle(ctx.rng, CREATIVE_PROMPTS).slice(0, k);

// ---------------------------------------------------------------------------
// MODUL A · Zwei hohe Saiten
// ---------------------------------------------------------------------------

function pairName(lo: number, hi: number) {
  return `${STRING_SHORT[lo]}/${STRING_SHORT[hi]}`;
}

function a1(ctx: BuildCtx): Exercise {
  const { v, orig } = choose(ctx, [
    { perm: '1234', base: 5, lo: 4, hi: 5 },
    { perm: '1243', base: 5, lo: 4, hi: 5 },
    { perm: '2143', base: 5, lo: 4, hi: 5 },
    { perm: '1234', base: 7, lo: 4, hi: 5 },
    { perm: '1234', base: 3, lo: 4, hi: 5 },
    { perm: '1342', base: 5, lo: 4, hi: 5 },
    { perm: '1234', base: 5, lo: 3, hi: 4 },
  ]);
  const [lo, hi] = [bs(v.lo), bs(v.hi)];
  const up = permFrets(v.perm, v.base);
  const down = [...up].reverse();
  const pattern: Step[] = [
    ...up.map((f) => n(lo, f)),
    ...up.map((f) => n(hi, f)),
    ...down.map((f) => n(hi, f)),
    ...down.map((f) => n(lo, f)),
  ];
  return {
    key: 'A1',
    module: 'A',
    num: 1,
    title: 'Synchronisation',
    focus: 'speed',
    intro: `Finger ${dash(v.perm)} aufwärts, rückwärts abwärts. Die doppelte Note am Wendepunkt wird zweimal angeschlagen. Ohne zusätzliche Pause wiederholen. Wechselschlag, unbenutzte Saiten dämpfen.`,
    variant: orig ? undefined : `Fingerfolge ${dash(v.perm)} · ab Bund ${v.base} · Saiten ${pairName(lo, hi)}`,
    pattern,
    phases: [
      { label: 'Minute 1', seconds: 60, sub: 2, text: 'Achtel – 2 Noten pro Klick.' },
      { label: 'Minute 2', seconds: 60, sub: 4, alt: 2, text: 'Sechzehntel – nur wenn Minute 1 locker war. Sonst bei Achteln bleiben.' },
    ],
    tracksTempo: true,
  };
}

function a2(ctx: BuildCtx): Exercise {
  const { v, orig } = choose(ctx, [
    { perm: '1324', base: 5, lo: 4, hi: 5 },
    { perm: '1423', base: 5, lo: 4, hi: 5 },
    { perm: '2413', base: 5, lo: 4, hi: 5 },
    { perm: '3142', base: 5, lo: 4, hi: 5 },
    { perm: '1324', base: 7, lo: 4, hi: 5 },
    { perm: '1324', base: 5, lo: 3, hi: 4 },
  ]);
  const [lo, hi] = [bs(v.lo), bs(v.hi)];
  const up = permFrets(v.perm, v.base);
  const down = [...up].reverse();
  return {
    key: 'A2',
    module: 'A',
    num: 2,
    title: 'Fingerunabhängigkeit',
    focus: 'accuracy',
    intro: `Fingerfolge ${dash(v.perm)}, zurück ${dash([...v.perm].reverse().join(''))}. Finger nahe an der Saite halten, aber nicht künstlich auf dem Griffbrett festhalten.`,
    variant: orig ? undefined : `Fingerfolge ${dash(v.perm)} · ab Bund ${v.base} · Saiten ${pairName(lo, hi)}`,
    pattern: [...up.map((f) => n(lo, f)), ...up.map((f) => n(hi, f)), ...down.map((f) => n(hi, f)), ...down.map((f) => n(lo, f))],
    phases: [
      { label: 'Minute 1', seconds: 60, sub: 2, text: 'Mit Achteln beginnen.' },
      { label: 'Minute 2', seconds: 60, sub: 4, alt: 2, text: 'Erst wenn Achtel sauber sind: Sechzehntel.' },
    ],
    tracksTempo: true,
  };
}

function runPattern(g: { low: Pos[]; high: Pos[] }, pause = 4): Step[] {
  return [
    ...g.low.map((p) => n(p.s, p.f)),
    ...g.high.map((p) => n(p.s, p.f)),
    ...[...g.high].reverse().map((p) => n(p.s, p.f)),
    ...[...g.low].reverse().map((p) => n(p.s, p.f)),
    ...rests(pause),
  ];
}

function a3(ctx: BuildCtx): Exercise {
  const minor = homeMinor();
  const weekScale = ctx.scale.intervals.length === 7 ? ctx.scale : minor;
  const { v, orig } = choose(ctx, [
    { scale: minor, lo: 4, hi: 5, start: 5 },
    { scale: minor, lo: 4, hi: 5, start: 3 },
    { scale: minor, lo: 4, hi: 5, start: 6 },
    { scale: minor, lo: 4, hi: 5, start: 8 },
    { scale: minor, lo: 3, hi: 4, start: 5 },
    { scale: weekScale, lo: 4, hi: 5, start: 5 },
  ]);
  const [lo, hi] = [bs(v.lo), bs(v.hi)];
  const g = twoStringGroup(v.scale, lo, hi, v.start);
  const names = [...g.low, ...g.high].map((p) => noteOf(p)).join('–');
  return {
    key: 'A3',
    module: 'A',
    num: 3,
    title: `Kurzer ${v.scale === minor ? `${homeName()}-Moll` : v.scale.name}-Lauf`,
    focus: 'speed',
    intro: `${STRING_SHORT[lo]}-Saite ${fretsTxt(g.low)} (Finger ${fingering(g.low.map((p) => p.f))}), ${STRING_SHORT[hi]}-Saite ${fretsTxt(g.high)} (Finger ${fingering(g.high.map((p) => p.f))}). Töne: ${names} und zurück.`,
    variant: orig ? undefined : `${v.scale.name} · ${pairName(lo, hi)} ab Bund ${v.start}`,
    pattern: runPattern(g),
    phases: [
      { label: 'Minute 1', seconds: 60, sub: 3, text: 'Leichtere Variante: zwölf Achteltriolen, drei Töne pro Klick – genau ein Takt, direkt wiederholen.', pattern: runPattern(g, 0) },
      { label: 'Minute 2', seconds: 60, sub: 4, text: 'Zwölf Sechzehntel auf den Schlägen 1–3, Pause auf 4.' },
    ],
    tracksTempo: true,
    scaleId: v.scale.id,
    root: v.scale.root,
  };
}

function noteOf(p: Pos) {
  return noteName(fretMidi(p.s, p.f));
}

function a4(ctx: BuildCtx): Exercise {
  const { v, orig } = choose(ctx, [
    { shape: [0, 1, 3, 1], fing: '1–2–4–2', base: 5, hi: 5, lo: 4 },
    { shape: [0, 2, 3, 2], fing: '1–3–4–3', base: 5, hi: 5, lo: 4 },
    { shape: [0, 2, 4, 2], fing: '1–2–4–2 (gedehnt)', base: 5, hi: 5, lo: 4 },
    { shape: [0, 1, 3, 1], fing: '1–2–4–2', base: 7, hi: 5, lo: 4 },
    { shape: [0, 1, 3, 1], fing: '1–2–4–2', base: 5, hi: 4, lo: 3 },
    { shape: [0, 2, 3, 2], fing: '1–3–4–3', base: 3, hi: 5, lo: 4 },
  ]);
  const [lo, hi] = [bs(v.lo), bs(v.hi)];
  const grp = (s: number): Step[] => {
    const [a, b, c, d] = v.shape.map((x) => v.base + x);
    return [n(s, a), n(s, b, 'h'), n(s, c, 'h'), n(s, d, 'p')];
  };
  return {
    key: 'A4',
    module: 'A',
    num: 4,
    title: 'Legato',
    focus: 'accuracy',
    intro: `Nur die erste Note jeder Vierergruppe anschlagen. Finger ${v.fing}. Acht Noten als Achtel = ein 4/4-Takt. Gleich lange, ähnlich laute Töne; besonders die Pull-offs kontrollieren.`,
    variant: orig ? undefined : `Griff ${v.fing} · Bund ${v.base} · Saiten ${pairName(lo, hi)}`,
    pattern: [...grp(hi), ...grp(lo)],
    phases: [
      { label: 'Minute 1', seconds: 60, sub: 2, text: 'Achtel. Direkt wiederholen.' },
      { label: 'Minute 2', seconds: 60, sub: 2, text: 'Gleiches Tempo – Lautstärke der Pull-offs angleichen.' },
    ],
    tracksTempo: true,
  };
}

function a5(ctx: BuildCtx): Exercise {
  const { v, orig } = choose(ctx, [
    { lo: 3, hi: 5, start: 7 },
    { lo: 3, hi: 5, start: 5 },
    { lo: 2, hi: 4, start: 7 },
    { lo: 2, hi: 4, start: 5 },
    { lo: 1, hi: 3, start: 5 },
  ]);
  const minor = homeMinor();
  const [lo, hi] = [bs(v.lo), bs(v.hi)];
  const g = twoStringGroup(minor, lo, hi, v.start);
  const muted = STRING_LONG[lo + 1];
  return {
    key: 'A5',
    module: 'A',
    num: 5,
    title: 'Saitensprünge',
    focus: 'accuracy',
    intro: `${STRING_SHORT[lo]}-Saite: Finger ${fingering(g.low.map((p) => p.f))}; ${STRING_SHORT[hi]}-Saite: ${fingering(g.high.map((p) => p.f))}. Zwölf Achtel, dann zwei Klicks Pause. Die ${muted} bleibt stumm.`,
    variant: orig ? undefined : `Sprung ${STRING_SHORT[lo]} → ${STRING_SHORT[hi]} ab Bund ${v.start}`,
    pattern: runPattern(g),
    phases: [
      { label: 'Minute 1', seconds: 60, sub: 2, text: 'Zwölf Achtel, zwei Klicks Pause.' },
      { label: 'Minute 2', seconds: 60, sub: 2, text: 'Gleiches Tempo. Achte darauf, dass die übersprungene Saite still bleibt.' },
    ],
    tracksTempo: true,
    scaleId: minor.id,
    root: minor.root,
  };
}

function burstBars(notes: Note[], doubled: boolean): Step[] {
  // Kontrolle: four eighths on 1-und-2-und, rest on 3 and 4 (16th grid).
  const control: Step[] = [...notes.flatMap((x) => [x, 'hold' as const]), ...rests(8)];
  const speed: Step[] = doubled ? [...notes, ...notes, ...rests(8)] : [...notes, ...rests(12)];
  return [...control, ...speed];
}

function a6(ctx: BuildCtx): Exercise {
  const [d, a, f] = [bs(5), bs(4), bs(3)];
  const on = (s: number, frets: number[]) => `${STRING_SHORT[s]} ${frets.join('–')}`;
  const { v, orig } = choose(ctx, [
    { notes: [n(d, 5), n(d, 6), n(d, 8), n(d, 6)], fing: '1–2–4–2', label: on(d, [5, 6, 8, 6]) },
    { notes: [n(d, 5), n(d, 7), n(d, 8), n(d, 7)], fing: '1–3–4–3', label: on(d, [5, 7, 8, 7]) },
    { notes: [n(a, 6), n(a, 8), n(a, 10), n(a, 8)], fing: '1–2–4–2', label: on(a, [6, 8, 10, 8]) },
    { notes: [n(f, 5), n(f, 7), n(f, 9), n(f, 7)], fing: '1–2–4–2', label: on(f, [5, 7, 9, 7]) },
    { notes: [n(a, 8), n(d, 5), n(d, 6), n(d, 8)], fing: '4–1–2–4', label: `${on(a, [8])} → ${on(d, [5, 6, 8])} (Saitenwechsel)` },
  ]);
  return {
    key: 'A6',
    module: 'A',
    num: 6,
    title: 'Speed-Bursts',
    focus: 'speed',
    intro: `Takt „Kontrolle“: vier Achtel auf 1 und 2 und, Pause auf 3 und 4. Takt „Speed“: vier Sechzehntel auf Schlag 1, Pause auf 2–4. Takte abwechseln, Metronom nicht verändern. Kein Dauersprint. Finger ${v.fing}.`,
    variant: orig ? undefined : v.label,
    phases: [
      { label: 'Minute 1', seconds: 60, sub: 4, text: 'Kontrolle-Takt, dann Speed-Takt – im Wechsel.', pattern: burstBars(v.notes, false) },
      {
        label: 'Minute 2',
        seconds: 60,
        sub: 4,
        text: 'Bei sauberer Ausführung im Speed-Takt zwei Gruppen hintereinander, dann Pause auf 3 und 4.',
        pattern: burstBars(v.notes, true),
      },
    ],
    tracksTempo: true,
    burst: true,
  };
}

/** Booklet phrases in Drop C (strings 0 = low C … 5 = high d), all ending on C. */
export const PHRASES: { notes: [number, number][]; label: string }[] = [
  { notes: [[5, 8], [5, 6], [5, 5], [4, 8], [5, 10]], label: 'B♭–A♭–G–F → C' },
  { notes: [[4, 6], [4, 8], [5, 5], [5, 6], [5, 10]], label: 'E♭–F–G–A♭ → C' },
  { notes: [[5, 5], [4, 8], [4, 6], [4, 5], [3, 7]], label: 'G–F–E♭–D → C' },
  { notes: [[3, 5], [3, 7], [3, 9], [4, 6], [3, 7]], label: 'B♭–C–D–E♭ → C' },
  { notes: [[2, 8], [2, 7], [2, 5], [1, 8], [1, 5]], label: 'A♭–G–F–E♭ → C (tief)' },
  { notes: [[5, 6], [5, 8], [5, 10], [5, 8], [5, 10]], label: 'A♭–B♭–C–B♭ → C' },
];

function a7(ctx: BuildCtx): Exercise {
  const { v, orig } = choose(ctx, PHRASES);
  const [p1, p2, p3, p4, target] = v.notes.map(([s, f]) => n(bs(s), f));
  const label = `${[p1, p2, p3, p4].map(noteOf).join('–')} → ${noteOf(target)}${v.label.endsWith('(tief)') ? ' (tief)' : ''}`;
  const base: Step[] = [p1, p2, p3, p4, target, ...holds(3), ...rests(8)];
  const vib: Step[] = [p1, p2, p3, p4, { ...target, t: '~' }, ...holds(3), ...rests(8)];
  return {
    key: 'A7',
    module: 'A',
    num: 7,
    title: 'Solo-Phrase',
    focus: 'creativity',
    intro: `Die ersten vier Töne als Achtel (1 und 2 und), der Zielton ${homeName()} als halbe Note auf 3. Nach der Phrase einen ganzen Takt Pause.`,
    variant: orig ? undefined : label,
    phases: [
      { label: 'Minute 1', seconds: 60, sub: 2, text: 'Zielton ruhig halten.', pattern: base },
      { label: 'Minute 2', seconds: 60, sub: 2, text: 'Leichtes Vibrato auf dem Zielton ergänzen.', pattern: vib },
    ],
    tracksTempo: false,
  };
}

function a8(ctx: BuildCtx): Exercise {
  const minor = homeMinor();
  const { v, orig } = choose(ctx, [
    { pool: [[5, 5], [5, 6], [5, 8], [5, 10], [4, 5], [4, 6], [4, 8]] as [number, number][], label: `${pairName(bs(4), bs(5))}, Bund 5–10`, scale: minor },
    { pool: [[4, 6], [4, 8], [4, 10], [3, 5], [3, 7], [3, 9]] as [number, number][], label: `${pairName(bs(3), bs(4))}, Bund 5–10`, scale: minor },
    { pool: null, label: `${ctx.scale.name} auf ${pairName(bs(4), bs(5))}`, scale: ctx.scale },
  ]);
  const pool: Pos[] = v.pool
    ? v.pool.map(([s, f]) => ({ s: bs(s), f }))
    : fretboardNotes(v.scale, 5, 10).filter((p) => p.s >= TOP - 1);
  const dots: MapDot[] = pool.map((p) => {
    const deg = degreeOf(v.scale, fretMidi(p.s, p.f));
    return { ...p, kind: deg === 0 ? 'root' : v.scale !== minor && v.scale.color.includes(deg) ? 'color' : 'note' };
  });
  return {
    key: 'A8',
    module: 'A',
    num: 8,
    title: 'Mini-Solo',
    focus: 'creativity',
    intro: `Tonvorrat, nicht als Akkord spielen. Kurze Motive aus 3–6 Tönen, nach jedem Motiv mindestens zwei Klicks Luft. Jede zweite Phrase auf ${noteName(v.scale.root)} beenden. Lieber den Rhythmus einer guten Idee verändern, statt ständig neue Noten zu suchen.`,
    variant: orig ? undefined : v.label,
    map: { from: 4, to: 11, dots, caption: `Gold = ${noteName(v.scale.root)} (Zielton)` },
    phases: [{ label: 'Minute 1', seconds: 60, sub: 2, text: 'Frei improvisieren mit der heutigen Aufgabe.' }],
    tracksTempo: false,
    drone: true,
    prompts: prompts(ctx, 1),
    scaleId: v.scale.id,
    root: v.scale.root,
  };
}

// ---------------------------------------------------------------------------
// MODUL B · Alle Saiten
// ---------------------------------------------------------------------------

function b1(ctx: BuildCtx): Exercise {
  const { v, orig } = choose(ctx, [
    { perm: '1234', base: 5 },
    { perm: '1234', base: 3 },
    { perm: '1234', base: 7 },
    { perm: '1243', base: 5 },
    { perm: '2134', base: 5 },
  ]);
  const up = permFrets(v.perm, v.base);
  const down = [...up].reverse();
  const ascending: Step[] = allStrings().flatMap((s) => up.map((f) => n(s, f)));
  const descending: Step[] = allStrings().reverse().flatMap((s) => down.map((f) => n(s, f))).slice(1);
  return {
    key: 'B1',
    module: 'B',
    num: 1,
    title: 'Chromatik über die Saitenbreite',
    focus: 'speed',
    intro: `Finger ${dash(v.perm)} auf jeder Saite. Zurück rückwärts; den obersten Ton am Wendepunkt nicht doppeln. Keine Pause zwischen den Saiten.`,
    variant: orig ? undefined : `Fingerfolge ${dash(v.perm)} · ab Bund ${v.base}`,
    pattern: [...ascending, ...descending, 'rest'],
    phases: [
      { label: 'Minute 1', seconds: 60, sub: 2, text: 'Achtel.' },
      { label: 'Minute 2', seconds: 60, sub: 4, alt: 2, text: 'Bei sauberer Ausführung Sechzehntel.' },
    ],
    tracksTempo: true,
  };
}

/** String skips over the whole neck: 0 → 2 → 1 → 3 … (gap 2), or the same from the top. */
function skips(gap: number, fromTop = false): number[] {
  const seq = Array.from({ length: STRINGS - gap }, (_, i) => [i, i + gap]).flat();
  return fromTop ? seq.map((s) => TOP - s) : seq;
}

function b2(ctx: BuildCtx): Exercise {
  const txt = (seq: number[]) => seq.map(stringNo).join(' → ');
  const { v, orig } = choose(ctx, [
    { perm: '1324', base: 5, seq: skips(2), top: false },
    { perm: '1423', base: 5, seq: skips(2), top: false },
    { perm: '1324', base: 5, seq: skips(3), top: false },
    { perm: '2413', base: 5, seq: skips(2), top: false },
    { perm: '1324', base: 7, seq: skips(2, true), top: true },
  ]);
  const seqTxt = txt(v.seq) + (v.top ? ' (von oben)' : '');
  const up = permFrets(v.perm, v.base);
  const down = [...up].reverse();
  const m1: Step[] = [
    ...allStrings().flatMap((s) => up.map((f) => n(s, f))),
    ...allStrings().reverse().flatMap((s) => down.map((f) => n(s, f))),
  ];
  const m2 = padBar([...v.seq.flatMap((s) => up.map((f) => n(s, f))), ...rests(8)], 2);
  return {
    key: 'B2',
    module: 'B',
    num: 2,
    title: 'Fingerfolge und Saitensprünge',
    focus: 'accuracy',
    intro: `Fingerfolge ${dash(v.perm)}. Saite ${STRINGS} = ${STRING_LONG[0]} (die dickste), Saite 1 = ${STRING_LONG[TOP]}. Die übersprungenen Saiten sollen nicht nachklingen. Langsamer als die gerade Chromatik ist hier ausdrücklich in Ordnung.`,
    variant: orig ? undefined : `Fingerfolge ${dash(v.perm)} · ab Bund ${v.base} · Folge ${seqTxt}`,
    phases: [
      { label: 'Minute 1', seconds: 60, sub: 2, text: `Aufwärts ${up.join('–')}, abwärts ${down.join('–')}.`, pattern: m1 },
      { label: 'Minute 2', seconds: 60, sub: 2, text: `Saitenfolge ${seqTxt}, auf jeder Saite einmal ${up.join('–')}. Danach kurz lösen und neu beginnen.`, pattern: m2 },
    ],
    tracksTempo: true,
  };
}

/** Start notes of the minor shape above the key note (Drop C: low G, F, E♭, A♭, B♭ = frets 7, 5, 3, 8, 10). */
const B_POSITIONS = [7, 5, 3, 8, 10];

function minorShape(ctx: BuildCtx) {
  const { v, orig } = choose(ctx, B_POSITIONS);
  const scale = homeMinor();
  const fret = midiToPc(HOME + v - TUNING[0]) || 12;
  const path = sixStringPath(scale, TUNING[0] + fret);
  return { path, scale, label: orig ? undefined : `Griffbild ab tiefem ${noteName(HOME + v)} (Bund ${fret})` };
}

function pathTable(path: Pos[]) {
  return allStrings()
    .map((s) => {
      const fs = path.filter((p) => p.s === s).map((p) => p.f);
      return `${STRING_SHORT[s]} ${fs.join('–')} (${fingering(fs)})`;
    })
    .join(' · ');
}

function b3(_ctx: BuildCtx, shape: ReturnType<typeof minorShape>): Exercise {
  const { up, down } = pathUpDown(shape.path);
  const both = padBar([...up, ...down.slice(1)], 2);
  return {
    key: 'B3',
    module: 'B',
    num: 3,
    title: shape.scale.name,
    focus: 'scales',
    intro: `Ein Griffbild über alle ${STRINGS} Saiten. ${homeName()} als Zielton bewusst hören. Die Hand für die weitere Lage mitnehmen, nicht festklemmen. ${pathTable(shape.path)}`,
    variant: shape.label,
    map: scaleMap(shape.scale, 3, 14, `Gold = ${homeName()} · Türkis = ${noteName(HOME + 8)} (♭6)`),
    phases: [
      { label: 'Minute 1', seconds: 60, sub: 2, text: 'Aufwärts, oben halten und neu beginnen.', pattern: padBar([...up, 'hold', 'hold'], 2) },
      { label: 'Minute 2', seconds: 60, sub: 2, text: 'Abwärts.', pattern: padBar([...down, 'hold', 'hold'], 2) },
      { label: 'Minute 3', seconds: 60, sub: 2, text: 'Beide Richtungen ohne doppelten Wendeton verbinden.', pattern: both },
    ],
    tracksTempo: true,
    scaleId: shape.scale.id,
    root: shape.scale.root,
  };
}

function b4(_ctx: BuildCtx, shape: ReturnType<typeof minorShape>): Exercise {
  const { up, down } = pathUpDown(shape.path, 'legato');
  return {
    key: 'B4',
    module: 'B',
    num: 4,
    title: 'Dasselbe als Legato',
    focus: 'accuracy',
    intro: 'Nur die erste Note jeder Saite anschlagen. Gleichmäßige Achtel, kein hastiges Nachziehen der beiden Legato-Töne.',
    variant: shape.label,
    phases: [
      { label: 'Minute 1', seconds: 60, sub: 2, text: 'Aufwärts mit Hammer-ons.', pattern: padBar([...up, 'hold', 'hold'], 2) },
      { label: 'Minute 2', seconds: 60, sub: 2, text: 'Rückwärts mit Pull-offs. Jeweils den ersten Ton anschlagen.', pattern: padBar([...down, 'hold', 'hold'], 2) },
    ],
    tracksTempo: true,
    scaleId: shape.scale.id,
    root: shape.scale.root,
  };
}

function b5(_ctx: BuildCtx, shape: ReturnType<typeof minorShape>): Exercise {
  const group = (s: number): Note[] => {
    const fs = shape.path.filter((p) => p.s === s).map((p) => p.f);
    const [a, b, c] = fs;
    return [n(s, a), n(s, b), n(s, c), n(s, b)];
  };
  // Tab shows only the groups on the way up; rests and the way back are in the text.
  const up = allStrings();
  const single = up.flatMap(group);
  const double = up.flatMap((s) => [...group(s), ...group(s)]);
  return {
    key: 'B5',
    module: 'B',
    num: 5,
    title: 'Bursts auf jeder Saite',
    focus: 'speed',
    intro: 'Jede Saite einzeln: vier Sechzehntel auf Schlag 1, Pause auf 2–4. Im nächsten Takt zur nächsten Saite. Oben angekommen in umgekehrter Saitenfolge zurück.',
    variant: shape.label,
    phases: [
      { label: 'Minute 1', seconds: 60, sub: 4, text: 'Vier Sechzehntel auf Schlag 1, Pause auf 2–4. Pro Takt eine Saite, oben angekommen zurück.', pattern: single, groups: 4 },
      { label: 'Minute 2', seconds: 60, sub: 4, text: 'Wenn sauber: Gruppe zweimal direkt hintereinander (Schlag 1–2); Pause auf 3 und 4.', pattern: double, groups: 8 },
      {
        label: 'Minute 3',
        seconds: 60,
        sub: 4,
        text: 'Schwierigste Saite auswählen und mit denselben Pausen wiederholen.',
        pattern: double,
        groups: 8,
        pick: {
          label: 'Schwierigste Saite',
          options: allStrings()
            .reverse()
            .map((s) => ({ value: s, label: STRING_SHORT[s] })),
          build: (s) => [...group(s), ...group(s)],
        },
      },
    ],
    tracksTempo: true,
    burst: true,
    scaleId: shape.scale.id,
    root: shape.scale.root,
  };
}

function b6(ctx: BuildCtx, shape: ReturnType<typeof minorShape>): Exercise {
  const isHome = (p: Pos) => midiToPc(fretMidi(p.s, p.f)) === HOME;
  const targets = shape.path.filter(isHome);
  const dots: MapDot[] = shape.path.map((p) => ({ ...p, kind: isHome(p) ? 'target' : 'note' }));
  const rhythm = ctx.vary ? pick(ctx.rng, RHYTHM_IDEAS) : RHYTHM_IDEAS[0];
  return {
    key: 'B6',
    module: 'B',
    num: 6,
    title: 'Mini-Solo über drei Register',
    focus: 'creativity',
    intro: `Nur Töne aus dem Griffbild verwenden. Den Zielton halten, optional leichtes Vibrato. Hier nicht die Geschwindigkeit messen, sondern Phrasen mit Anfang und Ende spielen. Zieltöne ${homeName()}: ${targets.map((t) => `${STRING_SHORT[t.s]} ${t.f}`).join(', ')}.`,
    variant: shape.label,
    map: { from: Math.min(...shape.path.map((p) => p.f)) - 1, to: Math.max(...shape.path.map((p) => p.f)) + 1, dots, caption: `Gold = ${homeName()}-Zieltöne` },
    phases: [
      { label: 'Minute 1', seconds: 60, sub: 2, text: 'Je eine Phrase mit 4–6 Tönen auf dem tiefen, mittleren und hohen Saitenpaar. Nach jeder Phrase zwei Klicks Pause.' },
      { label: 'Minute 2', seconds: 60, sub: 2, text: `Rhythmus ${rhythm} tief, mittig und hoch wiederverwenden. Andere Töne, erkennbar dasselbe Motiv.` },
      { label: 'Minute 3', seconds: 60, sub: 2, text: `Phrasen abwechselnd auf den ${homeName()}-Zieltönen beenden.` },
    ],
    tracksTempo: false,
    drone: true,
    prompts: ctx.vary ? prompts(ctx, 1) : undefined,
  };
}

// ---------------------------------------------------------------------------
// SKALA · ein Block über mehrere Tage; jeder neue Block bringt eine neue Skala
// mit neuem Grundton. Tag 1 lernen, mittlere Tage vertiefen, letzter Tag
// abrufen, transponieren, benutzen. (Aufbau wie Modul C aus dem Heft.)
// ---------------------------------------------------------------------------

const octaveText = (o: Pos[]) => `${STRING_DAT[o[0].s]} (Bund ${o[0].f}–${o[o.length - 1].f})`;
const positionText = (p: Pos[]) => (p[0].f === 0 ? 'in der offenen Lage' : `ab Bund ${p[0].f}`);

/** Groups of `size` consecutive notes along a path: 1-2-3, 2-3-4, … */
function sequence(path: Pos[], size: number): Step[] {
  const out: Step[] = [];
  for (let i = 0; i + size <= path.length; i++) out.push(...path.slice(i, i + size).map((p) => n(p.s, p.f)));
  return out;
}

/** Thirds along a path: 1-3, 2-4, 3-5, … */
function thirds(path: Pos[]): Step[] {
  const out: Step[] = [];
  for (let i = 0; i + 2 < path.length; i++) out.push(n(path[i].s, path[i].f), n(path[i + 2].s, path[i + 2].f));
  return out;
}

function scaleListen(sc: ScaleDef, map: FretMap): Exercise {
  const r = noteName(sc.root);
  return {
    key: 'C1',
    module: 'C',
    num: 1,
    title: 'Hören',
    focus: 'scales',
    intro: `Tiefes ${r} als gehaltener Klang (Drone). ${sc.ref ? `Zuerst den ${sc.ref.name}-Vergleichston, dann den charakteristischen Ton der Skala spielen. ` : ''}${r} immer wieder als Ruhepunkt hören.`,
    map,
    phases: [{ label: '2 Minuten', seconds: 120, sub: 2, text: sc.listen, widget: 'listen', metronome: false }],
    tracksTempo: false,
    drone: true,
    scaleId: sc.id,
    root: sc.root,
  };
}

function scaleFind(sc: ScaleDef, map: FretMap, path: Pos[]): Exercise {
  const r = noteName(sc.root);
  const { up, down } = pathUpDown(path);
  const octave = oneStringOctave(sc);
  const oUp = octave.map((p) => n(p.s, p.f));
  return {
    key: 'C2',
    module: 'C',
    num: 2,
    title: 'Finden',
    focus: 'scales',
    intro: 'Alle Noten gleichmäßig als Achtel. Kein Tempo-Ziel für diesen Block. Langsam spielen und die Hand passend mitverschieben.',
    map,
    phases: [
      { label: 'Minute 1', seconds: 60, sub: 2, text: `Die Ein-Saiten-Oktave auf der ${octaveText(octave)}: ${r} bis ${r} und zurück.`, pattern: padBar([...oUp, ...[...oUp].reverse().slice(1)], 2) },
      { label: 'Minute 2–3', seconds: 120, sub: 2, text: `Lage 1, das ${stringsWord()}-Saiten-Griffbild ${positionText(path)}, in beide Richtungen. Die übrigen Lagen folgen in den nächsten Lektionen.`, pattern: padBar([...up, ...down.slice(1)], 2) },
      { label: 'Minute 4', seconds: 60, sub: 2, text: 'Griffbild abgedeckt: auf drei Saiten Grundton und Farbton suchen.', widget: 'find', hideMap: true, metronome: false },
    ],
    tracksTempo: false,
    scaleId: sc.id,
    root: sc.root,
  };
}

function scaleSequences(sc: ScaleDef, map: FretMap, path: Pos[]): Exercise {
  return {
    key: 'C6',
    module: 'C',
    num: 6,
    title: 'Sequenzen',
    focus: 'scales',
    intro: 'Sequenzen machen aus der Tonleiter Musik: immer einen Ton weiter, dieselbe Figur. So lernst du Lage 1 in Stücken statt nur von unten nach oben. Langsam und gleichmäßig.',
    map,
    phases: [
      { label: 'Minute 1', seconds: 60, sub: 3, text: 'Dreiergruppen aufwärts als Triolen: 1-2-3, 2-3-4, 3-4-5 …', pattern: padBar(sequence(path, 3), 3) },
      { label: 'Minute 2', seconds: 60, sub: 2, text: 'Terzen: jeweils einen Skalenton überspringen – 1-3, 2-4, 3-5 …', pattern: padBar(thirds(path), 2) },
    ],
    tracksTempo: false,
    scaleId: sc.id,
    root: sc.root,
  };
}

/**
 * Which positions each day of a scale block brings: the first day the home
 * position, the middle days up to four new ones each, the last day up to two.
 * From three days per scale on, every position comes up within the block.
 */
export function positionSchedule(count: number, days: number): number[][] {
  const out: number[][] = Array.from({ length: Math.max(1, days) }, () => []);
  out[0] = [0];
  const rest = Array.from({ length: count - 1 }, (_, i) => i + 1);
  const middle = Math.max(0, days - 2);
  if (middle) {
    const per = Math.min(4, Math.ceil(rest.length / middle));
    for (let d = 1; d <= middle; d++) out[d] = rest.splice(0, per);
  }
  if (days > 1) out[days - 1] = rest.splice(0, 2);
  return out;
}

const lageText = (i: number, p: Pos[]) => {
  const [lo, hi] = fretRange(p);
  return `Lage ${i + 1} (Bund ${lo}–${hi})`;
};

/** The already known position closest to position `i` on the neck. */
function neighbour(all: Pos[][], i: number) {
  const known = all.slice(0, i).map((p, j) => ({ j, d: Math.abs(p[0].f - all[i][0].f) }));
  return known.sort((a, b) => a.d - b.d)[0]?.j ?? 0;
}

/** The whole neck with all scale notes: what the positions add up to. */
function fullNeck(count: number): Phase[] {
  return [
    {
      label: 'Griffbrett-Tour',
      seconds: 60,
      sub: 2,
      text: `Einmal über den ganzen Hals: in Lage 1 eine Oktave aufwärts, in die nächste Lage weiterrutschen und so weiter, bis alle ${count} Lagen dran waren. Die Karte zeigt jeden Ton der Skala bis Bund 17.`,
      metronome: false,
    },
    { label: 'Treffer', seconds: 60, sub: 2, text: 'Die App nennt Töne der Skala – finde sie irgendwo auf dem Griffbrett, ohne Karte.', widget: 'notes', hideMap: true, metronome: false },
  ];
}

/**
 * Lagen: today's new positions of the scale, one minute each (up and down),
 * the rest of the time connects them with a known neighbour. With no new
 * position left the whole neck is reviewed.
 */
function scalePositionsEx(sc: ScaleDef, all: Pos[][], today: number[], minutes: number): Exercise {
  const r = noteName(sc.root);
  const count = all.length;
  const base = { key: 'C7', module: 'C' as const, num: 7, focus: 'scales' as const, tracksTempo: false, scaleId: sc.id, root: sc.root };
  if (!today.length) {
    return {
      ...base,
      title: 'Ganzes Griffbrett',
      intro: `Alle ${count} Lagen von ${sc.name} zusammen decken das ganze Griffbrett ab – ab Bund 12 wiederholt sich alles eine Oktave höher. Jetzt die Lagen verbinden, statt in einer Box zu bleiben.`,
      map: scaleMap(sc, 0, 17, `Alle Töne von ${sc.name} · Gold = ${r} (Grundton) · Türkis = ${sc.colorLabel}`),
      phases: [...fullNeck(count), ...fullNeck(count)].slice(0, minutes),
    };
  }
  const phases: Phase[] = today.map((i) => {
    const { up, down } = pathUpDown(all[i]);
    return { label: `Lage ${i + 1}`, seconds: 60, sub: 2, text: `${lageText(i, all[i])}: aufwärts und abwärts. Grundton ${r} in der Lage suchen und bewusst hören.`, pattern: padBar([...up, ...down.slice(1)], 2) };
  });
  const fill: Phase[] = today.map((i) => {
    const j = neighbour(all, i);
    const a = pathUpDown(all[j]);
    const b = pathUpDown(all[i]);
    return {
      label: 'Verbinden',
      seconds: 60,
      sub: 2,
      text: `Lage ${j + 1} aufwärts, Lage ${i + 1} abwärts: Die beiden Lagen teilen sich Töne – dort wechselt die Hand ohne Pause.`,
      pattern: padBar([...a.up, ...b.down], 2),
    };
  });
  fill.push(...fullNeck(count));
  phases.push(...fill.slice(0, Math.max(0, minutes - phases.length)));
  const shown = today.flatMap((i) => [all[i], all[neighbour(all, i)]]);
  return {
    ...base,
    title: 'Lagen',
    intro: `${sc.name} hat ${count} Lagen, die zusammen das ganze Griffbrett abdecken. Heute neu: ${today.map((i) => `Lage ${i + 1}`).join(', ')}. Jede Lage hat dieselbe Form in jeder Tonart – nur der Startbund ändert sich mit dem Grundton.`,
    map: mapAround(sc, shown.flat()),
    phases: phases.slice(0, minutes),
  };
}

function scaleRecall(sc: ScaleDef, map: FretMap): Exercise {
  return {
    key: 'C5',
    module: 'C',
    num: 5,
    title: 'Abrufen',
    focus: 'accuracy',
    intro: `Karte abdecken: die ${sc.intervals.length} Töne nennen, Ein-Saiten-Oktave spielen, anschließend eine kurze Phrase. Unsichere Stellen nachsehen und einmal korrekt wiederholen.`,
    map,
    phases: [{ label: '2 Minuten', seconds: 120, sub: 2, text: 'Noten der Skala aus dem Kopf antippen, dann spielen.', widget: 'recall', hideMap: true, metronome: false }],
    tracksTempo: false,
    scaleId: sc.id,
    root: sc.root,
  };
}

function scaleMusic(ctx: BuildCtx, path: Pos[]): Exercise {
  const sc = ctx.scale;
  const motif: Step[] = sc.motif.map(([s, f]) => n(s, f));
  return {
    key: 'C4',
    module: 'C',
    num: 4,
    title: 'Musik',
    focus: 'creativity',
    intro: `Mini-Motiv: ${sc.motifText}. Die Zahlen sind eine aufeinanderfolgende Melodie, keine Akkordgriffe. Ziel: den Farbton hören und bewusst einsetzen.`,
    map: mapAround(sc, [...path, ...sc.motif.map(([s, f]) => ({ s, f }))]),
    phases: [
      { label: 'Minute 1', seconds: 60, sub: 2, text: 'Motiv von der Karte spielen – erst frei, dann im klaren Achtelrhythmus.', pattern: padBar([...motif, 'hold', 'hold'], 2), metronome: false },
      { label: 'Minute 2', seconds: 60, sub: 2, text: `Eigene Antwort mit 3–6 Tönen erfinden; ${noteName(sc.root)} als Zielton, Pausen lassen.`, metronome: false },
    ],
    tracksTempo: false,
    drone: true,
    prompts: prompts(ctx, 1),
    scaleId: sc.id,
    root: sc.root,
  };
}

/** The scale block of the day: 6 minutes, depending on the day within the block. */
export function scaleBlock(ctx: BuildCtx): Exercise[] {
  const sc = ctx.scale;
  const all = scalePositions(sc);
  const path = all[0];
  const map = mapAround(sc, path);
  const stage = ctx.stage ?? 'learn';
  const day = ctx.blockDay ?? { index: stage === 'learn' ? 0 : stage === 'deepen' ? 1 : 2, total: 3 };
  const today = positionSchedule(all.length, day.total)[day.index % day.total] ?? [];
  switch (stage) {
    case 'learn':
      return [scaleListen(sc, map), scaleFind(sc, map, path)];
    case 'deepen':
      return [scaleSequences(sc, map, path), scalePositionsEx(sc, all, today, 4)];
    case 'apply':
      return [scaleRecall(sc, map), scalePositionsEx(sc, all, today, 2), scaleMusic(ctx, path)];
  }
}

export function moduleA(ctx: BuildCtx): Exercise[] {
  return [a1(ctx), a2(ctx), a3(ctx), a4(ctx), a5(ctx), a6(ctx), a7(ctx), a8(ctx)];
}

export function moduleB(ctx: BuildCtx): Exercise[] {
  const shape = minorShape(ctx);
  return [b1(ctx), b2(ctx), b3(ctx, shape), b4(ctx, shape), b5(ctx, shape), b6(ctx, shape)];
}

// ---------------------------------------------------------------------------
// MODUL D · Polyrhythmus (nicht aus dem Heft)
// The click keeps the beat; the guitar plays the other layer. "Hören" phases
// let the metronome play that layer too, as a second, lower click.
// ---------------------------------------------------------------------------

/** The open lowest string (low C in Drop C) and the same note an octave up (Drop C: Saite 4 offen). */
const lowOpen = () => n(0, 0);
function octaveUp(): Note {
  // Lowest fret that sounds the octave of the open low string, on strings 1–3.
  const opts = [1, 2, 3].map((s) => n(s, TUNING[0] + 12 - TUNING[s])).filter((x) => x.f >= 0);
  return opts.sort((a, b) => a.f - b.f)[0];
}
/** "Tiefes C = Saite 6 offen, hohes C = Saite 4 offen" for the current tuning. */
function lowHighText() {
  const r = STRING_SHORT[0];
  const o = octaveUp();
  return `Tiefes ${r} = Saite ${STRINGS} offen, hohes ${r} = Saite ${stringNo(o.s)} ${o.f ? `Bund ${o.f}` : 'offen'}`;
}

/** A note every `every` steps over `len` steps, held until the next (or short, palm-muted). */
function pulse(len: number, every: number, note: Note, ring = true): Step[] {
  return Array.from({ length: len }, (_, i) => (i % every === 0 ? note : ring ? 'hold' : 'rest'));
}

/** Every grid step played: the counter-rhythm on the low C, the steps between on the octave. */
function grid(len: number, every: number): Step[] {
  const [low, high] = [lowOpen(), octaveUp()];
  return Array.from({ length: len }, (_, i) => (i % every === 0 ? low : high));
}

/** A riff group (frets on the lowest string) repeated 16 times, so it lands on the "1" again. */
const groups = (frets: number[]): Step[] => Array.from({ length: 16 }, () => frets.map((f) => n(0, f))).flat();

function d1(): Exercise {
  const LOW_C = lowOpen();
  const r = STRING_SHORT[0];
  return {
    key: 'D1',
    module: 'D',
    num: 1,
    title: '3 gegen 2',
    focus: 'accuracy',
    intro:
      `3 gegen 2 heißt: In der Zeit von zwei Klicks spielst du drei Töne, gleich weit auseinander – pro 4/4-Takt also sechs. Nur der erste Ton fällt auf einen Klick, die anderen beiden liegen dazwischen. Zum Zählen jeden Klick in drei Silben teilen: „eins-te-le zwei-te-le“. Deine Töne kommen auf jede zweite Silbe: EINS-te-LE zwei-TE-le. ${lowHighText()}.`,
    phases: [
      {
        label: 'Hören',
        seconds: 60,
        sub: 3,
        text: `Der zweite, tiefere Klick spielt die Drei. Erst nur zuhören und „eins-te-le zwei-te-le“ mitsprechen, dann auf EINS, LE, TE klatschen. Zusammen klingt es wie „Ton+Klick – Ton – Klick – Ton“, die mittleren drei dicht hintereinander. Wenn es sitzt, auf dem tiefen ${r} mitspielen.`,
        pattern: pulse(12, 2, LOW_C),
        layer: true,
      },
      {
        label: 'Raster',
        seconds: 60,
        sub: 3,
        text: 'Jede Silbe ein Ton, im Wechselschlag: tief – hoch – tief – hoch – tief – hoch auf zwei Klicks. Die tiefen Töne (EINS, LE, TE) sind die Drei – kräftig spielen; die hohen leise. Der Klick fällt auf die Eins (tief) und die Zwei (hoch).',
        pattern: grid(12, 2),
      },
      {
        label: 'Nur die Drei',
        seconds: 60,
        sub: 3,
        text: 'Die hohen Töne weglassen, nur die tiefen bleiben – das ist die Drei. Jeden Ton bis zum nächsten klingen lassen und die Silben innerlich weiterzählen, damit die Töne nicht zum Klick rutschen.',
        pattern: pulse(12, 2, LOW_C),
      },
      {
        label: 'Wechsel',
        seconds: 60,
        sub: 3,
        text: 'Takt 1: sechs Töne (die Drei, wie eben). Takt 2: vier Töne genau mit dem Klick (die Zwei). Im Wechsel ohne Pause – die Silben laufen durch, nur die Töne wechseln.',
        pattern: [...pulse(12, 2, LOW_C), ...pulse(12, 3, LOW_C)],
      },
    ],
    tracksTempo: true,
  };
}

function d2(): Exercise {
  const LOW_C = lowOpen();
  return {
    key: 'D2',
    module: 'D',
    num: 2,
    title: '2 und 4 gegen 3',
    focus: 'accuracy',
    intro: `Dreivierteltakt: der Klick spielt drei Schläge pro Takt. Du teilst den Takt in zwei, dann in vier gleich lange Töne. Alles auf dem tiefen ${STRING_SHORT[0]} (Saite ${STRINGS} offen).`,
    phases: [
      { label: 'Hören 2:3', seconds: 60, sub: 2, beats: 3, text: 'Zwei Töne pro Takt (punktierte Viertel). Erst zuhören, dann mitspielen.', pattern: pulse(6, 3, LOW_C), layer: true },
      { label: 'Spielen 2:3', seconds: 60, sub: 2, beats: 3, text: 'In Achteln mitzählen „1 + 2 + 3 +“ – die Töne kommen auf 1 und auf 2+.', pattern: pulse(6, 3, LOW_C) },
      { label: 'Hören 4:3', seconds: 60, sub: 4, beats: 3, text: 'Vier Töne pro Takt (punktierte Achtel). Erst zuhören, dann mitspielen.', pattern: pulse(12, 3, LOW_C), layer: true },
      { label: 'Spielen 4:3', seconds: 60, sub: 4, beats: 3, text: 'In Sechzehnteln mitzählen – jeder dritte Sechzehntel ist ein Ton.', pattern: pulse(12, 3, LOW_C) },
    ],
    tracksTempo: true,
  };
}

function d3(): Exercise {
  const LOW_C = lowOpen();
  return {
    key: 'D3',
    module: 'D',
    num: 3,
    title: '3 gegen 4',
    focus: 'accuracy',
    intro: 'Der Klick spielt vier Viertel, du spielst drei gleich lange Töne pro Takt (Halbe-Triolen). Gerüst: zwölf Triolen-Achtel pro Takt, jede vierte ist ein Ton der Drei.',
    phases: [
      { label: 'Hören', seconds: 60, sub: 3, text: 'Der tiefere Klick spielt die Drei. Zuhören, mitklatschen, dann mitspielen.', pattern: pulse(12, 4, LOW_C), layer: true },
      {
        label: 'Raster',
        seconds: 60,
        sub: 3,
        text: `Alle Triolen-Achtel durchspielen: jede vierte auf dem tiefen Ton, die anderen leise auf dem hohen. ${lowHighText()}.`,
        pattern: grid(12, 4),
      },
      { label: 'Nur die Drei', seconds: 60, sub: 3, text: 'Nur noch die Drei gegen den Klick – Töne klingen lassen.', pattern: pulse(12, 4, LOW_C) },
    ],
    tracksTempo: true,
  };
}

function d4(ctx: BuildCtx): Exercise {
  const LOW_C = lowOpen();
  const names = (frets: number[]) => frets.map((f) => noteName(TUNING[0] + f)).join('–');
  const { v: shape, orig } = choose(ctx, [
    { three: [0, 3, 5], fing: 'offen–1–3', five: [0, 0, 3, 0, 5] },
    { three: [0, 1, 3], fing: 'offen–1–3', five: [0, 0, 1, 0, 3] },
    { three: [0, 3, 6], fing: 'offen–1–4', five: [0, 0, 3, 0, 6] },
  ]);
  const v = { ...shape, threeTxt: names(shape.three), fiveTxt: names(shape.five) };
  return {
    key: 'D4',
    module: 'D',
    num: 4,
    title: 'Dreier- und Fünfergruppen',
    focus: 'speed',
    intro: `Metal-Polyrhythmus: der Klick bleibt im 4/4, deine Gruppe läuft in Sechzehnteln darüber und verschiebt sich gegen die Eins. Alles auf der ${STRING_DAT[0]} mit Palm-Mute, Finger ${v.fing}. Die erste Note jeder Gruppe betonen.`,
    variant: orig ? undefined : `Gruppe ${v.threeTxt}`,
    phases: [
      { label: 'Chugs', seconds: 60, sub: 4, text: `Alle drei Sechzehntel ein kurzer Chug auf dem tiefen ${STRING_SHORT[0]}. Nach drei Takten trifft er wieder die Eins. Der zweite Klick spielt erst mit.`, pattern: pulse(48, 3, LOW_C, false), layer: true },
      { label: 'Dreiergruppe', seconds: 60, sub: 4, text: `Gruppe ${v.threeTxt} durchgehend – nach drei Takten wieder auf der Eins.`, pattern: groups(v.three) },
      { label: 'Fünfergruppe', seconds: 60, sub: 4, text: `Gruppe ${v.fiveTxt} durchgehend – nach fünf Takten wieder auf der Eins.`, pattern: groups(v.five) },
    ],
    tracksTempo: true,
  };
}

function d5(ctx: BuildCtx): Exercise {
  const task = ctx.vary
    ? pick(ctx.rng, ['Dreiergruppe aus zwei Tönen', 'Fünfergruppe mit Pause am Ende', 'Gruppe 3 + 3 + 2 (Tresillo)', 'Siebenergruppe'])
    : 'Dreiergruppe aus zwei Tönen';
  return {
    key: 'D5',
    module: 'D',
    num: 5,
    title: 'Eigenes Polyrhythmus-Riff',
    focus: 'creativity',
    intro: 'Ein eigenes Riff auf den tiefen Saiten, das sich gegen den 4/4-Klick verschiebt. Die Gruppe beibehalten, nur Töne und Betonungen verändern. Zählen, wann es wieder auf der Eins landet.',
    phases: [{ label: 'Minute 1', seconds: 60, sub: 4, text: 'Frei spielen mit der heutigen Aufgabe.' }],
    tracksTempo: false,
    prompts: [`Heute: ${task}.`],
  };
}

export function moduleD(ctx: BuildCtx): Exercise[] {
  return [d1(), d2(), d3(), d4(ctx), d5(ctx)];
}

// ---------------------------------------------------------------------------
// E · Zusatz-Technik (nicht aus dem Heft): Tremolo, Lagenwechsel, Oktaven,
// Griffbrett-Kenntnis. Im Grundton des Tages, wo es um Töne geht.
// ---------------------------------------------------------------------------

function e1(ctx: BuildCtx): Exercise {
  const sc = ctx.scale;
  // Four scale notes on the highest string from the tonic – upwards, or downwards where upwards runs out of frets.
  const up = (f: number) => scaleRun(sc, fretMidi(TOP, f), 4).map((m) => m - TUNING[TOP]);
  const down = (f: number) => {
    const out = [f];
    for (let x = f - 1; out.length < 4; x--) if (scaleRun(sc, fretMidi(TOP, x), 1)[0] === fretMidi(TOP, x)) out.push(x);
    return out;
  };
  const low = midiToPc(sc.root - TUNING[TOP]);
  const frets = [up(low), down(low), down(low + 12)].find((fs) => fs.every((f) => f >= 0 && f <= 17))!;
  const rootFret = frets[0];
  return {
    key: 'E1',
    module: 'E',
    num: 1,
    title: 'Tremolo-Picking',
    focus: 'speed',
    intro: `Durchgehende Sechzehntel im Wechselschlag auf der ${STRING_DAT[TOP]}. Die Bewegung kommt aus dem Handgelenk, nicht aus dem Arm – klein und locker. Grundton ${noteName(sc.root)} = Bund ${rootFret}.`,
    phases: [
      { label: 'Minute 1', seconds: 60, sub: 4, text: `Tremolo auf einem Ton: ${noteName(sc.root)}, gleichmäßig laut.`, pattern: Array.from({ length: 16 }, () => n(TOP, rootFret)) },
      {
        label: 'Minute 2',
        seconds: 60,
        sub: 4,
        text: `Tremolo-Melodie ${frets.join('–')}: auf jedem Schlag ein neuer Ton, die Anschlaghand läuft ohne Stocken weiter.`,
        pattern: frets.flatMap((f) => [n(TOP, f), n(TOP, f), n(TOP, f), n(TOP, f)]),
      },
    ],
    tracksTempo: true,
  };
}

function e2(ctx: BuildCtx): Exercise {
  const { v: b, orig } = choose(ctx, [4, 5, 3, 2]);
  const s = bs(b);
  const ladder = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  const jump = [5, 6, 7, 8, 12, 13, 14, 15];
  return {
    key: 'E2',
    module: 'E',
    num: 2,
    title: 'Lagenwechsel',
    focus: 'accuracy',
    intro: `Eine Saite, Finger 1–2–3–4 pro Lage. Beim Wechsel springt die ganze Hand, der Zeigefinger landet genau auf dem neuen Bund – ohne Rutschgeräusch und ohne Pause. Saite: ${STRING_LONG[s]}.`,
    variant: orig ? undefined : `auf der ${STRING_DAT[s]}`,
    phases: [
      { label: 'Minute 1', seconds: 60, sub: 2, text: 'Alle vier Töne eine Lage weiter: Bund 1–4, 5–8, 9–12 und zurück.', pattern: [...ladder, ...[...ladder].reverse()].map((f) => n(s, f)) },
      { label: 'Minute 2', seconds: 60, sub: 2, text: 'Großer Sprung: Bund 5–8, dann direkt 12–15 und zurück. Den Zielbund vorher anschauen, dann ohne Hinsehen treffen.', pattern: [...jump, ...[...jump].reverse()].map((f) => n(s, f)) },
    ],
    tracksTempo: true,
  };
}

function e3(ctx: BuildCtx): Exercise {
  const sc = ctx.scale;
  const steps = sc.intervals.slice(0, 4);
  // Octave two strings up: Drop C low + middle C string (same fret), else G + F string (two frets up).
  const octave = (lo: number) => ({ lo, hi: lo + 2, base: midiToPc(sc.root - TUNING[lo]), up: 12 - (TUNING[lo + 2] - TUNING[lo]) });
  const first = octave(0);
  const shape = first.base + steps[3] + first.up <= 16 ? first : octave(1);
  const pair = (k: number): Step[] => [n(shape.lo, shape.base + steps[k]), n(shape.hi, shape.base + steps[k] + shape.up)];
  const names = steps.map((i) => noteName(sc.root + i)).join('–');
  const where = shape.up === 0 ? 'im selben Bund' : `${shape.up} Bünde höher`;
  return {
    key: 'E3',
    module: 'E',
    num: 3,
    title: 'Oktaven',
    focus: 'accuracy',
    intro: `Oktavgriff: Ton auf der ${STRING_DAT[shape.lo]}, die Oktave ${where} auf der ${STRING_DAT[shape.hi]}. Die ${STRING_LONG[shape.lo + 1]} dazwischen ${shape.up === 0 ? 'mit dem Zeigefinger ' : ''}abdämpfen. Töne: ${names} aus ${sc.name}. Erst gebrochen spielen, später gern beide Töne zusammen.`,
    phases: [
      { label: 'Minute 1', seconds: 60, sub: 2, text: `Gebrochene Oktaven aufwärts und abwärts: ${names}.`, pattern: [0, 1, 2, 3, 3, 2, 1, 0].flatMap(pair) },
      { label: 'Minute 2', seconds: 60, sub: 2, text: 'Sprünge 1-3-2-4 und zurück – die Hand landet ohne Hinsehen auf dem richtigen Bund.', pattern: [0, 2, 1, 3, 3, 1, 2, 0].flatMap(pair) },
    ],
    tracksTempo: true,
  };
}

function e4(ctx: BuildCtx): Exercise {
  const sc = ctx.scale;
  return {
    key: 'E4',
    module: 'E',
    num: 4,
    title: 'Griffbrett-Treffer',
    focus: 'accuracy',
    intro: `Die App nennt einen Ton aus ${sc.name} und eine Saite – du findest ihn so schnell wie möglich. Mit Mikrofon prüft die App selbst. Wer die Töne auf dem Griffbrett kennt, verliert sich in keiner Tonart.`,
    phases: [{ label: '2 Minuten', seconds: 120, sub: 2, text: 'Ton finden, spielen, laut benennen. Gezählt wird der erste Versuch.', widget: 'notes', metronome: false }],
    tracksTempo: false,
    scaleId: sc.id,
    root: sc.root,
  };
}

// ---------------------------------------------------------------------------
// E · Legato und Sweep-Picking: Triller, drei Töne pro Saite, Dreiklänge und
// Arpeggios. Die oberen fünf Saiten sind in jeder Stimmung wie A D G H e
// gestimmt, die Griffe werden trotzdem aus der Stimmung berechnet.
// ---------------------------------------------------------------------------

function e5(ctx: BuildCtx): Exercise {
  const { v, orig } = choose(ctx, [
    { b: 4, base: 5 },
    { b: 5, base: 5 },
    { b: 3, base: 7 },
    { b: 4, base: 8 },
  ]);
  const s = bs(v.b);
  // One bar of sixteenths: pick the first note, then hammer-on / pull-off only.
  const trill = (a: number, b: number): Step[] => {
    const [fa, fb] = [v.base + a - 1, v.base + b - 1];
    return Array.from({ length: 16 }, (_, i) => (i === 0 ? n(s, fa) : i % 2 ? n(s, fb, 'h') : n(s, fa, 'p')));
  };
  return {
    key: 'E5',
    module: 'E',
    num: 5,
    title: 'Triller',
    focus: 'speed',
    intro: `Nur den ersten Ton jedes Takts anschlagen, danach hält die Greifhand die Saite allein am Klingen: Hammer-on, Pull-off, Hammer-on … Beim Pull-off zupft der Finger die Saite leicht seitlich an, sonst wird der Ton leiser. Ein Finger pro Bund ab Bund ${v.base} auf der ${STRING_DAT[s]}; die Anschlaghand dämpft die übrigen Saiten.`,
    variant: orig ? undefined : `auf der ${STRING_DAT[s]} ab Bund ${v.base}`,
    phases: [
      { label: 'Minute 1', seconds: 60, sub: 4, text: 'Finger 1–2, 1–3, 1–4 – je ein Takt Sechzehntel.', pattern: [...trill(1, 2), ...trill(1, 3), ...trill(1, 4)] },
      {
        label: 'Minute 2',
        seconds: 60,
        sub: 4,
        text: 'Die schwächeren Finger: 2–3, 2–4, 3–4. So laut und gleichmäßig wie in Minute 1. Wenn die Hand brennt, kurz lockern.',
        pattern: [...trill(2, 3), ...trill(2, 4), ...trill(3, 4)],
      },
    ],
    tracksTempo: true,
  };
}

function e6(ctx: BuildCtx): Exercise {
  const sc = ctx.scale;
  const { v, orig } = choose(ctx, [4, 3, 2]);
  const [lo, hi] = [bs(v), bs(v + 1)];
  // Start on the tonic when it sits low on the lower string, else the first scale note from fret 5.
  const r = midiToPc(sc.root - TUNING[lo]);
  const g = twoStringGroup(sc, lo, hi, r >= 2 && r <= 7 ? r : 5);
  const [l0, l1, l2] = g.low;
  const [h0, h1, h2] = g.high;
  // Two picks per pass (first and top note); string changes are hammer-ons from nowhere.
  const roll: Step[] = [
    n(l0.s, l0.f), n(l1.s, l1.f, 'h'), n(l2.s, l2.f, 'h'), n(h0.s, h0.f, 'h'), n(h1.s, h1.f, 'h'), n(h2.s, h2.f, 'h'),
    n(h2.s, h2.f), n(h1.s, h1.f, 'p'), n(h0.s, h0.f, 'p'), n(l2.s, l2.f, 'h'), n(l1.s, l1.f, 'p'), n(l0.s, l0.f, 'p'),
  ];
  const on = (ps: Pos[]) => `${STRING_SHORT[ps[0].s]} ${fretsTxt(ps)} (Finger ${fingering(ps.map((p) => p.f))})`;
  return {
    key: 'E6',
    module: 'E',
    num: 6,
    title: 'Legato: drei Töne pro Saite',
    focus: 'accuracy',
    intro: `Drei Töne pro Saite aus ${sc.name}: ${on(g.low)}, ${on(g.high)}. Pro Durchgang nur zwei Anschläge – auf dem ersten und auf dem obersten Ton. Der Saitenwechsel ist ein Hammer-on „aus dem Nichts“: Der Finger trifft die neue Saite so kräftig, dass sie ohne Plektrum klingt.`,
    variant: orig ? undefined : `Saiten ${pairName(lo, hi)}`,
    phases: [
      { label: 'Minute 1', seconds: 60, sub: 2, text: 'Achtel. Alle Töne gleich laut – vor allem der Hammer-on auf der neuen Saite.', pattern: [...roll, ...roll] },
      {
        label: 'Minute 2',
        seconds: 60,
        sub: 3,
        text: 'Triolen: ein Durchgang pro Takt. Die Anschlaghand dämpft die tieferen Saiten, freie Finger der Greifhand die höheren.',
        pattern: roll,
      },
    ],
    tracksTempo: true,
    scaleId: sc.id,
    root: sc.root,
  };
}

/** Third and fifth of a triad in semitones above its root. */
const chordSteps = (c: Chord) => ({ third: midiToPc(c.pcs[1] - c.root), fifth: midiToPc(c.pcs[2] - c.root) });

/** The day's tonic chord, or with variation another major/minor chord of the progression. */
function sweepChord(ctx: BuildCtx) {
  const others = (ctx.progression ?? []).filter((c) => c.degree !== 0 && (c.quality === 'maj' || c.quality === 'min'));
  return choose(ctx, [triad(ctx.scale, 0), ...others]);
}

/** Fret on string `s` for a note `semis` above `rootFret` on string `base`. */
const above = (base: number, rootFret: number, s: number, semis: number) => rootFret + semis - (TUNING[s] - TUNING[base]);

function e7(ctx: BuildCtx): Exercise {
  const { v: c, orig } = sweepChord(ctx);
  const { third, fifth } = chordSteps(c);
  const [g, b, e] = [TOP - 2, TOP - 1, TOP];
  // Root on the third string from the top, at least fret 3 so the lower frets stay on the neck.
  const r = midiToPc(c.root - TUNING[g]) < 3 ? midiToPc(c.root - TUNING[g]) + 12 : midiToPc(c.root - TUNING[g]);
  const [fb, fe, fo] = [above(g, r, b, third), above(g, r, e, fifth), above(g, r, e, 12)];
  const two: Step[] = [picked(b, fb, 'down'), picked(e, fe, 'down'), picked(e, fo, 'up'), picked(b, fb, 'up')];
  const three: Step[] = [picked(g, r, 'down'), picked(b, fb, 'down'), picked(e, fe, 'down'), n(e, fo, 'h'), n(e, fe, 'p'), picked(b, fb, 'up')];
  return {
    key: 'E7',
    module: 'E',
    num: 7,
    title: 'Sweep-Picking',
    focus: 'accuracy',
    intro: `Beim Sweep fällt das Plektrum in einer Bewegung durch mehrere Saiten (⊓ = Abschlag, V = Aufschlag) – wie ein langsamer Akkordanschlag, nur dass jeder Ton allein klingt. Dazu hebt der Greiffinger ab, sobald der nächste Ton kommt. Dreiklang ${c.name}: ${STRING_SHORT[g]} ${r}, ${STRING_SHORT[b]} ${fb}, ${STRING_SHORT[e]} ${fe} und ${fo}.`,
    variant: orig ? undefined : `Dreiklang ${c.name} (${c.roman})`,
    phases: [
      {
        label: 'Minute 1',
        seconds: 60,
        sub: 2,
        text: `Zwei Saiten: ein Abschlag durch ${STRING_SHORT[b]} und ${STRING_SHORT[e]}, auf dem Rückweg ein Aufschlag durch ${STRING_SHORT[e]} und ${STRING_SHORT[b]}. Das Plektrum drückt durch, statt jede Saite einzeln zu zupfen.`,
        pattern: [...two, ...two],
      },
      {
        label: 'Minute 2',
        seconds: 60,
        sub: 3,
        text: `Drei Saiten als Triolen: ein Abschlag durch alle drei, oben Hammer-on und Pull-off, zurück mit Aufschlag auf der ${STRING_DAT[b]}. Kein Ton darf mit dem nächsten zusammenklingen.`,
        pattern: [...three, ...three],
      },
    ],
    tracksTempo: true,
  };
}

function e8(ctx: BuildCtx): Exercise {
  const { v: c, orig } = sweepChord(ctx);
  const { third, fifth } = chordSteps(c);
  const [a, d, g, b, e] = [TOP - 4, TOP - 3, TOP - 2, TOP - 1, TOP];
  // Root on the fifth string from the top; fret 12 instead of the open string.
  const r = midiToPc(c.root - TUNING[a]) || 12;
  const at = (s: number, semis: number) => above(a, r, s, semis);
  const [fa3, fd, fg, fb, fe, fo] = [r + third, at(d, fifth), at(g, 12), at(b, 12 + third), at(e, 12 + fifth), at(e, 24)];
  // Up with downstrokes, top note by hammer-on, back down with upstrokes: one pass = 12 notes.
  const sweep: Step[] = [
    picked(a, r, 'down'), n(a, fa3, 'h'), picked(d, fd, 'down'), picked(g, fg, 'down'), picked(b, fb, 'down'), picked(e, fe, 'down'),
    n(e, fo, 'h'), n(e, fe, 'p'), picked(b, fb, 'up'), picked(g, fg, 'up'), picked(d, fd, 'up'), picked(a, fa3, 'up'),
  ];
  return {
    key: 'E8',
    module: 'E',
    num: 8,
    title: 'Sweep-Arpeggio',
    focus: 'speed',
    intro: `Arpeggio ${c.name} über fünf Saiten, Grundton ${noteName(c.root)} auf der ${STRING_DAT[a]} (Bund ${r}). Aufwärts nur Abschläge, abwärts nur Aufschläge; auf der untersten und obersten Saite des Arpeggios verbinden Hammer-on und Pull-off. Beim Wiederholen wird der erste Ton zum Pull-off. Jeder Ton einzeln – die Greifhand dämpft, was nicht klingen soll.`,
    variant: orig ? undefined : `Arpeggio ${c.name} (${c.roman})`,
    phases: [
      { label: 'Minute 1', seconds: 60, sub: 2, text: 'Achtel. Langsam genug, dass jeder Ton gleich laut und getrennt klingt.', pattern: [...sweep, ...sweep] },
      { label: 'Minute 2', seconds: 60, sub: 3, alt: 2, text: 'Triolen: ein Durchgang pro Takt. Nur wenn Minute 1 sauber war – sonst bei Achteln bleiben.', pattern: sweep },
    ],
    tracksTempo: true,
  };
}

// ---------------------------------------------------------------------------
// R · Rhythmus & Timing: Palm-Mute-Riffs auf dem Grundton des Tages.
// ---------------------------------------------------------------------------

/** A note every `k` steps, short (palm-muted) in between. */
const every = (len: number, k: number, note: Note): Step[] => Array.from({ length: len }, (_, i) => (i % k === 0 ? note : 'rest'));
const times = (k: number, steps: Step[]): Step[] => Array.from({ length: k }, () => steps).flat();

function rootChug(ctx: BuildCtx) {
  const f = midiToPc(ctx.scale.root - TUNING[0]);
  const [, fifth, oct] = powerGrip(null, 0, f).map((p) => n(p.s, p.f));
  return { f, r: noteName(ctx.scale.root), low: n(0, f), fifth, oct };
}

function r1(ctx: BuildCtx): Exercise {
  const { r, low } = rootChug(ctx);
  return {
    key: 'R1',
    module: 'R',
    num: 1,
    title: 'Unterteilungen',
    focus: 'rhythm',
    intro: `Palm-Mute auf dem tiefen ${r}: Handballen leicht auf den Saiten am Steg. Der Klick bleibt gleich, nur die Unterteilung ändert sich. Laut mitzählen hilft.`,
    phases: [
      { label: 'Minute 1', seconds: 60, sub: 4, text: 'Je ein Takt Viertel, Achtel, Sechzehntel, Achtel – ohne Pause dazwischen.', pattern: [...every(16, 4, low), ...every(16, 2, low), ...every(16, 1, low), ...every(16, 2, low)] },
      { label: 'Minute 2', seconds: 60, sub: 3, text: 'Viertel und Triolen im Wechsel. Zählen: „eins-te-le zwei-te-le“.', pattern: [...every(12, 3, low), ...every(12, 1, low)] },
      { label: 'Minute 3', seconds: 60, sub: 4, text: 'Rückwärts: Sechzehntel, Achtel, Viertel, Achtel. Der Puls darf beim Wechsel nicht wackeln.', pattern: [...every(16, 1, low), ...every(16, 2, low), ...every(16, 4, low), ...every(16, 2, low)] },
    ],
    tracksTempo: true,
  };
}

function r2(ctx: BuildCtx): Exercise {
  const { r, f, low, fifth, oct } = rootChug(ctx);
  const same = fifth.f === f && oct.f === f;
  const gallop = (x: Note): Step[] => [x, 'rest', x, x];
  const reverse = (x: Note): Step[] => [x, x, x, 'rest'];
  return {
    key: 'R2',
    module: 'R',
    num: 2,
    title: 'Gallop',
    focus: 'rhythm',
    intro: `Der Metal-Klassiker: eine Achtel und zwei Sechzehntel pro Schlag („Ta-ka-ta“). Palm-Mute auf dem tiefen ${r} (Bund ${f}); Abschlag – Abschlag – Aufschlag oder alles im Wechselschlag.`,
    phases: [
      { label: 'Minute 1', seconds: 60, sub: 4, text: 'Gallop: Achtel + zwei Sechzehntel auf jedem Schlag.', pattern: times(8, gallop(low)) },
      { label: 'Minute 2', seconds: 60, sub: 4, text: 'Umgekehrter Gallop: zwei Sechzehntel + Achtel.', pattern: times(8, reverse(low)) },
      {
        label: 'Minute 3',
        seconds: 60,
        sub: 4,
        text: same
          ? `Riff: zwei Schläge auf dem tiefen ${r}, dann Quinte (${STRING_LONG[1]}) und Oktave (${STRING_LONG[2]}) – im selben Bund.`
          : `Riff: zwei Schläge auf dem tiefen ${r}, dann Quinte (${STRING_LONG[1]}, Bund ${fifth.f}) und Oktave (${STRING_LONG[2]}, Bund ${oct.f}).`,
        pattern: times(2, [...gallop(low), ...gallop(low), ...gallop(fifth), ...gallop(oct)]),
      },
    ],
    tracksTempo: true,
  };
}

function r3(ctx: BuildCtx): Exercise {
  const { r, low } = rootChug(ctx);
  const at = (len: number, hits: number[]): Step[] => Array.from({ length: len }, (_, i) => (hits.includes(i) ? low : 'rest'));
  return {
    key: 'R3',
    module: 'R',
    num: 3,
    title: 'Offbeats & Synkopen',
    focus: 'rhythm',
    intro: `Töne zwischen den Klicks. Die Anschlaghand läuft trotzdem durchgehend weiter (Luftschläge auf den Pausen) – dann sitzen die Synkopen von allein. Palm-Mute auf dem tiefen ${r}.`,
    phases: [
      { label: 'Minute 1', seconds: 60, sub: 2, text: 'Nur auf „und“ spielen – auf den Klicks Pause (Aufschlag).', pattern: times(8, ['rest', low]) },
      { label: 'Minute 2', seconds: 60, sub: 2, text: 'Tresillo 3 + 3 + 2: Töne auf 1, auf „2 und“ und auf 4.', pattern: times(2, at(8, [0, 3, 6])) },
      { label: 'Minute 3', seconds: 60, sub: 4, text: 'Sechzehntel-Synkope 3 + 3 + 3 + 3 + 4 – typisches Metal-Riff-Raster.', pattern: times(2, at(16, [0, 3, 6, 9, 12])) },
    ],
    tracksTempo: true,
  };
}

function r4(ctx: BuildCtx): Exercise {
  const { r, low } = rootChug(ctx);
  return {
    key: 'R4',
    module: 'R',
    num: 4,
    title: 'Stopps & Abdämpfen',
    focus: 'rhythm',
    intro: `Pausen sind Teil des Riffs. Zum Abdämpfen die Greifhand leicht lösen und die Anschlaghand auf die Saiten legen – exakt auf dem Schlag, ohne Nachklingen. Tiefes ${r}.`,
    phases: [
      { label: 'Minute 1', seconds: 60, sub: 2, text: 'Auf 1 und 3 anschlagen, auf 2 und 4 exakt stoppen.', pattern: times(2, [low, 'hold', 'rest', 'rest', low, 'hold', 'rest', 'rest']) },
      { label: 'Minute 2', seconds: 60, sub: 2, text: 'Kurze Stopps im Achtelraster: „1 und – – 3 – 4 –“.', pattern: times(2, [low, low, 'rest', 'rest', low, 'rest', low, 'rest']) },
      { label: 'Minute 3', seconds: 60, sub: 2, text: 'Ein Takt Achtel, im nächsten nur die Eins – danach absolute Stille bis zur nächsten Eins.', pattern: [...times(8, [low]), low, ...rests(7)] },
    ],
    tracksTempo: true,
  };
}

// ---------------------------------------------------------------------------
// K · Akkordfolge des Tages (in der Tonart der Skala) und
// I · Anwenden: über genau diese Folge mit der Skala improvisieren.
// ---------------------------------------------------------------------------

/** "zwei Bünde höher", "im selben Bund" … */
const frets = (d: number) => (d === 0 ? 'im selben Bund' : `${['', 'einen Bund', 'zwei Bünde', 'drei Bünde'][d] ?? `${d} Bünde`} höher`);

/** Where fifth and octave sit for a power chord with the root on string `s`. */
function powerWhere(s: number) {
  const [, q, o] = powerGrip(null, s, 5).map((p) => p.f - 5);
  return `Quinte ${frets(q)} (${STRING_LONG[s + 1]}), Oktave ${frets(o)} (${STRING_LONG[s + 2]})`;
}

function voicingText(v: Voicing): string {
  const [g, h, e] = [TOP - 2, TOP - 1, TOP].map((s) => STRING_SHORT[s]);
  switch (v) {
    case 'power':
      return isDrop(CURRENT)
        ? `Powerchords: In ${CURRENT.name} greift ein Finger quer über die drei tiefen Saiten im selben Bund. Jeder Griff hat drei Töne – ${STRING_LONG[0]} Grundton, ${STRING_LONG[1]} Quinte, ${STRING_LONG[2]} Oktave. Die übrigen Saiten mit der Greifhand dämpfen.`
        : `Powerchords auf den drei tiefen Saiten: Grundton auf der ${STRING_DAT[0]}, ${powerWhere(0)}. Die übrigen Saiten mit der Greifhand dämpfen.`;
    case 'power-mix':
      return `Powerchords mit kurzen Wegen: Der Grundton liegt auf der ${STRING_DAT[0]}, der ${STRING_DAT[1]} oder der ${STRING_DAT[2]} – je nachdem, was näher liegt. Grundton auf der ${STRING_DAT[1]}: ${powerWhere(1)}. Grundton auf der ${STRING_DAT[2]}: ${powerWhere(2)}.`;
    case 'triad':
      return `Dreiklänge auf ${g}-, ${h}- und ${e}-Saite${g === 'G' && h === 'H' ? '' : ' (wie G-, H- und e-Saite in Standardstimmung)'}. Genau drei Töne, die tiefen Saiten bleiben stumm. Angezeigt ist jeweils der Griff, der dem vorigen am nächsten liegt.`;
  }
}

function chordPhase(label: string, slots: ChordSlot[], beatsPer: number, text: string, opts: { backing?: boolean; hide?: boolean } = {}): Phase {
  return { label, seconds: 120, sub: 2, text, chords: { slots, beatsPer, hide: opts.hide }, backing: opts.backing };
}

function k1(ctx: BuildCtx): Exercise {
  const prog = ctx.progression ?? [];
  const v = (x: Voicing) => voiceProgression(prog, x);
  const stage = ctx.stage ?? 'learn';
  const phases: Phase[] =
    stage === 'learn'
      ? [
          chordPhase('Kennenlernen', v('power'), 8, 'Jeder Akkord zwei Takte, auf jeden Schlag einmal anschlagen. Vor dem Wechsel schon an den nächsten Griff denken.'),
          chordPhase('Im Takt', v('power'), 4, 'Ein Takt pro Akkord, Achtel mit Palm-Mute. Gewechselt wird genau auf der Eins.'),
          chordPhase('Mitspielen', v('power'), 4, 'Die App spielt die Folge mit. Klingt dein Akkord mit der Begleitung zusammen?', { backing: true }),
        ]
      : stage === 'deepen'
        ? [
            chordPhase('Dreiklänge', v('triad'), 8, 'Dieselbe Folge als Dreiklänge oben. Jeden Griff erst einzeln klingen lassen – alle drei Töne müssen hörbar sein.'),
            chordPhase('Im Takt', v('triad'), 4, 'Ein Takt pro Akkord, Viertel anschlagen. Finger, die liegen bleiben können, liegen lassen.'),
            chordPhase('Schnelle Wechsel', v('triad'), 2, 'Halber Takt pro Akkord, mit Begleitung.', { backing: true }),
          ]
        : [
            chordPhase('Kurze Wege', v('power-mix'), 4, 'Powerchords mit wechselnder Grundton-Saite – die Hand bleibt in einer Lage, statt über den Hals zu springen.'),
            chordPhase('Auswendig', v('triad'), 4, 'Griffe abgedeckt: die Dreiklänge aus dem Kopf. Nur bei Unsicherheit aufdecken.', { hide: true }),
            chordPhase('Groove', v('power-mix'), 2, 'Zwei Schläge pro Akkord, Achtel-Palm-Mute, Akzent auf jedem Wechsel. Mit Begleitung.', { backing: true }),
          ];
  const first = stage === 'deepen' ? 'triad' : stage === 'apply' ? 'power-mix' : 'power';
  return {
    key: 'K1',
    module: 'K',
    num: 1,
    title: 'Akkordfolge',
    focus: 'chords',
    intro: `${romanText(prog)} in ${noteName(ctx.scale.root)}: ${namesText(prog)}. Die römischen Zahlen zeigen, auf welcher Stufe der Tonart ein Akkord steht (klein = Moll, groß = Dur) – nicht die Töne im Griff. Dieselbe Folge klingt so in jeder Tonart gleich. ${voicingText(first)}`,
    phases,
    tracksTempo: true,
  };
}

function i1(ctx: BuildCtx): Exercise {
  const sc = ctx.scale;
  const prog = ctx.progression ?? [];
  // Backing: triads on top plus the chord root on the low string.
  const slots = voiceProgression(prog, 'triad').map((sl) => ({ ...sl, midis: [TUNING[0] + midiToPc(sl.pcs[0] - TUNING[0]), ...sl.midis] }));
  const chords = { slots, beatsPer: 4, highlight: true };
  const path = sixStringPath(sc);
  return {
    key: 'I1',
    module: 'I',
    num: 1,
    title: 'Improvisieren',
    focus: 'creativity',
    intro: `Jetzt kommt alles zusammen: ${sc.name} über ${namesText(prog)}. Die App spielt die Akkorde, du improvisierst im Griffbild der Skala. Ziel sind Phrasen, die auf Tönen des aktuellen Akkords landen.`,
    map: mapAround(sc, path, `Gold = Grundton ${noteName(sc.root)} · Türkis = Töne des aktuellen Akkords`),
    phases: [
      {
        label: 'Akkordtöne',
        seconds: 60,
        sub: 2,
        text: 'Auf jeder Eins einen Ton des aktuellen Akkords (türkis) spielen und klingen lassen. Dazwischen frei – zum Wechsel wieder auf einem Akkordton landen.',
        chords,
        backing: true,
      },
      { label: 'Frei', seconds: 120, sub: 2, text: 'Eigene Phrasen über die Begleitung. Pausen gehören dazu.', chords, backing: true },
    ],
    tracksTempo: false,
    prompts: prompts(ctx, 1),
    scaleId: sc.id,
    root: sc.root,
  };
}

export const MODULE_INFO = {
  A: { name: 'Zwei hohe Saiten', short: 'Kontrolle, Legato, Bursts, Phrasen' },
  B: { name: 'Alle Saiten', short: 'Saitenwechsel, Sprünge, Moll-Griffbild' },
  C: { name: 'Skalen verstehen', short: 'Hören, finden, benutzen' },
  D: { name: 'Polyrhythmus', short: '3:2, 2:3, 4:3, 3:4, Gruppen über 4/4' },
  E: { name: 'Zusatz-Technik', short: 'Tremolo, Lagenwechsel, Oktaven, Griffbrett, Legato, Sweep-Picking' },
  R: { name: 'Rhythmus', short: 'Unterteilungen, Gallop, Synkopen, Stopps' },
  W: { name: 'Riff der Woche', short: 'Ein Riff pro Woche: lernen, zusammensetzen, Tempo, auswendig' },
  K: { name: 'Akkorde', short: 'Powerchords und Dreiklänge' },
  I: { name: 'Improvisation', short: 'Über die Akkordfolge spielen' },
} as const;

/** The daily 30 minutes, in playing order. */
export const BLOCK_INFO: Record<BlockId, { name: string; minutes: number; short: string }> = {
  speed: { name: 'Geschwindigkeit', minutes: 4, short: 'Wechselschlag, Bursts, Legato, Sweeps – das Tempo wächst mit' },
  accuracy: { name: 'Treffsicherheit', minutes: 4, short: 'Saitensprünge, Lagenwechsel, Oktaven, Legato, Sweeps' },
  rhythm: { name: 'Rhythmus & Timing', minutes: 3, short: 'Unterteilungen, Gallop, Synkopen, Polyrhythmen' },
  riff: { name: 'Riff der Woche', minutes: 4, short: 'Ein Riff pro Woche – jede Lektion ein Schritt weiter' },
  scale: { name: 'Skala', minutes: 6, short: 'Hören, finden, alle Lagen – in wechselnden Tonarten' },
  chords: { name: 'Akkordfolge', minutes: 6, short: 'Powerchords und Dreiklänge sauber wechseln' },
  improv: { name: 'Anwenden', minutes: 3, short: 'Mit der Skala über die Akkordfolge improvisieren' },
};

export const BLOCK_ORDER = Object.keys(BLOCK_INFO) as BlockId[];

/** Single-exercise builders by key, for the daily rotation. */
export const BUILDERS: Record<string, (ctx: BuildCtx) => Exercise> = {
  A1: a1,
  A2: a2,
  A3: a3,
  A4: a4,
  A5: a5,
  A6: a6,
  B1: b1,
  B2: b2,
  B4: (ctx) => b4(ctx, minorShape(ctx)),
  B5: (ctx) => b5(ctx, minorShape(ctx)),
  D1: d1,
  D2: d2,
  D3: d3,
  D4: d4,
  E1: e1,
  E2: e2,
  E3: e3,
  E4: e4,
  E5: e5,
  E6: e6,
  E7: e7,
  E8: e8,
  R1: r1,
  R2: r2,
  R3: r3,
  R4: r4,
  K1: k1,
  I1: i1,
};

/** Every note in a pattern, for validation. */
export function patternNotes(steps: Step[] | undefined): Note[] {
  return (steps ?? []).filter((s): s is Note => typeof s === 'object');
}

