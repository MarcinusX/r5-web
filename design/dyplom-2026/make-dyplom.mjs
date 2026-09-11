// Generator dyplomów Retkińska 5tka 2026.
// Jeden wspólny szablon (SVG w milimetrach, A4 pion) -> HTML per dyplom -> PDF/PNG (headless Chrome).
//
//   node make-dyplom.mjs            # generuje HTML + PDF + PNG dla wszystkich wpisów z dyplomy.json
//   node make-dyplom.mjs --html     # tylko HTML (podgląd w przeglądarce)
//   node make-dyplom.mjs --only 3   # tylko pierwsze 3 wpisy (szybki podgląd)
//
// Geometria mapy: ../../design/medal-2026/medal-geo.json (skopiowane do assets/) — prawdziwa pętla trasy
// (Kusocińskiego → Armii Krajowej → Maratońska → Popiełuszki) i siatka ulic Retkini z OSM.
import fs from "fs";
import path from "path";
import { execFileSync } from "child_process";
import { fileURLToPath } from "url";
import os from "os";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(DIR, "out");
const A = (f) => path.join(DIR, "assets", f);
fs.mkdirSync(OUT, { recursive: true });

const args = process.argv.slice(2);
const HTML_ONLY = args.includes("--html");
const ONLY = args.includes("--only") ? Number(args[args.indexOf("--only") + 1]) : Infinity;
const PICK = args.includes("--pick") ? args[args.indexOf("--pick") + 1].split(",").map(Number) : null; // numery wpisów (od 1)

// ── kolory marki ────────────────────────────────────────────────────────────
const TEAL = "#2D5A6B", TEAL_DARK = "#173540", YELLOW = "#F5C518", GREY = "#C7D0D5", INK = "#1a1a1a";

// pigułka z datą: PILL=granat (domyślnie) | zolty-granat | zolty-bialy | zolty-granat-biala-ramka
const PILL = {
  "granat":       { bg: TEAL_DARK, text: YELLOW,    stroke: "#fff" },
  "zolty-granat": { bg: YELLOW,    text: TEAL_DARK, stroke: TEAL_DARK },
  "zolty-bialy":  { bg: YELLOW,    text: "#fff",    stroke: TEAL_DARK },
  "zolty-granat-biala-ramka": { bg: YELLOW, text: TEAL_DARK, stroke: "#fff" },
}[process.env.PILL || "outline"] || { bg: TEAL_DARK, text: YELLOW, stroke: "#fff" };

// ── strona: A4 pion, jednostki = mm ─────────────────────────────────────────
const PW = 210, PH = 297;

// ── mapa: skala i pozycja ───────────────────────────────────────────────────
const g = JSON.parse(fs.readFileSync(A("medal-geo.json"), "utf8"));
const K = 0.235;                                  // mm na 1 px mapy (mapa 1023x859 px)
const LOOP_CX = 525, LOOP_CY = 405;               // środek pętli w px mapy
const MAP_CY = 152;                               // gdzie na stronie ma być środek pętli (mm)
// nagłówek: HEADER=logo (domyślnie: logo + smugi na bieli) | pasek (granatowy pas na całą szerokość, jak w projekcie z Canvy)
const HEADER = process.env.HEADER || "logo";   // | asset (gotowy pasek z Canvy: assets/pasek-gora.png, wstawiony bez zmian)
// ASSET=<plik w assets/> (domyślnie pasek-gora.png); wymiary czytane z nagłówka PNG; y = odstęp od góry kartki (mm)
const pngSize = (f) => { const b = fs.readFileSync(f); return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) }; };
const ASSET_FILE = process.env.ASSET || "pasek-gora.png";
const ASSET_BAND = { file: "../assets/" + ASSET_FILE, ...pngSize(A(ASSET_FILE)), y: Number(process.env.ASSET_Y || 9) };
const ASSET_BAND_H = PW * ASSET_BAND.h / ASSET_BAND.w;
const BAND_H = 66;                                // wysokość granatowego pasa (mm)
const FADE_TOP = HEADER === "pasek" ? [BAND_H, 102] : HEADER === "asset" ? [ASSET_BAND.y + ASSET_BAND_H, 100] : [42, 96];   // mapa wygaszona do bieli od..do (mm)
// stopka: FOOTER=domyslna | dwa-rzedy | bez-patronatu | bez-beneficjenta | patronat-tekst | akcent
const FOOTER = process.env.FOOTER || "bez-patronatu";
const FADE_BOTTOM = { "dwa-rzedy": [190, 243], "bez-beneficjenta": [195, 256], "patronat-tekst": [200, 262] }[FOOTER] || [205, 268];
const TX = PW / 2 - LOOP_CX * K, TY = MAP_CY - LOOP_CY * K;
let mapToPage;
const pageToMapX = (x) => (x - TX) / K;
const pageToMapY = (y) => (y - TY) / K;

