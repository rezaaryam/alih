/* alih docs page: highlight code and mark the visitor's current mode. */
(function () {
  function esc(s) { return s.replace(/[&<>]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]; }); }
  function highlight(code, lang) {
    var out = esc(code);
    if (lang === "html") {
      out = out.replace(/(&lt;!--[\s\S]*?--&gt;)/g, "\u0000$1\u0001");
      out = out.replace(/(&lt;\/?)([\w-]+)([^\u0000\u0001]*?)(&gt;)/g, function (m, o, t, attrs, c) {
        attrs = attrs.replace(/([\w-]+)(=)("[^"]*")/g, '<span class="a">$1</span><span class="p">$2</span><span class="s">$3</span>')
          .replace(/(\s)([\w-]+)(?=\s|$)/g, '$1<span class="a">$2</span>');
        return '<span class="p">' + o + '</span><span class="t">' + t + "</span>" + attrs + '<span class="p">' + c + "</span>";
      });
      return out.replace(/\u0000([\s\S]*?)\u0001/g, '<span class="c">$1</span>');
    }
    return out.replace(/("[^"]*")/g, '<span class="s">$1</span>')
      .replace(/(\/\/[^\n]*)/g, '<span class="c">$1</span>')
      .replace(/\b(const|let|return)\b/g, '<span class="k">$1</span>')
      .replace(/\.(\w+)(?=\()/g, '.<span class="a">$1</span>');
  }
  function run() {
    Array.prototype.forEach.call(document.querySelectorAll("pre.code[data-lang]"), function (pre) {
      if (pre.dataset.done) return;
      pre.innerHTML = highlight(pre.textContent, pre.dataset.lang);
      pre.dataset.done = "1";
    });
    var A = window.Alih;
    if (!A) return;
    var mode = A.mode === "native" ? "native" : A.mode === "soft" ? (A.supports().sameDocument ? "soft" : "fade") : "fade";
    Array.prototype.forEach.call(document.querySelectorAll(".modes li"), function (li) {
      li.classList.toggle("is-you", li.getAttribute("data-mode") === mode);
    });
  }
  run();
  document.addEventListener("alih:load", run);
})();
