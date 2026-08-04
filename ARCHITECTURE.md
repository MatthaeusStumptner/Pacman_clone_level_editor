# Architektur des Franz-&-Lola-Studios

Die Oberfläche verwendet Svelte 5 als dünne, statisch baubare UI-Schicht. Fachlogik, Dokumentzustand und Canvas-Rendering bleiben davon getrennt. Der Editor ist weiterhin eine reine GitHub-Pages-Anwendung ohne eigenen Server.

## Ein Dokument, sieben Arbeitsbereiche

`StudioState` ist die einzige schreibende Instanz für das aktive Level. Jede Änderung läuft über `EditorState`, erzeugt eine neue Dokumentversion, aktualisiert Undo/Redo und wird anschließend automatisch in `localStorage` gespeichert. Komponenten besitzen keine konkurrierenden Kopien des Levels.

Die Oberfläche trennt die benötigten Disziplinen bewusst:

1. **Level** – Raster, Wände, Startpunkte, Regeln und Theme
2. **Objekte** – universelle Assetbibliothek, Platzierung und Animation
3. **Figuren** – Sprite-Sheets, Player States und Verhalten
4. **Cutscenes** – levelgebundene Tracks, Keyframes, Kamera und Dialoge
5. **Ereignisse** – Trigger, Visuals und beide Sprachfassungen
6. **Testspiel** – dieselbe Kamera, Simulation und Cutscene-Wiedergabe wie im Spiel
7. **Live** – sicherer, geführter Publisher

## Module

- `src/App.svelte`: Studio-Shell, Projektleiste, Arbeitsbereichnavigation und Tastenkürzel
- `src/studio/store.svelte.js`: zentraler reaktiver Dokumentzustand und alle Studio-Kommandos
- `src/components/`: eigenständige Arbeitsbereiche und fokussierte Editoren
- `src/editor-state.js`: Levelzustand, Wandzellen, Transaktionen und History
- `src/editor-tools.js`: reine Geometrie, Flood Fill, Gutti-Vorschau und Bildschirmkoordinaten
- `src/object-library.js`: universelle, erweiterbare Sprite-Objektbibliothek in `localStorage`
- `src/character-template.js`: ursprüngliche Franz-&-Lola-Komposition mit fünf Player States
- `src/playtest-engine.js`: deterministische Spielsimulation
- `src/draft-repository.js`: mehrere lokale Levelentwürfe
- `src/publisher-client.js`: kurzlebige Publisher-Sitzung ohne Browser-Secrets
- `src/data/passau-levels.json`: verlustfreier Katalog der neun Passauer Level

## Datenfluss

```text
Passau-Vorlage / Import
          │
          ▼
     EditorState  ◄──── Undo / Redo
          │
          ▼
  StudioState (Svelte-Rune)
    │       │        │
    │       │        └── localStorage-Entwürfe
    │       └─────────── Live-Validierung
    └─────────────────── gemeinsamer Renderer
                              │
                 ┌────────────┼────────────┐
                 ▼            ▼            ▼
             Canvas       Cutscene      Testspiel
```

Svelte-Effekte werden nur an Browsergrenzen verwendet: Canvas-Lebenszyklus, ResizeObserver, Animation Frame und Autosave-Timer. Ableitbare UI-Werte sind `$derived`; das Level selbst bleibt ein unveränderlicher Snapshot aus `EditorState`.

## Gemeinsames Zwischenformat

Renderer, Editor und Spiel verwenden `franz-lola-level` mit `schemaVersion: 1`. Erweiterungen sind optionale, rückwärtskompatible Felder:

- `decorations[].appearance` enthält ein selbstständiges Sprite-Sheet.
- `appearance.stateAnimations` verbindet `idle`, `up`, `right`, `down` und `left` mit frei benannten Animationen.
- `cutscenes[]` gehört immer genau zu einem Level.
- Cutscene-Tracks besitzen die Typen `camera`, `actor`, `object` und `dialogue`.
- Spezialobjekte werden beim Platzieren vollständig eingebettet. Das Spiel benötigt die lokale Editorbibliothek daher nicht.

Der gemeinsame Renderer sampelt Cutscenes und zeichnet dieselben Zwischenstände in Editor und Spiel. Positionen dürfen dabei Bruchteile eines Tiles besitzen. Simulation und Cutscene-Zeit verwenden feste Updates und bleiben bei 60, 120 und 175 Hz gleich schnell.

## Qualitätsgrenze

Reine Fachlogik erhält Node-Tests. Sichtbare Arbeitsabläufe erhalten zusätzlich Chromium-End-to-End-Tests auf Desktop und Mobile. Die vollständige Prüfung umfasst Objektbibliothek, Originalkatalog, History, echte Renderer-Vorschauen aller Figuren, Sprite-States, direkte Elementauswahl, sämtliche neun levelgebundenen Cutscenes und Ereignisse, Testspiel, Publisher, Accessibility und Produktions-Build. Ein separater visueller Playwright-Lauf zeichnet kurze Videos der Figuren-, Ereignis- und Cutscene-Flows unter `output/playwright` auf.
