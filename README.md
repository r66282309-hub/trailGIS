# TrailGIS - Fase 1

Prototipo iniziale per portale escursionistico con mappa interattiva e archivio online.

## Funzioni incluse

- Upload file GPX.
- Anteprima della traccia su Leaflet.
- Calcolo lunghezza stimata.
- Lettura quota minima/massima se presente nel GPX.
- Scheda percorso con nome, zona e descrizione.
- Download GPX.
- Pubblicazione nell’archivio online, se configurato.
- Lista dei percorsi pubblicati.
- Visualizzazione dei percorsi pubblicati in cluster sulla mappa.
- Ricerca per comune con raggio impostabile.
- Filtro dei percorsi entro 5, 10, 20, 30 o 50 km dal comune cercato.

## Come provarlo senza archivio online

Apri `index.html` nel browser e carica `sample.gpx`.

In questa modalità funzionano:

- anteprima su mappa;
- statistiche;
- download GPX.

La pubblicazione online richiede la configurazione dell’archivio dati.

## Configurazione archivio online

1. Crea un progetto Supabase per l’archivio dati.
2. Apri SQL Editor.
3. Esegui `schema.sql`. Se avevi già creato la tabella con la prima versione, riesegui comunque il file: aggiunge le colonne mancanti per la ricerca geografica.
4. Vai in Project Settings > API.
5. Copia Project URL e anon public key.
6. Inseriscili in `app.js`:

```js
const SUPABASE_URL = "https://...supabase.co";
const SUPABASE_ANON_KEY = "...";
```

## Roadmap successiva

### Fase 2

- Waypoint/POI:
  - bene identitario;
  - belvedere;
  - rifugio;
  - parcheggio;
  - segnalazione generica.

### Fase 3

- APK Android con Capacitor.
- Tracking GPS.
- Waypoint durante il tracking.

### Fase 4

- Segmenti colorati:
  - normale;
  - scosceso;
  - pericoloso;
  - poco visibile;
  - fondo difficile.
