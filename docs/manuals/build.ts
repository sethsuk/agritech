/**
 * Renders the manuals to PDF:  npx tsx docs/manuals/build.ts
 *
 * Reads content/*.ts + screenshots/<set>/*.png + screenshots/<set>/marks.json (from
 * capture.ts), writes out/<name>.html (handy for quick previews in a browser) and
 * out/<name>.pdf (A4). Numbered markers on each screenshot match the numbered points
 * beside it.
 */
import { chromium } from "@playwright/test";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { resolve } from "path";
import { workerManual } from "./content/worker";
import { managerManual } from "./content/manager";
import type { Block, Manual, Section, Shot } from "./types";

const DIR = resolve(process.cwd(), "docs/manuals");
const OUT = resolve(DIR, "out");
const VW = 390; // capture viewport, CSS px
const VH = 844;

type Box = { x: number; y: number; w: number; h: number };

const LABEL = {
  th: { fix: "วิธีแก้", section: "บทที่" },
  my: { fix: "ဖြေရှင်းနည်း", section: "အခန်း" },
} as const;

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const pct = (n: number) => `${n.toFixed(2)}%`;

function render(m: Manual): string {
  const marksFile = resolve(DIR, "screenshots", m.shots, "marks.json");
  const marks: Record<string, Record<string, Box>> = existsSync(marksFile) ? JSON.parse(readFileSync(marksFile, "utf8")) : {};
  const missing: string[] = [];

  const phone = (s: Shot, cls: string) => {
    const file = resolve(DIR, "screenshots", m.shots, `${s.shot}.png`);
    if (!existsSync(file)) missing.push(`${m.shots}/${s.shot}.png`);
    const boxes = marks[s.shot] ?? {};
    const overlays = (s.marks ?? []).map((key, i) => {
      const b = boxes[key];
      if (!b) { missing.push(`${m.shots}/${s.shot} marker "${key}"`); return ""; }
      if (b.y >= VH || b.y + b.h <= 0) { missing.push(`${m.shots}/${s.shot} marker "${key}" is off-screen`); return ""; }
      const pad = 3;
      const x = Math.max(0, b.x - pad), y = Math.max(0, b.y - pad);
      const w = Math.min(VW - x, b.w + pad * 2), h = Math.min(VH - y, b.h + pad * 2);
      return `<div class="hl" style="left:${pct((x / VW) * 100)};top:${pct((y / VH) * 100)};width:${pct((w / VW) * 100)};height:${pct((h / VH) * 100)}"></div>` +
        `<div class="num" style="left:${pct((x / VW) * 100)};top:${pct((y / VH) * 100)}">${i + 1}</div>`;
    }).join("");
    return `<div class="phone ${cls}"><img src="../screenshots/${m.shots}/${s.shot}.png" alt=""><div class="ov">${overlays}</div></div>`;
  };

  const points = (items: string[], numbered: number) =>
    items.length ? `<ol class="pts">${items.map((p, i) =>
      `<li>${i < numbered ? `<span class="n">${i + 1}</span>` : `<span class="dot">•</span>`}<span>${esc(p)}</span></li>`).join("")}</ol>` : "";

  const block = (b: Block): string => {
    switch (b.kind) {
      case "step":
        return `<div class="step">${phone(b, "lg")}<div class="body">
          <h3>${esc(b.title)}</h3>
          ${points(b.points, b.marks?.length ?? 0)}
          ${b.extra?.length ? `<ul class="extra">${b.extra.map((e) => `<li>${esc(e)}</li>`).join("")}</ul>` : ""}
          ${b.tip ? `<div class="tip"><span>💡</span><span>${esc(b.tip)}</span></div>` : ""}
          ${b.warn ? `<div class="warn"><span>⚠️</span><span>${esc(b.warn)}</span></div>` : ""}
        </div></div>`;
      case "tiles":
        return `<div class="tiles">${b.tiles.map((t) => `<figure>${phone(t, "sm")}<figcaption>${esc(t.caption)}</figcaption></figure>`).join("")}</div>`;
      case "trouble":
        return `<div class="trouble ${b.shot ? "" : "noshot"}">
          ${b.shot ? phone(b as Shot, "xs") : `<div class="ticon">${b.icon ?? "❓"}</div>`}
          <div class="body">
            <p class="prob">${esc(b.problem)}</p>
            <p class="fixh">✔ ${LABEL[m.lang].fix}</p>
            <ol class="fix">${b.fix.map((f) => `<li>${esc(f)}</li>`).join("")}</ol>
          </div></div>`;
      case "note":
        return `<div class="note tone-${b.tone ?? "info"}"><h4>${b.icon} ${esc(b.title)}</h4><ul>${b.items.map((i) => `<li>${esc(i)}</li>`).join("")}</ul></div>`;
      case "table":
        return `<table><thead><tr><th>${esc(b.head[0])}</th><th>${esc(b.head[1])}</th></tr></thead><tbody>${
          b.rows.map(([a, c]) => `<tr><td>${esc(a)}</td><td>${esc(c)}</td></tr>`).join("")}</tbody></table>`;
    }
  };

  // The heading travels with the first block so it's never stranded at a page bottom.
  const section = (s: Section, i: number) => `<section>
    <div class="keep">
      <h2><span class="badge">${i + 1}</span><span class="ic">${s.icon}</span>${esc(s.title)}</h2>
      ${s.intro ? `<p class="intro">${esc(s.intro)}</p>` : ""}
      ${s.blocks.slice(0, 1).map(block).join("")}
    </div>
    ${s.blocks.slice(1).map(block).join("\n")}
  </section>`;

  const html = `<!doctype html>
<html lang="${m.lang}">
<head>
<meta charset="utf-8">
<title>${esc(m.title)} — ${esc(m.subtitle)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans:wght@400;600;700&family=Noto+Sans+Thai:wght@400;600;700&family=Noto+Sans+Myanmar:wght@400;600;700&display=block" rel="stylesheet">
<style>${CSS}</style>
</head>
<body class="lang-${m.lang}">
  <div class="cover">
    <div class="cover-band">
      <div class="logo">🌳</div>
      <h1>${esc(m.title)}</h1>
      <p class="sub">${esc(m.subtitle)}</p>
    </div>
    <div class="cover-shots">
      ${["login", "scan-qr", "tree", "dashboard", "alerts", "trees"].filter((n) => existsSync(resolve(DIR, "screenshots", m.shots, `${n}.png`))).slice(0, 3)
        .map((n) => phone({ shot: n }, "cv")).join("")}
    </div>
    <p class="draft">${esc(m.draft)}</p>
    <p class="example">ⓘ ${esc(m.exampleNote)}</p>
  </div>

  <div class="toc">
    <h2 class="toch">${esc(m.contentsTitle)}</h2>
    <ol>${m.sections.map((s, i) => `<li><span class="badge">${i + 1}</span><span class="ic">${s.icon}</span>${esc(s.title)}</li>`).join("")}</ol>
  </div>

  ${m.sections.map(section).join("\n")}
</body>
</html>`;

  if (missing.length) console.warn(`  ! ${m.file}: missing\n    ${missing.join("\n    ")}`);
  return html;
}

