# Politik mit Kopf

Statische Medienplattform für [Politik mit Kopf](https://www.youtube.com/@PolitikmitKopf) und [Politik mit Kopf REAGIERT](https://www.youtube.com/@PolitikmitKopfReagiert).

Öffentliche Adresse: https://web-developer89.github.io/

## Lokal

```bash
npm install
npm run sync
npm run dev
```

`npm run build` synchronisiert vor dem Bau automatisch.

## Kanäle

Konfiguration in `src/config/youtube.json`:

- Politik mit Kopf — `UCsLN1bEfDJoZOs8udTwHatQ`
- Politik mit Kopf REAGIERT — `UCOdBOgdBxkqo5CaGukX8z4g`

## Statistiken

Mit `YOUTUBE_API_KEY` lädt der Sync öffentliche Kanal- und Videostatistiken und schreibt Zeitreihen nach `src/data/snapshots.json` sowie `/data/stats.json`.

Die Homepage aktualisiert den Sync-Zeitstempel alle 60 Sekunden aus `/data/feed.json`. Der Backend-Sync läuft über GitHub Actions (stündlich). Echte Minuten-Aktualität der YouTube-Zahlen braucht einen API-Schlüssel und genug Quota; historische Veränderungen erscheinen erst, nachdem mehrere Sync-Läufe Snapshots gespeichert haben.

## Konfiguration

- `src/config/youtube.json` — Kanäle, Fokus, Limits
- `src/config/social.ts` — nur belegte Profile sind öffentlich sichtbar
- `src/config/support.ts` — Überweisung und Empfehlungen
- `src/config/site.ts` — Name, Impressum, Kontakt-E-Mail
- `src/content/overlay.json` — Texte für OBS-Einblendungen
- `public/images/politik-mit-kopf-background.jpg` — Pflicht-Hintergrund

## Umgebung

Siehe `.env.example`.

- `YOUTUBE_API_KEY` empfohlen für Statistiken, Laufzeiten und größeres Archiv
- `YOUTUBE_CHANNEL_ID` optional, überschreibt den hervorgehobenen Kanal

## OBS

Browserquellen, transparent, 1920×1080:

- `/overlay/news/`
- `/overlay/headline/`
- `/overlay/ticker/`
- `/overlay/latest-video/`
- `/overlay/live/`
- `/overlay/socials/`
- `/overlay/custom/`

## Veröffentlichung

GitHub Actions baut stündlich und bei jedem Push auf `main` neu und stellt die Seite über GitHub Pages bereit. Manueller Lauf: „Sync and deploy“.
