"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const A = require("../src/alih.js");
const { shouldIntercept, pageKey, direction, vtName, pickMode } = A._;

const page = { href: "https://site.test/prints/index.html" };
const link = (href, extra = {}) => ({ href, target: null, download: null, hasNoAlih: false, ...extra });
const click = (extra = {}) => ({ button: 0, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false, defaultPrevented: false, ...extra });

test("version and API surface", () => {
  assert.equal(A.version, "1.0.0");
  ["start", "navigate", "on", "supports"].forEach((k) => assert.equal(typeof A[k], "function", k));
});

test("same-site page links are intercepted", () => {
  assert.equal(shouldIntercept(link("https://site.test/prints/low-tide.html"), page, click()), true);
  assert.equal(shouldIntercept(link("/about.php?x=1"), { href: "https://site.test/" }, click()), true);
});

test("links the browser should keep are left alone", () => {
  const to = "https://site.test/prints/low-tide.html";
  assert.equal(shouldIntercept(link("https://other.test/a.html"), page, click()), false, "other origin");
  assert.equal(shouldIntercept(link(to, { target: "_blank" }), page, click()), false, "new tab");
  assert.equal(shouldIntercept(link(to, { download: "" }), page, click()), false, "download");
  assert.equal(shouldIntercept(link(to, { hasNoAlih: true }), page, click()), false, "data-no-alih");
  assert.equal(shouldIntercept(link("https://site.test/files/price-list.pdf"), page, click()), false, "file");
  assert.equal(shouldIntercept(link("mailto:hi@site.test"), page, click()), false, "mailto");
  assert.equal(shouldIntercept(link("https://site.test/prints/index.html#grid"), page, click()), false, "hash on same page");
  for (const k of ["metaKey", "ctrlKey", "shiftKey", "altKey"]) {
    assert.equal(shouldIntercept(link(to), page, click({ [k]: true })), false, k);
  }
  assert.equal(shouldIntercept(link(to), page, click({ button: 1 })), false, "middle click");
  assert.equal(shouldIntercept(link(to), page, click({ defaultPrevented: true })), false, "already handled");
  assert.equal(shouldIntercept(link(to, { target: "_self" }), page, click()), true, "_self is fine");
});

test("pageKey ignores hashes and index files", () => {
  assert.equal(pageKey("https://a.test/x/index.html#top"), "https://a.test/x/");
  assert.equal(pageKey("https://a.test/x/index.php?p=2"), "https://a.test/x/?p=2");
  assert.equal(pageKey("https://a.test/x/"), pageKey("https://a.test/x/index.htm"));
  assert.notEqual(pageKey("https://a.test/x/?p=1"), pageKey("https://a.test/x/?p=2"));
});

test("direction from history positions", () => {
  assert.equal(direction("traverse", 5, 4), "back");
  assert.equal(direction("traverse", 4, 5), "forward");
  assert.equal(direction("push", 4, 5), "forward");
  assert.equal(direction("back"), "back");
  assert.equal(direction("reload"), "forward");
});

test("view-transition names are safe CSS identifiers", () => {
  assert.equal(vtName("art-low-tide"), "alih-art-low-tide");
  assert.equal(vtName("  Low Tide #4 "), "alih-Low-Tide-4");
  assert.match(vtName("x".repeat(200)), /^alih-x{60}$/);
});

test("without a DOM, every mode resolves to off", () => {
  ["auto", "native", "soft", "off"].forEach((m) => assert.equal(pickMode(m), "off"));
});
