# Sicherer Ein-Klick-Publisher

Dieser Cloudflare Worker verbindet die statische Levelwerkstatt mit `Geburtstagsspiel`. Er authentifiziert eine kleine, ausdrücklich freigegebene Redaktion, akzeptiert ausschließlich validierte `franz-lola-level`-Dokumente und legt pro Veröffentlichung einen eng begrenzten Pull Request an. GitHub testet, merged und deployed diesen automatisch.

## Sicherheitsmodell

- Die GitHub App wird nur auf `Geburtstagsspiel` installiert.
- App-Rechte: **Actions: read**, **Contents: read and write**, **Pull requests: read and write**. Metadaten werden von GitHub automatisch lesbar gemacht.
- Redakteurinnen erhalten keinerlei Repository-Rechte. Ihre GitHub-Namen stehen in einer exakten Allowlist.
- Der private App-Schlüssel, Client Secret und Sitzungsschlüssel liegen nur als verschlüsselte Cloudflare-Secrets vor.
- Der Browser erhält lediglich eine signierte Sitzung für 30 Minuten. Sie steht im URL-Fragment, wird beim Laden sofort entfernt und weder in `localStorage` noch in `sessionStorage` gespeichert.
- CORS, Rücksprung-URL und Links sind auf die echten Editor-/GitHub-/Spieladressen begrenzt.
- Der Worker akzeptiert maximal 1 MB, nur JSON, keine gefährlichen Objektschlüssel und feste Inhaltslimits. Er kann ausschließlich `src/data/levels/<id>.level.json` ändern.
- Das Spiel übernimmt nur Pull Requests des konfigurierten App-Bots und prüft Dateipfad, Tests und Build vor dem Merge.

Der Betrieb passt bei normaler privater Nutzung in die kostenlosen Kontingente von GitHub Pages, GitHub Actions und Cloudflare Workers. Die jeweiligen Anbieter können ihre Limits später ändern.

## Einmalige Einrichtung durch den Besitzer

### 1. GitHub App anlegen

Unter **GitHub → Settings → Developer settings → GitHub Apps → New GitHub App**:

1. Einen eindeutigen Namen vergeben, zum Beispiel `Franz Lola Publisher`.
2. Homepage: `https://matthaeusstumptner.github.io/Pacman_clone_level_editor/`.
3. Webhooks deaktivieren.
4. Repository permissions setzen:
   - Actions: Read-only
   - Contents: Read and write
   - Pull requests: Read and write
5. App nur für den eigenen Account und danach **nur auf `Geburtstagsspiel`** installieren.
6. App ID, Client ID und Installation ID notieren, ein Client Secret sowie einen Private Key erzeugen. Den Schlüssel niemals committen.

Die Callback URL wird nach dem ersten Worker-Deploy auf diese Adresse gesetzt:

```text
https://franz-lola-publisher.<deine-workers-subdomain>.workers.dev/auth/callback
```

### 2. Cloudflare-Deploy aktivieren

Im Repository `Pacman_clone_level_editor` folgende GitHub-Actions-Werte anlegen:

| Art | Name | Wert |
| --- | --- | --- |
| Secret | `CLOUDFLARE_API_TOKEN` | Cloudflare-Token mit „Edit Cloudflare Workers“ für dieses Konto |
| Secret | `CLOUDFLARE_ACCOUNT_ID` | Cloudflare Account ID |
| Variable | `PUBLISHER_DEPLOY_ENABLED` | `true` |

Danach **Actions → Deploy secure level publisher → Run workflow** starten. Die Ausgabe nennt die öffentliche `workers.dev`-Adresse.

Im Cloudflare-Dashboard beim Worker unter **Settings → Variables and Secrets** diese Werte als verschlüsselte Secrets eintragen:

| Secret | Inhalt |
| --- | --- |
| `GITHUB_APP_ID` | App ID |
| `GITHUB_APP_CLIENT_ID` | Client ID |
| `GITHUB_APP_CLIENT_SECRET` | erzeugtes Client Secret |
| `GITHUB_INSTALLATION_ID` | Installation ID der App auf `Geburtstagsspiel` |
| `GITHUB_APP_PRIVATE_KEY` | vollständiger PEM-Private-Key |
| `SESSION_SECRET` | mindestens 32 zufällige Zeichen, besser 64 |
| `ALLOWED_GITHUB_LOGINS` | erlaubte GitHub-Namen, durch Komma getrennt |

Beispiel zum lokalen Erzeugen eines Sitzungsschlüssels:

```bash
openssl rand -hex 32
```

Anschließend die Callback URL der GitHub App auf die Worker-Adresse aktualisieren.

### Fehler `client_id=undefined`

Wenn GitHub nach „Mit GitHub verbinden“ eine 404-Seite zeigt und in der Adresse
`client_id=undefined` steht, fehlt dem Worker `GITHUB_APP_CLIENT_ID`:

1. Cloudflare → **Workers & Pages** → `franz-lola-publisher` → **Settings** öffnen.
2. Unter **Variables and Secrets** `GITHUB_APP_CLIENT_ID` als Typ **Secret** anlegen.
3. Als Wert die **Client ID** der GitHub App eintragen und **Deploy** wählen.

Auch die übrigen Werte aus der Secret-Tabelle müssen als Typ **Secret** angelegt
sein. Ab Publisher 1.1.1 verweigert Wrangler einen automatischen Deploy, solange
einer dieser Pflichtwerte fehlt; der Worker zeigt außerdem eine lesbare
Einrichtungsfehlermeldung statt zu GitHub weiterzuleiten.

### 3. Editor und Spiel verbinden

Im Repository `Pacman_clone_level_editor`:

- Variable `PUBLISHER_URL` = Worker-Adresse ohne abschließenden Slash.
- Danach den Workflow **Deploy Level Editor to GitHub Pages** einmal manuell starten.

Im Repository `Geburtstagsspiel`:

- Variable `PUBLISHER_BOT_LOGIN` = Bot-Login der GitHub App, normalerweise der App-Slug plus `[bot]`, zum Beispiel `franz-lola-publisher[bot]`.

Nun kann ein erlaubter Account im Editor auf **Veröffentlichen** klicken, bis zu 20 spielbare Entwürfe auswählen und sie gemeinsam prüfen lassen. Der Worker akzeptiert höchstens 5 MB pro Veröffentlichung und 1 MB pro Level; alle ausgewählten Dateien landen in genau einem Pull Request. Nicht erlaubte Accounts erhalten nur eine neutrale Fehlermeldung.

## Lokale Prüfung

Benötigt Node.js 22.3 oder neuer:

```bash
npm ci
npm test
npm audit
npm run dev
```

Für lokale Secrets `.dev.vars.example` nach `.dev.vars` kopieren. `.dev.vars` ist ignoriert und darf nie committed werden.
