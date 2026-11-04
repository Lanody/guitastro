import { useRef } from 'react';
import { audio, metronome } from '../audio/engine';
import { UNLOCK_DAYS } from '../logic/plan';
import { Seg } from '../components/Seg';
import { initialState, type AppState, type Settings } from '../logic/state';
import { TuningPicker } from './Guide';

interface Props {
  state: AppState;
  onSettings: (s: Partial<Settings>) => void;
  onReplace: (s: AppState) => void;
  onGuide: () => void;
}

export function SettingsScreen({ state, onSettings, onReplace, onGuide }: Props) {
  const s = state.settings;
  const file = useRef<HTMLInputElement>(null);

  const exportData = () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `drop-c-trainer-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const importData = async (f: File) => {
    try {
      const data = JSON.parse(await f.text()) as AppState;
      if (data.version !== 1 || !Array.isArray(data.sessions)) throw new Error();
      if (confirm('Aktuelle Daten durch die Datei ersetzen?')) onReplace({ ...initialState(), ...data });
    } catch {
      alert('Die Datei ist kein gültiger Export dieser App.');
    }
  };

  const testClick = () => {
    audio();
    metronome.set({ bpm: 90, sub: 2, clickSub: s.clickSub, volume: s.clickVolume, layer: null });
    metronome.start();
    setTimeout(() => metronome.stop(), 2700);
  };

  return (
    <div className="settings">
      <h1>Einstellungen</h1>

      <section className="card settings-grid">
        <div className="title-row">
          <span className="label">Anleitung</span>
          <button className="btn ghost small" onClick={onGuide}>
            Öffnen
          </button>
        </div>
        <p className="small muted">Wie deine Lektion entsteht, was die Menüpunkte bedeuten und wo du was einstellst.</p>
      </section>

      <section className="card settings-grid">
        <span className="label">Gitarre</span>
        <p className="small muted">
          Skalen-Griffbilder, Akkorde, Oktaven, Tabs und Saitennamen werden für diese Stimmung berechnet. Tempo und Fortschritt bleiben beim Wechsel erhalten.
        </p>
        <TuningPicker value={s.tuning} onChange={(id) => onSettings({ tuning: id })} />
      </section>

      <section className="card settings-grid">
        <div>
          <span className="label">Variationen</span>
          <Seg
            value={s.variation}
            onChange={(variation) => onSettings({ variation })}
            options={[
              { value: 'auto', label: `Nach ${UNLOCK_DAYS} Tagen` },
              { value: 'always', label: 'Sofort' },
              { value: 'never', label: 'Nie' },
            ]}
          />
          <p className="small muted">
            Welche Übungen drankommen, wechselt mit jeder Lektion. Diese Einstellung betrifft die Übungen selbst: Fingerfolgen und Lagen bleiben zunächst zwei Wochen gleich, damit sich eine saubere Bewegung festigt;
            danach variieren auch Fingerfolgen, Lagen und Saitenpaare.
          </p>
        </div>
        <label>
          Tempo-Schritt nach zwei sauberen Einheiten: <b>+{s.tempoStep} BPM</b>
          <input type="range" min={1} max={5} value={s.tempoStep} onChange={(e) => onSettings({ tempoStep: Number(e.target.value) })} />
        </label>
        <label>
          Wochenziel: <b>{s.weeklyGoal} Einheiten pro Woche</b>
          <input type="range" min={1} max={7} value={s.weeklyGoal} onChange={(e) => onSettings({ weeklyGoal: Number(e.target.value) })} />
        </label>
        <label>
          Lektionen pro Skala, bevor die nächste (mit neuem Grundton) kommt: <b>{s.scaleSessions}</b>
          <input type="range" min={1} max={8} value={s.scaleSessions} onChange={(e) => onSettings({ scaleSessions: Number(e.target.value) })} />
          <span className="small muted">Empfohlen: 3 – erste Lektion kennenlernen, zweite vertiefen, dritte festigen.</span>
        </label>
      </section>

      <section className="card settings-grid">
        <label>
          Metronom-Lautstärke
          <input type="range" min={0.1} max={1} step={0.05} value={s.clickVolume} onChange={(e) => onSettings({ clickVolume: Number(e.target.value) })} />
        </label>
        <label>
          Drone-Lautstärke
          <input type="range" min={0.05} max={0.8} step={0.05} value={s.droneVolume} onChange={(e) => onSettings({ droneVolume: Number(e.target.value) })} />
        </label>
        <label className="check">
          <input type="checkbox" checked={s.clickSub} onChange={(e) => onSettings({ clickSub: e.target.checked })} />
          <span>Unterteilungen hörbar klicken (Achtel/Sechzehntel)</span>
        </label>
        <label className="check">
          <input type="checkbox" checked={s.restCue} onChange={(e) => onSettings({ restCue: e.target.checked })} />
          <span>50/10-Hinweis: pro Minute 50 s arbeiten, 10 s lockern</span>
        </label>
        <label className="check">
          <input type="checkbox" checked={s.autoStart} onChange={(e) => onSettings({ autoStart: e.target.checked })} />
          <span>Nächste Übung startet automatisch nach der Bewertung</span>
        </label>
        <button className="btn ghost small" onClick={testClick}>
          Metronom testen
        </button>
      </section>

      <section className="card settings-grid">
        <span className="label">Daten</span>
        <p className="small muted">Alles wird nur lokal in diesem Browser gespeichert. Für ein anderes Gerät exportieren und dort importieren.</p>
        <div className="row wrap">
          <button className="btn ghost small" onClick={exportData}>
            Exportieren
          </button>
          <button className="btn ghost small" onClick={() => file.current?.click()}>
            Importieren
          </button>
          <button
            className="btn bad small"
            onClick={() => confirm('Wirklich alle Einheiten, Tempi und Einstellungen löschen?') && onReplace(initialState())}
          >
            Alles zurücksetzen
          </button>
          <input ref={file} type="file" accept="application/json" hidden onChange={(e) => e.target.files?.[0] && importData(e.target.files[0])} />
        </div>
      </section>
    </div>
  );
}