// Spłaszczona pętla trasy (M/L/Q/Z) -> lista punktów, do liczenia przecięć.
function flattenRoute(d) {
  const t = d.replace(/([MLQZ])/g, " $1 ").trim().split(/\s+/);
  const pts = []; let i = 0, cur = null;
  const P = () => { const [x, y] = t[i++].split(",").map(Number); return [x, y]; };
  while (i < t.length) {
    const c = t[i++];
    if (c === "M" || c === "L") { cur = P(); pts.push(cur); }
    else if (c === "Q") {
      const c1 = P(), p2 = P(), p0 = cur;
      for (let s = 1; s <= 8; s++) { const u = s / 8, v = 1 - u;
        pts.push([v*v*p0[0] + 2*v*u*c1[0] + u*u*p2[0], v*v*p0[1] + 2*v*u*c1[1] + u*u*p2[1]]); }
      cur = p2;
    } else if (c === "Z") break;
  }
  return pts;
}
const loopRaw = flattenRoute(g.routeD);
// Obrót mapy wokół środka pętli. ROT=auto -> dominujący kierunek ulic pętli wyrównany do krawędzi kartki.
function dominantAngle(pts) {
  let cx = 0, cy = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]), t = Math.atan2(b[1] - a[1], b[0] - a[0]);
    cx += L * Math.cos(4 * t); cy += L * Math.sin(4 * t);      // kąt mod 90°
  }
  return Math.atan2(cy, cx) / 4 * 180 / Math.PI;
}
const ROT = process.env.ROT === "auto" ? -dominantAngle(loopRaw) : Number(process.env.ROT || 0);
if (process.env.ROT) console.error(`obrót mapy: ${ROT.toFixed(1)}°`);
const rotPt = ([x, y]) => { const r = ROT * Math.PI / 180, dx = x - LOOP_CX, dy = y - LOOP_CY;
  return [LOOP_CX + dx * Math.cos(r) - dy * Math.sin(r), LOOP_CY + dx * Math.sin(r) + dy * Math.cos(r)]; };
const loop = loopRaw.map(rotPt);
mapToPage = (p) => { const [x, y] = rotPt(p); return [x * K + TX, y * K + TY]; };
const MAP_T = `translate(${TX} ${TY}) scale(${K}) rotate(${ROT} ${LOOP_CX} ${LOOP_CY})`;
// przecięcia pętli z linią pionową x=const / poziomą y=const (px mapy)
function crossings(axis, v) {
  const res = [];
  for (let i = 0; i < loop.length; i++) {
    const a = loop[i], b = loop[(i + 1) % loop.length];
    const [a1, a2, b1, b2] = axis === "x" ? [a[0], a[1], b[0], b[1]] : [a[1], a[0], b[1], b[0]];
    if ((a1 - v) * (b1 - v) <= 0 && a1 !== b1) res.push(a2 + (v - a1) / (b1 - a1) * (b2 - a2));
  }
  return res.sort((p, q) => p - q);
}
const loopBottomY = Math.max(...crossings("x", pageToMapX(PW / 2))) * K + TY;
const loopTopY = Math.min(...crossings("x", pageToMapX(PW / 2))) * K + TY;
const innerWidthAt = (pageY) => { const c = crossings("y", pageToMapY(pageY)); return c.length >= 2 ? (c[c.length - 1] - c[0]) * K : 0; };
console.error(`pętla: góra ${loopTopY.toFixed(1)}mm, dół ${loopBottomY.toFixed(1)}mm; szer. wewn. @120mm=${innerWidthAt(120).toFixed(0)} @150=${innerWidthAt(150).toFixed(0)} @185=${innerWidthAt(185).toFixed(0)}`);

// ── fonty lokalne (Google Fonts pobrane do fonts/) ──────────────────────────
const fontsCss = fs.readFileSync(path.join(DIR, "fonts", "fonts.css"), "utf8")
  .replace(/url\(https:[^)]*\/([^/)]+)\)/g, "url(../fonts/$1)");

// ── logo (wektor z logo-svg, bez pasa ŁÓDŹ-RETKINIA / BIEG 5 KM) ────────────
// LOGO=oryginal -> białe litery z konturem (jak logo oficjalne); domyślnie wersja granatowa (lepszy kontrast na papierze)
const LOGO_FILE = process.env.LOGO === "oryginal" ? "logo-full.svg" : "logo-granat.svg";
const logoSvg = fs.readFileSync(A(LOGO_FILE), "utf8");
const logoLayers = [...logoSvg.matchAll(/<g id="(\w+)" transform="([^"]+)" fill="([^"]+)"[^>]*>([\s\S]*?)<\/g>/g)]
  .map(m => `<g transform="${m[2]}" fill="${m[3]}" stroke="none">${m[4]}</g>`).join("\n");
