import { describe, expect, it } from 'vitest';
import { BLOCK_INFO, BLOCK_ORDER, BUILDERS, PHRASES, moduleA, moduleB, moduleD, patternNotes, scaleBlock, type BuildCtx, type ScaleStage } from '../data/exercises';
import { rngFrom } from '../data/rng';
import { seconds, type Exercise } from '../data/types';
import { progressionFor } from '../music/chords';
import { NATURAL_MINOR, ROOT_ROTATION, SCALES, SCALE_ROTATION, getScale } from '../music/scales';
import { fretMidi, inScale } from '../music/theory';
import { POOLS, advanceScale, applyRating, bpmFor, buildPlan, poolKeys, scaleStage, streak } from './plan';
import { initialState, type AppState, type SessionLog } from './state';

const STAGES: ScaleStage[] = ['learn', 'deepen', 'apply'];

const allPatterns = (e: Exercise) => [e.pattern, ...e.phases.map((p) => p.pattern), ...e.phases.map((p) => p.pick?.build(0))];

describe('modules', () => {
  const ctx = { rng: rngFrom('x'), vary: false, scale: getScale('dorian') };
  it('booklet modules A and B last 15 minutes', () => {
    for (const mod of [moduleA(ctx), moduleB(ctx)]) {
      expect(mod.reduce((a, e) => a + seconds(e), 0)).toBe(900);
    }
  });
  it('booklet versions of A match the tabs', () => {
    const a = moduleA(ctx);
    const frets = (e: Exercise) => patternNotes(e.pattern).map((x) => `${x.s}:${x.f}`).join(' ');
    expect(frets(a[0])).toBe('4:5 4:6 4:7 4:8 5:5 5:6 5:7 5:8 5:8 5:7 5:6 5:5 4:8 4:7 4:6 4:5');
    expect(frets(a[1])).toBe('4:5 4:7 4:6 4:8 5:5 5:7 5:6 5:8 5:8 5:6 5:7 5:5 4:8 4:6 4:7 4:5');
    expect(frets(a[2])).toBe('4:5 4:6 4:8 5:5 5:6 5:8 5:8 5:6 5:5 4:8 4:6 4:5');
    expect(frets(a[4])).toBe('3:7 3:9 3:10 5:5 5:6 5:8 5:8 5:6 5:5 3:10 3:9 3:7');
    expect(a.every((e) => !e.variant)).toBe(true);
  });
  it('patterns: whole bars, valid frets, notes in the right scale and key', () => {
    for (let seed = 0; seed < 12; seed++) {
      for (const card of SCALES) {
        const root = ROOT_ROTATION[seed % 12];
        const sc = getScale(card.id, root);
        const c: BuildCtx = { rng: rngFrom('s' + seed), vary: true, scale: sc, stage: STAGES[seed % 3], progression: progressionFor(sc, seed) };
        const all = [...moduleA(c), ...moduleB(c), ...moduleD(c), ...STAGES.flatMap((stage) => scaleBlock({ ...c, stage })), ...Object.values(BUILDERS).map((b) => b(c))];
        for (const e of all) {
          for (const p of e.phases) {
            const pat = p.pattern ?? e.pattern;
            if (pat && !p.groups) expect(pat.length % (p.sub * (p.beats ?? 4)), `${e.key} ${p.label}`).toBe(0);
          }
          for (const pat of allPatterns(e)) {
            for (const nt of patternNotes(pat)) {
              expect(nt.f, `${e.key} ${sc.name}`).toBeGreaterThanOrEqual(0);
              expect(nt.f, `${e.key} ${sc.name}`).toBeLessThanOrEqual(17);
              const scale = ['A3', 'A5', 'B3', 'B4', 'B5'].includes(e.key)
                ? e.scaleId
                  ? getScale(e.scaleId, e.root)
                  : NATURAL_MINOR
                : e.module === 'C' || ['E1', 'E3', 'E6'].includes(e.key)
                  ? getScale(e.scaleId ?? sc.id, e.root ?? sc.root)
                  : null;
              if (scale) expect(inScale(scale, fretMidi(nt.s, nt.f)), `${e.key} ${scale.name} ${nt.s}:${nt.f}`).toBe(true);
            }
          }
        }
      }
    }
  }, 30000); // brute force over all variants × scales × keys
  it('solo phrases are in C minor and end on C', () => {
    for (const p of PHRASES) {
      p.notes.forEach(([s, f]) => expect(inScale(NATURAL_MINOR, fretMidi(s, f))).toBe(true));
      const [s, f] = p.notes[4];
      expect(fretMidi(s, f) % 12).toBe(0);
    }
  });
});

