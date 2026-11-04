import { useRef, useState } from 'react';
import { playSequence } from '../audio/engine';
import { BLOCK_INFO, BLOCK_ORDER, BUILDERS } from '../data/exercises';
import { rngFrom } from '../data/rng';
import type { BlockId } from '../data/types';
import { RIFFS, RIFF_STAGES } from '../data/riffs';
import { POOLS, START_BPM, STAGE_INFO, UNLOCK_DAYS, poolCycle, riffWeek, scaleStage } from '../logic/plan';
import type { AppState, Settings } from '../logic/state';
import { ROOT_ROTATION, SCALE_ROTATION, getScale } from '../music/scales';
import { TUNINGS, isDrop, noteName, tuningById, type Tuning } from '../music/theory';

// Setup on first start, the tuning picker, and the guide ("Anleitung"):
// how the daily lesson is put together, what the tabs do, where to set what.

/** Short names for the rotation lists – a few builder titles only make sense inside a session. */
const TITLE_OVERRIDE: Record<string, string> = { A3: 'Kurzer Skalen-Lauf', B1: 'Chromatik über alle Saiten', B4: 'Moll-Griffbild als Legato', E7: 'Sweep-Picking (Dreiklänge)', E8: 'Sweep-Arpeggio' };

function poolTitles(block: keyof typeof POOLS) {
  const ctx = { rng: rngFrom('guide'), vary: false, scale: getScale('aeolian') };
  return POOLS[block].keys.map((k) => TITLE_OVERRIDE[k] ?? BUILDERS[k](ctx).title);
}

const BLOCK_TEXT: Record<BlockId, (s: Settings) => string> = {
  speed: () => `${POOLS.speed.perDay} von ${POOLS.speed.keys.length} Übungen im Wechsel`,
  accuracy: () => `${POOLS.accuracy.perDay} von ${POOLS.accuracy.keys.length} Übungen im Wechsel`,
  rhythm: () => `1 von ${POOLS.rhythm.keys.length} Übungen im Wechsel`,
  riff: () => 'Ein Riff für die ganze Woche – jede Lektion ein Schritt weiter, bis du es auswendig spielst',
  scale: (s) => `Die aktuelle Skala – sie bleibt ${s.scaleSessions} ${s.scaleSessions === 1 ? 'Lektion' : 'Lektionen'}, jedes Mal mit anderen Aufgaben`,
  chords: () => 'Eine Akkordfolge aus genau dieser Skala und Tonart, die App spielt auf Wunsch mit',
  improv: () => 'Mit der Skala über diese Akkordfolge improvisieren',
};

const stringList = (t: Tuning) => t.names.join(' ');

// ---------------------------------------------------------------------------
// Tuning picker
// ---------------------------------------------------------------------------

