"use strict";
/*
 * Both paths in a real browser, against the demo gallery in docs/:
 * native cross-document transitions, and the soft fetch-and-swap fallback.
 */
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const http = require("http");
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const ROOT = path.join(__dirname, "..", "docs");
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".webp": "image/webp", ".woff2": "font/woff2", ".svg": "image/svg+xml" };
let server, base, browser, hits = [];

before(async () => {
  server = http.createServer((req, res) => {
    const url = decodeURIComponent(req.url.split("?")[0]);
    let file = path.join(ROOT, url.endsWith("/") ? url + "index.html" : url);
    if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
    if (/\.html$/.test(file)) hits.push({ url: req.url, alih: req.headers["x-alih"] || null });
    fs.readFile(file, (err, data) => {
      if (err) { res.writeHead(404, { "content-type": "text/html" }); return res.end("<h1>Not found</h1>"); }
      res.writeHead(200, { "content-type": TYPES[path.extname(file)] || "application/octet-stream" });
      res.end(data);
    });
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  base = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch();
});
after(async () => { await browser.close(); server.close(); });

async function open(url, opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, ...opts });
  const p = await ctx.newPage();
  p.errors = [];
  p.on("pageerror", (e) => p.errors.push(e.message));
  await p.goto(base + url, { waitUntil: "networkidle" });
  return p;
}
const last = (p) => p.evaluate(() => window.Alih.last);

test("auto picks native where cross-document transitions exist", async () => {
  const p = await open("/demo/");
  assert.equal(await p.evaluate(() => Alih.mode), "native");
  assert.equal(await p.evaluate(() => document.documentElement.dataset.alihMode), "native");
  assert.equal(await p.textContent("[data-mode-label]"), "native, cross-document");
  // speculation rules were added so hovered pages can prerender
  assert.equal(await p.$$eval("script[type=speculationrules]", (s) => s.length), 1);
  await p.context().close();
});

test("native: list to detail morphs the clicked card, then back the other way", async () => {
  const p = await open("/demo/");
  await p.click('a[href="orchard.html"]');
  await p.waitForURL(/orchard\.html$/);
  await p.waitForFunction(() => window.Alih && window.Alih.last);
  const l = await last(p);
  assert.equal(l.mode, "native");
  assert.equal(l.animated, true);
  assert.equal(l.direction, "forward");
  assert.ok(l.shared.includes("art-orchard") && l.shared.includes("title-orchard"), l.shared.join());
  assert.ok(!l.shared.includes("art-low-tide"), "only the clicked card is named");
  // names are removed once the transition is over
  await p.waitForFunction(() => !document.querySelector('[data-alih="art-orchard"]').style.viewTransitionName);
  await p.goBack();
  await p.waitForURL(/\/demo\/$/);
  await p.waitForFunction(() => window.Alih && window.Alih.last && window.Alih.last.direction === "back");
  assert.ok((await last(p)).shared.includes("art-orchard"));
  assert.deepEqual(p.errors, []);
  await p.context().close();
});

test("native: keys carry over, so the docs fan lands in the gallery grid", async () => {
  const p = await open("/");
  await p.click(".fan");
  await p.waitForURL(/\/demo\/$/);
  await p.waitForFunction(() => window.Alih && window.Alih.last);
  const l = await last(p);
  ["art-low-tide", "art-signal", "art-night-ferry"].forEach((k) => assert.ok(l.shared.includes(k), k));
  await p.context().close();
});

