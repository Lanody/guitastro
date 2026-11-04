import { describe, expect, it } from 'vitest';
import { BUILDERS, scaleBlock } from '../data/exercises';
import { rngFrom } from '../data/rng';
import type { Step } from '../data/types';
import { countLabel, fillBars, padBar } from '../music/meter';
import { SCALES, getScale } from '../music/scales';
import { groupLines, layoutTab, palmMarks, sustained, withRestBeats } from './Tab';

const ctx = { rng: rngFrom('t'), vary: false, scale: getScale('dorian') };
const [a1, a3, a4, a5, a6, b1, b4, b5] = ['A1', 'A3', 'A4', 'A5', 'A6', 'B1', 'B4', 'B5'].map((k) => BUILDERS[k](ctx));
const note = (f: number): Step => ({ s: 5, f });

describe('tab layout (one column per step, equal time)', () => {
  it('short runs fit one line in both note values', () => {
    for (const ex of [a1, a3, a5]) {
      expect(layoutTab(ex.pattern!.length, 2)).toHaveLength(1);
      expect(layoutTab(ex.pattern!.length, 4)).toHaveLength(1);
    }
  });
  it('speed bursts: control and speed bar share one line', () => {
    const lines = layoutTab(a6.phases[0].pattern!.length, 4);
    expect(lines.map((l) => l.length)).toEqual([32]);
  });
  it('bursts on every string: group view, all strings in one line', () => {
    const [one, two] = b5.phases.map((ph) => withRestBeats(ph.pattern!, ph.groups!, ph.sub));
    expect(groupLines(one.steps.length, one.bar, false).map((l) => l.length)).toEqual([42]);
    expect(groupLines(two.steps.length, two.bar, true).map((l) => l.length)).toEqual([30, 30]);
  });
  it('group view: rests shrink to one column per beat and keep the count', () => {
    const g = withRestBeats([note(7), note(8), note(10), note(8)], 4, 4);
    expect(g.steps.slice(4)).toEqual(['rest', 'rest', 'rest']);
    expect(g.steps.map((_, i) => g.count(i)[0])).toEqual(['1', 'e', '+', 'e', '2', '3', '4']);
    const d = withRestBeats(Array(8).fill(note(5)), 8, 4);
    expect(d.steps.map((_, i) => d.count(i)[0])).toEqual(['1', 'e', '+', 'e', '2', 'e', '+', 'e', '3', '4']);
  });
  it('long patterns break at bar lines into equal lines', () => {
    expect(layoutTab(b1.pattern!.length, 2).map((l) => l.length)).toEqual([16, 16, 16]);
    expect(layoutTab(b4.phases[0].pattern!.length, 2).map((l) => l[0] % 8)).toEqual([0, 0]);
  });
  it('narrow fallback: one bar per line', () => {
    expect(layoutTab(16, 2, undefined, 1).map((l) => l.length)).toEqual([8, 8]);
  });
  it('static preview breaks every n steps', () => {
    expect(layoutTab(18, 2, 9).map((l) => l.length)).toEqual([9, 9]);
  });
  it('other meters: lines break at their bar lines', () => {
    expect(layoutTab(12, 2, undefined, 2, 3).map((l) => l.length)).toEqual([12]);
    expect(layoutTab(48, 4, undefined, 2, 3).map((l) => l.length)).toEqual([24, 24]);
  });
  it('held notes ring on their string until the next note or rest', () => {
    expect(sustained([note(5), 'hold', 'hold', 'rest', 'hold', { s: 2, f: 3 }, 'hold'])).toEqual([[], [5], [5], [], [], [], [2]]);
  });
  it('a held power chord rings on all its strings', () => {
    const chord: Step = { s: 0, f: 3, chord: [{ s: 1, f: 3 }, { s: 2, f: 3 }] };
    expect(sustained([chord, 'hold', 'rest'])).toEqual([[], [0, 1, 2], []]);
  });
  it('palm-mute marks: PM at the start of a run, dashes while it lasts', () => {
    const pm = (f: number): Step => ({ s: 0, f, pm: true });
    expect(palmMarks([pm(0), 'hold', pm(0), { s: 0, f: 3 }, 'hold', pm(0), 'rest', 'rest'])).toEqual(['PM', '–', '–', '', '', 'PM', '', '']);
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
        for (const ex of [...Object.values(BUILDERS).map((b) => b(c)), ...scaleBlock({ ...c, stage: 'learn' }), ...scaleBlock({ ...c, stage: 'deepen' }), ...scaleBlock({ ...c, stage: 'apply' })])
          for (const ph of ex.phases) {
            const pat = ph.pattern ?? ex.pattern;
            if (!pat || ph.groups) continue;
            for (const sub of ex.pattern && ex.tracksTempo ? [2, 4] : [ph.sub]) expect(fillBars(pat, sub).length % (sub * 4), `${ex.key} ${sub}`).toBe(0);
          }
      }
  });
});
