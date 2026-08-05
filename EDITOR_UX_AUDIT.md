# UX-Audit: Franz & Lola Levelwerkstatt

Stand: August 2026

## Kurzfazit

Die Aufteilung in sieben Fachbereiche ist fachlich richtig und deutlich verständlicher als ein einziger überladener Editor. Der größte Bedienbruch lag nicht im Svelte-State, sondern darin, dass Auswahl, Fachbereich und Navigation bisher nicht als eigener Zustand existierten. Ein Canvas-Klick konnte den Arbeitsbereich wechseln, ohne dass Browser-Zurück, Reload oder ein teilbarer Link den vorherigen Kontext wiederherstellen konnten.

Die erste Maßnahme ist deshalb ein eigener Studio-Router. Weitere Eingriffe in Auswahlmodell und mobile Informationsarchitektur sollten auf dieser stabilen Grundlage folgen.

## Vergleich mit etablierten Editoren

| Editor | Bewährtes Muster | Konsequenz für die Levelwerkstatt |
| --- | --- | --- |
| Tiled | Tile-, Objekt- und Bildebenen sind getrennt; Ebenen lassen sich hierarchisch ordnen, sperren und ausblenden. Das Auswahlwerkzeug unterstützt Mehrfachauswahl und überlappende Objekte. | Platzierte Instanzen benötigen mittelfristig einen echten Szenen-/Ebenenbaum mit Sichtbarkeit, Sperre und klarer Z-Reihenfolge. |
| LDtk | Projekt/World, Ebeneninstanzen und die Palette bleiben als stabile Seitenbereiche erhalten. Definitionen und im Level platzierte Instanzen sind getrennte Konzepte. | Objektbibliothek und „Objekte im Level“ müssen visuell und begrifflich konsequent als Asset versus Instanz behandelt werden. |
| Godot | Die Auswahl im Szenenbaum bestimmt den Inspector; ein Kontextwechsel geschieht bewusst und nicht als Nebenwirkung einer Eigenschaftsauswahl. | Einfacher Klick wählt zuerst. Das Öffnen einer Spezialwerkstatt sollte eine sichtbare, bewusste Aktion sein. |
| Aseprite | In der Timeline liegen Frames horizontal und Ebenen vertikal; Auswahl, Playhead und Bearbeitungskontext sind jederzeit sichtbar. | Cutscene- und Sprite-Timelines sollten dieselbe Zeitsprache und dieselben Playback-Konventionen verwenden. |

Quellen:

- [Tiled: Layers](https://doc.mapeditor.org/en/stable/manual/layers/)
- [Tiled: Working with Objects](https://doc.mapeditor.org/en/stable/manual/objects/)
- [LDtk: Editor interface](https://ldtk.io/docs/general/editor-components/)
- [LDtk: Entities](https://ldtk.io/docs/general/editor-components/entities/)
- [Godot: Inspector dock](https://docs.godotengine.org/en/stable/tutorials/editor/inspector_dock.html)
- [Godot: Using TileMaps](https://docs.godotengine.org/en/latest/tutorials/2d/using_tilemaps.html)
- [Aseprite: Timeline](https://www.aseprite.org/docs/timeline/)

## Umgesetzte Navigationsarchitektur

Die Navigation ist Teil der URL und wird zusätzlich im Browser-`localStorage` gespeichert. Beispiel:

```text
?level=zauberberg&workspace=cutscenes&cutscene=soundcheck&track=camera&keyframe=intro
```

Gespeichert werden abhängig vom Arbeitsbereich:

- Level und Fachbereich,
- ausgewähltes Asset oder platzierte Objektinstanz,
- Figur,
- Ereignis,
- Cutscene, Track und Keyframe.

Wechsel von Level oder Fachbereich erzeugen einen Eintrag in der Browser-Historie. Häufige Detailauswahlen ersetzen nur den aktuellen Eintrag. Dadurch funktionieren Zurück/Vorwärts sinnvoll, ohne für jeden Keyframe Dutzende Historieneinträge anzulegen.

Der Router verwendet Query-Parameter und kein Hash-Routing. Der URL-Fragment ist bereits für das kurzlebige Publisher-Session-Token reserviert. Query-Parameter funktionieren außerdem ohne Server-Fallback auf GitHub Pages. Eine Migration zu SvelteKit ist dafür nicht erforderlich.

Referenz:

- [SvelteKit: Routing](https://svelte.dev/docs/kit/routing)
- [SvelteKit: Static site generation](https://svelte.dev/docs/kit/adapter-static)

## Priorisierte nächste UX-Schritte

### 1. Auswahl und Fachbereich entkoppeln

Ein Klick im Canvas sollte ein Element auswählen und seinen kompakten Inspector zeigen. Eine deutliche Aktion wie „In Objektwerkstatt öffnen“ wechselt anschließend bewusst die Disziplin. Ein Doppelklick kann dieselbe Abkürzung anbieten. Browser-Zurück funktioniert bereits als Sicherheitsnetz, ersetzt diese Entkopplung aber nicht.

### 2. Szenenbaum statt horizontaler Objektleiste

Ein dauerhaft sichtbarer Szenenbaum sollte Spieler, Katzen, Ereignisse, Dekoration, Texte und Theme-Elemente enthalten. Benötigt werden:

- Suche und Typfilter,
- Sichtbarkeit und Sperre,
- Z-Reihenfolge und Gruppierung,
- Auswahl überlappender Elemente,
- stabile IDs für jede platzierte Instanz.

### 3. Mobile Fokusansicht

Die aktuelle mobile Oberfläche stapelt weitgehend die Desktop-Panels. Besser ist pro Fachbereich eine primäre Arbeitsfläche mit einer unteren Werkzeugleiste. Bibliothek, Szenenbaum und Inspector öffnen als fokussierte Sheets; der Canvas bleibt dabei sichtbar und verliert weder Kamera noch Auswahl.

### 4. Gemeinsame Interaktionsregeln

Alle visuellen Editoren sollten dieselben Regeln verwenden: Escape hebt Auswahl auf, Shift erweitert die Auswahl, Alt wählt das nächste überlappende Element, Leertaste verschiebt die Kamera, und ein einheitliches Snap-Menü steuert Raster, Pixel und freie Positionierung.

## Erfolgskennzahlen

- Nach Reload ist derselbe Fachbereich mit demselben Element aktiv.
- Zurück führt zum vorherigen Fachbereich, nicht aus dem Editor heraus.
- Ein neues Objekt ist ohne Anleitung in höchstens drei bewussten Aktionen platzierbar.
- Auf Mobile bleibt der Canvas während Auswahl und Inspektoränderung sichtbar.
- Kein geschlossener Drawer bleibt per Tastatur oder Screenreader bedienbar.
