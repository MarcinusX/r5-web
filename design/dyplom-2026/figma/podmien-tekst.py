#!/usr/bin/env python3
"""Podmiana tekstu w dyplomie z Figmy (szablon-figma.pdf) bez zmiany czcionek i z zachowaniem wyśrodkowania.

  python3 podmien-tekst.py                      # wszystkie wpisy z ../dyplomy.json -> out/*.pdf (+ png podglądy)
  python3 podmien-tekst.py --pick 1,5,51        # wybrane numery wpisów
  python3 podmien-tekst.py --one "II" "OPEN M"  # pojedynczy dyplom
  python3 podmien-tekst.py --blank              # zapasowe: out/zapasowy-{linie,zolte,kreski,pusty}.pdf (linie do ręcznego wpisu)
  python3 podmien-tekst.py --map-scale 1.15 ...  # większa mapa z trasą (skalowanie wokół środka pętli; teksty i logo bez zmian)
  python3 podmien-tekst.py --map-dy 8 ...        # mapa z trasą przesunięta o 8 mm w dół (łączy się z --map-scale)
  python3 podmien-tekst.py --font oswald-light ... # cieńszy krój dużych napisów (bebas | oswald-light | oswald-regular | oswald-extralight)
  python3 podmien-tekst.py --route-fade 0.4 ...  # bledsza trasa (0..1, ile w stronę bieli); łączy się z każdą komendą
  python3 podmien-tekst.py --merge 9 kreski     # jeden plik do druku: 9 zapasowych (styl kreski) + wszystkie z dyplomy.json -> out/dyplomy-komplet.pdf

Jak to działa: PyMuPDF usuwa tylko dwa napisy z szablonu ("I MIEJSCE" i "OPEN K"; sama warstwa tekstu, mapa/grafika
zostają) i wstawia nowe w tych samych czcionkach (Bebas Neue z ../fonts), na tej samej linii bazowej, wyśrodkowane
na tej samej osi co oryginał. Za długie napisy są zmniejszane, a kategoria z "\n" łamana na dwie linie.
"""
import sys, json, subprocess, pathlib, re
import fitz  # PyMuPDF

HERE = pathlib.Path(__file__).parent
TEMPLATE = HERE / "szablon-figma.pdf"
FONT = HERE.parent / "fonts" / "BebasNeue-Regular.ttf"
OUT = HERE / "out"; OUT.mkdir(exist_ok=True)
COLOR = (0x2d / 255, 0x5a / 255, 0x6b / 255)

# Co podmieniamy: tekst w szablonie -> (maks. szerokość w pt, dopuszczalne łamanie)
SLOTS = {"place": ("I MIEJSCE", 410), "category": ("OPEN K", 340)}

# Krój dużych napisów: TEXT_FONT = bebas (jak w szablonie, jedna grubość) | oswald-light | oswald-regular | oswald-extralight
# Rozmiar jest przeliczany tak, by wysokość wersalików była taka sama jak w Bebas Neue z szablonu.
TEXT_FONT = "bebas"
FONTS = {"bebas": ("BebasNeue-Regular.ttf", 1.0), "oswald-light": ("Oswald-Light.ttf", 0.7 / 0.81),
         "oswald-regular": ("Oswald-Regular.ttf", 0.7 / 0.81), "oswald-extralight": ("Oswald-ExtraLight.ttf", 0.7 / 0.81)}
def font_file(): return HERE.parent / "fonts" / FONTS[TEXT_FONT][0]
def cap_ratio(): return FONTS[TEXT_FONT][1]
def tlen(text, size): return fitz.Font(fontfile=str(font_file())).text_length(text, fontsize=size)

def find_span(page, text):
    """Zwraca (bbox, origin_y, size, cx) napisu złożonego ze spanów (np. 'OPEN', ' ', 'K')."""
    spans = [s for b in page.get_text("dict")["blocks"] if b["type"] == 0 for l in b["lines"] for s in l["spans"]]
    joined = ""; group = []
    for s in spans:
        if s["font"].startswith("BebasNeue"):
            group.append(s); joined += s["text"]
            if joined.strip() == text:
                x0 = min(g["bbox"][0] for g in group); x1 = max(g["bbox"][2] for g in group)
                y0 = min(g["bbox"][1] for g in group); y1 = max(g["bbox"][3] for g in group)
                return fitz.Rect(x0, y0, x1, y1), group[0]["origin"][1], group[0]["size"], (x0 + x1) / 2
            if not text.startswith(joined): group, joined = [], ""
        else:
            group, joined = [], ""
    raise SystemExit(f"nie znaleziono napisu {text!r} w szablonie")

