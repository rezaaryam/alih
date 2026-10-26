#!/usr/bin/env node
/*
 * Builds the demo gallery in docs/demo/ as plain, separate HTML files, exactly
 * like a small static or PHP site would have. alih is then added with two tags.
 *
 *   node scripts/build-demo.js
 */
"use strict";
const fs = require("fs");
const path = require("path");

const OUT = path.join(__dirname, "..", "docs", "demo");
fs.mkdirSync(OUT, { recursive: true });

const PRINTS = [
  { slug: "low-tide", title: "Low Tide", medium: "Pigment print on cotton paper", size: "40 × 50 cm", edition: 30, price: 1200000, bg: "#e9dcc4",
    note: "Seven bands of water and sand, drawn as if the tide had paused for a moment. The sun sits off center so the eye keeps drifting across the shoreline." },
  { slug: "orchard", title: "Orchard", medium: "Screen print, five colors", size: "40 × 50 cm", edition: 25, price: 1450000, bg: "#1f3b2c",
    note: "Eighty fruit on a dark green field. The grid is almost regular; every fruit is nudged a few millimeters, the way real rows of trees never quite line up." },
  { slug: "signal", title: "Signal", medium: "Risograph, two drums", size: "30 × 40 cm", edition: 50, price: 650000, bg: "#f2ece0",
    note: "Rings spreading from one corner, like a radio wave drawn by hand. Orange and black alternate with paper so the rhythm stays readable from across a room." },
  { slug: "kiln", title: "Kiln", medium: "Pigment print on cotton paper", size: "40 × 50 cm", edition: 30, price: 1200000, bg: "#efe2cf",
    note: "A stack of fired clay, each slab a different heat. The edges are rounded and slightly uneven, which is the only instruction the shapes followed." },
  { slug: "monsoon", title: "Monsoon", medium: "Giclée on matte paper", size: "50 × 62.5 cm", edition: 20, price: 1900000, bg: "#3e4e5c",
    note: "Nine hundred strokes of rain over a low row of roofs. The sky lightens toward the horizon, the moment just before the downpour eases." },
  { slug: "paper-sun", title: "Paper Sun", medium: "Risograph with halftone", size: "30 × 40 cm", edition: 50, price: 650000, bg: "#f4ead6",
    note: "A red disc and its shadow, built from printer's dots. Up close it is a grid; from a step back it is a sunset on a dark shore." },
  { slug: "night-ferry", title: "Night Ferry", medium: "Pigment print on cotton paper", size: "40 × 50 cm", edition: 30, price: 1200000, bg: "#0d1630",
    note: "The last crossing of the evening, six lit windows and a moon stretched across the water. Quiet enough to hear the engine." },
  { slug: "dune-04", title: "Dune 04", medium: "Screen print, six colors", size: "40 × 50 cm", edition: 25, price: 1450000, bg: "#f3d9a8",
    note: "Six layers of sand from pale to burnt, the fourth study in a series about slow movement. Each ridge was drawn from two overlapping waves." }
];

const rupiah = (n) => "Rp " + n.toLocaleString("id-ID");
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

function shell({ title, description, body, bodyClass = "" }) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<meta name="theme-color" content="#f4f1ea">
<link rel="icon" href="../favicon.svg">
<link rel="preload" href="../fonts/manrope-latin-wght-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="../alih.css">
<link rel="stylesheet" href="../style.css">
<script src="../alih.js"></script>
</head>
<body class="${bodyClass}">
<header class="g-top" data-alih="site-header">
  <a class="g-logo" href="./">Quiet Rooms</a>
  <nav class="g-nav" aria-label="Gallery">
    <a href="./">Prints</a>
    <a href="about.html">About</a>
    <a class="g-docs" href="../">alih docs</a>
  </nav>
</header>
${body}
<aside class="mode" data-no-alih aria-label="Transition mode">
  <span class="mode-dot" aria-hidden="true"></span>
  <span class="mode-t">Transition: <b data-mode-label>checking</b></span>
  <a class="mode-a" data-mode-switch href="?alih=soft">Try the fallback</a>
