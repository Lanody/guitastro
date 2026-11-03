import { midiToFreq } from '../music/theory';

let ctx: AudioContext | null = null;
let master: GainNode | null = null;

export function audio() {
  if (!ctx) {
    ctx = new AudioContext({ latencyHint: 'interactive' });
    master = ctx.createGain();
    master.gain.value = 0.9;
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return { ctx, out: master! };
}

// ---------------------------------------------------------------------------
// Metronome — look-ahead scheduler on the audio clock, so clicks stay tight
// even when the UI thread is busy. The pulse is a continuous beat grid:
// tempo and note value can change mid-run without the "1" jumping.
// An optional second voice (`layer`) plays a counter-rhythm, e.g. the "3"
// of a 3:2 polyrhythm, in a softer, lower sound than the beat click.
// Optional backing chords (`chords`) follow the same clock, so the screen can
// ask which chord is sounding right now.
// ---------------------------------------------------------------------------

export interface MetronomeChords {
  /** Changes when the progression or its timing changes – restarts it on the next "1". */
  id: string;
  midis: number[][];
  beatsPer: number;
  /** Strum the chords (otherwise only tracked, for the display). */
  audible: boolean;
}

export interface MetronomeOptions {
  bpm: number;
  /** Grid steps per beat (2 = eighths, 3 = triplets, 4 = sixteenths). */
  sub: number;
  /** Audible click on subdivisions, not only on the beat. */
  clickSub: boolean;
  beatsPerBar: number;
  volume: number;
  /** Second voice: sounds on every grid step where `hits` is true (loops over whole bars). */
  layer: { sub: number; hits: boolean[] } | null;
  /** Audible beat click (off: the clock still runs for the chords). */
  click: boolean;
  chords: MetronomeChords | null;
}

const LOOKAHEAD = 0.12;

export class Metronome {
  opts: MetronomeOptions = { bpm: 80, sub: 2, clickSub: false, beatsPerBar: 4, volume: 0.7, layer: null, click: true, chords: null };
  private timer: number | null = null;
  private nextTime = 0;
  private beat = 0;
  /** Step within the current beat and the grid in use for that beat. */
  private inBeat = 0;
  private sub = 2;
  /** Scheduled click voices (silenced on stop). */
  private voices: { osc: OscillatorNode; time: number }[] = [];
  /** Beat on which the current progression started, and when each chord begins. */
  private chordOrigin: number | null = null;
  private chordLog: { time: number; index: number }[] = [];
  private strums: Voice[] = [];

  get running() {
    return this.timer !== null;
  }

  /** Tempo changes apply from the next step, a new note value from the next beat. */
  set(o: Partial<MetronomeOptions>) {
    if (o.chords !== undefined && o.chords?.id !== this.opts.chords?.id) this.resetChords();
    this.opts = { ...this.opts, ...o };
  }

  private resetChords() {
    this.chordOrigin = null;
    this.chordLog = [];
  }

  /** Index of the chord sounding now, or -1 (stopped, or waiting for the next "1"). */
  chordNow() {
    if (!ctx || !this.running) return -1;
    const now = ctx.currentTime;
    let idx = -1;
    for (const c of this.chordLog) if (c.time <= now) idx = c.index;
    return idx;
  }

  start() {
    if (this.running) return;
    const { ctx } = audio();
    this.beat = 0;
    this.inBeat = 0;
    this.resetChords();
    this.nextTime = ctx.currentTime + 0.08;
    this.timer = window.setInterval(() => this.schedule(), 25);
    this.schedule();
  }

  stop() {
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;
    // Silence clicks that were already scheduled ahead.
    if (ctx) {
      const now = ctx.currentTime;
      for (const v of this.voices) {
        try {
          if (v.time > now) v.osc.stop();
        } catch {
          /* older Safari: stop() may only be called once */
        }
      }
      for (const v of this.strums) v.stop(now);
    }
    this.voices = [];
    this.strums = [];
  }

  private schedule() {
    const { ctx, out } = audio();
    const { bpm, clickSub, beatsPerBar, volume, layer, click: clickOn, chords } = this.opts;
    while (this.nextTime < ctx.currentTime + LOOKAHEAD) {
      if (this.inBeat === 0) this.sub = this.opts.sub;
      const onBeat = this.inBeat === 0;
      const barStart = onBeat && this.beat % beatsPerBar === 0;
      if (onBeat && chords?.midis.length) {
        if (this.chordOrigin === null && barStart) this.chordOrigin = this.beat;
        if (this.chordOrigin !== null) {
          const rel = this.beat - this.chordOrigin;
          const index = Math.floor(rel / chords.beatsPer) % chords.midis.length;
          const change = rel % chords.beatsPer === 0;
          if (change) this.chordLog = [...this.chordLog.filter((c) => c.time > ctx.currentTime - 4), { time: this.nextTime, index }];
          // Strum on every chord change, softer on the other half-bar beats.
          if (chords.audible && (change || rel % 2 === 0)) {
            const dur = Math.min(2.4, (60 / bpm) * Math.min(chords.beatsPer, 2));
            this.strums.push(strum(ctx, out, this.nextTime, chords.midis[index], change ? 0.55 : 0.3, dur));
          }
        }
      }
      if (clickOn && (onBeat || clickSub)) {
        const osc = click(ctx, out, this.nextTime, barStart ? 1 : onBeat ? 0.6 : 0.25, volume, barStart ? 1600 : onBeat ? 1100 : 900);
        this.voices.push({ osc, time: this.nextTime });
      }
      if (layer?.hits.length && layer.sub === this.sub && layer.hits[(this.beat * this.sub + this.inBeat) % layer.hits.length]) {
        const osc = click(ctx, out, this.nextTime, 0.8, volume, 520, 'triangle');
        this.voices.push({ osc, time: this.nextTime });
      }
      this.nextTime += 60 / bpm / this.sub;
      if (++this.inBeat >= this.sub) {
        this.inBeat = 0;
        this.beat++;
      }
    }
    const now = ctx.currentTime;
    this.voices = this.voices.filter((v) => v.time > now);
    this.strums = this.strums.filter((v) => v.end > now);
  }
}

function click(ctx: AudioContext, out: AudioNode, time: number, level: number, volume: number, freq: number, type: OscillatorType = 'square') {
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  g.gain.setValueAtTime(0, time);
  g.gain.linearRampToValueAtTime(0.35 * level * volume, time + 0.001);
  g.gain.exponentialRampToValueAtTime(0.0001, time + 0.035);
  osc.connect(g).connect(out);
  osc.start(time);
  osc.stop(time + 0.05);
  return osc;
}

export const metronome = new Metronome();

// ---------------------------------------------------------------------------
// Drone — a held low C, as the booklet suggests for Modul C ("Tiefes C als
// gehaltenen Klang"). Filtered saw + sine an octave up.
// ---------------------------------------------------------------------------

let drone: { stop: () => void } | null = null;

export function droneOn(midi = 36, volume = 0.5) {
  droneOff();
  const { ctx, out } = audio();
  const g = ctx.createGain();
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 700;
  lp.Q.value = 0.5;
  const oscs = [
    { type: 'sawtooth' as OscillatorType, f: midiToFreq(midi), lvl: 0.18, detune: -4 },
    { type: 'sawtooth' as OscillatorType, f: midiToFreq(midi), lvl: 0.18, detune: 4 },
    { type: 'sine' as OscillatorType, f: midiToFreq(midi + 12), lvl: 0.25, detune: 0 },
    { type: 'sine' as OscillatorType, f: midiToFreq(midi + 19), lvl: 0.06, detune: 0 },
  ].map((o) => {
    const osc = ctx.createOscillator();
    const og = ctx.createGain();
    osc.type = o.type;
    osc.frequency.value = o.f;
    osc.detune.value = o.detune;
    og.gain.value = o.lvl;
    osc.connect(og).connect(lp);
    osc.start();
    return osc;
  });
  lp.connect(g).connect(out);
  const now = ctx.currentTime;
  g.gain.setValueAtTime(0, now);
  g.gain.linearRampToValueAtTime(volume, now + 0.8);
  drone = {
    stop() {
      const t = ctx.currentTime;
      g.gain.cancelScheduledValues(t);
      g.gain.setValueAtTime(g.gain.value, t);
      g.gain.linearRampToValueAtTime(0, t + 0.4);
      oscs.forEach((o) => o.stop(t + 0.45));
    },
  };
}

export function droneOff() {
  drone?.stop();
  drone = null;
}

export function droneActive() {
  return drone !== null;
}

// ---------------------------------------------------------------------------
// Pluck — simple plucked-string voice to preview notes, scales and motifs.
// ---------------------------------------------------------------------------

interface Voice {
  end: number;
  /** Fade out quickly from `at` on (also before it started). */
  stop: (at: number) => void;
}

function pluckVoice(ctx: AudioContext, out: AudioNode, midi: number, t: number, dur: number, level: number): Voice {
  const f = midiToFreq(midi);
  const g = ctx.createGain();
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.setValueAtTime(Math.min(8000, f * 8), t);
  lp.frequency.exponentialRampToValueAtTime(Math.max(200, f * 1.5), t + dur);
  const oscs = (
    [
      ['sawtooth', 1, 0.25],
      ['triangle', 2, 0.15],
    ] as const
  ).map(([type, mult, lvl]) => {
    const o = ctx.createOscillator();
    const og = ctx.createGain();
    o.type = type;
    o.frequency.value = f * mult;
    og.gain.value = lvl;
    o.connect(og).connect(lp);
    o.start(t);
    o.stop(t + dur + 0.05);
    return o;
  });
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(level, t + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  lp.connect(g).connect(out);
  return {
    end: t + dur,
    stop(at) {
      if (at >= t + dur) return;
      g.gain.cancelScheduledValues(at);
      g.gain.setTargetAtTime(0, at, 0.02);
      oscs.forEach((o) => {
        try {
          o.stop(at + 0.15);
        } catch {
          /* already stopped */
        }
      });
    },
  };
}

export function pluck(midi: number, when = 0, dur = 1.2, level = 0.5) {
  const { ctx, out } = audio();
  pluckVoice(ctx, out, midi, Math.max(ctx.currentTime, when || ctx.currentTime), dur, level);
}

/** A downstroke: the chord's notes from low to high, a few milliseconds apart. */
function strum(ctx: AudioContext, out: AudioNode, time: number, midis: number[], level: number, dur: number): Voice {
  const each = level / Math.sqrt(Math.max(1, midis.length));
  const voices = [...midis].sort((a, b) => a - b).map((m, i) => pluckVoice(ctx, out, m, time + i * 0.014, dur, each));
  return { end: time + dur + 0.1, stop: (at) => voices.forEach((v) => v.stop(at)) };
}

/** Plays a sequence of MIDI notes (null = rest) as even eighths at `bpm`. */
export function playSequence(notes: (number | null)[], bpm = 90): number {
  const { ctx } = audio();
  const step = 60 / bpm / 2;
  const t0 = ctx.currentTime + 0.05;
  notes.forEach((m, i) => m !== null && pluck(m, t0 + i * step, Math.max(0.4, step * 1.8)));
  return notes.length * step * 1000;
}

export function chime() {
  const { ctx } = audio();
  const t = ctx.currentTime + 0.02;
  [84, 88, 91].forEach((m, i) => pluck(m, t + i * 0.09, 0.6, 0.25));
}

export function softCue() {
  const { ctx } = audio();
  pluck(79, ctx.currentTime + 0.01, 0.35, 0.18);
}

// ---------------------------------------------------------------------------
// Microphone input for the hit trainer.
// ---------------------------------------------------------------------------

export async function openMic(): Promise<{ analyser: AnalyserNode; sampleRate: number; close: () => void }> {
  const { ctx } = audio();
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
  });
  const src = ctx.createMediaStreamSource(stream);
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 4096;
  src.connect(analyser);
  return {
    analyser,
    sampleRate: ctx.sampleRate,
    close() {
      src.disconnect();
      stream.getTracks().forEach((t) => t.stop());
    },
  };
}
