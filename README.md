# Franz & Lola · Levelwerkstatt Pro

Statischer No-Code-Level-Editor für das gemeinsame `franz-lola-level`-JSON-Format. Die Werkstatt verwendet denselben Canvas-Renderer wie das Spiel, speichert Entwürfe ausschließlich lokal im Browser und läuft ohne Server auf GitHub Pages.

## Von der Idee zum spielbaren Level

- Alle neun Originallevel aus `Geburtstagsspiel` als verlustfreie Vorlagen
- Stift, Linie, Rechteck, Flächenfüllung und Radierer für Wände
- Franz & Lola, beliebig viele Katzen und Schnüffel-Power frei platzierbar
- Bäume, Bänke, Lampen, Blumen, Schilder, Felsen, Wasserflächen und freie Symbole
- Eigener Franz-&-Lola-Charakterbereich mit animierter Vorschau und frei bearbeitbaren Zuständen für Idle, Oben, Rechts, Unten und Links
- Eigene Pixel-Figuren mit Palette, benannten Animationen, sichtbarer Frame-Leiste, beliebig vielen Frames, FPS und Schleifenmodus
- Verhalten pro Figur: direkte Steuerung, Autopilot, Patrouille sowie unterschiedliche Jagd-, Hinterhalt-, Wach-, Streu- und Zufallsstrategien
- Animierbare Dekorationen und fest eingebaute Kulissenelemente mit Schweben, Pulsieren, Blinken und Drehen
- No-Code-Ereignisse mit Triggerzonen, Tast-/Wischfolgen oder Zeittriggern, Punktbelohnungen und globalem, Level- oder Rundengültigkeitsbereich
- Standarddeutsche und niederbairische Ereignistexte sowie Eisvogel-, Pfoten-, Glocken- oder frei gestaltbare Symbole
- Frei anpassbare Physikprofile pro Schwierigkeit (Tempo, Katzenzahl, Leben, Power-Dauer, Zufall und Startschutz)
- Freie Raster von 9×9 bis 45×45, Tunnelzeilen, Farben, Landmarken und Kartenkoordinaten
- Live-Vorschau für 70, 110 oder 160 Guttis mit exakt derselben Verteilung wie im Spiel
- Integrierter Testlauf mit demselben Renderer und derselben 120-Tick-Simulation wie das Spiel
- Spielkamera, Ganzlevel-Ansicht, nativer Vollbildmodus, Pause, Touch-Buttons und direkte Wischsteuerung während der Fingerbewegung
- Live-Prüfung auf Erreichbarkeit, Kollisionen, Gutti-Kapazität und Randüberschreitungen
- Transaktionsbasiertes Undo/Redo: ein kompletter Zeichenstrich ist ein Schritt
- Mehrere automatisch gespeicherte `localStorage`-Entwürfe
- Import/Export einzelner Level sowie Export des vollständigen Originalkatalogs
- Sicheres Veröffentlichen per Knopfdruck: Anmeldung, Prüfung, Pull Request, Merge und GitHub-Pages-Deploy laufen geführt und automatisch
- Responsive Oberfläche für Maus, Tastatur, Stift und Touch

Die Originalvorlagen enthalten auch die ursprünglichen Geheimnisse: den Eisvogel an der Ilz, Lolas Lieblingsplatz und die Passauer Kirchenglocken – jeweils mit Originaltrigger, Belohnung und beiden Sprachfassungen. Der Zauberberg besitzt in Editor und Testlauf wieder seine beiden Bühnenlichtkegel, Lautsprecher, Verstärker und die animierte Musiknote. Musiknote und Bühnenlichter sind im Design-Tab einzeln auswählbar; Animation, Tempo und Stärke lassen sich ohne Code ändern.

Eine bloß geöffnete Originalvorlage wird nicht als Entwurf gespeichert. Erst die erste echte Änderung erzeugt eine lokale Kopie; über „Originalvorlage wiederherstellen“ lässt sie sich jederzeit zurücksetzen.

## Entwicklung

```bash
npm install
npm run dev
```

Vollständige Prüfung:

```bash
npm test              # Datenmodell, Katalog, Werkzeuge, Speicher, Testlauf
npm run test:e2e      # Chromium: Desktop, Mobile, Kamera, Vollbild und Animationen
npm run build         # statischer GitHub-Pages-Build
```

`npm run catalog:generate -- ../Pacman_clone/src/main.js src/data/passau-levels.json` erzeugt die neun Vorlagen deterministisch aus dem Spielcode. Der geprüfte Quellstand wird über einen SHA-256-Hash im Katalog festgehalten.

## Austauschformat

Ein Export ist normales, versioniertes JSON mit `kind: "franz-lola-level"` und `schemaVersion: 1`. Das Renderer-Repository liefert dazu ein JSON Schema. Es enthält keine ausführbare Logik und kann deshalb sicher versioniert, geprüft und zwischen Spiel, Editor und zukünftigen Werkzeugen ausgetauscht werden.

## Veröffentlichen ohne Repository-Zugriff

Der Editor kann mit dem kleinen Cloudflare Worker in [`publisher/`](publisher/) verbunden werden. Die Redaktion meldet sich über GitHub an, darf aber ausschließlich geprüfte Leveldateien veröffentlichen. GitHub-App-Schlüssel gelangen nie in den Browser; die kurzlebige Editorsitzung bleibt nur im Arbeitsspeicher des Tabs. Die einmalige Einrichtung für den Besitzer ist in [`publisher/README.md`](publisher/README.md) beschrieben.