const LOGO_VB = 5112;
const LOGO_CLIP_Y = Number(process.env.LOGO_CLIP || 3496);   // 3496 = bez pasa ŁÓDŹ-RETKINIA (pas dodajemy tekstem z „5 KM”), 4000 = z pasem z logo
const BIEG_CLIP_Y = 4500;
// clip: logo z pasem ŁÓDŹ-RETKINIA (y<4000), bez linii „BIEG 5 KM • ATEST PZLA”; lewa kolumna z „5” i biegaczami w całości
const PLATE_SVG = (process.env.LOGO || "plate") === "plate" ? fs.readFileSync(A(process.env.PLATE_NO_DATE ? "logo-plate-bez-daty.svg" : "logo-plate.svg"), "utf8") : null;
const logoLayersWhite = [...fs.readFileSync(A("logo-full.svg"), "utf8").matchAll(/<g id="(\w+)" transform="([^"]+)" fill="([^"]+)"[^>]*>([\s\S]*?)<\/g>/g)]
  .map(m => `<g transform="${m[2]}" fill="${m[3]}" stroke="none">${m[4]}</g>`).join("\n");
const CLIP_POLY = [[0,0],[639,0],[639,437],[246,437],[246,488],[236,505],[218,525],[195,545],[160,562],[0,572]].map(([a,b]) => (a*8) + "," + (b*8)).join(" ");
function logoOnBand(x, y, w) {
  const u = w / 639;
  return `<svg x="${x}" y="${y}" width="${w}" height="${w}" viewBox="0 0 ${LOGO_VB} ${LOGO_VB}">
    <defs><clipPath id="logoClipBand"><polygon points="${CLIP_POLY}"/></clipPath></defs>
    <g clip-path="url(#logoClipBand)">${logoLayersWhite}</g>
  </svg>
  <text x="${x + 598 * u}" y="${y + 497 * u}" font-family="Barlow Condensed" font-weight="800" font-style="italic" fill="#ffffff" font-size="${42 * u}" text-anchor="end" letter-spacing="${1.5 * u}" data-fit="${348 * u}">5 KM • ŁÓDŹ-RETKINIA</text>`;
}
function logo(x, y, w) {
  if (HEADER === "pasek") return logoOnBand(x, y, w);
  if (PLATE_SVG) {   // plakietka 1023x950 -> szerokość w, wyśrodkowana tak jak zwykłe logo
    const inner = PLATE_SVG.replace(/^[\s\S]*?<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "");
    return `<svg x="${x}" y="${y}" width="${w}" height="${w * 950 / 1023}" viewBox="0 0 1023 950">${inner}</svg>`;
  }
  return `<svg x="${x}" y="${y}" width="${w}" height="${w}" viewBox="0 0 ${LOGO_VB} ${LOGO_VB}">
    <defs><clipPath id="logoClip">${LOGO_CLIP_Y >= 4000
      ? `<rect x="0" y="0" width="${LOGO_VB}" height="${LOGO_CLIP_Y}"/><rect x="0" y="0" width="1680" height="${LOGO_VB}"/>`
      : `<polygon points="${[[0,0],[639,0],[639,437],[246,437],[246,488],[236,505],[218,525],[195,545],[160,562],[0,572]].map(([a,b]) => (a*8) + "," + (b*8)).join(" ")}"/>`}</clipPath></defs>
    <g clip-path="url(#logoClip)">${logoLayers}</g>
  </svg>
  ${LOGO_CLIP_Y < 4000 ? logoBand(x, y, w) : ""}`;
}
// Pas pod logo: „5 KM • ŁÓDŹ-RETKINIA” (jak na projektach z czatu). BAND=pod-tka (w miejscu oryginalnego pasa) | pod-logo (pod całym logo)
function logoBand(x, y, w) {
  const u = w / 639;
  const style = `font-family="Barlow Condensed" font-weight="800" font-style="italic" fill="${TEAL}" paint-order="stroke" stroke="#F8D448" stroke-linejoin="round"`;
  if ((process.env.BAND || "pod-tka") === "pod-logo")
    return `<text x="${x + 320 * u}" y="${y + 585 * u}" ${style} font-size="${58 * u}" stroke-width="${5 * u}" text-anchor="middle" letter-spacing="${1.5 * u}" data-fit="${w * 0.9}">${process.env.BAND_TEXT || "5 KM • ŁÓDŹ-RETKINIA"}</text>`;
  const txt = process.env.BAND_TEXT || "5 KM • ŁÓDŹ";
  return `<text x="${x + 598 * u}" y="${y + 497 * u}" ${style} font-size="${74 * u}" stroke-width="${5 * u}" text-anchor="end" letter-spacing="${2 * u}" data-fit="${348 * u}">${txt}</text>`;
}

// ── kościół (piktogram z medalu) — wersja na jasne tło ──────────────────────
function church(x, y, h, opts = {}) {
  const body = opts.body || TEAL, line = opts.line || "#ffffff", cross = opts.cross || YELLOW;
  const s = h / 130;
  return `<g transform="translate(${x} ${y}) scale(${s}) translate(-50 -130)">
    <path d="M 27 76 L 2 102 L 2 120 L 27 120 Z" fill="${body}"/>
    <path d="M 73 76 L 98 102 L 98 120 L 73 120 Z" fill="${body}"/>
    <path d="M 46 20 L 26 120 L 74 120 L 54 20 Z M 46 20 L 54 20 L 50 62 Z" fill="${body}" fill-rule="evenodd"/>
    <g stroke="${line}" stroke-width="2.2" fill="none">
      <line x1="42.1" y1="65" x2="34" y2="120"/><line x1="57.9" y1="65" x2="66" y2="120"/>
      <line x1="46" y1="52" x2="29.5" y2="120"/><line x1="54" y1="52" x2="70.5" y2="120"/>
    </g>
    <path d="M 47.3 64 L 52.7 64 L 55.5 120 L 44.5 120 Z" fill="${TEAL_DARK}"/>
    <rect x="43" y="104" width="14" height="16" fill="${TEAL_DARK}"/>
    <rect x="40" y="100" width="20" height="4" fill="${line}"/>
    <rect x="20" y="120" width="60" height="5" fill="${body}"/>
    <g fill="${cross}"><rect x="47.6" y="0" width="4.8" height="46"/><rect x="38" y="9" width="24" height="5"/><rect x="48.4" y="46" width="3.2" height="42"/></g>
  </g>`;
}