export function TuningPicker({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const cur = tuningById(value);
  const count = cur.strings.length;
  // Switching 6 ↔ 7 strings comes back to the tuning chosen there before.
  const last = useRef<Record<number, string>>({ 6: 'drop-c', 7: '7-b-std', [count]: cur.id });
  last.current[count] = cur.id;
  const options = TUNINGS.filter((t) => t.strings.length === count);
  const groups = [
    { title: 'Drop-Stimmungen', list: options.filter(isDrop) },
    { title: 'Standard-Stimmungen', list: options.filter((t) => !isDrop(t)) },
  ];

  return (
    <div className="tuning-picker">
      <span className="label">Saiten</span>
      <div className="seg">
        {[6, 7].map((n) => (
          <button key={n} className={count === n ? 'on' : ''} onClick={() => n !== count && onChange(last.current[n])}>
            {n} Saiten
          </button>
        ))}
      </div>

      {groups.map((g) => (
        <div key={g.title}>
          <span className="label">{g.title}</span>
          <div className="tuning-list" role="radiogroup" aria-label={g.title}>
            {g.list.map((t) => (
              <button key={t.id} role="radio" aria-checked={t.id === cur.id} className={`tuning-opt${t.id === cur.id ? ' on' : ''}`} onClick={() => onChange(t.id)}>
                <b>{t.name}</b>
                <span className="tuning-notes">{stringList(t)}</span>
              </button>
            ))}
          </div>
        </div>
      ))}

      <div className="row wrap">
        <button className="btn ghost small" onClick={() => playSequence(cur.strings, 100)}>
          ▶ Leersaiten anhören
        </button>
        <span className="small muted">
          Tiefste Saite zuerst: {stringList(cur)}
        </span>
      </div>
      <p className="small muted">
        Deine Stimmung ist nicht dabei? Nimm die mit demselben Muster (Drop oder Standard) – Griffbilder und Bünde passen dann, nur die Tonnamen sind verschoben.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Guide sections
// ---------------------------------------------------------------------------

function nextScaleName(state: AppState) {
  const s = state.scale;
  const i = SCALE_ROTATION.indexOf(s.id);
  const r = ROOT_ROTATION.indexOf(s.root ?? 0);
  return getScale(SCALE_ROTATION[(i + 1) % SCALE_ROTATION.length], ROOT_ROTATION[(r + 1) % ROOT_ROTATION.length]).name;
}

export function PlanGuide({ state }: { state: AppState }) {
  const s = state.settings;
  const total = Math.max(1, s.scaleSessions);
  const scale = getScale(state.scale.id, state.scale.root ?? 0);
  const keys = ROOT_ROTATION.map(noteName).join(', ');

  return (
    <div className="guide">
      <p>
        Jede Lektion dauert 30 Minuten und hat immer dieselben {BLOCK_ORDER.length} Blöcke in derselben Reihenfolge. Was <i>in</i> den Blöcken drankommt, rechnet die App aus: wie viele Lektionen du schon
        gespeichert hast, welche Skala gerade dran ist und wie deine letzten Bewertungen waren.
      </p>

      <ol className="guide-blocks">
        {BLOCK_ORDER.map((b) => (
          <li key={b}>
            <div className="guide-block-head">
              <b>{BLOCK_INFO[b].name}</b>
              <span className="muted small">{BLOCK_INFO[b].minutes} Min</span>
            </div>
            <span className="small">{BLOCK_TEXT[b](s)}</span>
            {(b === 'speed' || b === 'accuracy' || b === 'rhythm') && <span className="small muted guide-pool">{poolTitles(b).join(' · ')}</span>}
          </li>
        ))}
      </ol>

      <h3>Warum jeden Tag andere Übungen?</h3>
      <p className="small">
        Die Auswahl rückt mit jeder <b>gespeicherten Lektion</b> eine Stelle weiter – nicht nach Kalendertag. Lässt du einen Tag aus, verpasst du also nichts. Jede Übung kommt spätestens nach{' '}
        {poolCycle('speed')} Lektionen wieder: oft genug, damit das Tempo wachsen kann.
      </p>

      <h3>Skala und Tonart – du bleibst nicht auf C</h3>
      <p className="small">
        Eine Skala bleibt für {total} {total === 1 ? 'Lektion' : 'Lektionen'}. Die erste: kennenlernen (hören, finden).
        {total > 2 && ' Die mittleren: vertiefen (Sequenzen, neue Lagen).'}
        {total > 1 && ' Die letzte: festigen (abrufen, Lagen verbinden, Musik machen).'} Danach kommt automatisch die nächste Skala <b>mit neuem Grundton</b>. Die Grundtöne laufen der Reihe
        nach durch alle zwölf Tonarten: {keys}.
      </p>
      <div className="guide-now small">
        <b>Bei dir gerade:</b> {scale.name}, Lektion {(state.scale.sessions % total) + 1} von {total} ({STAGE_INFO[scaleStage(state)].split(':')[0]}).{' '}
        {state.scale.pinned ? 'Die Skala ist fixiert und wechselt nicht automatisch.' : `Danach: ${nextScaleName(state)}.`}
      </div>
      <p className="small">
        <b>Das ganze Griffbrett:</b> Jede Skala hat mehrere Lagen – sieben bei Skalen mit sieben Tönen, fünf bei Pentatoniken. Am ersten Tag lernst du Lage 1, an den folgenden Tagen
        kommen die übrigen dazu und werden mit den bekannten verbunden. Zusammen decken sie jeden Ton der Skala auf jeder Saite ab.{' '}
        {total >= 3
          ? 'Mit deiner Einstellung kommen alle Lagen innerhalb einer Skala dran.'
          : 'Dafür braucht eine Skala mindestens 3 Lektionen (Mehr → Lektionen pro Skala); unter Skalen → Alle Lagen siehst du sie jederzeit.'}
      </p>
      <p className="small">
        Lieber eine bestimmte Skala oder Tonart? Unter <b>Skalen</b> auswählen und „Ab der nächsten Einheit üben“ tippen. Mit „Länger bei dieser Skala bleiben“ wird sie fixiert.
      </p>
      <p className="small muted">Tonart ist nicht Stimmung: Die Tonart wechselt mit jeder Skala. Die Stimmung deiner Gitarre legst du einmal fest (Mehr → Gitarre).</p>

      <h3>Riff der Woche</h3>
      <p className="small">
        Jede Kalenderwoche, in der du übst, bringt ein neues Riff – {RIFFS.length} Riffs von leicht bis schwer, alle auf den tiefen Saiten und passend zu deiner Stimmung. Die Lektionen der Woche
        bauen aufeinander auf: {RIFF_STAGES.join(' → ')}. Die App kann das Riff vorspielen (Vorspielen), ab der zweiten Lektion wächst das Tempo mit deinen Bewertungen.
      </p>
      <div className="guide-now small">
        <b>Diese Woche:</b> {RIFFS[riffWeek(state).index % RIFFS.length].name}, Lektion {riffWeek(state).lesson + 1} (
        {RIFF_STAGES[Math.min(RIFF_STAGES.length - 1, riffWeek(state).lesson)]}).
      </div>

      <h3>Tempo</h3>
      <p className="small">
        Jede Technik-Übung und jedes Riff beginnt bei {START_BPM} BPM. Nach jeder Übung bewertest du sie: „Sauber &amp; locker“, „Ging so“ oder „Unsauber / verkrampft“. Zweimal hintereinander sauber = beim
        nächsten Mal +{s.tempoStep} BPM, zweimal unsauber = −{s.tempoStep} BPM. Das Tempo merkt sich die App für jede Übung einzeln.
      </p>

      <h3>Die ersten {UNLOCK_DAYS} Tage</h3>
      <p className="small">
        Zuerst bleiben Fingerfolgen und Lagen gleich, damit sich eine saubere, lockere Bewegung festigt. Danach variieren Fingerfolgen, Lagen und Saitenpaare – Abwechslung bringt dann mehr als
        stures Wiederholen, weil du die Technik auf neue Stellen übertragen musst. Dazu kommen besondere Tage: der <b>Kontrolltag</b> (alles 10 % langsamer, maximale Sauberkeit) und der{' '}
        <b>Push-Tag</b> (Burst-Übungen +6 BPM, kurze Sprints statt Dauersprint). Mit „Neu würfeln“ auf <b>Heute</b> bekommst du andere Varianten.
      </p>

      <h3>Nach der Lektion</h3>
      <p className="small">
        Drei kurze Checks und eine Notiz für den nächsten Fokus – die Notiz steht beim nächsten Mal auf <b>Heute</b>. Erst mit dem Speichern zählt die Lektion: Tempo, Skalen-Fortschritt und die
        Rotation gehen dann weiter.
      </p>
    </div>
  );
}

const MENU: { tab: string; text: string }[] = [
  { tab: 'Heute', text: 'Deine Lektion für heute: Skala und Tonart, Akkordfolge, alle Übungen mit Tempo. Unten startest du sie.' },
  { tab: 'Treffer', text: 'Freies Griffbrett-Training: Die App nennt Ton und Saite, du spielst ihn – mit Mikrofon prüft sie selbst. Skala, Grundton, Saiten und Bünde frei wählbar.' },
  { tab: 'Skalen', text: 'Alle Skalen in allen Tonarten mit Griffbrett, Anhören und Hör-Quiz. Hier wählst du auch, welche Skala als Nächstes in deiner Lektion kommt.' },
  { tab: 'Fortschritt', text: 'Level, Wochenziel, Übungskalender, Erfolge, Skalen-Sterne und das Tempo jeder Übung im Verlauf.' },
  { tab: 'Mehr', text: 'Einstellungen: Gitarre und Stimmung, Variationen, Tempo-Schritt, Wochenziel, Metronom, Daten sichern – und diese Anleitung.' },
];

export function MenuGuide() {
  return (
    <dl className="guide-menu">
      {MENU.map((m) => (
        <div key={m.tab}>
          <dt>{m.tab}</dt>
          <dd className="small">{m.text}</dd>
        </div>
      ))}
      <p className="small muted">Treffer-Training und Hör-Quiz zählen für Erfolge, aber nicht als Lektion.</p>
    </dl>
  );
}

const WHERE: [string, string][] = [
  ['Stimmung und Saitenzahl', 'Mehr → Gitarre'],
  ['Nächste Skala oder Tonart', 'Skalen → Skala und Grundton wählen → „Ab der nächsten Einheit üben“'],
  ['Bei einer Skala bleiben', 'Skalen → „Länger bei dieser Skala bleiben“'],
  ['Wie lange eine Skala bleibt', 'Mehr → Lektionen pro Skala'],
  ['Wie schnell das Tempo steigt', 'Mehr → Tempo-Schritt'],
  ['Variationen an oder aus', 'Mehr → Variationen'],
  ['Heute andere Varianten', 'Heute → „Neu würfeln“ (wenn Variationen aktiv)'],
  ['Wochenziel', 'Mehr → Wochenziel'],
  ['Metronom, Drone, Auto-Start', 'Mehr'],
  ['Daten auf ein anderes Gerät', 'Mehr → Exportieren / Importieren'],
  ['Diese Anleitung', 'Heute → „?“ oder Mehr → Anleitung'],
];

export function WhereGuide() {
  return (
    <table className="guide-where">
      <tbody>
        {WHERE.map(([what, where]) => (
          <tr key={what}>
            <th scope="row">{what}</th>
            <td>{where}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ---------------------------------------------------------------------------
// First start
// ---------------------------------------------------------------------------

const STEPS = ['Willkommen', 'Deine Gitarre', 'Deine Lektion', 'Menü'] as const;

interface OnboardingProps {
  state: AppState;
  onSettings: (s: Partial<Settings>) => void;
}

export function Onboarding({ state, onSettings }: OnboardingProps) {
  const [step, setStep] = useState(0);
  const returning = state.sessions.length > 0;
  const last = step === STEPS.length - 1;
  const go = (i: number) => {
    setStep(i);
    window.scrollTo(0, 0);
  };

  return (
    <div className="onboarding">
      <div className="steps" aria-label={`Schritt ${step + 1} von ${STEPS.length}`}>
        {STEPS.map((s, i) => (
          <span key={s} className={i === step ? 'on' : i < step ? 'past' : ''} />
        ))}
      </div>
      <p className="eyebrow">
        {step + 1}/{STEPS.length} · {STEPS[step]}
      </p>

      {step === 0 && (
        <section>
          <h1>{returning ? 'Neu: Deine Gitarre und eine Anleitung' : 'Willkommen'}</h1>
          <p>
            {returning
              ? 'Die App kennt jetzt verschiedene Stimmungen und Gitarren mit 6 oder 7 Saiten. Einmal kurz einrichten – danach erklärt sie dir, wie deine Lektionen entstehen und wo du was einstellst.'
              : 'Die App stellt dir jeden Tag eine 30-Minuten-Lektion zusammen: Technik, Rhythmus, ein Riff der Woche, eine Skala, eine Akkordfolge und Improvisation. Erst richtest du deine Gitarre ein, dann zeigt sie dir in zwei Schritten, wie alles funktioniert.'}
          </p>
          <ul className="small guide-points">
            <li>Dein Fortschritt bleibt erhalten – auch wenn du die Stimmung später wechselst.</li>
            <li>Alles lässt sich später unter <b>Mehr</b> ändern; die Anleitung findest du jederzeit über das <b>?</b> auf Heute.</li>
          </ul>
        </section>
      )}

      {step === 1 && (
        <section>
          <h1>Wie ist deine Gitarre gestimmt?</h1>
          <p className="small">
            Skalen-Griffbilder, Powerchords, Oktaven, Tabs und Saitennamen werden für diese Stimmung berechnet. Du kannst sie später jederzeit wechseln.
          </p>
          <section className="card">
            <TuningPicker value={state.settings.tuning} onChange={(id) => onSettings({ tuning: id })} />
          </section>
        </section>
      )}

      {step === 2 && (
        <section>
          <h1>So entsteht deine Lektion</h1>
          <PlanGuide state={state} />
        </section>
      )}

      {step === 3 && (
        <section>
          <h1>Die Menüpunkte</h1>
          <p className="small muted">Unten in der Leiste:</p>
          <MenuGuide />
          <h3>Wo stelle ich was ein?</h3>
          <WhereGuide />
        </section>
      )}

      <div className="onboarding-nav">
        {step > 0 ? (
          <button className="btn ghost" onClick={() => go(step - 1)}>
            Zurück
          </button>
        ) : (
          <span />
        )}
        {last ? (
          <button className="btn primary" onClick={() => onSettings({ onboarded: true })}>
            Los geht's
          </button>
        ) : (
          <button className="btn primary" onClick={() => go(step + 1)}>
            {step === 1 ? `Weiter mit ${tuningById(state.settings.tuning).name}` : 'Weiter'}
          </button>
        )}
      </div>
      {step >= 2 && !last && (
        <p className="center">
          <button className="link small" onClick={() => onSettings({ onboarded: true })}>
            Erklärung überspringen
          </button>
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Guide screen (from Home "?" and Mehr)
// ---------------------------------------------------------------------------

interface GuideProps {
  state: AppState;
  onSettings: (s: Partial<Settings>) => void;
  go: (screen: 'home' | 'settings') => void;
}

export function GuideScreen({ state, onSettings, go }: GuideProps) {
  const t = tuningById(state.settings.tuning);
  return (
    <div className="guide-screen">
      <button className="link small" onClick={() => go('home')}>
        ← Heute
      </button>
      <h1>Anleitung</h1>

      <section className="card">
        <p className="eyebrow">Deine Gitarre</p>
        <p>
          <b>{t.name}</b> · {t.strings.length} Saiten · <span className="tuning-notes">{stringList(t)}</span>
        </p>
        <button className="btn ghost small" onClick={() => go('settings')}>
          Stimmung ändern
        </button>
      </section>

      <section className="card">
        <h2>So entsteht deine Lektion</h2>
        <PlanGuide state={state} />
      </section>

      <section className="card">
        <h2>Die Menüpunkte</h2>
        <MenuGuide />
      </section>

      <section className="card">
        <h2>Wo stelle ich was ein?</h2>
        <WhereGuide />
      </section>

      <p className="center">
        <button className="btn ghost small" onClick={() => onSettings({ onboarded: false })}>
          Einrichtung noch einmal durchgehen
        </button>
      </p>
    </div>
  );
}
