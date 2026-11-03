import { describe, expect, it } from 'vitest';
import { PROGRESSIONS, progressionFor, triad, voiceProgression, type Voicing } from './chords';
import { SCALES, getScale } from './scales';
import { fretMidi, midiToPc } from './theory';

describe('chords from the scale', () => {
  it('major and minor keys', () => {
    const c = getScale('ionian');
    expect([0, 1, 2, 3, 4, 5, 6].map((d) => triad(c, d).name)).toEqual(['C', 'Dm', 'Em', 'F', 'G', 'Am', 'B°']);
    const a = getScale('aeolian', 9);
    expect([0, 1, 2, 3, 4, 5, 6].map((d) => triad(a, d).name)).toEqual(['Am', 'B°', 'C', 'Dm', 'Em', 'F', 'G']);
    expect([0, 1, 2, 3, 4, 5, 6].map((d) => triad(a, d).roman)).toEqual(['i', 'ii°', '♭III', 'iv', 'v', '♭VI', '♭VII']);
  });
  it('colour scales', () => {
    expect(triad(getScale('dorian', 2), 3).name).toBe('G'); // IV in dorian is major
    expect(triad(getScale('phrygian', 4), 1).roman).toBe('♭II');
    expect(triad(getScale('harmonic'), 4).name).toBe('G'); // V major thanks to the leading tone
    expect(triad(getScale('pentatonic'), 0).name).toBe('Cm'); // pentatonics borrow natural minor
  });
});

describe('progressions and grips', () => {
  for (const sc of SCALES) {
    it(`${sc.name.replace('C-', '')}: every progression in every key is playable`, () => {
      for (let root = 0; root < 12; root++) {
        const key = getScale(sc.id, root);
        for (let day = 0; day < PROGRESSIONS[sc.id].length; day++) {
          const prog = progressionFor(key, day);
          prog.forEach((c) => c.pcs.forEach((pc) => expect(key.harmony.map((i) => midiToPc(root + i))).toContain(pc)));
          for (const v of ['power', 'power-mix', 'triad'] as Voicing[]) {
            const slots = voiceProgression(prog, v);
            slots.forEach((sl, i) => {
              const c = prog[i];
              expect(sl.grip.length).toBe(3);
              sl.grip.forEach((p) => {
                expect(p.f).toBeGreaterThanOrEqual(0);
                expect(p.f).toBeLessThanOrEqual(15);
                expect(c.pcs, `${v} ${sl.name}`).toContain(midiToPc(fretMidi(p.s, p.f)));
              });
              expect(new Set(sl.grip.map((p) => p.s)).size).toBe(3);
              const pcs = new Set(sl.midis.map(midiToPc));
              if (v === 'triad') expect(pcs.size).toBe(3);
              else expect(midiToPc(Math.min(...sl.midis))).toBe(c.root); // power chords: root in the bass
              const fretted = sl.grip.filter((p) => p.f > 0).map((p) => p.f);
              if (fretted.length) expect(Math.max(...fretted) - Math.min(...fretted)).toBeLessThanOrEqual(3);
              if (fretted.length < 3) expect(Math.max(0, ...fretted)).toBeLessThanOrEqual(4);
            });
          }
        }
      }
    });
  }
  it('power chords in Drop C are one finger on the three low strings', () => {
    const [cm] = voiceProgression(progressionFor(getScale('aeolian'), 0), 'power');
    expect(cm.name).toBe('C5');
    expect(cm.grip).toEqual([{ s: 0, f: 0 }, { s: 1, f: 0 }, { s: 2, f: 0 }]);
  });
});
