import { afterEach, describe, expect, it } from 'vitest';
import { BUILDERS, moduleA, moduleB, moduleD, patternNotes, scaleBlock, type BuildCtx, type ScaleStage } from '../data/exercises';
import { rngFrom } from '../data/rng';
import type { Exercise } from '../data/types';
import { powerGrip, progressionFor, triad, voiceProgression } from './chords';
import { ROOT_ROTATION, SCALES, getScale } from './scales';
import {
  HOME,
  STRINGS,
  STRING_DAT,
  STRING_LONG,
  TOP,
  TUNINGS,
  fretMidi,
  inScale,
  midiToPc,
  oneStringOctave,
  scalePositions,
  setTuning,
  sixStringPath,
} from './theory';

const STAGES: ScaleStage[] = ['learn', 'deepen', 'apply'];
const allPatterns = (e: Exercise) => [e.pattern, ...e.phases.map((p) => p.pattern), ...e.phases.map((p) => p.pick?.build(p.pick.options[0].value))];

afterEach(() => setTuning('drop-c'));

describe('tuning names', () => {
  it('Drop C keeps the booklet names', () => {
    setTuning('drop-c');
    expect(STRING_LONG).toEqual(['tiefe C-Saite', 'G-Saite', 'mittlere C-Saite', 'F-Saite', 'A-Saite', 'hohe d-Saite']);
    expect(STRING_DAT[0]).toBe('tiefen C-Saite');
    expect(HOME).toBe(0);
  });
  it('E standard and seven strings', () => {
    setTuning('e-std');
    expect(STRING_LONG).toEqual(['tiefe E-Saite', 'A-Saite', 'D-Saite', 'G-Saite', 'H-Saite', 'hohe e-Saite']);
    expect(HOME).toBe(2);
    setTuning('7-b-std');
    expect(STRINGS).toBe(7);
    expect(STRING_LONG).toEqual(['tiefe H-Saite', 'E-Saite', 'A-Saite', 'D-Saite', 'G-Saite', 'H-Saite', 'hohe e-Saite']);
    setTuning('7-drop-a');
    expect(STRING_LONG[2]).toBe('mittlere A-Saite');
  });
});

describe('booklet frets stay the same in every drop tuning', () => {
  const frets = (es: Exercise[]) => es.map((e) => allPatterns(e).flatMap((p) => patternNotes(p).map((x) => `${x.s}:${x.f}`)).join(' '));
  const build = () => {
    const ctx: BuildCtx = { rng: rngFrom('x'), vary: false, scale: getScale('aeolian', HOME) };
    return frets([...moduleA(ctx), ...moduleB(ctx), ...moduleD(ctx)]);
  };
  setTuning('drop-c');
  const dropC = build();
  for (const id of ['drop-d', 'drop-cs', 'drop-b', 'drop-a']) {
    it(id, () => {
      setTuning(id);
      expect(build()).toEqual(dropC);
    });
  }
});

