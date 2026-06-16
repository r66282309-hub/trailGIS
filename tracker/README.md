# TrailGIS Tracker PWA - abbozzo

Funzioni incluse:
- mappa Esri Topo;
- posizione GPS in tempo reale;
- frequenza acquisizione 1/3/5/10 secondi;
- Start/Stop tracking;
- linea della traccia in mappa;
- statistiche punti/km/tempo;
- esportazione GPX sul telefono;
- tasto Upload che per ora mette la traccia in coda locale;
- coda offline in localStorage;
- Service Worker base per apertura offline dell'app;
- Wake Lock API quando disponibile.

Nota importante: il tracking a schermo spento vero richiede build Android con Capacitor e plugin background geolocation/foreground service. La PWA web pura può essere sospesa dal sistema operativo.