</aside>
<script src="../mode.js" data-alih-skip></script>
</body>
</html>
`;
}

// ------------------------------------------------------------------ list
const cards = PRINTS.map((p, i) => `
      <li>
        <a class="g-card" href="${p.slug}.html" style="--bg:${p.bg}">
          <figure class="g-art"><img src="../art/${p.slug}.webp" alt="${esc(p.title)}, ${esc(p.medium.toLowerCase())}" width="1000" height="1250" data-alih="art-${p.slug}"${i > 3 ? ' loading="lazy"' : ""}></figure>
          <div class="g-meta">
            <h2 data-alih="title-${p.slug}">${esc(p.title)}</h2>
            <p>${esc(p.medium)}</p>
            <p class="g-price">${rupiah(p.price)}</p>
          </div>
        </a>
      </li>`).join("");

fs.writeFileSync(path.join(OUT, "index.html"), shell({
  title: "Quiet Rooms · Eight small prints",
  description: "A small online exhibition of eight prints, used to demonstrate alih page transitions.",
  body: `<main data-alih-root class="g-list">
  <section class="g-intro">
    <p class="g-kicker">Exhibition · Autumn 2026</p>
    <h1 data-alih="page-title">Eight small <em>prints.</em></h1>
    <p class="g-lead">Open any print. Each one is its own HTML page, like on any ordinary website. alih makes the image travel from this grid into the next page, and back again.</p>
  </section>
  <ul class="g-grid">${cards}
  </ul>
  <p class="g-fine">The prints and the gallery are fictional, made for this demo. All images are drawn by a script in the repository.</p>
</main>`
}));

// ------------------------------------------------------------------ detail pages
PRINTS.forEach((p, i) => {
  const prev = PRINTS[(i - 1 + PRINTS.length) % PRINTS.length];
  const next = PRINTS[(i + 1) % PRINTS.length];
  const nav = (o, label, dir) => `
      <a class="d-step ${dir}" href="${o.slug}.html"${dir === "prev" ? ' data-alih-direction="back"' : ""}>
        <img src="../art/${o.slug}.webp" alt="" width="1000" height="1250" loading="lazy" data-alih="art-${o.slug}">
        <span><small>${label}</small><b data-alih="title-${o.slug}">${esc(o.title)}</b></span>
      </a>`;
  fs.writeFileSync(path.join(OUT, p.slug + ".html"), shell({
    title: `${p.title} · Quiet Rooms`,
    description: `${p.title}, ${p.medium.toLowerCase()}. ${p.note}`,
    bodyClass: "is-detail",
    body: `<main data-alih-root class="g-detail" style="--bg:${p.bg}">
  <a class="d-back" href="./" data-alih-direction="back"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 12H5m0 0 6-6m-6 6 6 6"/></svg>All prints</a>
  <div class="d-grid">
    <figure class="d-art"><img src="../art/${p.slug}.webp" alt="${esc(p.title)}, ${esc(p.medium.toLowerCase())}" width="1000" height="1250" data-alih="art-${p.slug}"></figure>
    <div class="d-info">
      <p class="g-kicker">No. ${String(i + 1).padStart(2, "0")} of ${String(PRINTS.length).padStart(2, "0")}</p>
      <h1 data-alih="title-${p.slug}">${esc(p.title)}</h1>
      <p class="d-note">${esc(p.note)}</p>
      <dl class="d-facts">
        <div><dt>Medium</dt><dd>${esc(p.medium)}</dd></div>
        <div><dt>Size</dt><dd>${esc(p.size)}</dd></div>
        <div><dt>Edition</dt><dd>${p.edition} signed copies</dd></div>
        <div><dt>Year</dt><dd>2026</dd></div>
      </dl>
      <div class="d-buy">
        <p class="d-price">${rupiah(p.price)}</p>
        <button type="button" disabled>Reserve, demo only</button>
      </div>
    </div>
  </div>
  <nav class="d-nav" aria-label="More prints">${nav(prev, "Previous", "prev")}${nav(next, "Next", "next")}
  </nav>
</main>`
  }));
});

// ------------------------------------------------------------------ about
fs.writeFileSync(path.join(OUT, "about.html"), shell({
  title: "About · Quiet Rooms",
  description: "About this demo gallery.",
  body: `<main data-alih-root class="g-about">
  <section class="g-intro">
    <p class="g-kicker">About</p>
    <h1 data-alih="page-title">A gallery that is <em>not real.</em></h1>
    <div class="g-prose">
      <p>Quiet Rooms exists to show what <a href="../">alih</a> does on an ordinary multi-page site. Every page here is a separate HTML file with a normal link to the next one. There is no router, no framework, and no build step for the pages themselves.</p>
      <p>In browsers that support cross-document view transitions, the browser animates between pages on its own; alih only tells it which elements belong together. In other browsers, alih fetches the next page and swaps it in, so the experience stays close.</p>
      <p>Use the switch in the corner to compare the two.</p>
    </div>
  </section>
</main>`
}));

console.log("demo: " + (PRINTS.length + 2) + " pages written to docs/demo/");
module.exports = { PRINTS };
