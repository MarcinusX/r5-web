# Dyplomy Retkińska 5tka 2026 — generator

Jeden szablon (SVG w milimetrach, A4 pion, białe tło = tanie w druku) → osobny HTML/PDF/PNG
dla każdego wpisu z `dyplomy.json`. Wszystko generowane programistycznie, więc każdy dyplom
jest **identyczny** poza tekstem (miejsce, kategoria).

```bash
node make-dyplom.mjs               # wszystkie wpisy z dyplomy.json -> out/*.pdf + *.png (+ .html)
node make-dyplom.mjs --pick 1,9    # tylko wpisy nr 1 i 9
node make-dyplom.mjs --html        # tylko HTML (otwórz w przeglądarce)
LOGO=oryginal node make-dyplom.mjs # logo białe z konturem (oficjalne) zamiast granatowego
```

Wymagania: Google Chrome (render PDF), `pdftoppm` z poppler (podgląd PNG). Fonty (Bebas Neue,
Oswald) są lokalnie w `fonts/`, więc działa offline; PDF ma osadzone fonty i wektorowe logo/mapę.

## Koncepcja

- **Ramka dyplomu = prawdziwa pętla trasy** (OSM: Kusocińskiego → Armii Krajowej → Maratońska →
  Popiełuszki), ta sama geometria co medal i koszulka (`assets/medal-geo.json`).
  W tle bardzo jasna siatka ulic i bloki Retkini, wygaszana ku górze i dołowi strony.
- **META = kościół** Najświętszej Eucharystii stojący na linii mety (piktogram z medalu), START na Maratońskiej.
- **Data 13.09.2026** w pigułce na dolnej krawędzi pętli, obrócona zgodnie z kierunkiem ulicy.
- **„Znaczki”** (smugi prędkości, trójkąty, `▸▸▸`) po obu stronach logo — generowane z ustalonym
  ziarnem (seed), więc identyczne na każdym dyplomie; kolory tylko z palety marki.
- Stopka jak na podziękowaniu 2025: Organizatorzy / Beneficjent / Patronat honorowy / Partnerzy główni.

## Edycja

- Lista dyplomów: `dyplomy.json` — `{ "place": "I", "category": "OPEN K" }` albo
  `{ "title": "WYRÓŻNIENIE", "category": "NAJLICZNIEJSZA\nDRUŻYNA" }` (`\n` = dwie linie).
  Teksty są automatycznie zmniejszane, jeśli nie mieszczą się w pętli.
- Logotypy stopki: `assets/` (parafia i Kolorowy Świat przebarwione na granatowo z białych wersji).
- Parametry układu (skala mapy `K`, pozycje, kolory) na górze `make-dyplom.mjs`.

## Wersje

- **v1-plakietka** (10.09.2026, zaakceptowana): logo na granatowej plakietce z datą (`LOGO=plate`), bez pigułki (`PILL=none`),
  ukośna trasa (`ROT=0`), stopka `bez-patronatu` (Parafia | Toya + Kultowa duże | Kolorowy Świat).
  Snapshot PDF/PNG + kopia skryptu: `wersje/v1-plakietka/`. To są domyślne ustawienia `make-dyplom.mjs`.

- **v2-figma** (11.09.2026, do druku): szablon z Figmy (`figma/szablon-figma.pdf`) + podmiana tekstu skryptem
  `figma/podmien-tekst.py` (Bebas Neue, wyśrodkowanie, trasa rozjaśniona o 55%, logo „5KM” bez zmian, małe „m” w 300m/500m
  jako kapitalik). Wynik: `figma/out/dyplomy-komplet.pdf` = 9 zapasowych (żółte kreski) + 51 imiennych = 60 stron.
  Snapshot: `wersje/v2-figma-2026-09-11/` oraz pełny zip całego folderu w `~/dev/retkinska5/snapshots/`.

- **v3 „złoty standard”** (11.09.2026): jak v2, plus mapa z trasą 120% przesunięta 8 mm w dół (`--map-scale 1.20 --map-dy 8`),
  trasa rozjaśniona o 55%, logo z medalu 2026 (`medal/medal-2026-logo.png`, data w Archivo Black Italic 75%) w miejsce logo z Figmy
  (`LOGO_SWAP`). Wszystko to są domyślne ustawienia `figma/podmien-tekst.py`; komplet = `figma/out/dyplomy-komplet.pdf` (60 stron).
  Snapshot: `wersje/v3-zloty-standard-2026-09-11/` (komplet, zapasowy, szablon, skrypt, lista kategorii, medal).
