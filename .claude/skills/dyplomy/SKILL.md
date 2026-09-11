---
name: dyplomy
description: Generowanie dyplomów i medalu Retkińskiej 5tki (design/dyplom-2026) — komplet PDF do druku, zapasowe strony, nowe kategorie, podmiana daty w medalu. Użyj, gdy user mówi o dyplomach, kategoriach nagród, medalu, logo na plakietce lub pasku smug.
---

# Dyplomy Retkińska 5tka

Wszystko leży w `design/dyplom-2026/`. Szczegóły i historia wersji: `design/dyplom-2026/README.md`.

## Złoty standard (11.09.2026) — jak odtworzyć komplet do druku

```bash
cd design/dyplom-2026/figma
python3 podmien-tekst.py --merge 9 kreski     # -> out/dyplomy-komplet.pdf (9 zapasowych + 51 imiennych = 60 stron)
```

Skrypt `podmien-tekst.py` bierze szablon z Figmy (`szablon-figma.pdf`) i podmienia w nim tylko dwa napisy
(„I MIEJSCE”, „OPEN K”) fontem Bebas Neue z `../fonts`, zachowując linię bazową i wyśrodkowanie. Domyślne ustawienia
(zaakceptowane, nie zmieniać bez pytania): trasa rozjaśniona o 55% (`ROUTE_FADE`), mapa 120% przesunięta 8 mm w dół
(`MAP_SCALE`, `MAP_DY_MM`), logo z medalu 2026 w miejsce logo z Figmy (`LOGO_SWAP`), logo „5KM” bez zmian, małe „m”
w 300m/500m jako pomniejszona kapitalika. Wymagania: PyMuPDF (`import fitz`), poppler (`pdftoppm`), ImageMagick.

Typowe zadania:
- Nowa/zmieniona kategoria: edytuj `dyplomy.json` (`{"place":"I","category":"OPEN K"}`, `\n` = dwie linie), potem `--merge`.
- Pojedynczy dyplom: `python3 podmien-tekst.py --one "II" "OPEN M"`.
- Zapasowe do ręcznego wpisu: `python3 podmien-tekst.py --blank kreski` (style: linie | zolte | kreski | pusty).
- Warianty do porównania: `--route-fade 0.35`, `--map-scale 1.15 --map-dy 4`, `--font oswald-light` (przed komendą).
- Scalony PDF zapisuj z `garbage=4` (deduplikacja tła mapy: 5 MB zamiast 300 MB).
- **Do drukarni wysyłaj `out/dyplomy-komplet-corel.pdf`** (`python3 eksport-corel.py`): PDF 1.4 bez przezroczystości i fontów,
  tło jako wspólny raster 300 dpi, napisy jako krzywe. Zwykły `dyplomy-komplet.pdf` (PDF 1.7, przezroczystości, fonty Type0)
  nie importował się w CorelDRAW w drukarni (12.09.2026). Wariant z edytowalnym tekstem (osadzony Bebas Neue, prosty font
  WinAnsi; strony z „Ż” mają font CID): `TEXT=font python3 eksport-corel.py` -> `out/dyplomy-komplet-corel-font.pdf`.

## Medal

`design/dyplom-2026/medal/make-medal-2026.py` — ten sam raster co `medal_2025_final.pdf`, tylko data podmieniona
(Archivo Black Italic 75%, dobrany pikselowo do oryginału). Nowa data: `DATE=12.09.2027 python3 make-medal-2026.py`.
Wynik `medal-2026.pdf` to obraz 300 ppi bez fontów — bezpieczny dla producenta. Logo do innych nośników: `medal-2026-logo.png`.

## Pozostałe generatory (własny projekt od zera, nie używany w finale)

- `make-dyplom.mjs` — dyplom w SVG/mm na prawdziwej mapie OSM (`assets/medal-geo.json`), render przez headless Chrome
  (Chrome nie kończy się sam po zapisie PDF — skrypt ubija go po 8 s, to normalne). `node make-dyplom.mjs --pick 1`.
- `make-logo-plate.mjs` — wektorowa plakietka logo z datą (`assets/logo-plate.svg`).
- `make-pasek.mjs` — zapętlony pasek smug (równoległoboki + trójkąty), `SEED=7 node make-pasek.mjs`.
- Assety wielokrotnego użytku: `assets/medal-geo.json` (geometria trasy i ulic Retkini), `assets/logo-full.svg`,
  `assets/logo-granat.svg`, logotypy stopki, `fonts/` (Google Fonts, OFL).

## Zasady

- Nie zmieniać domyślnych ustawień „złotego standardu” bez wyraźnej prośby; nowe pomysły jako przełączniki lub warianty w `out-warianty/`.
- Podglądy pokazuj userowi jako PNG (montaż), do porównań w druku dawaj kilkustronicowy PDF.
- `out/`, `out-warianty/`, `wersje/`, podglądy PNG i `figma/out/*` (poza kompletem i zapasowym) są poza git; snapshoty zip w `~/dev/retkinska5/snapshots/`.