const log = (modules: SessionLog['modules']): SessionLog => ({
  id: String(Math.random()), date: new Date().toISOString(), modules, focus: 'standard', seconds: 900, results: [], checks: [true, true, true], note: '',
});

describe('polyrhythm module', () => {
  const at = (steps: Exercise['pattern']) => (steps ?? []).flatMap((st, i) => (typeof st === 'object' ? [i] : []));
  it('lasts 15 minutes, every pattern fills whole bars of its meter', () => {
    for (let seed = 0; seed < 20; seed++) {
      const d = moduleD({ rng: rngFrom('d' + seed), vary: seed > 0, scale: getScale('dorian') });
      expect(d.reduce((a, e) => a + seconds(e), 0)).toBe(900);
      for (const e of d)
        for (const p of e.phases) {
          if (p.pattern) expect(p.pattern.length % (p.sub * (p.beats ?? 4)), `${e.key} ${p.label}`).toBe(0);
          if (p.layer) expect(p.pattern, `${e.key} ${p.label}`).toBeDefined();
          for (const nt of patternNotes(p.pattern)) expect(nt.f).toBeLessThanOrEqual(17);
        }
    }
  });
  it('places the counter-rhythm evenly against the click', () => {
    const [d1, d2, d3, d4] = moduleD({ rng: rngFrom('x'), vary: false, scale: getScale('dorian') });
    expect(at(d1.phases[0].pattern)).toEqual([0, 2, 4, 6, 8, 10]); // 3:2 – triplet grid, 3 beats per 2 clicks
    expect(at(d2.phases[0].pattern)).toEqual([0, 3]); // 2:3 in 3/4
    expect(at(d2.phases[2].pattern)).toEqual([0, 3, 6, 9]); // 4:3 in 3/4
    expect(at(d3.phases[0].pattern)).toEqual([0, 4, 8]); // 3:4
    expect(d4.phases[1].pattern).toHaveLength(48); // groups of 3 sixteenths → back on the "1" after 3 bars
    expect(d4.phases[2].pattern).toHaveLength(80); // groups of 5 → 5 bars
  });
});