def replace(page, slot, new_text):
    old, max_w = SLOTS[slot]
    rect, base_y, size, cx = find_span(page, old)
    # usuń tylko tekst; ciasny prostokąt (od góry glifów do linii bazowej + zapas), żeby nie zahaczyć o "DLA"
    ink = fitz.Rect(rect.x0 - 2, rect.y0, rect.x1 + 2, base_y + size * 0.06)
    page.add_redact_annot(ink, fill=False)
    page.apply_redactions(images=fitz.PDF_REDACT_IMAGE_NONE, graphics=0)
    lines = new_text.split("\n")
    fs = size * cap_ratio()
    if len(lines) > 1: fs = fs * 0.62
    fs = min(fs, *[fs * max_w / seg_width(l, fs) for l in lines])   # dopasuj do szerokości
    lh = fs * 0.95
    first_base = base_y - (len(lines) - 1) * lh * 0.55          # blok wielu linii wyśrodkowany wokół oryginalnej linii
    for i, line in enumerate(lines):
        draw_centered(page, line, cx, first_base + i * lh, fs)

SMALL = 0.68   # skala „małych liter” (Bebas Neue ma tylko wersaliki: małe m rysujemy jako pomniejszone M)
def segments(text):
    """Dzieli tekst na (fragment, skala): końcowe małe litery (np. jednostka 'm' w '300m') -> pomniejszone."""
    m = re.match(r"^(.*?)([a-ząćęłńóśźż]+)$", text)
    return [(m.group(1), 1.0), (m.group(2), SMALL)] if m else [(text, 1.0)]
def seg_width(text, fs): return sum(tlen(t, fs * sc) for t, sc in segments(text))
def draw_centered(page, text, cx, base_y, fs):
    x = cx - seg_width(text, fs) / 2
    for t, sc in segments(text):
        page.insert_text((x, base_y), t, fontsize=fs * sc, fontname="Dyplom" + TEXT_FONT.replace("-", ""), fontfile=str(font_file()), color=COLOR)
        x += tlen(t, fs * sc)

def clear(page, slot):
    """Usuwa napis ze slotu; zwraca (cx, base_y, size)."""
    old, _ = SLOTS[slot]
    rect, base_y, size, cx = find_span(page, old)
    ink = fitz.Rect(rect.x0 - 2, rect.y0, rect.x1 + 2, base_y + size * 0.06)
    page.add_redact_annot(ink, fill=False)
    page.apply_redactions(images=fitz.PDF_REDACT_IMAGE_NONE, graphics=0)
    return cx, base_y, size

YELLOW = (0xF5 / 255, 0xC5 / 255, 0x18 / 255)
BLANK_STYLES = {   # nazwa -> (kolor, grubość, wzór kresek lub None)
    "linie":  (COLOR, 0.9, None),
    "zolte":  (YELLOW, 2.4, None),
    "kreski": (YELLOW, 2.4, "[24 17] 0"),   # jak linia pod „DLA” w szablonie (kreska 24 pt, przerwa 17 pt), ale o 1/3 cieńsza (2,4 pt) i z zaokrąglonymi końcami
    "pusty":  None,
}
def make_blank(style="linie"):
    doc = open_template(); page = doc[0]
    for slot, width in (("place", 300), ("category", 150)):
        cx, base_y, size = clear(page, slot)
        if BLANK_STYLES[style]:   # linia do ręcznego wpisu, tuż pod linią bazową napisu
            color, w, dashes = BLANK_STYLES[style]; y = base_y + 4
            if dashes:            # długość = pełna liczba kresek (zaczyna i kończy się całą kreską)
                d, g = 24, 17; n = max(1, round((width + g) / (d + g))); width = n * d + (n - 1) * g
            page.draw_line((cx - width / 2, y), (cx + width / 2, y), color=color, width=w, dashes=dashes, lineCap=1 if dashes else 0)
    name = f"zapasowy-{style}"
    pdf = OUT / f"{name}.pdf"; doc.save(pdf, garbage=3, deflate=True); doc.close()
    subprocess.run(["pdftoppm", "-r", "100", "-png", "-singlefile", str(pdf), str(OUT / name)], check=True)
    return pdf

# Logo: "RETKINIA  • 5KM" zostaje na wszystkich dyplomach. KIDS_LOGO=True -> w biegach dziecięcych dystans w logo 300m / 500m
KIDS_LOGO = False
FONT_BARLOW = HERE.parent / "fonts" / "Barlow-Bold.ttf"
def logo_text_for(category):
    m = re.search(r"(\d+)m$", category or "")
    return f"RETKINIA  • {m.group(1)}m" if (KIDS_LOGO and m) else None