const CSS = `
:root {
  --ink: #2b2318; --body: #4a3f31; --muted: #7d6e59; --line: #d9d0c1;
  --bg-alt: #f6f1e7; --primary: #1b5e20; --primary-tint: #e4ede2;
  --caution: #b45309; --caution-tint: #fcefd9; --warning: #a62f0a; --warning-tint: #f7e4dc;
  --status: #01579b; --status-tint: #dce8f2;
  --mark: #e8590c;
}
@page { size: A4; margin: 12mm 12mm 14mm 12mm; }
* { box-sizing: border-box; }
html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
body {
  margin: 0; color: var(--body); background: #fff;
  font-family: "Noto Sans", "Noto Sans Thai", "Noto Sans Myanmar", sans-serif;
  font-size: 11.5pt; line-height: 1.6;
}
body.lang-my { font-size: 11pt; line-height: 1.95; }
h1, h2, h3, h4 { color: var(--ink); margin: 0; line-height: 1.35; }
body.lang-my h1, body.lang-my h2, body.lang-my h3, body.lang-my h4 { line-height: 1.7; }

/* Cover */
.cover { height: 271mm; display: flex; flex-direction: column; break-after: page; }
.cover-band { background: var(--primary); color: #fff; border-radius: 6mm; padding: 14mm 12mm 12mm; }
.cover-band .logo { font-size: 40pt; line-height: 1; }
.cover-band h1 { color: #fff; font-size: 26pt; margin-top: 5mm; }
.cover-band .sub { font-size: 16pt; margin: 2mm 0 0; opacity: .92; }
.cover-shots { display: flex; justify-content: center; gap: 8mm; margin: 12mm 0 10mm; }
.draft { margin: auto 0 0; font-weight: 600; color: var(--caution); font-size: 11pt; }
.example { color: var(--muted); font-size: 10pt; margin: 2mm 0 0; }

/* Contents */
.toc { break-after: page; }
.toch { font-size: 20pt; margin-bottom: 6mm; }
.toc ol { list-style: none; padding: 0; margin: 0; }
.toc li { display: flex; align-items: center; gap: 4mm; padding: 3.5mm 0; border-bottom: 1px solid var(--line); font-size: 13pt; color: var(--ink); font-weight: 600; }

/* Sections */
section { margin-top: 4mm; }
.keep { break-inside: avoid; }
section:first-of-type { margin-top: 0; }
section h2 { display: flex; align-items: center; gap: 3mm; font-size: 18pt; padding-bottom: 3mm; border-bottom: 2px solid var(--primary); margin-bottom: 5mm; }
.badge { display: inline-flex; align-items: center; justify-content: center; min-width: 9mm; height: 9mm; border-radius: 50%; background: var(--primary); color: #fff; font-size: 12pt; font-weight: 700; }
.ic { font-size: 16pt; }
.intro { margin: -1mm 0 5mm; font-size: 11.5pt; }

/* Phone screenshots */
.phone { position: relative; flex: none; }
.phone img { display: block; width: 100%; border: 1.5px solid #b9ad99; border-radius: 4mm; }
.phone .ov { position: absolute; inset: 0; }
.phone.lg { width: 54mm; }
.phone.sm { width: 38mm; }
.phone.xs { width: 34mm; }
.phone.cv { width: 46mm; }
.hl { position: absolute; border: 2px solid var(--mark); border-radius: 1.5mm; }
.num {
  position: absolute; transform: translate(-45%, -45%);
  width: 6mm; height: 6mm; border-radius: 50%; background: var(--mark); color: #fff;
  font: 700 9.5pt/6mm "Noto Sans", sans-serif; text-align: center; box-shadow: 0 0 0 1.2px #fff;
}
.phone.xs .num { width: 4.6mm; height: 4.6mm; font-size: 7.5pt; line-height: 4.6mm; }
.phone.xs .hl { border-width: 1.5px; }

/* Step */
.step { display: flex; gap: 8mm; align-items: flex-start; break-inside: avoid; margin-bottom: 7mm; }
.step .body { flex: 1; padding-top: 1mm; }
.step h3 { font-size: 14pt; margin-bottom: 3mm; }
.pts { list-style: none; padding: 0; margin: 0; }
.pts li { display: flex; gap: 3mm; align-items: flex-start; margin-bottom: 2.6mm; }
.pts .n {
  flex: none; width: 6.5mm; height: 6.5mm; border-radius: 50%; background: var(--mark); color: #fff;
  font: 700 10pt/6.5mm "Noto Sans", sans-serif; text-align: center; margin-top: .6mm;
}
body.lang-my .pts .n { margin-top: 1.6mm; }
.pts .dot { flex: none; width: 6.5mm; text-align: center; color: var(--muted); font-weight: 700; }
.extra { margin: 1mm 0 0; padding-left: 5mm; color: var(--body); }
.extra li { margin-bottom: 1.5mm; }
.tip, .warn { display: flex; gap: 2.5mm; margin-top: 3mm; padding: 2.5mm 3.5mm; border-radius: 2.5mm; font-size: 10.5pt; }
.tip { background: var(--status-tint); color: #013a68; }
.warn { background: var(--caution-tint); color: #6b4100; border-left: 3px solid var(--caution); }

/* Tiles */
.tiles { display: grid; grid-template-columns: repeat(3, 40mm); justify-content: space-around; row-gap: 6mm; margin-bottom: 6mm; }
.tiles figure { margin: 0; break-inside: avoid; }
.tiles figcaption { margin-top: 2mm; text-align: center; font-weight: 700; color: var(--ink); font-size: 11pt; line-height: 1.45; }
body.lang-my .tiles figcaption { line-height: 1.7; }

/* Trouble */
.trouble { display: flex; gap: 6mm; align-items: flex-start; break-inside: avoid; border: 1px solid var(--line); border-radius: 3mm; padding: 4mm; margin-bottom: 4mm; }
.trouble.noshot { align-items: center; }
.ticon { flex: none; width: 14mm; height: 14mm; border-radius: 50%; background: var(--bg-alt); display: flex; align-items: center; justify-content: center; font-size: 18pt; }
.trouble .body { flex: 1; }
.prob { margin: 0 0 1.5mm; font-weight: 700; color: var(--warning); font-size: 12pt; }
.fixh { margin: 0 0 .5mm; font-weight: 700; color: var(--primary); }
.fix { margin: 0; padding-left: 5.5mm; }
.fix li { margin-bottom: 1mm; }

/* Notes & tables */
.note { border-radius: 3mm; padding: 4mm 5mm; margin-bottom: 5mm; break-inside: avoid; }
.note h4 { font-size: 13pt; margin-bottom: 2mm; }
.note ul { margin: 0; padding-left: 5.5mm; }
.note li { margin-bottom: 1.2mm; }
.note.tone-info { background: var(--status-tint); }
.note.tone-ok { background: var(--primary-tint); }
.note.tone-warn { background: var(--caution-tint); border-left: 3px solid var(--caution); }
table { width: 100%; border-collapse: collapse; margin-bottom: 6mm; font-size: 10.5pt; break-inside: auto; }
th { background: var(--primary); color: #fff; text-align: left; padding: 2.5mm 3mm; }
td { border-bottom: 1px solid var(--line); padding: 2.5mm 3mm; vertical-align: top; }
td:first-child { font-weight: 600; color: var(--ink); width: 34%; }
tr { break-inside: avoid; }
`;

async function main() {
  mkdirSync(OUT, { recursive: true });
  const manuals = [workerManual("th"), workerManual("my"), managerManual()];
  const browser = await chromium.launch();
  try {
    for (const m of manuals) {
      const htmlPath = resolve(OUT, `${m.file}.html`);
      writeFileSync(htmlPath, render(m));
      const page = await browser.newPage();
      await page.goto(`file://${htmlPath}`, { waitUntil: "networkidle" });
      await page.evaluate(() => document.fonts.ready);
      await page.pdf({
        path: resolve(OUT, `${m.file}.pdf`),
        format: "A4",
        printBackground: true,
        preferCSSPageSize: true,
        displayHeaderFooter: true,
        headerTemplate: "<div></div>",
        footerTemplate: `<div style="width:100%;text-align:center;font-size:9px;color:#7d6e59;font-family:sans-serif"><span class="pageNumber"></span> / <span class="totalPages"></span></div>`,
      });
      await page.close();
      console.log(`✓ out/${m.file}.pdf`);
    }
  } finally {
    await browser.close();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