// ── „znaczki”: smugi prędkości + trójkąty, deterministyczne (seed) ──────────
function mulberry32(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

// Klaster smug: poziome paski o zaokrąglonych końcach, w rzędach, „uciekające” od krawędzi strony.
// dir = 1: paski dosunięte do lewej krawędzi, -1: do prawej.
function streaks({ x0, x1, y0, y1, dir, seed, rows = 6, sharp = false }) {
  const rnd = mulberry32(seed);
  const palette = [YELLOW, YELLOW, TEAL, GREY, TEAL];
  let out = "";
  const rowH = (y1 - y0) / rows;
  for (let r = 0; r < rows; r++) {
    const y = y0 + rowH * (r + 0.5);
    const h = sharp ? 1.6 + rnd() * 2.2 : 1.1 + rnd() * 1.6;   // grubość paska (mm)
    let cursor = dir === 1 ? x0 - 6 : x1 + 6;          // start poza krawędzią
    const n = 1 + Math.floor(rnd() * 3);               // 1–3 segmenty w rzędzie
    for (let i = 0; i < n; i++) {
      const len = sharp ? 10 + rnd() * 38 : 6 + rnd() * 26;
      const gap = 2 + rnd() * 6;
      const color = palette[Math.floor(rnd() * palette.length)];
      const hollow = rnd() < (sharp ? 0.08 : 0.18);
      const xs = dir === 1 ? cursor : cursor - len;
      const inner = dir === 1 ? xs + len : xs;         // koniec od strony środka
      if (dir === 1 ? inner > x1 : inner < x0) break;
      const fill = hollow ? "none" : color;
      const stroke = hollow ? ` stroke="${color}" stroke-width="0.45"` : "";
      out += `<rect x="${xs.toFixed(2)}" y="${(y - h / 2).toFixed(2)}" width="${len.toFixed(2)}" height="${h.toFixed(2)}" rx="${sharp ? 0 : (h / 2).toFixed(2)}" fill="${fill}"${stroke}/>`;
      cursor = dir === 1 ? inner + gap : inner - gap;
    }
  }
  // trójkąty-strzałki (kontur) + trzy kropki, skierowane do środka strony
  const tri = (cx, cy, s, filled) => {
    const pts = dir === 1 ? `${cx - s},${cy - s} ${cx + s},${cy} ${cx - s},${cy + s}` : `${cx + s},${cy - s} ${cx - s},${cy} ${cx + s},${cy + s}`;
    return `<polygon points="${pts}" fill="${filled ? YELLOW : "none"}" stroke="${YELLOW}" stroke-width="0.5" stroke-linejoin="round"/>`;
  };
  for (let i = 0; i < 3; i++) {
    const cx = x0 + rnd() * (x1 - x0), cy = y0 + rnd() * (y1 - y0);
    out += tri(cx, cy, 1.2 + rnd() * 1.4, rnd() < 0.3);
  }
  const dy = y0 + rnd() * (y1 - y0), dx = dir === 1 ? x0 + 2 + rnd() * 8 : x1 - 10 - rnd() * 8;
  for (let i = 0; i < 3; i++) out += tri(dx + i * 2.6, dy, 0.8, true);
  const ox = dir === 1 ? x0 : x1, oy = (y0 + y1) / 2;
  return `<g transform="translate(${ox} ${oy}) skewX(-14) translate(${-ox} ${-oy})">${out}</g>`;
}

// ── mapa tła + trasa ────────────────────────────────────────────────────────
const [mx, my] = g.meta, [sx, sy] = g.start;
function mapLayer() {
  return `
  <defs>
    <!-- wygaszanie mapy: białe gradienty NAD ulicami (zamiast maski — maski SVG w PDF źle renderują Preview/drukarnie) -->
    <linearGradient id="fadeTop" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#fff" stop-opacity="1"/><stop offset="1" stop-color="#fff" stop-opacity="0"/>
    </linearGradient>
    <linearGradient id="fadeBottom" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#fff" stop-opacity="1"/>
    </linearGradient>
    <path id="route" d="${g.routeD}"/>
  </defs>
  <!-- siatka ulic Retkini + bloki (OSM), bardzo jasno, wygaszana ku górze i dołowi strony -->
  <g>
    <g transform="${MAP_T}">
      <g stroke="${TEAL}" stroke-width="2" fill="none" opacity="0.10" stroke-linecap="round">${g.streetsTiny}</g>
      <g stroke="${TEAL}" stroke-width="3.5" fill="none" opacity="0.16" stroke-linecap="round">${g.streetsMinor}</g>
      <g stroke="${TEAL}" stroke-width="7" fill="none" opacity="0.22" stroke-linecap="round">${g.streetsMajor}</g>
      <g fill="${TEAL}" opacity="0.08" stroke="none">${g.buildings}</g>
    </g>
    <rect x="0" y="0" width="${PW}" height="${FADE_TOP[0]}" fill="#fff"/>
    <rect x="0" y="${FADE_TOP[0]}" width="${PW}" height="${FADE_TOP[1] - FADE_TOP[0]}" fill="url(#fadeTop)"/>
    <rect x="0" y="${FADE_BOTTOM[0]}" width="${PW}" height="${FADE_BOTTOM[1] - FADE_BOTTOM[0]}" fill="url(#fadeBottom)"/>
    <rect x="0" y="${FADE_BOTTOM[1]}" width="${PW}" height="${PH - FADE_BOTTOM[1]}" fill="#fff"/>
  </g>
  <g transform="${MAP_T}">
    <!-- trasa biegu = ramka dyplomu -->
    <use href="#route" fill="#ffffff" fill-opacity="0.55" stroke="none"/>
    <use href="#route" fill="none" stroke="${TEAL_DARK}" stroke-width="17" stroke-linejoin="round"/>
    <use href="#route" fill="none" stroke="${YELLOW}" stroke-width="9" stroke-linejoin="round"/>
    <circle cx="${sx}" cy="${sy}" r="15" fill="${TEAL_DARK}" stroke="${YELLOW}" stroke-width="6"/>
    <!-- META: kościół Najświętszej Eucharystii stoi na mecie -->
    <circle cx="${mx}" cy="${my}" r="15" fill="${TEAL_DARK}" stroke="${YELLOW}" stroke-width="6"/>
    <g transform="rotate(${-ROT} ${mx} ${my + 9})">${church(mx, my + 9, 108, {})}</g>
  </g>`;
}

// ── nagłówek / stopka ───────────────────────────────────────────────────────
// Faliste cienkie linie (jak w projekcie z Canvy) — wiązka sinusoid przez cały pas.
function waves({ y0, y1, n = 14, seed = 7, color = "#ffffff", opacity = 0.28 }) {
  const rnd = mulberry32(seed);
  let out = "";
  for (let i = 0; i < n; i++) {
    const base = y0 + (y1 - y0) * (i / (n - 1)), amp = 5 + rnd() * 9, ph = rnd() * 6.28, f1 = 0.035 + rnd() * 0.02, f2 = 0.011 + rnd() * 0.01;
    const pts = [];
    for (let x = -5; x <= PW + 5; x += 3) pts.push(`${x},${(base + amp * Math.sin(x * f1 + ph) + amp * 0.6 * Math.sin(x * f2 + ph * 1.7)).toFixed(2)}`);
    out += `<polyline points="${pts.join(" ")}" fill="none" stroke="${color}" stroke-width="0.25" opacity="${opacity}"/>`;
  }
  return out;
}
function headerBand() {
  const w = 62, x = (PW - w) / 2, y = 4;
  const BAND_TEAL = "#1D576D", CREAM = "#F3E9C6", GREY2 = "#8F9BA3";
  const st = (o) => streaks({ rows: 7, sharp: true, ...o }).replace(/#C7D0D5/g, GREY2).replace(new RegExp(TEAL, "g"), CREAM);
  return `
  <rect x="0" y="0" width="${PW}" height="${BAND_H}" fill="${BAND_TEAL}"/>
  ${waves({ y0: 14, y1: 52, seed: 11, opacity: 0.22 })}
  ${st({ x0: 0, x1: 96, y0: 9, y1: 57, dir: 1, seed: 20260913 })}
  ${st({ x0: 114, x1: 210, y0: 7, y1: 55, dir: -1, seed: 5 })}
  ${logo(x, y, w)}`;
}
function header() {
  if (HEADER === "pasek") return headerBand();
  if (HEADER === "asset") return `<image href="${ASSET_BAND.file}" x="0" y="${ASSET_BAND.y}" width="${PW}" height="${ASSET_BAND_H.toFixed(2)}" preserveAspectRatio="none"/>`;
  const w = 62, x = (PW - w) / 2, y = 6;
  return `${streaks({ x0: 0, x1: 72, y0: 14, y1: 50, dir: 1, seed: 20260913 })}
  ${streaks({ x0: 138, x1: 210, y0: 12, y1: 48, dir: -1, seed: 5 })}
  ${logo(x, y, w)}`;
}

const label = (x, y, text, w) => `
  <text x="${x}" y="${y}" font-family="Oswald" font-weight="700" font-size="5.2" fill="${TEAL}" letter-spacing="1.6" text-anchor="middle" data-fit="${w - 24}">${text}</text>
  <g stroke="${YELLOW}" stroke-width="1" stroke-linecap="round" data-flank="${x},${y}">
    <line x1="${x - w / 2}" y1="${y - 1.8}" x2="${x - w / 2 + 8}" y2="${y - 1.8}"/><line x1="${x + w / 2 - 8}" y1="${y - 1.8}" x2="${x + w / 2}" y2="${y - 1.8}"/>
  </g>`;

// Data: warianty formy (PILL=...). Kolorowe pigułki + 5 innych form.
function dateBadge(px, y, ang, lastBaseline) {
  const style = process.env.PILL || "none";
  const T = (fill, extra = "") => `<text x="0" y="3.6" font-family="Bebas Neue" font-size="10.5" fill="${fill}" text-anchor="middle" letter-spacing="0.6"${extra}>13.09.2026</text>`;
  const rot = (inner) => `<g transform="translate(${px} ${y.toFixed(2)}) rotate(${ang.toFixed(2)})">${inner}</g>`;
  switch (style) {
    case "none": return "";
    case "bib":        // numer startowy: biała tabliczka, żółty pasek u góry, granatowa data
      return rot(`<rect x="-25" y="-8" width="50" height="16" rx="2" fill="#fff" stroke="${TEAL_DARK}" stroke-width="1.2"/>
        <rect x="-25" y="-8" width="50" height="3.2" fill="${YELLOW}"/>
        <text x="0" y="5.8" font-family="Bebas Neue" font-size="10.5" fill="${TEAL_DARK}" text-anchor="middle" letter-spacing="0.6">13.09.2026</text>`);
    case "outline":    // lekka: biała pigułka z granatowym konturem
      return rot(`<rect x="-20" y="-5.4" width="40" height="10.8" rx="5.4" fill="#fff" stroke="#fff" stroke-width="3"/>
        <rect x="-20" y="-5.4" width="40" height="10.8" rx="5.4" fill="#fff" stroke="${TEAL_DARK}" stroke-width="1"/>
        <text x="0" y="3" font-family="Bebas Neue" font-size="8.8" fill="${TEAL_DARK}" text-anchor="middle" letter-spacing="0.5">13.09.2026</text>`);
    case "tekst":      // bez pigułki: data nad linią trasy, „5 KM” pod nią (po drugiej stronie), z białą otoczką
      return rot(`<text x="0" y="-5" font-family="Bebas Neue" font-size="11.5" fill="${TEAL_DARK}" text-anchor="middle" letter-spacing="0.8" paint-order="stroke" stroke="#fff" stroke-width="2" stroke-linejoin="round">13.09.2026</text>
        <text x="0" y="13.5" font-family="Bebas Neue" font-size="11.5" fill="${TEAL_DARK}" text-anchor="middle" letter-spacing="1.2" paint-order="stroke" stroke="#fff" stroke-width="2" stroke-linejoin="round">5 KM</text>`);
    case "srodek":     // bez pigułki: data w bloku centralnym pod kategorią
      return `<text x="${PW / 2}" y="${lastBaseline + 13}" font-family="Oswald" font-weight="700" font-size="5.6" fill="${TEAL}" text-anchor="middle" letter-spacing="1.4" paint-order="stroke" stroke="#fff" stroke-width="1.4" stroke-linejoin="round">ŁÓDŹ  <tspan fill="${YELLOW}">•</tspan>  13.09.2026</text>`;
    case "tag": {      // dymek przy kropce START (jak etykieta na mapie)
      const [ax, ay] = mapToPage(g.start);
      const bx = ax + 14, by = ay + 9;
      return `<polygon points="${ax + 4.5},${ay + 1.5} ${bx - 8},${by - 4} ${bx - 2},${by - 1}" fill="${TEAL_DARK}"/>
        <rect x="${bx - 8}" y="${by - 6.5}" width="48" height="13" rx="3" fill="${TEAL_DARK}"/>
        <text x="${bx + 16}" y="${by + 3.6}" font-family="Bebas Neue" font-size="10.5" fill="${YELLOW}" text-anchor="middle" letter-spacing="0.6">13.09.2026</text>`;
    }
    default:           // pigułka w kolorach PILL
      return rot(`<rect x="-24" y="-6.5" width="48" height="13" rx="6.5" fill="${PILL.bg}" stroke="${PILL.stroke}" stroke-width="1.6"/>${T(PILL.text)}`);
  }
}

// Blok centralny wewnątrz pętli. lines: {place:"I", category:"OPEN K"} albo category z "\n".
function centre(d) {
  const cx = PW / 2;
  const placeText = d.place ? `${d.place} MIEJSCE` : (d.title || "");
  const catLines = String(d.category || "").split("\n");
  const catSize = catLines.length > 1 ? 19 : 24;
  const catY0 = 190 - (catLines.length - 1) * catSize * 0.45;
  const cat = catLines.map((l, i) => `<text x="${cx}" y="${catY0 + i * catSize * 0.92}" font-family="Bebas Neue" font-size="${catSize}" fill="${TEAL}" text-anchor="middle" data-fit="118" paint-order="stroke" stroke="#fff" stroke-width="1.6" stroke-linejoin="round">${l}</text>`).join("");
  const px = 132;
  const edgeY = (x) => Math.max(...crossings("x", pageToMapX(x))) * K + TY;
  const dateY = edgeY(px), ang = Math.atan2(edgeY(px + 10) - edgeY(px - 10), 20) * 180 / Math.PI;
  return `
  ${label(cx, 100, "DYPLOM", 60)}
  <text x="${cx}" y="${d.place ? 143 : 141}" font-family="Bebas Neue" font-size="${d.place ? 42 : 30}" fill="${TEAL}" text-anchor="middle" data-fit="${d.place ? 126 : 114}" paint-order="stroke" stroke="#fff" stroke-width="2.2" stroke-linejoin="round">${placeText}</text>
  <g stroke="${YELLOW}" stroke-linecap="round"><line x1="${cx - 42}" y1="150.5" x2="${cx + 42}" y2="150.5" stroke-width="1.4"/></g>
  ${label(cx, 165, "KATEGORIA", 60)}
  ${cat}
  ${dateBadge(px, dateY, ang, catY0 + (catLines.length - 1) * catSize * 0.92)}`;
}

// stopka: grupy logotypów jak na podziękowaniu 2025
function img(src, x, y, w, h) {
  return `<image href="${src}" x="${x}" y="${y}" width="${w}" height="${h}" preserveAspectRatio="xMidYMid meet"/>`;
}
function group(x, w, title, content, y = 271) {
  return `
  <text x="${x}" y="${y}" font-family="Oswald" font-weight="500" font-size="3.1" fill="${TEAL}" letter-spacing="0.5">${title}</text>
  <line x1="${x}" y1="${y + 1.8}" x2="${x + w}" y2="${y + 1.8}" stroke="${TEAL}" stroke-width="0.3"/>
  ${content(x, y + 5, w)}`;
}
function footer(d) {
  // logotypy: parafia i prezydent wycięte z plakatu 2026 (pasek sponsorów), Kolorowy Świat z ich strony (kolorowe)
  const parafia   = (h) => (x, y, w) => img("../assets/parafia.png", x, y + 1, w, h);
  const kolorowy  = (h) => (x, y, w) => img("../assets/kolorowy.png", x, y + 2, w, h);
  const prezydent = (h) => (x, y, w) => img("../assets/prezydent.png", x, y + 1, w, h);
  // partnerzy główni: Toya (proporcje 4.4:1) i Kultowa (3.8:1); wt/wk = szerokości w mm
  const partnerzy = (wt, wk, gap = 5) => (x, y, w) => {
    const ht = wt / 4.44, hk = wk / 3.81, H = Math.max(ht, hk);
    const x0 = x + (w - wt - wk - gap) / 2;
    return `${img("../assets/toya.png", x0, y + 3 + (H - ht) / 2, wt, ht)}${img("../assets/pizzeria-kultowa.png", x0 + wt + gap, y + 3 + (H - hk) / 2, wk, hk)}`;
  };
  const line = (y, text, size = 3.4) => `<text x="${PW / 2}" y="${y}" font-family="Oswald" font-weight="500" font-size="${size}" fill="${TEAL}" letter-spacing="0.8" text-anchor="middle">${text}</text>`;
  switch (FOOTER) {
    case "dwa-rzedy":        // partnerzy główni w osobnym, dużym rzędzie nad resztą
      return `
  ${group(12, 186, "PARTNERZY GŁÓWNI", partnerzy(42, 54, 12), 247)}
  ${group(12, 44, "ORGANIZATOR", parafia(11), 275)}
  ${group(83, 44, "BENEFICJENT", kolorowy(9.5), 275)}
  ${group(154, 44, "PATRONAT HONOROWY", (x, y, w) => prezydent(11)(x + 8, y, 22), 275)}`;
    case "bez-patronatu": {  // 3 grupy: partnerzy w środku, duzi; wszystkie logotypy wycentrowane na jednej osi (y+10)
      // etykiety niżej (272.5), logotypy na stałej osi 282 mm — bliżej nagłówków
      const LABEL_Y = 275, box = (src, x, y, w) => img(src, x, 278.5, w, 15);
      return `
  ${group(12, 28, "ORGANIZATOR", (x, y) => box("../assets/parafia.png", x, y, 28), LABEL_Y)}
  ${group(48, 114, "PARTNERZY GŁÓWNI", (x, y, w) => {
      // przycięte assety (bez przezroczystych marginesów): napis TOYA i pasek Kultowej mają tę samą wysokość H
      const Ht = 11, Hk = 13.2, wt = Ht * 732 / 165, wk = Hk * 2052 / 457, gap = 7, x0 = x + (w - wt - wk - gap) / 2;
      return box("../assets/toya-trim.png", x0, y, wt) + box("../assets/pizzeria-kultowa-trim.png", x0 + wt + gap, y, wk); }, LABEL_Y)}
  ${group(168, 30, "BENEFICJENT", (x, y) => box("../assets/kolorowy.png", x, y, 30), LABEL_Y)}`;
    }
    case "bez-beneficjenta": // 3 grupy + fundacja wspomniana tekstem nad stopką
      return `
  ${line(262, "BIEG CHARYTATYWNY NA RZECZ FUNDACJI KOLOROWY ŚWIAT")}
  ${group(12, 40, "ORGANIZATOR", parafia(14))}
  ${group(62, 92, "PARTNERZY GŁÓWNI", partnerzy(36, 46))}
  ${group(162, 36, "PATRONAT HONOROWY", (x, y, w) => prezydent(14)(x + 5, y, 26))}`;
    case "patronat-tekst":   // patronat jako linia tekstu pod logotypami
      return `
  ${group(12, 40, "ORGANIZATOR", parafia(14), 266)}
  ${group(62, 40, "BENEFICJENT", kolorowy(11.6), 266)}
  ${group(112, 86, "PARTNERZY GŁÓWNI", partnerzy(34, 46), 266)}
  ${line(290.5, "PATRONAT HONOROWY: PREZYDENT MIASTA ŁODZI HANNA ZDANOWSKA", 3.1)}`;
    case "akcent":           // jeden rząd, wszystko zostaje, ale partnerzy 1,6x więksi, reszta mniejsza
      return `
  ${group(12, 26, "ORGANIZATOR", parafia(11))}
  ${group(44, 26, "BENEFICJENT", kolorowy(8.4))}
  ${group(76, 22, "PATRONAT", (x, y, w) => prezydent(12)(x, y, 22))}
  ${group(104, 94, "PARTNERZY GŁÓWNI", partnerzy(36, 46))}`;
    default:                 // obecny: jeden rząd, równe grupy
      return `
  ${group(12, 34, "ORGANIZATOR", parafia(14))}
  ${group(56, 36, "BENEFICJENT", kolorowy(11.6))}
  ${group(102, 30, "PATRONAT HONOROWY", (x, y, w) => prezydent(14)(x + 2, y, 26))}
  ${group(146, 52, "PARTNERZY GŁÓWNI", partnerzy(22, 27))}`;
  }
}

// ── strona ──────────────────────────────────────────────────────────────────
function page(d) {
  return `<!DOCTYPE html>
<html lang="pl"><head><meta charset="UTF-8">
<title>Dyplom — ${d.place ? d.place + " miejsce" : d.title} — ${d.category || ""}</title>
<style>
${fontsCss}
@page { size: A4 portrait; margin: 0; }
html, body { margin: 0; padding: 0; background: #fff; }
svg.page { display: block; width: 210mm; height: 297mm; }
</style></head><body>
<svg class="page" viewBox="0 0 ${PW} ${PH}" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
  <rect x="0" y="0" width="${PW}" height="${PH}" fill="#ffffff"/>
  ${mapLayer()}
  ${header()}
  ${centre(d)}
  ${footer(d)}
</svg>
<script>
// Dopasowanie tekstów do maksymalnej szerokości (data-fit, w mm) — po załadowaniu fontów.
document.fonts.ready.then(() => {
  for (const el of document.querySelectorAll("[data-fit]")) {
    const max = Number(el.dataset.fit);
    let size = parseFloat(el.getAttribute("font-size"));
    for (let i = 0; i < 40 && el.getBBox().width > max; i++) { size *= 0.96; el.setAttribute("font-size", size.toFixed(2)); }
  }
  document.documentElement.dataset.ready = "1";
});
</script>
</body></html>`;
}

// ── lista dyplomów ──────────────────────────────────────────────────────────
const list = JSON.parse(fs.readFileSync(path.join(DIR, "dyplomy.json"), "utf8")).filter((_, i) => !PICK || PICK.includes(i + 1)).slice(0, ONLY);
const slug = (s) => s.toLowerCase().replace(/ł/g, "l").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const files = [];
for (const d of list) {
  const name = slug(`${d.place ? d.place + "-miejsce" : d.title}-${(d.category || "").replace("\n", " ")}`);
  const html = path.join(OUT, name + ".html");
  fs.writeFileSync(html, page(d));
  files.push({ name, html });
}
console.error(`HTML: ${files.length} plików w out/`);
if (!HTML_ONLY) {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "dyplom-chrome-"));
  for (const { name, html } of files) {
    const url = "file://" + html;
    const common = ["--headless=new", "--disable-gpu", "--hide-scrollbars", "--timeout=4000", "--no-first-run", `--user-data-dir=${profile}`];
    const pdf = path.join(OUT, name + ".pdf");
    fs.rmSync(pdf, { force: true });
    try { execFileSync(CHROME, [...common, "--no-pdf-header-footer", `--print-to-pdf=${pdf}`, url], { stdio: "ignore", timeout: 8000, killSignal: "SIGKILL" }); }
    catch (e) { if (!fs.existsSync(pdf)) throw e; }
    // podgląd PNG z PDF (poppler), 150 dpi
    execFileSync("pdftoppm", ["-r", "150", "-png", "-singlefile", path.join(OUT, name + ".pdf"), path.join(OUT, name)], { stdio: "ignore" });
    console.error("  ✓", name);
  }
  fs.rmSync(profile, { recursive: true, force: true });
}