describe('daily plan', () => {
  const played = (s: AppState, n: number) => {
    for (let i = 0; i < n; i++) s.sessions.push(log(['A']));
  };
  it('always 30 minutes, split into the six blocks', () => {
    const s: AppState = initialState();
    for (let day = 0; day < 30; day++) {
      s.scale = { id: SCALE_ROTATION[day % SCALE_ROTATION.length], root: ROOT_ROTATION[day % 12], sessions: day % 3, pinned: false };
      const p = buildPlan(s, '2026-11-03');
      expect(p.exercises.reduce((a, e) => a + seconds(e), 0)).toBe(1800);
      for (const b of BLOCK_ORDER) expect(p.exercises.filter((e) => e.block === b).reduce((a, e) => a + seconds(e), 0), `${b} day ${day}`).toBe(BLOCK_INFO[b].minutes * 60);
      expect(p.blocks).toEqual(BLOCK_ORDER);
      played(s, 1);
    }
  });
  it('technique exercises change every day and come back within three days', () => {
    for (const block of ['speed', 'accuracy'] as const) {
      expect(poolKeys(block, 0)).not.toEqual(poolKeys(block, 1));
      const seen = new Set([0, 1, 2].flatMap((d) => poolKeys(block, d)));
      expect(seen.size).toBe(POOLS[block].keys.length);
    }
    expect(poolKeys('rhythm', 0)).not.toEqual(poolKeys('rhythm', 1));
  });
  it('scale block: learn → deepen → apply, then the next scale with a new tonic', () => {
    const s: AppState = initialState();
    s.scale = { id: 'aeolian', root: 0, sessions: 0, pinned: false };
    const stages = [];
    for (let i = 0; i < 3; i++) {
      stages.push(scaleStage(s));
      expect(buildPlan(s).root).toBe(0);
      s.scale = advanceScale(s);
    }
    expect(stages).toEqual(['learn', 'deepen', 'apply']);
    expect(s.scale).toEqual({ id: 'pentatonic', root: ROOT_ROTATION[1], sessions: 0, pinned: false });
    const p = buildPlan(s);
    expect(p.scaleId).toBe('pentatonic');
    expect(p.root).toBe(ROOT_ROTATION[1]);
    expect(p.exercises.find((e) => e.key === 'C1')?.root).toBe(ROOT_ROTATION[1]);
  });
  it('chords and improvisation use the day\'s key and progression', () => {
    const s: AppState = initialState();
    s.scale = { id: 'dorian', root: 2, sessions: 1, pinned: false };
    const p = buildPlan(s);
    expect(p.progression.map((c) => c.name)[0]).toBe('Dm');
    const k = p.exercises.find((e) => e.key === 'K1')!;
    expect(k.phases.every((ph) => ph.chords && ph.chords.slots.length === p.progression.length)).toBe(true);
    expect(p.exercises.find((e) => e.key === 'I1')!.phases.every((ph) => ph.backing)).toBe(true);
  });
  it('progression changes from day to day', () => {
    const s: AppState = initialState();
    const a = buildPlan(s).progression.map((c) => c.roman).join();
    played(s, 1);
    expect(buildPlan(s).progression.map((c) => c.roman).join()).not.toBe(a);
  });
  it('variations stay off for the first 14 days', () => {
    const s: AppState = initialState();
    s.firstDay = '2026-11-01';
    expect(buildPlan(s, '2026-11-10').vary).toBe(false);
    expect(buildPlan(s, '2026-11-15').vary).toBe(true);
  });
  it('pinned scale stays and keeps cycling through the stages', () => {
    const s: AppState = initialState();
    s.scale = { id: 'dorian', root: 7, sessions: 2, pinned: true };
    s.scale = advanceScale(s);
    expect(s.scale.id).toBe('dorian');
    expect(scaleStage(s)).toBe('learn');
  });
});

describe('tempo progression', () => {
  it('+2 after two clean sessions, -2 after two rough', () => {
    let r = applyRating(undefined, 80, 'clean', 'standard', 2);
    expect(r.next.bpm).toBe(80);
    r = applyRating(r.next, 80, 'ok', 'standard', 2);
    r = applyRating(r.next, 80, 'clean', 'standard', 2);
    expect(r.next.bpm).toBe(82);
    expect(r.change).toBe(2);
    r = applyRating(r.next, 82, 'rough', 'standard', 2);
    r = applyRating(r.next, 82, 'rough', 'standard', 2);
    expect(r.next.bpm).toBe(80);
  });
  it('never drops below the 80 BPM start', () => {
    let r = applyRating(undefined, 80, 'rough', 'standard', 2);
    r = applyRating(r.next, 80, 'rough', 'standard', 2);
    expect(r.next.bpm).toBe(80);
  });
  it('every exercise starts at 80 BPM, older lower tempos are raised', () => {
    const s = initialState();
    const a1 = buildPlan(s).exercises.find((e) => e.key === 'A1')!;
    expect(bpmFor(s, a1, 'standard')).toBe(80);
    s.tempo.A1 = { bpm: 64, clean: 0, rough: 0, history: [] };
    expect(bpmFor(s, a1, 'standard')).toBe(80);
    s.tempo.A1.bpm = 90;
    expect(bpmFor(s, a1, 'standard')).toBe(90);
  });
  it('control days never change tempo', () => {
    const t = { bpm: 90, clean: 1, rough: 0, history: [] };
    expect(applyRating(t, 81, 'clean', 'control', 2).next.bpm).toBe(90);
  });
  it('push days do not store the boost', () => {
    const t = { bpm: 90, clean: 0, rough: 0, history: [] };
    expect(applyRating(t, 96, 'ok', 'push', 2).next.bpm).toBe(90);
  });
});

describe('streak', () => {
  it('counts consecutive days', () => {
    const s = initialState();
    s.sessions = ['2026-11-01T18:00:00', '2026-11-02T18:00:00', '2026-10-30T18:00:00'].map((d) => ({ ...log(['A']), date: d }));
    expect(streak(s, '2026-11-02')).toBe(2);
    expect(streak(s, '2026-11-03')).toBe(2);
    expect(streak(s, '2026-11-04')).toBe(0);
  });
});