def fix_logo_text(page, category=None):
    LOGO_TEXT = logo_text_for(category)
    if not LOGO_TEXT: return
    spans = [s for b in page.get_text("dict")["blocks"] if b["type"] == 0 for l in b["lines"] for s in l["spans"]]
    sp = next(s for s in spans if s["font"].startswith("Barlow") and "5KM" in s["text"])
    x0, y0, x1, y1 = sp["bbox"]; cx = (x0 + x1) / 2; base_y = sp["origin"][1]; fs = sp["size"]
    page.add_redact_annot(fitz.Rect(x0 - 1, y0, x1 + 1, base_y + fs * 0.05), fill=False)
    page.apply_redactions(images=fitz.PDF_REDACT_IMAGE_NONE, graphics=0)
    w = fitz.Font(fontfile=str(FONT_BARLOW)).text_length(LOGO_TEXT, fontsize=fs)
    page.insert_text((cx - w / 2, base_y), LOGO_TEXT, fontsize=fs, fontname="BarlowBold", fontfile=str(FONT_BARLOW), color=(1, 1, 1))

# Bledsza trasa: ROUTE_FADE = 0..1 (0 = bez zmian, 0.5 = kolory trasy w połowie drogi do bieli). Zmienia tylko dwa obrysy
# pętli trasy (żółty 9 pt i ciemny kontur 17 pt) w strumieniach PDF; kropki START/META i reszta grafiki bez zmian.
ROUTE_FADE = 0.55   # domyślnie bledsza trasa (wybór z 10.09.2026)
ROUTE_STROKES = [   # (fragment strumienia tuż przed kolorem, oryginalny kolor)
    (b"9 w 1 j 4 M /Gs6 gs /Cs1 CS ", b"0.9608 0.7725 0.0941 SC"),
    (b"17 w 1 j 4 M /Gs6 gs /Cs1 CS ", b"0.0902 0.2078 0.251 SC"),
]
def fade_route(doc, f):
    if not f: return
    for x in range(1, doc.xref_length()):
        if not doc.xref_is_stream(x): continue
        d = doc.xref_stream(x); changed = False
        for pre, col in ROUTE_STROKES:
            if pre + col in d:
                rgb = [float(v) for v in col.split()[:3]]
                new = " ".join(f"{c + (1 - c) * f:.4f}" for c in rgb).encode() + b" SC"
                d = d.replace(pre + col, pre + new, 1); changed = True
        if changed: doc.update_stream(x, d)

# Skala mapy: MAP_SCALE = 1.0 (bez zmian) … 1.2. Skaluje wokół środka pętli dwie grupy bloków w głównym XObject (xref 6):
# [Im1, Fm2, Fm3, Fm4] = raster mapy + warstwy ulic oraz [Fm8 … kościół] = pętla trasy, kropki, kościół. Teksty, logo,
# stopka, linia „DLA” i wygaszenia (Fm5/Fm6) zostają na miejscu.
MAP_SCALE = 1.20              # domyślnie mapa 120% (wybór z 11.09.2026)
MAP_DY_MM = 8.0               # … przesunięta o 8 mm w dół
MAP_CENTER = (297.6, 411.2)   # środek pętli w układzie PDF (BBox Fm8), y od dołu strony
def top_blocks(d):
    toks = [(m.start(), m.group(0)) for m in re.finditer(r"(?<![\w.])(q|Q)(?![\w.])", d)]
    depth = 0; blocks = []; start = None
    for off, t in toks:
        if t == "q":
            if depth == 0: start = off
            depth += 1
        else:
            depth -= 1
            if depth == 0: blocks.append((start, off + 1))
    return blocks
def scale_map(doc, s, dy_mm=0.0):
    if (not s or abs(s - 1) < 1e-6) and not dy_mm: return
    xref = 6; d = doc.xref_stream(xref).decode("latin1")
    blocks = top_blocks(d)
    first = lambda pat: next(i for i, (a, b) in enumerate(blocks) if re.search(pat, d[a:b]))
    g1 = (first(r"/Im1 Do"), first(r"/Fm4 Do"))                      # mapa
    i8 = first(r"/Fm8 Do"); j = i8                                      # trasa … ostatni blok przed nagłówkiem
    while j + 1 < len(blocks):                                          # nagłówek zaczyna się od bloku rysowanego powyżej y=690
        m = re.search(r"([-\d.]+) ([-\d.]+) m\b", d[blocks[j + 1][0]:blocks[j + 1][1]])
        if m and float(m.group(2)) > 690: break
        j += 1
    g2 = (i8, j)
    cx, cy = MAP_CENTER
    dy = -dy_mm * 72 / 25.4     # w PDF oś y rośnie do góry
    pre = f"q 1 0 0 1 {cx} {cy + dy:.3f} cm {s} 0 0 {s} 0 0 cm 1 0 0 1 {-cx} {-cy} cm "
    out = ""; pos = 0
    for (i0, i1) in (g1, g2):
        a = blocks[i0][0]; b = blocks[i1][1]
        out += d[pos:a] + pre + d[a:b] + " Q "; pos = b
    out += d[pos:]
    doc.update_stream(xref, out.encode("latin1"))

