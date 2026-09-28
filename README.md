# Politik mit Kopf

Statische Medienplattform für [Politik mit Kopf](https://www.youtube.com/@PolitikmitKopf). Neue YouTube-Videos werden beim Build aus dem öffentlichen RSS-Feed übernommen. Mit einem YouTube-API-Schlüssel wächst das Archiv über die letzten 15 Beiträge hinaus.

Öffentliche Adresse: https://web-developer89.github.io/

## Lokal

```bash
npm install
npm run sync
npm run dev
```

`npm run build` synchronisiert vor dem Bau automatisch.

## Konfiguration

- `src/config/youtube.json` — Kanäle, Reihenfolge, automatischer oder manueller Fokus
- `src/config/social.ts` — nur belegte Profile sind öffentlich sichtbar
- `src/config/support.ts` — Überweisung und Empfehlungen
- `src/config/site.ts` — Name, Zitat, Impressum, optionale Analyse und Newsletter
- `src/content/overlay.json` — Texte für OBS-Einblendungen

Analyse und Newsletter bleiben unsichtbar, solange kein Anbieter gesetzt ist. Das Kontaktformular sendet nichts, solange `PUBLIC_CONTACT_ENDPOINT` leer ist.

## Umgebung

Siehe `.env.example`.

- `YOUTUBE_API_KEY` optional
- `YOUTUBE_CHANNEL_ID` optional, überschreibt den hervorgehobenen Kanal
- `PUBLIC_CONTACT_ENDPOINT` optional, POST JSON `{ name, email, subject, category, message }`

## OBS

Browserquellen, transparent, 1920×1080:

- `/overlay/news/`
- `/overlay/headline/`
- `/overlay/ticker/`
- `/overlay/latest-video/`
- `/overlay/live/`
- `/overlay/socials/`
- `/overlay/custom/`

`?preview=1` zeigt ein Raster zum Prüfen. Die Seiten fragen alle 30 Sekunden `/data/feed.json` ab. Echte Push-Updates brauchen einen Server; hier folgt die Einblendung der nächsten Veröffentlichung.

## Veröffentlichung

GitHub Actions baut stündlich und bei jedem Push auf `main` neu und stellt die Seite über GitHub Pages bereit. Ein manueller Lauf heißt „Sync and deploy“.
