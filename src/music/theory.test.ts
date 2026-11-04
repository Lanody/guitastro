import { describe, expect, it } from 'vitest';
import { fretMidi, inScale, midiToPc, oneStringOctave, scalePositions, sixStringPath, twoStringGroup } from './theory';
import { SCALES, getScale } from './scales';

const frets = (path: { s: number; f: number }[]) => {
  const by: number[][] = [[], [], [], [], [], []];
  path.forEach((p) => by[p.s].push(p.f));
  return by;
};

describe('six-string paths match the booklet', () => {
  it('natural minor (Modul B)', () => {
    expect(frets(sixStringPath(getScale('aeolian')))).toEqual([[7, 8, 10], [5, 7, 8], [5, 7, 8], [5, 7, 9], [6, 8, 10], [6, 8, 10]]);
  });
  it('dorian', () => {
    expect(frets(sixStringPath(getScale('dorian')))).toEqual([[7, 9, 10], [5, 7, 8], [5, 7, 9], [5, 7, 9], [6, 8, 10], [7, 8, 10]]);
  });
  it('phrygian', () => {
    expect(frets(sixStringPath(getScale('phrygian')))).toEqual([[7, 8, 10], [5, 6, 8], [5, 7, 8], [5, 7, 8], [6, 8, 10], [6, 8, 10]]);
  });
  it('harmonic minor', () => {
    expect(frets(sixStringPath(getScale('harmonic')))).toEqual([[7, 8, 11], [5, 7, 8], [5, 7, 8], [6, 7, 9], [6, 8, 10], [6, 9, 10]]);
  });
});

describe('one-string octave on G', () => {
  it('matches booklet', () => {
    expect(oneStringOctave(getScale('dorian')).map((p) => p.f)).toEqual([5, 7, 8, 10, 12, 14, 15, 17]);
    expect(oneStringOctave(getScale('phrygian')).map((p) => p.f)).toEqual([5, 6, 8, 10, 12, 13, 15, 17]);
    expect(oneStringOctave(getScale('harmonic')).map((p) => p.f)).toEqual([5, 7, 8, 10, 12, 13, 16, 17]);
  });
});

describe('two-string groups', () => {
  const minor = getScale('aeolian');
  it('short run A/d (A3)', () => {
    const g = twoStringGroup(minor, 4, 5, 5);
    expect(g.low.map((p) => p.f)).toEqual([5, 6, 8]);
    expect(g.high.map((p) => p.f)).toEqual([5, 6, 8]);
  });
  it('string skip F/d (A5)', () => {
    const g = twoStringGroup(minor, 3, 5, 7);
    expect(g.low.map((p) => p.f)).toEqual([7, 9, 10]);
    expect(g.high.map((p) => p.f)).toEqual([5, 6, 8]);
  });
});

describe('every scale', () => {
  for (const sc of SCALES) {
    it(`${sc.name}: motif and path are in scale, path ascends, stretch ok`, () => {
      sc.motif.forEach(([s, f]) => expect(inScale(sc, fretMidi(s, f))).toBe(true));
      const path = sixStringPath(sc);
      const midis = path.map((p) => fretMidi(p.s, p.f));
      midis.forEach((m, i) => i && expect(m).toBeGreaterThan(midis[i - 1]));
      for (let s = 0; s < 6; s++) {
        const fs = path.filter((p) => p.s === s).map((p) => p.f);
        expect(fs.length).toBeGreaterThan(0);
        expect(Math.max(...fs) - Math.min(...fs)).toBeLessThanOrEqual(4);
      }
    });
  }
});

describe('scales in every key', () => {
  const rel = (path: { s: number; f: number }[]) => path.map((p) => `${p.s}:${p.f - path[0].f}`).join(' ');
  for (const card of SCALES) {
    it(`${card.name.replace('C-', '')} in all 12 keys: same shapes, right notes, playable frets`, () => {
      const shape = rel(sixStringPath(card));
      for (let root = 0; root < 12; root++) {
        const sc = getScale(card.id, root);
        for (const path of scalePositions(sc)) {
          expect(new Set(path.map((p) => p.s)).size, `${sc.name} uses all strings`).toBe(6);
          const midis = path.map((p) => fretMidi(p.s, p.f));
          midis.forEach((m, i) => i && expect(m).toBeGreaterThan(midis[i - 1]));
          path.forEach((p) => {
            expect(inScale(sc, fretMidi(p.s, p.f))).toBe(true);
            expect(p.f).toBeGreaterThanOrEqual(0);
            expect(p.f).toBeLessThanOrEqual(17);
          });
        }
        // The first position is the same shape in every key, only moved.
        expect(rel(sixStringPath(sc)), sc.name).toBe(shape);
        const oct = oneStringOctave(sc);
        expect(midiToPc(fretMidi(oct[0].s, oct[0].f))).toBe(root);
        expect(fretMidi(oct[oct.length - 1].s, oct[oct.length - 1].f) - fretMidi(oct[0].s, oct[0].f)).toBe(12);
        expect(oct[oct.length - 1].f).toBeLessThanOrEqual(17);
        sc.motif.forEach(([s, f]) => {
          expect(inScale(sc, fretMidi(s, f)), `${sc.name} motif`).toBe(true);
          expect(f).toBeGreaterThanOrEqual(0);
          expect(f).toBeLessThanOrEqual(17);
        });
        expect(sc.listen + sc.compare).not.toMatch(/\{/);
      }
    });
  }
  it('texts follow the key', () => {
    const d = getScale('dorian', 2);
    expect(d.name).toBe('D-Dorisch');
    expect(d.compare).toBe('Natürlich Moll: B♭. Dorisch: B. Nur diese Stufe verändert sich.');
    expect(d.colorLabel).toBe('B (= H) · große Sexte');
    expect(getScale('lydian').compare).toContain('F♯');
    expect(getScale('dorian').motifText).toBe('G-Saite: 5–7–8 | mittlere C-Saite: 7–9–7–5 | G-Saite: 5');
  });
});
