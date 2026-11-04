// Riff der Woche: one riff per calendar week, played every lesson of that
// week – listen and learn it in parts, put it together, bring it up to tempo,
// play it from memory. All riffs are original and sit on the lowest strings.
//
// Notation (one token per grid step, bars separated by "|" for readability):
//   0 … 15   single note, semitones above the open lowest string (on that string)
//   7@1      the same, played on string 1 (counted from the lowest = 0)
//   P5       power chord, root 5 semitones above the open lowest string
//   P10@1    power chord with the root on string 1
//   suffix m = palm mute, h = hammer-on, p = pull-off, ~ = vibrato
//   -        previous note rings on      .  rest
// Pitches are relative to the open lowest string, so a riff sounds the same in
// every tuning (in its key); frets and grips follow from the tuning.

import type { TabEvent } from '../audio/engine';
import { powerGrip } from '../music/chords';
import { barSteps } from '../music/meter';
import { STRING_LONG, STRING_SHORT, TUNING, fretMidi, midiToPc } from '../music/theory';
import type { BuildCtx } from './exercises';
import type { Exercise, Note, Phase, Step, Tech } from './types';

export interface RiffDef {
  name: string;
  style: string;
  /** Scale (card id) the riff's notes come from, with the open lowest string as tonic. */
  scale: string;
  /** Grid steps per beat (4 = sixteenths, 3 = triplets). */
  sub: number;
  /** Tempo the riff is meant for. */
  target: number;
  /** What to listen and watch for. */
  focus: string;
  /** Every note a downstroke. */
  downstrokes?: boolean;
  steps: string;
}

