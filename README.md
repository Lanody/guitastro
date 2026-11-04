# Drop C Trainer

Tägliche 30-Minuten-Einheiten für 6- und 7-saitige Gitarren in Drop- und Standard-Stimmungen. Ursprünglich aufgebaut auf `Drop-C_Trainingsheft_3x15_Minuten.pdf`; Stimmung und Saitenzahl werden beim ersten Start abgefragt (später unter „Mehr → Gitarre“), eine Anleitung erklärt Tagesplan und Menü (Heute → „?“).

## Die 30 Minuten
| Block | Min | Inhalt |
|---|---|---|
| Geschwindigkeit | 6 | 3 Übungen aus einer Rotation (Synchronisation, Bursts, Chromatik, Tremolo, Lauf, Legato, Triller, Sweep-Arpeggio) |
| Treffsicherheit | 6 | 3 Übungen aus einer Rotation (Fingerunabhängigkeit, Saitensprünge, Lagenwechsel, Oktaven, Griffbrett-Treffer, Legato mit drei Tönen pro Saite, Sweep-Picking …) |
| Rhythmus & Timing | 3 | Unterteilungen, Gallop, Synkopen, Stopps, Polyrhythmen |
| Skala | 6 | Eine Skala pro Block (Standard 3 Tage: kennenlernen → vertiefen → festigen), jeder neue Block mit neuem Grundton |
| Akkordfolge | 6 | Folge des Tages in der Tonart der Skala – Powerchords und Dreiklänge, mit Begleitung |
| Anwenden | 3 | Improvisieren mit der Skala über die Akkordfolge |

Die Technik-Übungen wechseln täglich; jede kommt alle 3 Tage wieder, damit das Tempo (+2 BPM nach zwei sauberen Einheiten) wachsen kann.

```bash
npm install
npm run dev      # http://localhost:5173 (und im WLAN über die angezeigte Network-Adresse)
npm test         # prüft u. a. die Griffbilder in Drop C und alle Übungen in allen 12 Stimmungen
npm run build    # Produktions-Build nach dist/
```

## Aufbau
- `src/music/` – Stimmungen (`TUNINGS`, `setTuning` in `theory.ts`), Skalen-Engine in allen 12 Tonarten (Griffbilder werden für die aktive Stimmung berechnet), Akkorde & Griffe (`chords.ts`), YIN-Tonhöhenerkennung
- `src/data/exercises.ts` – Module A/B/C aus dem Heft als Patterns, inkl. Variationen; dazu D (Polyrhythmus), E (Zusatz-Technik inkl. Legato und Sweep-Picking), R (Rhythmus), K (Akkorde), I (Improvisation)
- `src/logic/plan.ts` – Tagesplan (sechs Blöcke, Rotation, Skalen-Block mit Grundton-Wechsel, Tagesfokus), Tempo-Regel
- `src/logic/progress.ts` – XP/Level, Wochenziel, Erfolge, Skalen-Sterne (alles aus den Logs berechnet)
- `src/audio/engine.ts` – Metronom (Audio-Clock-Scheduler, optional mit zweiter Stimme für den Gegenrhythmus und Akkord-Begleitung), Drone, Ton-Vorschau, Mikrofon
- `src/screens/` – Heute, Session, Zusammenfassung, Abschluss, Fortschritt, Skalen (inkl. Hör-Quiz), Treffer-Training, Einstellungen, Einrichtung & Anleitung (`Guide.tsx`)

Daten liegen nur im `localStorage` des Browsers (Export/Import unter „Mehr“).
