// Generator zapętlonego paska „smug”: równoległoboki + trójkąty (żółte i granatowe), wektor SVG.
// Pasek jest bezszwowy: kształty wychodzące poza prawą krawędź wracają z lewej (i odwrotnie),
// więc można go powielać w poziomie w nieskończoność.
//
//   node make-pasek.mjs                 # -> assets/pasek-smugi.svg (+ .png 2x, + podgląd 2 kafelków)
//   SEED=7 W=2400 H=800 node make-pasek.mjs
//   TINT=0 node make-pasek.mjs          # bez jasnych (rozjaśnionych) pasków — tylko żółty i granat
import fs from "fs";
import path from "path";
import { execFileSync } from "child_process";
import { fileURLToPath } from "url";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(DIR, "assets", process.env.NAME || "pasek-smugi");

const W = Number(process.env.W || 2400), H = Number(process.env.H || 800);
const SEED = Number(process.env.SEED || 2026);
const TINT = process.env.TINT !== "0";
const YELLOW = "#F5C518", TEAL = "#2D5A6B", TEAL_LIGHT = "#A9C0CA";
const SKEW = Math.tan(28 * Math.PI / 180);      // pochylenie boków równoległoboków

function mulberry32(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const rnd = mulberry32(SEED);
const R = (a, b) => a + rnd() * (b - a);
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
const f = (n) => Number(n.toFixed(1));

// ── kształty (w układzie 0..W, zapętlane przez wrap()) ─────────────────────
const shapes = [];   // { svg(dx) -> string, x0, x1 }  x0/x1 = zakres w osi X (do zapętlenia)
const boxes = [];    // bbox-y do unikania kolizji [x0,y0,x1,y1] (w układzie zapętlonym: także kopie ±W)
const hits = (x0, y0, x1, y1, m = 0) => boxes.some(([a, b, c, d]) => x0 - m < c && x1 + m > a && y0 - m < d && y1 + m > b);
const addBox = (x0, y0, x1, y1) => { boxes.push([x0, y0, x1, y1], [x0 - W, y0, x1 - W, y1], [x0 + W, y0, x1 + W, y1]); };

function bar(x, y, len, h, color) {
  const s = h * SKEW;
  addBox(x - s, y, x + len, y + h);
  shapes.push({ x0: x - s, x1: x + len,
    svg: (dx) => `<polygon points="${f(x + dx)},${f(y)} ${f(x + len + dx)},${f(y)} ${f(x + len - s + dx)},${f(y + h)} ${f(x - s + dx)},${f(y + h)}" fill="${color}"/>` });
}
function tri(x, y, size, color, filled) {          // trójkąt „▶” wpisany w kwadrat size
  addBox(x, y, x + size, y + size);
  const pts = (dx) => `${f(x + dx)},${f(y)} ${f(x + size + dx)},${f(y + size / 2)} ${f(x + dx)},${f(y + size)}`;
  shapes.push({ x0: x, x1: x + size,
    svg: (dx) => filled ? `<polygon points="${pts(dx)}" fill="${color}"/>`
                        : `<polygon points="${pts(dx)}" fill="none" stroke="${color}" stroke-width="${f(size * 0.09)}" stroke-linejoin="round"/>` });
}
function tripleTri(x, y, size, color) { for (let i = 0; i < 3; i++) tri(x + i * size * 1.35, y, size, color, true); }
// wolne miejsce o rozmiarze w×h (do 40 prób), null gdy brak
function freeSpot(w, h, margin = 10) {
  for (let i = 0; i < 40; i++) { const x = R(0, W), y = R(4, H - h - 4); if (!hits(x, y, x + w, y + h, margin)) return [x, y]; }
  return null;
}

// ── kompozycja ──────────────────────────────────────────────────────────────
// 1. długie równoległoboki w rzędach; część z „doczepionym” drugim paskiem (jak w oryginale: żółty + granat)
const ROWS = 8, rowH = H / ROWS;
for (let r = 0; r < ROWS; r++) {
  const mid = 1 - Math.abs((r + 0.5) / ROWS - 0.5) * 1.2;      // gęściej w środku pasa, rzadziej przy krawędziach
  let x = R(-200, 200);
  while (x < W) {
    const len = R(120, 620) * (0.6 + mid * 0.6), h = R(12, 44), y = rowH * r + R(4, rowH - h - 4);
    const s = h * SKEW;
    if (!hits(x - s, y, x + len, y + h, 14)) {
      const main = rnd() < 0.6 ? YELLOW : TEAL;
      bar(x, y, len, h, main);
      if (rnd() < 0.6) {                            // doczepiony cieńszy pasek (stos), przesunięty w poziomie
        const h2 = h * R(0.35, 0.75), off = R(-0.25, 0.45) * len, below = rnd() < 0.5;
        let c2 = main === YELLOW ? (rnd() < 0.5 ? TEAL_LIGHT : TEAL) : (rnd() < 0.7 ? YELLOW : TEAL_LIGHT);
        if (!TINT && c2 === TEAL_LIGHT) c2 = main === YELLOW ? TEAL : YELLOW;
        bar(x + off, below ? y + h : y - h2, len * R(0.5, 1.0), h2, c2);
      }
    }
    x += len + R(100, 480) / (0.5 + mid);
  }
}
// 2. krótkie „iskry” — małe cienkie paski w wolnych miejscach
for (let i = 0; i < 40; i++) { const len = R(40, 150), h = R(5, 12); const p = freeSpot(len, h, 6); if (p) bar(p[0], p[1], len, h, rnd() < 0.7 ? YELLOW : TEAL); }
// 3. trójkąty: konturowe duże, pełne małe, potrójne ▶▶▶ — zawsze w wolnym miejscu
for (let i = 0; i < 14; i++) { const sz = R(40, 85); const p = freeSpot(sz, sz, 12); if (p) tri(p[0], p[1], sz, rnd() < 0.8 ? YELLOW : TEAL, false); }
for (let i = 0; i < 22; i++) { const sz = R(14, 28); const p = freeSpot(sz, sz, 8); if (p) tri(p[0], p[1], sz, rnd() < 0.7 ? YELLOW : TEAL, true); }
for (let i = 0; i < 9; i++) { const sz = R(12, 20); const p = freeSpot(sz * 3.7, sz, 8); if (p) tripleTri(p[0], p[1], sz, rnd() < 0.7 ? YELLOW : TEAL); }

// ── zapętlenie: kopia przesunięta o -W i +W dla kształtów przy krawędziach ─
let body = "";
for (const s of shapes) {
  body += s.svg(0);
  if (s.x1 > W) body += s.svg(-W);
  if (s.x0 < 0) body += s.svg(W);
}
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
  <defs><clipPath id="tile"><rect x="0" y="0" width="${W}" height="${H}"/></clipPath></defs>
  <g clip-path="url(#tile)">
${body}
  </g>
</svg>
`;
fs.writeFileSync(OUT + ".svg", svg);
// podgląd: PNG 2x (przezroczysty) + dwa kafelki obok siebie na białym (test zapętlenia)
execFileSync("rsvg-convert", ["-w", String(W * 2), OUT + ".svg", "-o", OUT + ".png"]);
execFileSync("magick", [OUT + ".png", OUT + ".png", "+append", "-background", "white", "-flatten", "-resize", "50%", OUT + "-podglad-2x.png"]);
console.log(`-> ${path.basename(OUT)}.svg (${shapes.length} kształtów, ${W}x${H}), .png (${W * 2}px), -podglad-2x.png`);