/** Ordered from easy to hard; one per week, then the list starts over. */
export const RIFFS: RiffDef[] = [
  {
    name: 'Erster Chug',
    style: 'Metal-Grundlage: gedämpfte Achtel und Powerchords',
    scale: 'aeolian',
    sub: 4,
    target: 120,
    focus: 'Palm-Mute gleichmäßig: Der Handballen bleibt liegen und hebt nur für die Powerchords ab. Die Akkorde klingen voll bis zum nächsten Anschlag.',
    steps: '0m - 0m - 0m - 0m - P3 - - - P5 - - - | 0m - 0m - 0m - 0m - P7 - - - P5 - P3 -',
  },
  {
    name: 'Stopp & Go',
    style: 'Hardcore-Riff mit harten Stopps',
    scale: 'aeolian',
    sub: 4,
    target: 110,
    focus: 'Die Pausen gehören zum Riff: Greifhand lockern und die Anschlaghand auf die Saiten legen – genau auf der Zählzeit, ohne Nachklingen.',
    steps: 'P0 - - . . . P0 - . . P0 . P3 - P5 . | P0 - - . . . P0 - . . P0 . P8 - - -',
  },
  {
    name: 'Doom-Walze',
    style: 'Doom: langsam, schwer, ausklingende Akkorde',
    scale: 'phrygian',
    sub: 4,
    target: 90,
    focus: 'Langsam ist schwer: Jeden Akkord voll ausklingen lassen und erst auf der Zählzeit wechseln. Das Vibrato kommt aus der ganzen Hand.',
    steps: 'P0 - - - - - - - P1 - - - - - - - | P0 - - - - - - - P3 - - - P1~ - - -',
  },
  {
    name: 'Gallop-Maschine',
    style: 'Heavy Metal: der klassische Gallop',
    scale: 'aeolian',
    sub: 4,
    target: 130,
    focus: 'Gallop gleichmäßig: lang – kurz – kurz. Abschlag – Abschlag – Aufschlag oder durchgehend Wechselschlag, aber jede Lektion gleich.',
    steps: '0m - 0m 0m 0m - 0m 0m 0m - 0m 0m P3 - P5 - | 0m - 0m 0m 0m - 0m 0m P8 - - - P7 - - -',
  },
  {
    name: 'Einzelton-Lauf',
    style: 'Groove Metal: Melodie aus Chugs heraus',
    scale: 'aeolian',
    sub: 4,
    target: 110,
    focus: 'Saitenwechsel ohne Lücke. Nur die Chugs auf der tiefen Saite sind gedämpft, die Melodietöne klingen voll.',
    steps: '0m 0m 3 0m 0m 5 0m 0m 7@1 - 8@1 - 7@1 - 5 - | 0m 0m 3 0m 0m 5 0m 0m 10@1 - 8@1 - 7@1 - 3 -',
  },
  {
    name: 'Halbton-Drohung',
    style: 'Death Metal: phrygische Spannung',
    scale: 'phrygian',
    sub: 4,
    target: 120,
    focus: 'Der Halbton über dem Grundton (♭2) macht die Spannung. Die Chugs kurz und gedämpft, die gegriffenen Töne voll klingen lassen.',
    steps: '0m 0m 1 - 0m 0m 3 - 0m 0m 1 - 0m 0m 5 - | 0m 0m 1 - 0m 0m 3 - 0m 0m 7@1 - 5 - 3 -',
  },
  {
    name: 'Triolen-Stampfer',
    style: 'Metal im Triolen-Feel',
    scale: 'aeolian',
    sub: 3,
    target: 100,
    focus: 'Drei Anschläge pro Klick, laut zählen: „eins-te-le zwei-te-le“. Im Wechselschlag beginnt jeder zweite Schlag mit einem Aufschlag – nicht aus dem Takt bringen lassen.',
    steps: '0m 0m 0m 0m 0m 0m P5 - - P3 - - | 0m 0m 0m 0m 0m 0m P7 - P8 P7 - -',
  },
  {
    name: 'Legato-Chug',
    style: 'Metalcore: Chugs mit Legato-Figuren',
    scale: 'aeolian',
    sub: 4,
    target: 110,
    focus: 'Hammer-on und Pull-off ohne neuen Anschlag – sie müssen so laut klingen wie die angeschlagenen Töne. Die Chugs dazwischen bleiben kurz.',
    steps: '0m 0m 2 3h 0m 0m 5 3p 0m 0m 2 3h P5 - P3 - | 0m 0m 2 3h 0m 0m 7 5p 3p - 0m 0m P8 - P7 -',
  },
  {
    name: 'Thrash-Abschläge',
    style: 'Thrash: Achtel nur im Abschlag',
    scale: 'blues',
    sub: 4,
    target: 150,
    downstrokes: true,
    focus: 'Nur Abschläge (⊓). Die Bewegung kommt aus dem Handgelenk, der Unterarm bleibt locker. Wird es eng, lieber langsamer – Ausdauer im Abschlag wächst über Wochen.',
    steps: '0m - 0m - 0m - 0m - 3 - 0m - 5 - 0m - | 0m - 0m - 0m - 0m - P7 - P6 - P5 - P3 -',
  },
  {
    name: 'Synkopen-Groove',
    style: 'Djent und Groove: versetzte Chugs',
    scale: 'aeolian',
    sub: 4,
    target: 100,
    focus: 'Die Anschlaghand läuft in Sechzehnteln durch, auch über die Pausen (Luftschläge). Dann sitzen die versetzten Chugs von allein.',
    steps: '0m . 0m 0m . 0m . 0m 0m . 0m . P5 - - . | 0m . 0m 0m . 0m . 0m 0m . 0m . P3 - P2 .',
  },
  {
    name: 'Neoklassik-Riff',
    style: 'Neoklassik: Harmonisch Moll mit Leitton',
    scale: 'harmonic',
    sub: 4,
    target: 110,
    focus: 'Der Leitton (große Septime) zieht zum Grundton – genau hinhören. Die Chugs zwischen den Melodietönen kurz abdämpfen.',
    steps: '0m 0m 7@1 0m 0m 8@1 0m 0m 11@1 - 12@2 - 11@1 - 8@1 - | 0m 0m 7@1 0m 0m 8@1 0m 0m 7@1 - 5 - 3 - 2 -',
  },
  {
    name: 'Tremolo-Melodie',
    style: 'Black Metal: Melodie im Tremolo-Picking',
    scale: 'aeolian',
    sub: 4,
    target: 130,
    focus: 'Durchgehende Sechzehntel aus dem Handgelenk, klein und locker. Die Greifhand wechselt genau auf der Zählzeit, die Anschlaghand läuft einfach weiter.',
    steps: '7@1 7@1 7@1 7@1 8@1 8@1 8@1 8@1 10@1 10@1 10@1 10@1 8@1 8@1 8@1 8@1 | 7@1 7@1 7@1 7@1 5 5 5 5 3 3 3 3 5 5 5 5',
  },
  {
    name: 'Dreier über Vier',
    style: 'Progressive Metal: Dreiergruppen gegen den 4/4-Takt',
    scale: 'aeolian',
    sub: 4,
    target: 100,
    focus: 'Der Powerchord wandert mit jeder Dreiergruppe weiter. In Dreiern zählen und trotzdem den Klick hören – der vierte Takt bringt das Riff zurück auf die Eins.',
    steps: `${Array.from({ length: 20 }, () => 'P0 0m 0m').join(' ')} P5 - P3 -`,
  },
];

/** One token → one grid step on the current guitar. */
function parseToken(tok: string, down: boolean): Step {
  if (tok === '.') return 'rest';
  if (tok === '-') return 'hold';
  const m = /^(P?)(\d+)(?:@(\d))?([mhp~]*)$/.exec(tok);
  if (!m) throw new Error(`Riff: unbekanntes Zeichen „${tok}“`);
  const [, power, offset, string, mods] = m;
  const s = Number(string ?? 0);
  const f = Number(offset) - (TUNING[s] - TUNING[0]);
  const note: Note = { s, f };
  if (power) note.chord = powerGrip(null, s, f).slice(1);
  if (mods.includes('m')) note.pm = true;
  const t = mods.replace('m', '')[0] as Tech | undefined;
  if (t) note.t = t;
  if (down) note.stroke = 'down';
  return note;
}

