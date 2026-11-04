import { MAJOR, NAT_MINOR as MINOR, inKey, noteName, type ScaleCard, type ScaleDef } from './theory';

// The first three minor colours come straight from the booklet (Modul C).
// The rest extend the repertoire in the same format. Cards are written in C;
// {1}, {b3}, {#4} … are degree tokens that become note names in the day's key.
export const CARDS: ScaleCard[] = [
  {
    id: 'dorian',
    name: 'C-Dorisch',
    intervals: [0, 2, 3, 5, 7, 9, 10],
    degrees: ['1', '2', '♭3', '4', '5', '6', '♭7'],
    color: [9],
    colorName: 'große Sexte',
    compare: 'Natürlich Moll: {b6}. Dorisch: {6}. Nur diese Stufe verändert sich.',
    feel: 'Moll, aber hell und offen – funky, jazzig, weniger düster.',
    listen: 'Spiele {5}–{6}–{5}–{4}–{1}. Lass das {6} einmal kurz und einmal länger stehen. Hör, wie sich die große Sexte gegen den Grundton {1} verhält.',
    motif: [[1, 5], [1, 7], [1, 8], [2, 7], [2, 9], [2, 7], [2, 5], [1, 5]],
    ref: { name: 'Moll', tone: 8 },
  },
  {
    id: 'phrygian',
    name: 'C-Phrygisch',
    intervals: [0, 1, 3, 5, 7, 8, 10],
    degrees: ['1', '♭2', '♭3', '4', '5', '♭6', '♭7'],
    color: [1],
    colorName: 'kleine Sekunde',
    compare: 'Natürlich Moll: {2}. Phrygisch: {b2}. Der Halbton direkt über {1} ist die entscheidende Farbe.',
    feel: 'Dunkel, gespannt, „spanisch“ – im Metal ein Klassiker für tiefe Riffs.',
    listen: 'Spiele {1}–{b2}–{1}, danach {b3}–{b2}–{1}. Halte {1} lang und die Nachbarn zunächst kurz. Danach {b2} absichtlich länger halten und die Reibung hören.',
    motif: [[1, 5], [1, 6], [1, 5], [1, 8], [1, 6], [1, 5]],
    ref: { name: 'Moll', tone: 2 },
  },
  {
    id: 'harmonic',
    name: 'C-Harmonisch-Moll',
    intervals: [0, 2, 3, 5, 7, 8, 11],
    degrees: ['1', '2', '♭3', '4', '5', '♭6', '7'],
    color: [11],
    colorName: 'große Septime',
    compare: 'Natürlich Moll: {b7}. Harmonisch Moll: {7} – der Leitton. Zwischen {b6} und {7} liegen drei Halbtöne.',
    feel: 'Neoklassisch, dramatisch – der Leitton zieht stark zum Grundton.',
    listen: 'Spiele {1}–{7}–{b6}–{7}–{1}. Höre besonders die Auflösung von {7} nach {1}. Das ist keine zusätzliche Note, sondern der Ersatz für {b7}.',
    motif: [[5, 10], [5, 9], [5, 6], [5, 9], [5, 10]],
    ref: { name: 'Moll', tone: 10 },
  },
  {
    id: 'pentatonic',
    name: 'C-Moll-Pentatonik',
    intervals: [0, 3, 5, 7, 10],
    degrees: ['1', '♭3', '4', '5', '♭7'],
    color: [3],
    colorName: 'kleine Terz',
    compare: 'Natürlich Moll ohne {2} und {b6}. Keine Halbtonschritte – deshalb klingt jede Note „sicher“.',
    feel: 'Rock- und Blues-Fundament. Ideal, um Phrasierung statt Noten zu üben.',
    listen: 'Spiele {1}–{b3}–{4}–{b3}–{1}. Lass die Moll-Terz {b3} stehen und hör, wie sie den Moll-Charakter trägt.',
    motif: [[4, 6], [4, 8], [4, 6], [3, 7], [3, 5], [3, 7]],
    harmony: MINOR,
  },
  {
    id: 'blues',
    name: 'C-Blues',
    intervals: [0, 3, 5, 6, 7, 10],
    degrees: ['1', '♭3', '4', '♭5', '5', '♭7'],
    color: [6],
    colorName: 'Blue Note (♭5)',
    compare: 'Moll-Pentatonik plus {b5}. Die Blue Note ist ein Durchgangston – nicht darauf stehen bleiben.',
    feel: 'Dreckig, gesanglich. Die ♭5 macht aus der Pentatonik ein Statement.',
    listen: 'Spiele {4}–{b5}–{5}, dann {b3}–{1}. Einmal {b5} nur durchlaufen, einmal kurz halten – hör die Spannung.',
    motif: [[2, 5], [2, 6], [2, 7], [1, 8], [1, 5]],
    harmony: MINOR,
  },
  {
    id: 'phrygdom',
    name: 'C-Phrygisch-Dominant',
    intervals: [0, 1, 4, 5, 7, 8, 10],
    degrees: ['1', '♭2', '3', '4', '5', '♭6', '♭7'],
    color: [1, 4],
    colorName: '♭2 und große Terz',
    compare: 'Wie Phrygisch, aber mit {3} statt {b3}: der Schritt {b2}→{3} (drei Halbtöne) klingt orientalisch.',
    feel: 'Exotisch, aggressiv – sehr beliebt in Metal-Soli über tiefem Grundton.',
    listen: 'Spiele {1}–{b2}–{3}–{4}–{3}–{b2}–{1}. Halte {3} und hör, wie es trotz Moll-Umfeld nach Dur klingt.',
    motif: [[1, 5], [1, 6], [2, 4], [2, 5], [2, 4], [1, 6], [1, 5]],
    ref: { name: 'Moll', tone: 3 },
  },
  {
    id: 'melodic',
    name: 'C-Melodisch-Moll',
    intervals: [0, 2, 3, 5, 7, 9, 11],
    degrees: ['1', '2', '♭3', '4', '5', '6', '7'],
    color: [9, 11],
    colorName: 'große Sexte und Septime',
    compare: 'Natürlich Moll mit {6} statt {b6} und {7} statt {b7}. Unten Moll, oben Dur.',
    feel: 'Elegant, jazzig, „fusion“ – sehr flüssige Linien möglich.',
    listen: 'Spiele {5}–{6}–{7}–{1}, dann {7}–{6}–{5}. Hör, wie glatt die Linie zum {1} hochsteigt.',
    motif: [[2, 7], [2, 9], [3, 6], [3, 7], [3, 6], [2, 9], [2, 7]],
    ref: { name: 'Moll', tone: 8 },
  },
  {
    id: 'locrian',
    name: 'C-Lokrisch',
    intervals: [0, 1, 3, 5, 6, 8, 10],
    degrees: ['1', '♭2', '♭3', '4', '♭5', '♭6', '♭7'],
    color: [6],
    colorName: 'verminderte Quinte',
    compare: 'Phrygisch mit {b5} statt {5}. Ohne reine Quinte wirkt {1} instabil.',
    feel: 'Unruhig, bedrohlich – gut für dissonante Riffs und Spannung vor der Auflösung.',
    listen: 'Spiele {1}–{b2}–{1}, dann {b5}–{4}–{1}. Hör, wie {b5} den Boden unter dem {1} wegzieht.',
    motif: [[1, 5], [1, 6], [1, 5], [2, 6], [2, 5], [1, 5]],
    ref: { name: 'Moll', tone: 7 },
  },
  {
    id: 'aeolian',
    name: 'C-Natürlich-Moll',
    intervals: MINOR,
    degrees: ['1', '2', '♭3', '4', '5', '♭6', '♭7'],
    color: [8],
    colorName: 'kleine Sexte',
    compare: 'Die Vergleichsbasis für alle Moll-Farben: kleine Terz ({b3}), kleine Sexte ({b6}), kleine Septime ({b7}).',
    feel: 'Klassisches Moll – traurig, ernst, episch.',
    listen: 'Spiele {5}–{b6}–{5}–{4}–{b3}–{2}–{1}. Lass das {b6} stehen und hör die dunkle Färbung.',
    motif: [[2, 7], [2, 8], [2, 7], [2, 5], [1, 8], [1, 7], [1, 5]],
  },
  {
    id: 'ionian',
    name: 'C-Dur',
    intervals: MAJOR,
    degrees: ['1', '2', '3', '4', '5', '6', '7'],
    color: [4],
    colorName: 'große Terz',
    compare: 'Die Grundlage fast aller Pop- und Rocksongs. Gegenüber Natürlich Moll sind Terz ({3}), Sexte ({6}) und Septime ({7}) groß.',
    feel: 'Hell, stabil, hymnisch – Pop, Rock, Powerballaden.',
    listen: 'Spiele {1}–{2}–{3}–{2}–{1}. Halte die große Terz {3} und vergleiche sie mit der Moll-Terz {b3}.',
    motif: [[1, 5], [1, 7], [1, 9], [2, 5], [1, 9], [1, 7], [1, 5]],
    ref: { name: 'Moll', tone: 3 },
  },
  {
    id: 'majpenta',
    name: 'C-Dur-Pentatonik',
    intervals: [0, 2, 4, 7, 9],
    degrees: ['1', '2', '3', '5', '6'],
    color: [4],
    colorName: 'große Terz',
    compare: 'Dur ohne {4} und {7}. Dieselben Griffbilder wie die Moll-Pentatonik – nur vom Grundton aus gesehen hell.',
    feel: 'Country, Southern Rock, fröhliche Melodien – klingt sofort „richtig“.',
    listen: 'Spiele {1}–{2}–{3}–{5}–{6}–{5}–{3}. Hör, wie offen die Linie ohne Halbtöne klingt.',
    motif: [[1, 5], [1, 7], [1, 9], [2, 7], [2, 9], [2, 7], [1, 9]],
    harmony: MAJOR,
  },
  {
    id: 'mixolydian',
    name: 'C-Mixolydisch',
    intervals: [0, 2, 4, 5, 7, 9, 10],
    degrees: ['1', '2', '3', '4', '5', '6', '♭7'],
    color: [10],
    colorName: 'kleine Septime',
    compare: 'Dur: {7}. Mixolydisch: {b7}. Dur mit einer bluesigen Septime.',
    feel: 'Rockig, bluesig, entspannt – der klassische Dur-Rock-Sound.',
    listen: 'Spiele {5}–{6}–{b7}–{6}–{5}, dann {b7}–{1}. Hör, wie {b7} nicht zum Grundton drängt.',
    motif: [[2, 7], [2, 9], [2, 10], [2, 9], [2, 7], [3, 5], [3, 7]],
    ref: { name: 'Dur', tone: 11 },
  },
  {
    id: 'lydian',
    name: 'C-Lydisch',
    intervals: [0, 2, 4, 6, 7, 9, 11],
    degrees: ['1', '2', '3', '♯4', '5', '6', '7'],
    color: [6],
    colorName: 'übermäßige Quarte',
    compare: 'Dur: {4}. Lydisch: {#4}. Die erhöhte Quarte lässt Dur schweben.',
    feel: 'Schwebend, verträumt, filmisch – Dur mit Fragezeichen.',
    listen: 'Spiele {3}–{#4}–{5}, dann {#4}–{3}–{1}. Halte {#4} über der Drone und hör das Schweben.',
    motif: [[1, 9], [2, 6], [2, 7], [2, 6], [1, 9], [1, 7], [1, 5]],
    ref: { name: 'Dur', tone: 5 },
  },
];

/** All cards in C, for lists and the ear quiz. */
export const SCALES: ScaleDef[] = CARDS.map((c) => inKey(c));

/**
 * Order of the scale blocks: the essentials first (minor, pentatonic, major),
 * then the colours. Each block stays a few days, then the next scale comes
 * with a new tonic.
 */
export const SCALE_ROTATION = [
  'aeolian',
  'pentatonic',
  'ionian',
  'dorian',
  'blues',
  'majpenta',
  'mixolydian',
  'harmonic',
  'phrygian',
  'lydian',
  'melodic',
  'phrygdom',
  'locrian',
];

/** Tonic of each new scale block – all twelve keys, the guitar-friendly ones first. */
export const ROOT_ROTATION = [0, 9, 2, 7, 4, 5, 3, 10, 11, 8, 6, 1];

export const ROOTS = Array.from({ length: 12 }, (_, pc) => ({ pc, name: noteName(pc) }));

export const NATURAL_MINOR = SCALES.find((s) => s.id === 'aeolian')!;

/** A scale card in the given key (default C). */
export function getScale(id: string, root = 0): ScaleDef {
  return inKey(CARDS.find((s) => s.id === id) ?? CARDS[0], root);
}
