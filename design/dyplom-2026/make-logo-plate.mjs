// Logo na granatowej plakietce (jak na medalu 2025), wersja 2026 — w pełni wektorowa.
// Plakietka: sylwetka zwektoryzowana (potrace) z medal_2025_final.pdf -> assets/logo-plate-shape.svg
// Litery: assets/logo-granat.svg / logo-full.svg (wektor), dopasowane skalą i przesunięciem po bbox słowa „RETKIŃSKA”:
//   medal (1023x950 px): 882x202 @ (116,16)   logo-full (2556 px render): 2077x477 @ (303,174)  -> k = 0.4241/2 na jednostkę viewBox 5112
// Data i pas: tekst (Barlow Condensed 800 italic) w miejscu „28.09.2025 / ŁÓDŹ - RETKINIA • 5 KM”.
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
const DIR = path.dirname(fileURLToPath(import.meta.url));
const A = (f) => path.join(DIR, "assets", f);

const NAVY = "#1F586C", YELLOW = "#FFD302";
const K = 0.4241 / 2, TX = 116 - 606 * K, TY = 16 - 348 * K;

const shape = fs.readFileSync(A("logo-plate-shape.svg"), "utf8");
const sm = shape.match(/<g transform="([^"]+)"[^>]*>([\s\S]*?)<\/g>/);
const plate = `<g transform="${sm[1]}" fill="${NAVY}" stroke="none">${sm[2]}</g>`;

const logoSvg = fs.readFileSync(A("logo-full.svg"), "utf8");
const layers = [...logoSvg.matchAll(/<g id="(\w+)" transform="([^"]+)" fill="([^"]+)"[^>]*>([\s\S]*?)<\/g>/g)]
  .map(m => `<g transform="${m[2]}" fill="${m[3]}" stroke="none">${m[4]}</g>`).join("\n");
// bez oryginalnego pasa ŁÓDŹ-RETKINIA / BIEG 5 KM; wielokąt omija brzuszek „5” (jednostki 639 * 8)
const clip = [[0,0],[639,0],[639,437],[246,437],[246,488],[236,505],[218,525],[195,545],[160,562],[0,572]].map(([a,b]) => (a*8) + "," + (b*8)).join(" ");

const DATE = process.env.DATE || "13.09.2026";
const BAND = process.env.BAND_TEXT || "ŁÓDŹ - RETKINIA • 5 KM";
const withDate = process.env.NO_DATE !== "1";

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1023 950" width="1023" height="950">
  <defs><clipPath id="plateLogoClip"><polygon points="${clip}"/></clipPath></defs>
  ${plate}
  <g transform="translate(${TX.toFixed(2)} ${TY.toFixed(2)}) scale(${K.toFixed(5)})">
    <g clip-path="url(#plateLogoClip)">${layers}</g>
  </g>
  ${withDate ? `<text x="686" y="770" font-family="Barlow Condensed" font-weight="800" font-style="italic" font-size="130" fill="#ffffff"
        paint-order="stroke" stroke="#0e2a36" stroke-width="7" stroke-linejoin="round" text-anchor="middle" letter-spacing="2">${DATE}</text>` : ""}
  <text x="683" y="${withDate ? 852 : 790}" font-family="Barlow Condensed" font-weight="800" font-style="italic" font-size="${withDate ? 58 : 80}" fill="${YELLOW}"
        text-anchor="middle" letter-spacing="1.5">${BAND}</text>
</svg>
`;
const out = A(withDate ? "logo-plate.svg" : "logo-plate-bez-daty.svg");
fs.writeFileSync(out, svg);
console.log("->", path.basename(out), `(${(svg.length / 1024).toFixed(0)} KB)`);
