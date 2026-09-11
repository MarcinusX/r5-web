#!/usr/bin/env python3
"""Medal 2026 = dokładnie ten sam asset co medal_2025_final.pdf, tylko z podmienioną datą.

Źródło to raster 2362x2362 px (300 dpi) z maską alfa. Data „28.09.2025” jest białym napisem na płaskim granacie plakietki,
więc: (1) zamalowujemy jej prostokąt granatem plakietki, (2) wpisujemy nową datę fontem dobranym do oryginału
(Roboto Black Italic, szerokość 85% — cyfry, pochylenie i grubość zgodne z oryginałem), tej samej wysokości wersalików,
na tej samej linii bazowej, wyśrodkowaną na tej samej osi. Reszta pikseli jest nietknięta.

  python3 make-medal-2026.py                # -> medal-2026.pdf, medal-2026.png (2362², RGBA), medal-2026-logo.png (przycięty)
  DATE=13.09.2026 python3 make-medal-2026.py
"""
import os, pathlib, subprocess, fitz
HERE = pathlib.Path(__file__).parent
SRC = HERE / "medal_2025_final.pdf"
# Krój daty: FONT=archivo (domyślnie; Archivo Black Italic 75% szer., licencja OFL — najbliższy oryginałowi w teście pikselowym)
#            | helvetica (Helvetica Neue Condensed Black z macOS, pochylona 8°) | roboto (Roboto Black Italic 85%)
FONTS = {"archivo":   (HERE.parent / "fonts" / "Archivo-BlackItalic-w75.ttf", 0, -6),
         "helvetica": (HERE.parent / "fonts" / "HelveticaNeue-HelveticaNeueCondensedBlack.ttf", -8, -4),
         "roboto":    (HERE.parent / "fonts" / "Roboto-BlackItalic-w85.ttf", 0, -4)}
FONT_KEY = os.environ.get("FONT", "archivo"); FONT, SKEW, KERN = FONTS[FONT_KEY]
OUT_SUFFIX = os.environ.get("SUFFIX", "")
DATE = os.environ.get("DATE", "13.09.2026")
NAVY = "#1F586C"                     # kolor plakietki (zmierzony: rgb 31,87,110)
# geometria starej daty w pikselach pełnego obrazu 2362x2362 (zmierzona po białych pikselach): bbox x 1034..1617, y 1380..1470
OLD = (1034, 1380, 1617, 1470); CX = (OLD[0] + OLD[2]) / 2; BASE = OLD[3]; CAP = OLD[3] - OLD[1]   # 90 px
from fontTools.ttLib import TTFont
_f = TTFont(str(FONT)); _cap = getattr(_f["OS/2"], "sCapHeight", 0) or _f["glyf"][_f.getBestCmap()[ord("H")]].yMax   # wysokość wersalików (fallback: glif H)
PT = CAP / (_cap / _f["head"].unitsPerEm)   # rozmiar w px z wysokości wersalików fontu
DRAW_PRE = f"skewX {SKEW} " if SKEW else ""

def run(*a): subprocess.run(list(map(str, a)), check=True)
tmp = HERE / "_tmp"; tmp.mkdir(exist_ok=True)
# 1. raster + alfa z PDF
run("pdfimages", "-png", SRC, tmp / "m")
run("magick", tmp / "m-000.png", tmp / "m-001.png", "-alpha", "off", "-compose", "CopyOpacity", "-composite", tmp / "rgba.png")
# 2. zamaluj starą datę granatem (3 px zapasu) i wpisz nową, wyśrodkowaną na tej samej osi i linii bazowej
w = int(subprocess.check_output(["magick", "-size", "1400x300", "xc:none", "-font", str(FONT), "-pointsize", f"{PT:.2f}", "-kerning", str(KERN),
                                 "-fill", "white", "-draw", f"translate 20,200 {DRAW_PRE}text 0,0 '{DATE}'", "-trim", "-format", "%w", "info:"]))
x0 = CX - w / 2
run("magick", tmp / "rgba.png",
    "-fill", NAVY, "-draw", f"rectangle {OLD[0]-3},{OLD[1]-3} {OLD[2]+3},{OLD[3]+3}",
    "-font", FONT, "-pointsize", f"{PT:.2f}", "-kerning", str(KERN), "-fill", "white",
    "-draw", f"translate {x0:.1f},{BASE} {DRAW_PRE}text 0,0 '{DATE}'",     # skew wokół początku napisu, nie strony
    HERE / f"medal-2026{OUT_SUFFIX}.png")
run("magick", HERE / f"medal-2026{OUT_SUFFIX}.png", "-trim", "+repage", HERE / f"medal-2026{OUT_SUFFIX}-logo.png")
# 3. PDF jak oryginał: ta sama strona, obraz w tym samym miejscu
src = fitz.open(SRC); page = src[0]
rect = page.get_image_rects(page.get_images()[0][0])[0]
out = fitz.open(); p = out.new_page(width=page.rect.width, height=page.rect.height)
p.insert_image(rect, filename=str(HERE / f"medal-2026{OUT_SUFFIX}.png"))
out.save(HERE / f"medal-2026{OUT_SUFFIX}.pdf", garbage=3, deflate=True)
print(f"-> medal-2026{OUT_SUFFIX}.pdf / .png / -logo.png  (font {FONT_KEY}, data {DATE}, szer. napisu {w} px, oś x={CX:.1f}, baza y={BASE})")
