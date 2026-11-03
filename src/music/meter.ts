// Bar grid shared by the patterns, the tab display and the metronome.
// A pattern is a list of grid steps; `sub` steps make one beat, `beats` beats one bar.

import type { Step } from '../data/types';

/** All booklet exercises are in 4/4. */
export const DEFAULT_BEATS = 4;

export const barSteps = (sub: number, beats = DEFAULT_BEATS) => sub * beats;

const rests = (k: number): Step[] => Array.from({ length: k }, () => 'rest' as const);

/** Pads with rests to a whole number of bars on the given grid. */
export function padBar(steps: Step[], sub: number, beats = DEFAULT_BEATS): Step[] {
  const rem = steps.length % barSteps(sub, beats);
  return rem ? [...steps, ...rests(barSteps(sub, beats) - rem)] : steps;
}

/**
 * Makes a looping pattern fill whole bars, so its first step always falls on
 * the "1" (e.g. 8 legato notes played as sixteenths = half a bar → repeat once).
 * Repeats the loop when that takes at most 4 passes, otherwise pads with rests.
 */
export function fillBars(steps: Step[], sub: number, beats = DEFAULT_BEATS): Step[] {
  const bar = barSteps(sub, beats);
  if (!steps.length || steps.length % bar === 0) return steps;
  for (let k = 2; k <= 4; k++) if ((steps.length * k) % bar === 0) return Array.from({ length: k }, () => steps).flat();
  return padBar(steps, sub, beats);
}

const COUNTS: Record<number, string[]> = {
  2: ['+'],
  3: ['t', 'l'],
  4: ['e', '+', 'e'],
};

/** Count syllable for a step: 1 e + e 2 e + e … */
export function countLabel(i: number, sub: number, beats = DEFAULT_BEATS) {
  const inBeat = i % sub;
  return inBeat === 0 ? String((Math.floor(i / sub) % beats) + 1) : (COUNTS[sub]?.[inBeat - 1] ?? '');
}
