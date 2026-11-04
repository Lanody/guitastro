import { afterEach, describe, expect, it } from 'vitest';
import { getScale } from '../music/scales';
import { STRINGS, TUNING, TUNINGS, fretMidi, inScale, midiToPc, setTuning } from '../music/theory';
import { RIFFS, RIFF_STAGES, riffBars, riffBlock, riffEvents } from './riffs';
import { rngFrom } from './rng';
import { seconds, type Note } from './types';

afterEach(() => setTuning('drop-c'));

const notesOf = (steps: ReturnType<typeof riffBars>[number]) => steps.filter((x): x is Note => typeof x === 'object');

for (const t of TUNINGS) {
  describe(`riffs in ${t.name} (${t.strings.length} Saiten)`, () => {
    it('whole bars, playable frets, notes from the riff scale on the lowest strings', () => {
      setTuning(t.id);
      const tonic = midiToPc(TUNING[0]);
      for (const def of RIFFS) {
        const bars = riffBars(def);
        expect(bars.length, def.name).toBeGreaterThanOrEqual(2);
        const scale = getScale(def.scale, tonic);
        for (const bar of bars) {
          expect(bar.length, `${def.name} bar length`).toBe(def.sub * 4);
          for (const n of notesOf(bar)) {
            expect(inScale(scale, fretMidi(n.s, n.f)), `${def.name} ${n.s}:${n.f}`).toBe(true);
            for (const p of [n, ...(n.chord ?? [])]) {
              expect(p.f, def.name).toBeGreaterThanOrEqual(0);
              expect(p.f, def.name).toBeLessThanOrEqual(17);
              expect(p.s, def.name).toBeLessThan(Math.min(STRINGS, 4));
            }
            // Power chords: fifth and octave above the root.
            if (n.chord) expect(n.chord.map((p) => fretMidi(p.s, p.f) - fretMidi(n.s, n.f)), def.name).toEqual([7, 12]);
          }
        }
      }
    });
    it('same pitches in every tuning, relative to the open lowest string', () => {
      const rel = () => RIFFS.map((def) => riffBars(def).flat().map((st) => (typeof st === 'object' ? fretMidi(st.s, st.f) - TUNING[0] : st)).join(' '));
      setTuning('drop-c');
      const ref = rel();
      setTuning(t.id);
      expect(rel()).toEqual(ref);
    });
  });
}

describe('riff block', () => {
  it('4 minutes in every lesson of the week, whole bars, tempo from the second lesson on', () => {
    for (let index = 0; index < RIFFS.length + 2; index++) {
      for (let lesson = 0; lesson < 6; lesson++) {
        const ex = riffBlock({ rng: rngFrom('r'), vary: false, scale: getScale('aeolian'), riff: { index, lesson } });
        expect(seconds(ex), `${ex.title}`).toBe(240);
        expect(ex.key).toBe(`W${(index % RIFFS.length) + 1}`);
        expect(ex.tracksTempo).toBe(lesson > 0);
        expect(ex.title).toContain(RIFF_STAGES[Math.min(3, lesson)]);
        for (const p of ex.phases) expect(p.pattern!.length % (p.sub * 4), `${ex.title} ${p.label}`).toBe(0);
      }
    }
  });
  it('play-along: chords sound together, held notes last until the next step', () => {
    const steps = riffBars(RIFFS[0])[0];
    const ev = riffEvents(steps);
    expect(ev[0]).toEqual({ midis: [36], len: 2, pm: true, legato: false });
    expect(ev[1]).toBeNull();
    expect(ev[8]).toEqual({ midis: [39, 46, 51], len: 4, pm: false, legato: false });
    expect(riffEvents([{ s: 0, f: 3 }, { s: 0, f: 5, t: 'h' }]).map((e) => e?.legato)).toEqual([false, true]);
  });
});
