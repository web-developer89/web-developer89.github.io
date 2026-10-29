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

## Kanalstatistik ohne Data API

Ohne `YOUTUBE_API_KEY` liest der Sync die öffentlichen About-Seiten der Kanäle (`/about`: Abonnenten, Aufrufe, Videoanzahl) und ergänzt Aufrufe einzelner Videos über die öffentliche YouTube-Seite. Die Zeitreihe liegt in `src/data/snapshots.json` und `public/data/stats.json`. Ein API-Key ist nur optional und wird für diese Anzeige nicht gebraucht.

Die Sektion **Meine Community wächst** zeigt die YouTube-Abonnentenzahlen. Jeder Lauf des Sync-Workflows schreibt `/data/community.json` neu (Messpunkte der letzten 40 Tage) und veröffentlicht sie mit demselben Deploy. Die Seite lädt diese Datei nach dem Aufbau und danach alle 60 Sekunden mit `cache: 'no-store'` und einem Zeitstempel in der Adresse. Eine fehlgeschlagene, ungültige oder ältere Antwort lässt die zuletzt gültigen Zahlen stehen; eine gemeldete 0 ersetzt keine bereits bekannte positive Abonnentenzahl. Ist die Änderung in 7 Tagen nicht 0, steht sie in der Zeile. Sonst die Änderung über 30 Tage, oder „seit dem …“, wenn die Historie kürzer ist. Ist die gemessene Änderung 0, wird die Zeile ausgeblendet, weil YouTube Abonnenten rundet. TikTok erscheint in diesen Panels nicht.

### Backend-Takt

GitHub Actions erlaubt keinen kürzeren Cron als alle **5 Minuten**. Der Workflow `.github/workflows/pages.yml` läuft daher `*/5 * * * *` sowie bei Push und manuell. Statisches GitHub Pages allein kann keinen persistenten 60-Sekunden-Worker ausführen.

## Konfiguration

- `src/config/youtube.json` — Kanäle, Fokus, Limits
- `src/config/navigation.ts` — Navigation und Beratungs-CTA
- `src/config/social.ts` — nur belegte Profile sind öffentlich sichtbar
- `src/config/support.ts` — Überweisung und Empfehlungen
- `src/config/site.ts` — Name, Impressum, Kontakt-E-Mail
- `src/content/overlay.json` — Texte für OBS-Einblendungen
- `public/images/politik-mit-kopf-background.jpg` — Pflicht-Hintergrund
- `public/brand/channels/` — originale Social-Badges

## Umgebung

Siehe `.env.example`.

- `YOUTUBE_API_KEY` empfohlen für Statistiken, Laufzeiten und größeres Archiv
- `YOUTUBE_CHANNEL_ID` optional, überschreibt den hervorgehobenen Kanal

## Seiten

- `/` — Premium-Homepage mit Abonnenten-Panels und Kanalentwicklung
- `/beratungsgespraech/` — Anfrage direkt vom Browser an `kontakt@politikmitkopf.de` (FormSubmit; erste Nutzung einmal per Mail bestätigen)
- `/informant-werden/` — vertrauliche Hinweise
- `/politik-mit-kopf/` und `/politik-mit-kopf-reagiert/` — Kanalarchive

Die interne Synchronisation wird nicht als Seite veröffentlicht.

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

GitHub Actions baut alle 5 Minuten (Schedule), bei Push auf `main` und manuell neu und stellt die Seite über GitHub Pages bereit.