# Podmiana logo: LOGO_SWAP = True -> w miejsce logo z Figmy (XObject Fm13, xref 35 + napisy „RETKINIA • 5KM” / „13.09.2026”)
# wstawiamy gotowy raster z medalu 2026 (../medal/medal-2026-logo.png, 300 dpi), dopasowany do tego samego prostokąta.
LOGO_SWAP = True
LOGO_XREF = 35
LOGO_PNG = HERE.parent / "medal" / "medal-2026-logo.png"
def swap_logo(doc, page):
    if not LOGO_SWAP: return
    bbox = [float(v) for v in doc.xref_get_key(LOGO_XREF, "BBox")[1].strip("[]").split()]     # układ PDF (y od dołu)
    H = page.rect.height
    rect = fitz.Rect(bbox[0], H - bbox[3], bbox[2], H - bbox[1])
    doc.update_stream(LOGO_XREF, b"")                                                          # stare logo znika
    spans = [sp for b in page.get_text("dict")["blocks"] if b["type"] == 0 for l in b["lines"] for sp in l["spans"] if sp["font"].startswith("Barlow")]
    for sp in spans: page.add_redact_annot(fitz.Rect(sp["bbox"]), fill=False)                  # napisy pod logo
    if spans: page.apply_redactions(images=fitz.PDF_REDACT_IMAGE_NONE, graphics=0)
    page.insert_image(rect, filename=str(LOGO_PNG), keep_proportion=True)

def open_template():
    doc = fitz.open(TEMPLATE); fade_route(doc, ROUTE_FADE); scale_map(doc, MAP_SCALE, MAP_DY_MM); swap_logo(doc, doc[0]); return doc

def make(place, category, name):
    doc = open_template(); page = doc[0]
    fix_logo_text(page, category)
    replace(page, "place", f"{place} MIEJSCE")
    replace(page, "category", category)
    doc.subset_fonts()
    pdf = OUT / f"{name}.pdf"
    doc.save(pdf, garbage=3, deflate=True); doc.close()
    subprocess.run(["pdftoppm", "-r", "100", "-png", "-singlefile", str(pdf), str(OUT / name)], check=True)
    return pdf

def slug(s):
    s = s.lower().replace("ł", "l").replace("ż", "z").replace("ó", "o").replace("ę", "e").replace("ą", "a").replace("ś", "s").replace("ń", "n").replace("ć", "c").replace("ź", "z")
    return re.sub(r"[^a-z0-9]+", "-", s).strip("-")

if __name__ == "__main__":
    args = sys.argv[1:]
    while args[:1] in (["--route-fade"], ["--map-scale"], ["--map-dy"], ["--font"]):
        if args[0] == "--route-fade": ROUTE_FADE = float(args[1])
        elif args[0] == "--map-scale": MAP_SCALE = float(args[1])
        elif args[0] == "--font": TEXT_FONT = args[1]
        else: MAP_DY_MM = float(args[1])
        args = args[2:]
    if args[:1] == ["--merge"]:
        n_blank = int(args[1]) if len(args) > 1 else 9; style = args[2] if len(args) > 2 else "kreski"
        items = json.load(open(HERE.parent / "dyplomy.json"))
        merged = fitz.open()
        blank = fitz.open(make_blank(style))
        for _ in range(n_blank): merged.insert_pdf(blank)
        for it in items:
            cat = it["category"]; name = slug(f'{it["place"]}-miejsce-{cat.replace(chr(10), " ")}')
            pdf = OUT / f"{name}.pdf"
            if not pdf.exists(): make(it["place"], cat, name)
            merged.insert_pdf(fitz.open(pdf))
        out = OUT / "dyplomy-komplet.pdf"; merged.save(out, garbage=4, deflate=True)   # garbage=4 scala zduplikowane strumienie (tło mapy) — 5 MB zamiast 300 MB
        print(f"✓ {out.name}: {n_blank} zapasowych ({style}) + {len(items)} = {merged.page_count} stron"); sys.exit()
    if args[:1] == ["--blank"]:
        for st in (args[1:] or BLANK_STYLES): print("✓", make_blank(st).name)
        sys.exit()
    if args[:1] == ["--one"]:
        items = [{"place": args[1], "category": args[2]}]
    else:
        items = json.load(open(HERE.parent / "dyplomy.json"))
        if args[:1] == ["--pick"]:
            keep = {int(n) for n in args[1].split(",")}; items = [it for i, it in enumerate(items, 1) if i in keep]
    for it in items:
        cat = it["category"]; name = slug(f'{it["place"]}-miejsce-{cat.replace(chr(10), " ")}')
        print("✓", make(it["place"], cat, name).name)