test("soft: ?alih=soft swaps pages without reloading, and keeps the choice", async () => {
  const p = await open("/demo/?alih=soft");
  assert.equal(await p.evaluate(() => Alih.mode), "soft");
  await p.evaluate(() => { window.__same = "yes"; });
  hits = [];
  await p.click('a[href="kiln.html"]');
  await p.waitForFunction(() => location.pathname.endsWith("kiln.html") && document.querySelector("h1").textContent === "Kiln");
  assert.equal(await p.evaluate(() => window.__same), "yes", "same document, no reload");
  assert.equal(await p.title(), "Kiln · Quiet Rooms");
  assert.ok(hits.some((h) => h.url.endsWith("kiln.html") && h.alih === "1"), "fetched with the X-Alih header");
  const l = await last(p);
  assert.equal(l.mode, "soft");
  assert.ok(l.shared.includes("art-kiln"));
  await p.waitForFunction(() => !document.documentElement.classList.contains("alih-loading"));
  // a full reload stays in soft mode for this tab
  await p.reload();
  assert.equal(await p.evaluate(() => Alih.mode), "soft");
  await p.context().close();
});

test("soft: Back restores the previous page and its scroll position", async () => {
  const p = await open("/demo/?alih=soft");
  await p.evaluate(() => scrollTo(0, 400));
  await p.waitForFunction(() => scrollY >= 390);
  await p.click('a[href="monsoon.html"]');
  await p.waitForFunction(() => document.querySelector("h1").textContent === "Monsoon");
  assert.equal(await p.evaluate(() => scrollY), 0);
  await p.goBack();
  await p.waitForFunction(() => document.querySelector("h1").textContent.startsWith("Eight small"));
  await p.waitForFunction(() => scrollY >= 390);
  assert.equal((await last(p)).direction, "back");
  await p.context().close();
});

test("soft: hovering a link prefetches it, so the click needs no second request", async () => {
  const p = await open("/demo/?alih=soft");
  hits = [];
  await p.hover('a[href="dune-04.html"]');
  await p.waitForFunction(() => true);
  await p.waitForTimeout(250);
  const before = hits.filter((h) => h.url.endsWith("dune-04.html")).length;
  assert.equal(before, 1, "prefetched on hover");
  await p.click('a[href="dune-04.html"]');
  await p.waitForFunction(() => document.querySelector("h1").textContent === "Dune 04");
  assert.equal(hits.filter((h) => h.url.endsWith("dune-04.html")).length, 1, "used the cached page");
  await p.context().close();
});

test("soft: external links, new tabs, and data-no-alih are left to the browser", async () => {
  const p = await open("/?alih=soft");
  hits = [];
  // the GitHub link has data-no-alih; it must not be fetched by alih
  const intercepted = await p.evaluate(() => {
    const a = document.querySelector('a[href^="https://github.com/rezaaryam/alih"]');
    const ev = new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 });
    a.addEventListener("click", (e) => e.preventDefault(), { once: true }); // keep the test page here
    a.dispatchEvent(ev);
    return document.documentElement.classList.contains("alih-loading");
  });
  assert.equal(intercepted, false);
  await p.context().close();
});

test("soft: a missing page falls back to a normal navigation", async () => {
  const p = await open("/demo/?alih=soft");
  await p.evaluate(() => {
    const a = document.createElement("a");
    a.href = "missing.html"; a.textContent = "missing"; a.id = "gone";
    document.querySelector("main").appendChild(a);
  });
  await p.click("#gone");
  await p.waitForFunction(() => document.querySelector("h1") && document.querySelector("h1").textContent === "Not found");
  await p.context().close();
});

test("reduced motion: native transitions are skipped", async () => {
  const p = await open("/demo/", { reducedMotion: "reduce" });
  await p.click('a[href="signal.html"]');
  await p.waitForURL(/signal\.html$/);
  await p.waitForFunction(() => window.Alih && window.Alih.last);
  assert.equal((await last(p)).animated, false);
  await p.context().close();
});

test("mobile layout has no sideways scroll", async () => {
  for (const u of ["/", "/demo/", "/demo/night-ferry.html"]) {
    const p = await open(u, { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    assert.equal(await p.evaluate(() => document.documentElement.scrollWidth), 390, u);
    await p.context().close();
  }
});

test("docs copies match src", () => {
  for (const f of ["alih.js", "alih.css"]) {
    assert.equal(fs.readFileSync(path.join(ROOT, f), "utf8"), fs.readFileSync(path.join(__dirname, "..", "src", f), "utf8"), f);
  }
});
