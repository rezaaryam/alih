/* Shows which transition mode is active, and lets visitors switch to compare. */
(function () {
  function paint() {
    var A = window.Alih, mode = A && A.mode;
    var label = document.querySelector("[data-mode-label]");
    var sw = document.querySelector("[data-mode-switch]");
    if (!label || !sw) return;
    var s = A ? A.supports() : {};
    var names = {
      native: "native, cross-document",
      soft: s.sameDocument ? "soft, fetched and swapped" : "soft, with a simple fade",
      off: "off"
    };
    label.textContent = names[mode] || "off";
    document.documentElement.setAttribute("data-mode-ui", mode || "off");
    if (mode === "native") { sw.textContent = "Try the fallback"; sw.href = "?alih=soft"; }
    else if (s.crossDocument) { sw.textContent = "Back to native"; sw.href = "?alih=auto"; }
    else { sw.textContent = "Why not native?"; sw.href = "../#support"; }
  }
  paint();
  document.addEventListener("alih:load", paint);
})();
