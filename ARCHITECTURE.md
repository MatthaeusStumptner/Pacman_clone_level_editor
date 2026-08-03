# Architektur der Levelwerkstatt

Die Oberfläche ist bewusst frameworkfrei. Fachlogik und DOM bleiben getrennt, sodass Werkzeuge unabhängig vom Browser getestet und später in andere Oberflächen eingebettet werden können.

## Module

- `src/catalog.js`: unveränderlicher Passau-Originalkatalog, Suche und sichere Kopien
- `src/editor-state.js`: Levelzustand, Wandzellen, kompakter Export, Transaktionen und History
- `src/editor-tools.js`: reine Geometrie, Flood Fill, Gutti-Vorschau und Kamera-Koordinaten
- `src/draft-repository.js`: versionierter Browser-Arbeitsbereich mit mehreren Entwürfen
- `src/character-template.js`: editierbare Franz-&-Lola-Pixelvorlage mit fünf semantischen Spielerzuständen
- `src/playtest-engine.js`: deterministische, rasterbasierte Testbewegung und Abschlussbedingung
- `src/main.js`: dünne UI-Orchestrierung, Gesten, Dialoge, Import/Export und Rendering
- `src/data/passau-levels.json`: generierter, gehashter Katalog der neun Spiellevel

## Datenfluss

```text
Spielcode ──Generator──> Originalkatalog ──EditorState──> Level-JSON
                                           │      │
                                           │      └──> localStorage-Entwürfe
                                           ├──> Live-Validierung
                                           ├──> gemeinsamer Renderer
                                           └──> PlaytestEngine
```

`EditorState` bewahrt die originalen Wandrechtecke unverändert auf, solange keine Wand editiert wurde. Nach einer Bearbeitung werden die tatsächlich belegten Zellen deterministisch zu Rechtecken kompaktisiert. Dadurch ist ein unverändertes Spiellevel verlustfrei und ein geändertes Level weiterhin klein.

## Erweiterungspunkte

Neue Dekorationen, Kulissenelemente oder Actor-Renderer werden zuerst im gemeinsamen Format und Renderer ergänzt. Der Editor stellt anschließend nur die benötigten Eingabefelder bereit. `appearance.stateAnimations` bildet die semantischen Spielerzustände `idle`, `up`, `right`, `down` und `left` auf frei benennbare Animationen ab. Der gemeinsame Eingabevertrag puffert Abbiegungen, kehrt Gegenrichtungen sofort um und verändert bei einer Eingabe niemals die Position. Reine Werkzeuge gehören in eigene Module und benötigen Node-Tests; sichtbare Abläufe erhalten zusätzlich einen Chromium-End-to-End-Test.
