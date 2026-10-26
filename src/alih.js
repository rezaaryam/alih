/*!
 * alih 1.0.0
 * Smooth page transitions for ordinary multi-page sites (static HTML, PHP, anything).
 *
 *  - Browsers with cross-document View Transitions: native, no JavaScript navigation.
 *  - Other browsers: links are fetched and swapped in place ("soft" mode), animated
 *    with document.startViewTransition when available, or a short fade otherwise.
 *  - Elements marked data-alih="key" morph from one page to the next.
 *
 * MIT License, Reza Arya Maulana.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.Alih = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var hasDOM = typeof window !== "undefined" && typeof document !== "undefined";
  var VERSION = "1.0.0";

  // ------------------------------------------------------------------ pure helpers
  var SKIP_EXT = /\.(pdf|zip|rar|7z|gz|dmg|exe|apk|mp4|mp3|wav|png|jpe?g|gif|webp|svg|avif|csv|xlsx?|docx?|pptx?)(\?|#|$)/i;

  /**
   * Should a click on this link become a soft navigation?
   * link: { href, target, download, origin, hasNoAlih }, page: { href, origin }, ev: { button, metaKey, ctrlKey, shiftKey, altKey, defaultPrevented }
   */
  function shouldIntercept(link, page, ev) {
    if (!link || !link.href) return false;
    if (ev) {
      if (ev.defaultPrevented || (ev.button !== undefined && ev.button !== 0)) return false;
      if (ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey) return false;
    }
    if (link.target && link.target !== "_self") return false;
    if (link.download !== undefined && link.download !== null && link.download !== false) return false;
    if (link.hasNoAlih) return false;
    var from = parseUrl(page.href), to = parseUrl(link.href, page.href);
    if (!to || !from) return false;
    if (to.origin !== from.origin) return false;
    if (!/^https?:$/.test(to.protocol)) return false;
    if (SKIP_EXT.test(to.pathname)) return false;
    // same page, only the hash changes: let the browser scroll
    if (to.pathname === from.pathname && to.search === from.search && to.hash) return false;
    return true;
  }

  function parseUrl(href, base) {
    try {
      var u = new URL(href, base || (typeof location !== "undefined" ? location.href : "http://x/"));
      return { href: u.href, origin: u.origin, protocol: u.protocol, pathname: u.pathname, search: u.search, hash: u.hash };
    } catch (e) { return null; }
  }

  /** URL without the hash, used to match links to pages. */
  function pageKey(href) {
    var u = parseUrl(href);
    if (!u) return "";
    var path = u.pathname.replace(/\/index\.(html?|php)$/, "/");
    return u.origin + path + u.search;
  }

  /** "back" when moving to an earlier history entry, otherwise "forward". */
  function direction(navType, fromIndex, toIndex) {
    if (navType === "traverse" && typeof fromIndex === "number" && typeof toIndex === "number") {
      return toIndex < fromIndex ? "back" : "forward";
    }
    if (navType === "back") return "back";
    return "forward";
  }

  /** CSS identifiers for view-transition-name. Keys can be anything the author writes. */
  function vtName(key) {
    return "alih-" + String(key).trim().replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
  }

  function prefersReducedMotion() {
    return hasDOM && window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  // ------------------------------------------------------------------ shared elements
  /**
   * Which data-alih elements on this page should be named for a transition to or from `otherUrl`?
   * - elements inside a link that points at otherUrl (the card you clicked, or will return to)
   * - elements that are not inside any link (the page's own hero, title, and so on)
   */
  function sharedElements(doc, otherUrl, carried) {
    var key = pageKey(otherUrl), seen = {}, out = [];
    carried = carried || [];
    Array.prototype.forEach.call(doc.querySelectorAll("[data-alih]"), function (el) {
      var k = el.getAttribute("data-alih");
      if (!k || k === "false") return;
      var link = el.closest("a[href]");
      // also match keys the previous page named, so a card can land anywhere it appears
      var match = link ? pageKey(link.href) === key || carried.indexOf(k) >= 0 : true;
      if (!match || seen[k]) return;
      seen[k] = true;
      out.push(el);
    });
    return out;
  }
  function keysOf(els) { return els.map(function (el) { return el.getAttribute("data-alih"); }); }
  function stash(keys) { try { sessionStorage.setItem("alih-keys", JSON.stringify(keys)); } catch (e) {} }
  function unstash() {
    try { var v = JSON.parse(sessionStorage.getItem("alih-keys") || "[]"); sessionStorage.removeItem("alih-keys"); return Array.isArray(v) ? v : []; }
    catch (e) { return []; }
  }
  function nameAll(els) { els.forEach(function (el) { el.style.viewTransitionName = vtName(el.getAttribute("data-alih")); }); }
  function clearAll(els) { els.forEach(function (el) { el.style.viewTransitionName = ""; }); }

  // ------------------------------------------------------------------ runtime
  var config = { mode: "auto", root: "[data-alih-root], main", prefetch: true, scroll: "top", animation: "slide" };
  var state = { started: false, mode: null, last: null, cache: new Map(), navigating: null, index: 0 };
  var listeners = {};

  function emit(name, detail) {
    (listeners[name] || []).forEach(function (fn) { try { fn(detail); } catch (e) { setTimeout(function () { throw e; }); } });
    if (hasDOM) document.dispatchEvent(new CustomEvent("alih:" + name, { detail: detail }));
  }

  function supports() {
    return {
      crossDocument: hasDOM && "CSSViewTransitionRule" in window && "onpagereveal" in window,
      sameDocument: hasDOM && typeof document.startViewTransition === "function",
      fetch: hasDOM && typeof fetch === "function" && typeof DOMParser === "function" && !!(history && history.pushState)
    };
  }

  function pickMode(wanted) {
    var s = supports();
    if (wanted === "off") return "off";
    if (wanted === "native") return s.crossDocument ? "native" : "off";
    if (wanted === "soft") return s.fetch ? "soft" : "off";
    return s.crossDocument ? "native" : s.fetch ? "soft" : "off";
  }

  function setDir(dir) { document.documentElement.setAttribute("data-alih-dir", dir); }

  // --------------------------- native: cross-document view transitions
  function startNative() {
    ensureOptInRule();
    // Old page, just before it is captured.
    window.addEventListener("pageswap", function (e) {
      if (!e.viewTransition || !e.activation) return;
      var to = e.activation.entry && e.activation.entry.url;
      var from = navigation.currentEntry;
      var dir = direction(e.activation.navigationType, from && from.index, e.activation.entry && e.activation.entry.index);
      setDir(dir);
      var els = sharedElements(document, to);
      nameAll(els);
      stash(keysOf(els));
      // the page may come back from the bfcache; do not leave names behind
      e.viewTransition.finished.then(function () { clearAll(els); }, function () { clearAll(els); });
    });
    // New page, before its first frame.
    window.addEventListener("pagereveal", function (e) {
      if (!e.viewTransition) { state.last = { mode: "native", animated: false }; return; }
      if (prefersReducedMotion()) { e.viewTransition.skipTransition(); state.last = { mode: "native", animated: false }; return; }
      var act = window.navigation && navigation.activation;
      var from = act && act.from ? act.from.url : document.referrer;
      var dir = act ? direction(act.navigationType, act.from && act.from.index, act.entry && act.entry.index) : "forward";
      setDir(dir);
      var els = sharedElements(document, from, unstash());
      nameAll(els);
      state.last = { mode: "native", animated: true, direction: dir, shared: keysOf(els) };
      emit("start", state.last);
      e.viewTransition.finished.then(function () { clearAll(els); emit("end", state.last); }, function () { clearAll(els); });
    });
    if (config.prefetch) addSpeculationRules();
  }

  /** The opt-in must exist on both pages. alih.css includes it; this covers pages that forgot. */
  function ensureOptInRule() {
    if (document.getElementById("alih-optin")) return;
    var st = document.createElement("style");
    st.id = "alih-optin";
    st.textContent = "@view-transition{navigation:auto}";
    (document.head || document.documentElement).appendChild(st);
  }

  /** Ask the browser to prerender same-site pages when a link is hovered. */
  function addSpeculationRules() {
    if (!HTMLScriptElement.supports || !HTMLScriptElement.supports("speculationrules")) return;
    if (document.querySelector("script[data-alih-rules]")) return;
    var s = document.createElement("script");
    s.type = "speculationrules";
    s.setAttribute("data-alih-rules", "");
    s.textContent = JSON.stringify({ prerender: [{ where: { and: [{ href_matches: "/*" }, { not: { selector_matches: "[data-no-alih], [download], [target=_blank]" } }] }, eagerness: "moderate" }] });
    document.head.appendChild(s);
  }

  // --------------------------- soft: fetch and swap
  function fetchPage(url) {
    var key = pageKey(url);
    if (state.cache.has(key)) return state.cache.get(key);
    var p = fetch(url, { headers: { "X-Alih": "1", "Accept": "text/html" }, credentials: "same-origin" }).then(function (r) {
      if (!r.ok || !/text\/html/i.test(r.headers.get("content-type") || "text/html")) throw new Error("alih: cannot swap " + url);
      return r.text();
    });
    state.cache.set(key, p);
    p.catch(function () { state.cache.delete(key); });
    // keep the cache small
    if (state.cache.size > 30) state.cache.delete(state.cache.keys().next().value);
    return p;
  }

  function findRoot(doc) {
    var sel = config.root.split(",");
    for (var i = 0; i < sel.length; i++) { var el = doc.querySelector(sel[i].trim()); if (el) return el; }
    return doc.body;
  }

  function runScripts(container) {
    Array.prototype.forEach.call(container.querySelectorAll("script"), function (old) {
      if (old.hasAttribute("data-alih-skip")) return;
      var s = document.createElement("script");
      Array.prototype.forEach.call(old.attributes, function (a) { s.setAttribute(a.name, a.value); });
      s.textContent = old.textContent;
      old.replaceWith(s);
    });
  }

  function swap(html, url, opts) {
    var doc = new DOMParser().parseFromString(html, "text/html");
    var next = findRoot(doc), cur = findRoot(document);
    if (!next || !cur || next.tagName !== cur.tagName) return false;
    document.title = doc.title;
    ["description", "theme-color"].forEach(function (n) {
      var a = document.querySelector('meta[name="' + n + '"]'), b = doc.querySelector('meta[name="' + n + '"]');
      if (a && b) a.setAttribute("content", b.getAttribute("content"));
    });
    if (doc.documentElement.lang) document.documentElement.lang = doc.documentElement.lang;
    var bodyClass = doc.body.getAttribute("class");
    if (bodyClass !== null) document.body.setAttribute("class", bodyClass);
    var imported = document.importNode(next, true);
    cur.replaceWith(imported);
    runScripts(imported);
    if (opts.scroll === "restore" && typeof opts.y === "number") window.scrollTo(0, opts.y);
    else {
      var hash = parseUrl(url).hash;
      var target = hash && document.getElementById(decodeURIComponent(hash.slice(1)));
      if (target) target.scrollIntoView(); else window.scrollTo(0, 0);
    }
    var focus = imported.querySelector("[autofocus], h1") || imported;
    if (focus && !focus.hasAttribute("tabindex") && focus.tagName === "H1") focus.setAttribute("tabindex", "-1");
    if (focus && focus.focus) focus.focus({ preventScroll: true });
    return true;
  }

  function softNavigate(url, opts) {
    opts = opts || {};
    var dir = opts.direction || "forward";
    var from = location.href;
    if (state.navigating) state.navigating.abort = true;
    var job = { abort: false };
    state.navigating = job;
    document.documentElement.classList.add("alih-loading");
    emit("before", { url: url, direction: dir });

    return fetchPage(url).then(function (html) {
      if (job.abort) return;
      if (opts.push) {
        // remember where we were so Back can return to the same spot
        history.replaceState(Object.assign({}, history.state, { alih: true, y: window.scrollY, i: state.index }), "");
        state.index++;
        history.pushState({ alih: true, y: 0, i: state.index }, "", url);
      }
      setDir(dir);
      var reduce = prefersReducedMotion();
      var oldEls = sharedElements(document, url);
      var newEls = [];
      var update = function () {
        clearAll(oldEls);
        if (!swap(html, url, opts)) throw new Error("alih: page structure differs");
        newEls = sharedElements(document, from, keysOf(oldEls));
        nameAll(newEls);
      };
      var info = { mode: "soft", animated: !reduce, direction: dir, url: url, shared: keysOf(oldEls) };
      state.last = info;
      emit("start", info);

      var done = function () {
        clearAll(newEls);
        document.documentElement.classList.remove("alih-loading");
        if (state.navigating === job) state.navigating = null;
        emit("end", info);
        emit("load", { url: url });
      };
      if (reduce) { update(); done(); return; }
      if (document.startViewTransition) {
        nameAll(oldEls);
        var vt;
        try { vt = document.startViewTransition({ update: update, types: [dir] }); }
        catch (e) { vt = document.startViewTransition(update); }
        return vt.finished.then(done, function () { done(); });
      }
      // last resort: a short fade, no shared elements
      info.fallback = "fade";
      var root = findRoot(document);
      root.classList.add("alih-out");
      return new Promise(function (r) { setTimeout(r, 160); }).then(function () {
        update();
        var nr = findRoot(document);
        nr.classList.add("alih-in");
        setTimeout(function () { nr.classList.remove("alih-in"); done(); }, 260);
      });
    }).catch(function (err) {
      document.documentElement.classList.remove("alih-loading");
      if (job.abort) return;
      emit("error", { url: url, error: err });
      // anything unexpected: just do a normal page load
      if (opts.push) location.assign(url); else location.reload();
    });
  }

  function startSoft() {
    history.replaceState(Object.assign({}, history.state, { alih: true, i: state.index, y: window.scrollY }), "");
    if ("scrollRestoration" in history) history.scrollRestoration = "manual";

    document.addEventListener("click", function (e) {
      var a = e.target.closest && e.target.closest("a[href]");
      if (!a) return;
      var link = { href: a.href, target: a.getAttribute("target"), download: a.hasAttribute("download") ? "" : null, hasNoAlih: !!a.closest("[data-no-alih]") };
      if (!shouldIntercept(link, { href: location.href }, e)) return;
      if (pageKey(a.href) === pageKey(location.href) && !parseUrl(a.href).hash) { e.preventDefault(); return; }
      e.preventDefault();
      softNavigate(a.href, { push: true, direction: a.getAttribute("data-alih-direction") || "forward" });
    });

    window.addEventListener("popstate", function (e) {
      var st = e.state || {};
      var dir = typeof st.i === "number" && st.i < state.index ? "back" : "forward";
      state.index = typeof st.i === "number" ? st.i : state.index;
      softNavigate(location.href, { push: false, direction: dir, scroll: "restore", y: st.y });
    });

    if (config.prefetch) {
      var timer;
      var warm = function (e) {
        var a = e.target.closest && e.target.closest("a[href]");
        if (!a || a.closest("[data-no-alih]")) return;
        if (!shouldIntercept({ href: a.href, target: a.getAttribute("target") }, { href: location.href })) return;
        clearTimeout(timer);
        timer = setTimeout(function () { fetchPage(a.href).catch(function () {}); }, e.type === "touchstart" ? 0 : 65);
      };
      document.addEventListener("pointerover", warm, { passive: true });
      document.addEventListener("focusin", warm);
      document.addEventListener("touchstart", warm, { passive: true });
    }
  }

  // ------------------------------------------------------------------ public
  function start(options) {
    if (!hasDOM || state.started) return api;
    Object.keys(options || {}).forEach(function (k) { if (options[k] !== undefined && options[k] !== null) config[k] = options[k]; });
    // ?alih=soft (or native, off) in the URL forces a mode, handy for comparing
    var forced = /[?&]alih=(soft|native|off|auto)\b/.exec(location.search);
    if (forced) { try { sessionStorage.setItem("alih-mode", forced[1]); } catch (e) {} }
    var stored = null;
    try { stored = sessionStorage.getItem("alih-mode"); } catch (e) {}
    state.mode = pickMode(stored || config.mode);
    state.started = true;
    document.documentElement.setAttribute("data-alih-mode", state.mode);
    document.documentElement.setAttribute("data-alih-animation", config.animation);
    if (state.mode === "native") startNative();
    else if (state.mode === "soft") {
      // a page opted out of native transitions must not keep the CSS opt-in active
      if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", startSoft); else startSoft();
    }
    if (state.mode !== "native") {
      var st = document.createElement("style");
      st.textContent = "@view-transition{navigation:none}";
      document.head.appendChild(st);
    }
    return api;
  }

  /** Read options from the <script> tag that loaded alih. */
  function autoStart() {
    var me = document.currentScript;
    if (!me || me.hasAttribute("data-manual")) return;
    start({
      mode: me.getAttribute("data-mode") || undefined,
      root: me.getAttribute("data-root") || undefined,
      animation: me.getAttribute("data-animation") || undefined,
      prefetch: me.getAttribute("data-prefetch") === "false" ? false : undefined
    });
  }

  var api = {
    version: VERSION,
    start: start,
    navigate: function (url) { return state.mode === "soft" ? softNavigate(url, { push: true }) : (location.href = url, Promise.resolve()); },
    on: function (name, fn) { (listeners[name] = listeners[name] || []).push(fn); return api; },
    supports: supports,
    get mode() { return state.mode; },
    get last() { return state.last; },
    // exposed for tests
    _: { shouldIntercept: shouldIntercept, pageKey: pageKey, direction: direction, vtName: vtName, pickMode: pickMode, sharedElements: sharedElements }
  };

  if (hasDOM) autoStart();
  return api;
});
