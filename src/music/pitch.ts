// YIN pitch detector for guitar, from a seven-string in Drop G (G1 ≈ 49 Hz) up to ~1.2 kHz.

export interface PitchResult {
  freq: number;
  /** 0..1, higher = more periodic (more trustworthy). */
  clarity: number;
  rms: number;
}

export function detectPitch(buf: Float32Array, sampleRate: number, threshold = 0.15): PitchResult | null {
  let rms = 0;
  for (let i = 0; i < buf.length; i++) rms += buf[i] * buf[i];
  rms = Math.sqrt(rms / buf.length);
  if (rms < 0.01) return null;

  const minLag = Math.floor(sampleRate / 1300);
  const maxLag = Math.min(Math.floor(sampleRate / 45), Math.floor(buf.length / 2));
  const w = buf.length - maxLag;
  const d = new Float32Array(maxLag + 1);
  for (let tau = 1; tau <= maxLag; tau++) {
    let sum = 0;
    for (let i = 0; i < w; i++) {
      const diff = buf[i] - buf[i + tau];
      sum += diff * diff;
    }
    d[tau] = sum;
  }
  // Cumulative mean normalised difference.
  const cmnd = new Float32Array(maxLag + 1);
  cmnd[0] = 1;
  let running = 0;
  for (let tau = 1; tau <= maxLag; tau++) {
    running += d[tau];
    cmnd[tau] = running === 0 ? 1 : (d[tau] * tau) / running;
  }
  let tau = -1;
  for (let t = minLag; t <= maxLag; t++) {
    if (cmnd[t] < threshold) {
      while (t + 1 <= maxLag && cmnd[t + 1] < cmnd[t]) t++;
      tau = t;
      break;
    }
  }
  if (tau < 0) return null;
  // Parabolic interpolation around the minimum.
  let better = tau;
  if (tau > 1 && tau < maxLag) {
    const a = cmnd[tau - 1];
    const b = cmnd[tau];
    const c = cmnd[tau + 1];
    const denom = a + c - 2 * b;
    if (denom !== 0) better = tau + (a - c) / (2 * denom);
  }
  return { freq: sampleRate / better, clarity: 1 - cmnd[tau], rms };
}