/** The riff as bars of grid steps for the current tuning. */
export function riffBars(def: RiffDef): Step[][] {
  const steps = def.steps.split(/\s+/).filter((x) => x && x !== '|').map((x) => parseToken(x, !!def.downstrokes));
  const len = barSteps(def.sub);
  return Array.from({ length: Math.ceil(steps.length / len) }, (_, i) => steps.slice(i * len, (i + 1) * len));
}

/** What the app plays along: per grid step the sounding notes, how many steps they last, palm-muted or legato. */
export function riffEvents(steps: Step[]): (TabEvent | null)[] {
  return steps.map((st, i) => {
    if (typeof st !== 'object') return null;
    let len = 1;
    while (steps[i + len] === 'hold') len++;
    return { midis: [st, ...(st.chord ?? [])].map((p) => fretMidi(p.s, p.f)), len, pm: !!st.pm, legato: st.t === 'h' || st.t === 'p' };
  });
}

/** The riff of the week and which lesson of the week this is (0 = first). */
export interface RiffWeek {
  index: number;
  lesson: number;
}

export const RIFF_STAGES = ['Kennenlernen', 'Zusammensetzen', 'Tempo', 'Auswendig'] as const;

/** Riff block: 4 minutes, the task depends on the lesson within the week. */
export function riffBlock(ctx: BuildCtx): Exercise {
  const week = ctx.riff ?? { index: 0, lesson: 0 };
  const i = week.index % RIFFS.length;
  const def = RIFFS[i];
  const stage = Math.min(RIFF_STAGES.length - 1, week.lesson);
  const bars = riffBars(def);
  const all = bars.flat();
  const half = Math.ceil(bars.length / 2);
  const partA = bars.slice(0, half).flat();
  const partB = bars.slice(half).flat();
  const barsText = (a: number, b: number) => (a === b ? `Takt ${a}` : `Takt ${a}–${b}`);
  const ph = (label: string, seconds: number, text: string, pattern: Step[], extra: Partial<Phase> = {}): Phase => ({ label, seconds, sub: def.sub, text, pattern, ...extra });
  const phases: Phase[] = [
    [
      ph('Anhören', 60, 'Die App spielt das Riff vor (Vorspielen). Mitlesen und leise mitzählen, die Greifhand bewegt sich schon mit.', all, { demo: true }),
      ph(barsText(1, half), 90, `${barsText(1, half)} in Schleife. So langsam, dass jeder Ton sitzt – lieber das Tempo senken als Fehler einschleifen.`, partA),
      ph(barsText(half + 1, bars.length), 90, `${barsText(half + 1, bars.length)} in Schleife. Danach einmal beide Teile hintereinander.`, partB),
    ],
    [
      ph('Mitspielen', 60, 'Mit der App zusammen: Spiel genau gleichzeitig, als zweite Gitarre.', all, { demo: true }),
      ph('Allein', 120, 'Das ganze Riff allein mit Klick, bei der Wiederholung ohne Lücke weiter.', all),
      ph('Nahtstelle', 60, 'Letzter Takt → erster Takt: Hier stolpern die meisten. Die Stelle einzeln üben.', [...bars[bars.length - 1], ...bars[0]]),
    ],
    [
      ph('Arbeitstempo', 120, `Das ganze Riff im gespeicherten Tempo. Ziel: ${def.target} BPM – nur steigern, solange es locker bleibt.`, all),
      ph('Details', 120, def.focus, all),
    ],
    [
      ph('Auswendig', 120, 'Tab abgedeckt: aus dem Kopf spielen. Nur bei einer Lücke kurz aufdecken.', all, { hideTab: true }),
      ph('Durchspielen', 120, 'Wie auf der Bühne mit der App zusammen: Fehler nicht korrigieren, einfach im Takt weiterspielen.', all, { demo: true, hideTab: true }),
    ],
  ][stage];
  return {
    key: `W${i + 1}`,
    module: 'W',
    num: i + 1,
    title: `${def.name} · ${RIFF_STAGES[stage]}`,
    focus: 'rhythm',
    intro: `${def.style}. Grundton ist die leere ${STRING_LONG[0]} (${STRING_SHORT[0]}). ${def.focus} Zieltempo: ${def.target} BPM. Lektion ${week.lesson + 1} dieser Woche.`,
    phases,
    // The first lesson is for learning slowly; from then on the tempo grows with the ratings.
    tracksTempo: stage > 0,
    scaleId: def.scale,
    root: midiToPc(TUNING[0]),
  };
}