for (const t of TUNINGS) {
  describe(`${t.name} (${t.strings.length} Saiten)`, () => {
    it('scale paths: every string, ascending, in scale, playable stretch', () => {
      setTuning(t.id);
      for (const card of SCALES) {
        for (const root of ROOT_ROTATION) {
          const sc = getScale(card.id, root);
          const positions = scalePositions(sc);
          expect(positions[0], `${sc.name} home position first`).toEqual(sixStringPath(sc));
          for (const path of positions) {
            const midis = path.map((p) => fretMidi(p.s, p.f));
            midis.forEach((m, i) => {
              expect(inScale(sc, m), `${sc.name}`).toBe(true);
              if (i) expect(m).toBeGreaterThan(midis[i - 1]);
            });
            for (let s = 0; s < STRINGS; s++) {
              const fs = path.filter((p) => p.s === s).map((p) => p.f);
              expect(fs.length, `${sc.name} string ${s}`).toBeGreaterThan(0);
              expect(Math.max(...fs) - Math.min(...fs)).toBeLessThanOrEqual(4);
              fs.forEach((f) => expect(f).toBeGreaterThanOrEqual(0));
            }
          }
          const oct = oneStringOctave(sc);
          expect(midiToPc(fretMidi(oct[0].s, oct[0].f))).toBe(sc.root);
          expect(fretMidi(oct.at(-1)!.s, oct.at(-1)!.f) - fretMidi(oct[0].s, oct[0].f)).toBe(12);
          sc.motif.forEach(([s, f]) => {
            expect(s).toBeLessThanOrEqual(TOP);
            expect(inScale(sc, fretMidi(s, f)), `${sc.name} motif`).toBe(true);
          });
        }
      }
    });

    it('scale positions cover the whole fretboard', () => {
      setTuning(t.id);
      for (const card of SCALES) {
        for (const root of ROOT_ROTATION) {
          const sc = getScale(card.id, root);
          const positions = scalePositions(sc);
          // One position per scale note at most, never the same shape twice. Shapes that would need
          // frets above 17 drop out (blues on seven-string drop tunings keeps four) – the rest still cover all.
          expect(positions.length, sc.name).toBeLessThanOrEqual(sc.intervals.length);
          expect(positions.length, sc.name).toBeGreaterThanOrEqual(card.id === 'blues' ? 4 : Math.min(5, sc.intervals.length));
          expect(new Set(positions.map((p) => p[0].f)).size, `${sc.name} distinct starts`).toBe(positions.length);
          // Every scale note on every string (frets 0–11; above, the shapes repeat) lies in some position.
          const covered = new Set(positions.flat().map((p) => `${p.s}:${p.f % 12}`));
          for (let s = 0; s < STRINGS; s++)
            for (let f = 0; f < 12; f++) if (inScale(sc, fretMidi(s, f))) expect(covered.has(`${s}:${f}`), `${sc.name} string ${s} fret ${f}`).toBe(true);
        }
      }
    });

    it('chords: power chords are root–fifth–octave, triads hold the chord tones', () => {
      setTuning(t.id);
      for (const card of SCALES) {
        const sc = getScale(card.id, 4);
        for (let day = 0; day < 4; day++) {
          const prog = progressionFor(sc, day);
          for (const v of ['power', 'power-mix'] as const) {
            voiceProgression(prog, v).forEach((slot, i) => {
              const [r, q, o] = slot.midis;
              expect(midiToPc(r)).toBe(prog[i].root);
              expect(o - r).toBe(12);
              expect([6, 7, 8]).toContain(q - r);
            });
          }
          voiceProgression(prog, 'triad').forEach((slot, i) => {
            expect(new Set(slot.midis.map(midiToPc))).toEqual(new Set(prog[i].pcs));
            slot.grip.forEach((p) => expect(p.s).toBeGreaterThanOrEqual(TOP - 2));
          });
        }
      }
      const g = powerGrip(null, 0, 5).map((p) => fretMidi(p.s, p.f));
      expect([g[1] - g[0], g[2] - g[0]]).toEqual([7, 12]);
    });

    it('every exercise builds with valid strings and frets, in the right scale', () => {
      setTuning(t.id);
      for (let seed = 0; seed < 4; seed++) {
        for (const card of SCALES) {
          const sc = getScale(card.id, ROOT_ROTATION[(seed * 5) % 12]);
          const c: BuildCtx = { rng: rngFrom(`${t.id}${seed}`), vary: seed > 0, scale: sc, stage: STAGES[seed % 3], progression: progressionFor(sc, seed) };
          const all = [...moduleA(c), ...moduleB(c), ...moduleD(c), ...STAGES.flatMap((stage) => scaleBlock({ ...c, stage })), ...Object.values(BUILDERS).map((b) => b(c))];
          for (const e of all) {
            expect(e.intro, e.key).not.toMatch(/undefined|NaN/);
            for (const pat of allPatterns(e)) {
              for (const nt of patternNotes(pat)) {
                const where = `${e.key} ${sc.name} ${nt.s}:${nt.f}`;
                expect(nt.s, where).toBeGreaterThanOrEqual(0);
                expect(nt.s, where).toBeLessThanOrEqual(TOP);
                expect(nt.f, where).toBeGreaterThanOrEqual(0);
                expect(nt.f, where).toBeLessThanOrEqual(17);
                const scale = ['A3', 'A5', 'B3', 'B4', 'B5'].includes(e.key) || e.module === 'C' || ['E1', 'E3', 'E6'].includes(e.key) ? getScale(e.scaleId ?? sc.id, e.root ?? sc.root) : null;
                if (scale) expect(inScale(scale, fretMidi(nt.s, nt.f)), `${where} ${scale.name}`).toBe(true);
              }
            }
            for (const p of e.phases) expect(p.text, `${e.key} ${p.label}`).not.toMatch(/undefined|NaN/);
            if (e.key === 'E7' || e.key === 'E8') {
              // Sweeps: only chord tones, and every picked note says which way the pick goes.
              const pcs = progressionFor(sc, seed).concat(triad(sc, 0)).map((ch) => ch.pcs);
              for (const pat of allPatterns(e)) {
                const ns = patternNotes(pat);
                expect(pcs.some((cs) => ns.every((x) => cs.includes(midiToPc(fretMidi(x.s, x.f))))), `${e.key} ${sc.name}`).toBe(true);
                for (const x of ns) expect(!!x.stroke !== !!x.t, `${e.key} ${x.s}:${x.f}`).toBe(true);
              }
            }
          }
        }
      }
    }, 30000);
  });
}
