import { describe, expect, it } from 'vitest';
import { detectPitch } from './pitch';
import { freqToMidi, midiToFreq } from './theory';

// Guitar-like tone: strong harmonics, decaying fundamental, a bit of noise.
function pluck(freq: number, sr = 48000, n = 4096) {
  const buf = new Float32Array(n);
  let seed = 1;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647 - 0.5);
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    let v = 0;
    for (let h = 1; h <= 8; h++) v += (h === 1 ? 0.6 : 1 / h) * Math.sin(2 * Math.PI * freq * h * t + h);
    buf[i] = 0.3 * v + 0.01 * rnd();
  }
  return buf;
}

describe('YIN on guitar-like tones', () => {
  for (const midi of [36, 43, 48, 53, 57, 62, 67, 72, 79]) {
    it(`detects MIDI ${midi}`, () => {
      const r = detectPitch(pluck(midiToFreq(midi)), 48000);
      expect(r).not.toBeNull();
      expect(Math.abs(freqToMidi(r!.freq) - midi)).toBeLessThan(0.2);
    });
  }
  it('ignores silence', () => {
    expect(detectPitch(new Float32Array(4096), 48000)).toBeNull();
  });
});
