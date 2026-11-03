import { describe, expect, it } from 'vitest';
import { moduleA, moduleB, scaleBlock } from '../data/exercises';
import { rngFrom } from '../data/rng';
import type { Step } from '../data/types';
import { countLabel, fillBars, padBar } from '../music/meter';
import { SCALES, getScale } from '../music/scales';
import { layoutTab, sustained } from './Tab';

const ctx = { rng: rngFrom('t'), vary: false, scale: getScale('dorian') };
const [a1, , a3, a4, a5, a6] = moduleA(ctx);
const [b1, , b3] = moduleB(ctx);
const note = (f: number): Step => ({ s: 5, f });

describe('tab layout (one column per step, equal time)', () => {
  it('short runs fit one line in both note values', () => {
    for (const ex of [a1, a3, a5]) {
      expect(layoutTab(ex.pattern!.length, 2)).toHaveLength(1);
      expect(layoutTab(ex.pattern!.length, 4)).toHaveLength(1);
    }
  });
  it('speed bursts: control and speed bar are lines of equal length', () => {
    const lines = layoutTab(a6.phases[0].pattern!.length, 4);
    expect(lines.map((l) => l.length)).toEqual([16, 16]);
  });
  it('long patterns break at bar lines into equal lines', () => {
    expect(layoutTab(b1.pattern!.length, 2).map((l) => l.length)).toEqual([16, 16, 16]);
    expect(layoutTab(b3.phases[0].pattern!.length, 2).map((l) => l[0] % 8)).toEqual([0, 0]);
  });
  it('narrow fallback: one bar per line', () => {
    expect(layoutTab(16, 2, undefined, 1).map((l) => l.length)).toEqual([8, 8]);
  });
  it('static preview breaks every n steps', () => {
    expect(layoutTab(18, 2, 9).map((l) => l.length)).toEqual([9, 9]);
  });
  it('other meters: lines break at their bar lines', () => {
    expect(layoutTab(12, 2, undefined, undefined, 3).map((l) => l.length)).toEqual([12]);
    expect(layoutTab(24, 4, undefined, undefined, 3).map((l) => l.length)).toEqual([12, 12]);
  });
  it('held notes ring on their string until the next note or rest', () => {
    expect(sustained([note(5), 'hold', 'hold', 'rest', 'hold', { s: 2, f: 3 }, 'hold'])).toEqual([-1, 5, 5, -1, -1, -1, 2]);
  });
});

describe('meter', () => {
  it('count labels', () => {
    expect(Array.from({ length: 8 }, (_, i) => countLabel(i, 2)).join(' ')).toBe('1 + 2 + 3 + 4 +');
    expect(Array.from({ length: 8 }, (_, i) => countLabel(i, 4)).join(' ')).toBe('1 e + e 2 e + e');
    expect(Array.from({ length: 8 }, (_, i) => countLabel(i, 2, 3)).join(' ')).toBe('1 + 2 + 3 + 1 +');
  });
  it('padBar fills the last bar with rests', () => {
    expect(padBar([note(1), note(2), note(3)], 2)).toHaveLength(8);
    expect(padBar([note(1), note(2), note(3)], 2, 3)).toHaveLength(6);
  });
  it('fillBars repeats a short loop to whole bars (A4 legato as sixteenths)', () => {
    const p = a4.pattern!;
    expect(fillBars(p, 2)).toBe(p);
    const filled = fillBars(p, 4);
    expect(filled).toHaveLength(16);
    expect(filled.slice(8)).toEqual(p);
  });
  it('every pattern in every note value fills whole bars', () => {
    for (const scale of SCALES)
      for (let seed = 0; seed < 30; seed++) {
        const c = { rng: rngFrom(`m${seed}`), vary: seed > 0, scale };
        for (const ex of [...moduleA(c), ...moduleB(c), ...scaleBlock({ ...c, stage: 'learn' }), ...scaleBlock({ ...c, stage: 'deepen' }), ...scaleBlock({ ...c, stage: 'apply' })])
          for (const ph of ex.phases) {
            const pat = ph.pattern ?? ex.pattern;
            if (!pat) continue;
            for (const sub of ex.pattern && ex.tracksTempo ? [2, 4] : [ph.sub]) expect(fillBars(pat, sub).length % (sub * 4), `${ex.key} ${sub}`).toBe(0);
          }
      }
  });
});
