#!/usr/bin/env python3
"""Wersja kompletu dyplomów „pod Corela”: PDF 1.4 bez przezroczystości, bez fontów, bez XObjectów formularzy.

Dlaczego: dyplomy-komplet.pdf to PDF 1.7 z przezroczystościami (grupy, maski alfa, kanał alfa trasy/mapy) i fontami Type0,
na czym wykłada się import w CorelDRAW. Tu każda strona to:
  1) jedno wspólne tło rastrowe 300 dpi (szablon z rozjaśnioną trasą, mapą 120%/8 mm i logo z medalu, BEZ napisów) —
     ten sam strumień na wszystkich stronach, więc plik jest mały,
  2) napisy „X MIEJSCE” / kategoria jako KRZYWE (obrysy glifów Bebas Neue narysowane ścieżkami), ta sama geometria
     co w podmien-tekst.py (linia bazowa, oś, dopasowanie szerokości, kapitalikowe „m”, dwie linie).
Strony zapasowe = tło z żółtymi kreskami (też raster).

  python3 eksport-corel.py            # -> out/dyplomy-komplet-corel.pdf (9 zapasowych + wszystkie z ../dyplomy.json)
  DPI=400 python3 eksport-corel.py
"""
import os, sys, json, importlib.util, pathlib
import fitz
from fontTools.ttLib import TTFont
from fontTools.pens.recordingPen import DecomposingRecordingPen

HERE = pathlib.Path(__file__).parent
spec = importlib.util.spec_from_file_location("pt", HERE / "podmien-tekst.py"); pt = importlib.util.module_from_spec(spec); spec.loader.exec_module(pt)

DPI = int(os.environ.get("DPI", "300"))
N_BLANK = int(os.environ.get("N_BLANK", "9"))
OUT = HERE / "out" / "dyplomy-komplet-corel.pdf"

# ── tła rastrowe (bez napisów) ───────────────────────────────────────────────
def raster(page):
    pix = page.get_pixmap(dpi=DPI, alpha=False)
    return pix.tobytes("jpeg", jpg_quality=93)

doc = pt.open_template(); page = doc[0]
pt.clear(page, "place"); pt.clear(page, "category")
BG_NAMED = raster(page); PAGE_W, PAGE_H = page.rect.width, page.rect.height; doc.close()
BG_BLANK = raster(fitz.open(pt.make_blank("kreski"))[0])

# ── glify Bebas Neue jako ścieżki ───────────────────────────────────────────
tt = TTFont(str(pt.font_file())); glyphset = tt.getGlyphSet(); cmap = tt.getBestCmap(); UPM = tt["head"].unitsPerEm
hmtx = tt["hmtx"]

def glyph_contours(ch):
    """Kontury glifu jako lista segmentów w jednostkach fontu (kwadratowe krzywe -> sześcienne)."""
    name = cmap.get(ord(ch)); pen = DecomposingRecordingPen(glyphset); glyphset[name].draw(pen)
    contours = []; cur = None; start = None
    for op, args in pen.value:
        if op == "moveTo": cur = list(args[0]); start = cur; contours.append([("M", cur)])
        elif op == "lineTo": cur = list(args[0]); contours[-1].append(("L", cur))
        elif op == "curveTo": contours[-1].append(("C", args)); cur = list(args[-1])
        elif op == "qCurveTo":
            pts = list(args)
            if pts[-1] is None: pts[-1] = pts[0]           # kontur bez punktu on-curve
            # domyślne punkty on-curve między kolejnymi off-curve
            offs = pts[:-1]; end = pts[-1]; p0 = cur
            for i, q in enumerate(offs):
                p2 = end if i == len(offs) - 1 else ((q[0] + offs[i + 1][0]) / 2, (q[1] + offs[i + 1][1]) / 2)
                c1 = (p0[0] + 2 / 3 * (q[0] - p0[0]), p0[1] + 2 / 3 * (q[1] - p0[1])); c2 = (p2[0] + 2 / 3 * (q[0] - p2[0]), p2[1] + 2 / 3 * (q[1] - p2[1]))
                contours[-1].append(("C", (c1, c2, p2))); p0 = p2
            cur = list(end)
        elif op in ("closePath", "endPath"): pass
    return contours, hmtx[name][0]

def draw_text(page, text, cx, base_y, fs):
    """Rysuje napis jako wypełnione ścieżki (kolor pt.COLOR), wyśrodkowany na cx, na linii bazowej base_y."""
    x = cx - pt.seg_width(text, fs) / 2
    shape = page.new_shape()
    for seg, sc in pt.segments(text):
        size = fs * sc; k = size / UPM
        for ch in seg:
            contours, adv = glyph_contours(ch)
            P = lambda p: fitz.Point(x + p[0] * k, base_y - p[1] * k)
            for c in contours:                       # Shape: kolejne draw_* zaczynające się w ostatnim punkcie tworzą jedną ścieżkę
                cur = None
                for op, a in c:
                    if op == "M": cur = P(a)
                    elif op == "L": nxt = P(a); shape.draw_line(cur, nxt); cur = nxt
                    else: nxt = P(a[2]); shape.draw_bezier(cur, P(a[0]), P(a[1]), nxt); cur = nxt
            x += adv * k
    shape.finish(fill=pt.COLOR, color=None, closePath=True, even_odd=False)
    shape.commit()

def layout(slot, new_text):
    """Ta sama geometria co pt.replace(): (linie, fs, cx, pierwsza baza, wysokość linii) z szablonu."""
    old, max_w = pt.SLOTS[slot]
    tmpl = fitz.open(pt.TEMPLATE); rect, base_y, size, cx = pt.find_span(tmpl[0], old); tmpl.close()
    lines = new_text.split("\n"); fs = size * pt.cap_ratio()
    if len(lines) > 1: fs *= 0.62
    fs = min(fs, *[fs * max_w / pt.seg_width(l, fs) for l in lines])
    lh = fs * 0.95; first = base_y - (len(lines) - 1) * lh * 0.55
    return lines, fs, cx, first, lh

# ── składanie ───────────────────────────────────────────────────────────────
items = json.load(open(HERE.parent / "dyplomy.json"))
out = fitz.open()
for _ in range(N_BLANK):
    p = out.new_page(width=PAGE_W, height=PAGE_H); p.insert_image(p.rect, stream=BG_BLANK)
for it in items:
    p = out.new_page(width=PAGE_W, height=PAGE_H); p.insert_image(p.rect, stream=BG_NAMED)
    for slot, text in (("place", f'{it["place"]} MIEJSCE'), ("category", it["category"])):
        lines, fs, cx, first, lh = layout(slot, text)
        for i, line in enumerate(lines): draw_text(p, line, cx, first + i * lh, fs)
out.save(OUT, garbage=4, deflate=True, use_objstms=0)
data = OUT.read_bytes(); OUT.write_bytes(data.replace(b"%PDF-1.7", b"%PDF-1.4", 1))   # brak cech >1.4, nagłówek zgodnie z prawdą
print(f"-> {OUT.name}: {out.page_count} stron, {OUT.stat().st_size/1e6:.1f} MB, tło {DPI} dpi, napisy jako krzywe")
