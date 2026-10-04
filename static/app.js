/* X Router — client layer: toast, copy, modal, sidebar, theme, search */
(function () {
  "use strict";

  /* ---------- theme ---------- */
  var THEME_KEY = "xr_theme";
  function applyTheme(t) {
    document.body.classList.toggle("light", t === "light");
    var btn = document.getElementById("themeToggle");
    if (btn) {
      var ic = btn.querySelector(".material-symbols-outlined");
      if (ic) ic.textContent = t === "light" ? "dark_mode" : "light_mode";
      btn.title = t === "light" ? "Mode gelap" : "Mode terang";
    }
    try { localStorage.setItem(THEME_KEY, t); } catch (e) {}
    document.cookie = "xr_theme=" + t + ";path=/;max-age=31536000;samesite=lax";
  }
  var saved = null;
  try { saved = localStorage.getItem(THEME_KEY); } catch (e) {}
  if (!saved) {
    var m = document.cookie.match(/(?:^|;\s*)xr_theme=([^;]+)/);
    saved = m ? m[1] : null;
  }
  applyTheme(saved || "dark");
  window.xrTheme = applyTheme;

  /* ---------- font icons: hilangin flicker ---------- */
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(function () { document.body.classList.add("fonts-loaded"); });
  } else {
    document.body.classList.add("fonts-loaded");
  }

  /* ---------- toast ---------- */
  function ensureStack() {
    var s = document.querySelector(".toast-stack");
    if (!s) {
      s = document.createElement("div");
      s.className = "toast-stack";
      document.body.appendChild(s);
    }
    return s;
  }
  var ICONS = { success: "check_circle", error: "error", info: "info", warning: "warning" };
  window.xrToast = function (type, title, detail, ms) {
    var stack = ensureStack();
    var el = document.createElement("div");
    el.className = "toast " + (type || "info");
    el.innerHTML =
      '<span class="material-symbols-outlined">' + (ICONS[type] || ICONS.info) + "</span>" +
      '<div class="body"><div class="tt"></div>' +
      (detail ? '<div class="td"></div>' : "") + "</div>";
    el.querySelector(".tt").textContent = title || "";
    if (detail) el.querySelector(".td").textContent = detail;
    stack.appendChild(el);
    setTimeout(function () {
      el.classList.add("out");
      setTimeout(function () { el.remove(); }, 240);
    }, ms || 3400);
  };

  /* ---------- copy ---------- */
  window.xrCopy = function (text, label) {
    var done = function () {
      window.xrToast("success", "Tersalin", label ? label + " disalin ke clipboard" : String(text).slice(0, 70));
    };
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(done, function () { fallback(text, done); });
    } else {
      fallback(text, done);
    }
  };
  function fallback(text, done) {
    var ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand("copy"); done(); } catch (e) {
      window.xrToast("error", "Gagal menyalin");
    }
    ta.remove();
  }

  /* delegated copy: [data-copy] */
  document.addEventListener("click", function (e) {
    var t = e.target.closest("[data-copy]");
    if (!t) return;
    e.preventDefault();
    var val = t.getAttribute("data-copy");
    if (val === "@text") val = (t.closest("[data-copy-src]") ? "" : "") || "";
    var src = t.getAttribute("data-copy-target");
    if (src) {
      var el = document.querySelector(src);
      val = el ? (el.value !== undefined && el.value !== "" ? el.value : el.textContent) : val;
    }
    window.xrCopy(val || t.textContent.trim(), t.getAttribute("data-copy-label"));
    var ic = t.querySelector(".material-symbols-outlined");
    if (ic) {
      var old = ic.textContent;
      ic.textContent = "check";
      ic.style.color = "var(--color-success)";
      setTimeout(function () { ic.textContent = old; ic.style.color = ""; }, 1400);
    }
  });

  /* ---------- confirm modal ---------- */
  window.xrConfirm = function (opts, onOk) {
    var overlay = document.createElement("div");
    overlay.className = "modal-overlay";
    overlay.innerHTML =
      '<div class="modal" role="dialog" aria-modal="true">' +
        '<div class="modal-h"><div class="mt"><span class="material-symbols-outlined" style="color:var(--color-warning)">warning</span><span></span></div></div>' +
        '<div class="modal-b"><p class="msg" style="margin:0;color:var(--color-text-muted);line-height:1.6"></p></div>' +
        '<div class="modal-f">' +
          '<button class="btn secondary" data-x="cancel">Batal</button>' +
          '<button class="btn danger" data-x="ok"><span class="material-symbols-outlined">check</span><span class="lbl"></span></button>' +
        "</div></div>";
    overlay.querySelector(".mt span:last-child").textContent = opts.title || "Konfirmasi";
    overlay.querySelector(".msg").textContent = opts.message || "";
    overlay.querySelector('[data-x="ok"] .lbl').textContent = opts.okLabel || "Hapus";
    function close() { overlay.remove(); }
    overlay.querySelector('[data-x="cancel"]').onclick = close;
    overlay.querySelector('[data-x="ok"]').onclick = function () { close(); onOk && onOk(); };
    overlay.addEventListener("click", function (e) { if (e.target === overlay) close(); });
    document.addEventListener("keydown", function esc(e) {
      if (e.key === "Escape") { close(); document.removeEventListener("keydown", esc); }
    });
    document.body.appendChild(overlay);
  };

  /* ---------- sidebar (mobile) ---------- */
  document.addEventListener("click", function (e) {
    var btn = e.target.closest("[data-toggle-sidebar]");
    if (btn) {
      e.preventDefault();
      var sb = document.querySelector(".sidebar");
      if (sb.classList.contains("open")) { sb.classList.remove("open"); removeScrim(); }
      else { sb.classList.add("open"); addScrim(); }
      return;
    }
    if (e.target.classList && e.target.classList.contains("scrim")) {
      var s = document.querySelector(".sidebar");
      s && s.classList.remove("open");
      removeScrim();
    }
    if (e.target.closest(".nav-item")) {
      var sd = document.querySelector(".sidebar");
      if (sd && sd.classList.contains("open")) { sd.classList.remove("open"); removeScrim(); }
    }
  });
  function addScrim() {
    if (!document.querySelector(".scrim")) {
      var d = document.createElement("div");
      d.className = "scrim";
      document.body.appendChild(d);
    }
  }
  function removeScrim() {
    var d = document.querySelector(".scrim");
    if (d) d.remove();
  }

  /* ---------- keyboard: / fokus search, g toggle theme ---------- */
  document.addEventListener("keydown", function (e) {
    var tag = (e.target.tagName || "").toLowerCase();
    var typing = tag === "input" || tag === "textarea" || tag === "select";
    if (typing) return;
    if (e.key === "/") {
      var s = document.querySelector("[data-search]");
      if (s) { e.preventDefault(); s.focus(); s.select(); }
    } else if (e.key === "g" || e.key === "G") {
      window.xrTheme(document.body.classList.contains("light") ? "dark" : "light");
      window.xrToast("info", "Tema diganti", null, 1600);
    }
  });

  /* ---------- filter helper (models / providers) ---------- */
  window.xrFilter = function (inputSel, itemSel, counterSel, emptySel, matchAttr) {
    var input = document.querySelector(inputSel);
    if (!input) return;
    var attr = matchAttr || "data-match";
    var counter = counterSel ? document.querySelector(counterSel) : null;
    var empty = emptySel ? document.querySelector(emptySel) : null;
    var t = null;
    input.addEventListener("input", function () {
      clearTimeout(t);
      t = setTimeout(function () {
        var q = input.value.trim().toLowerCase();
        var items = document.querySelectorAll(itemSel);
        var shown = 0;
        items.forEach(function (el) {
          var hay = (el.getAttribute(attr) || el.textContent || "").toLowerCase();
          var ok = !q || hay.indexOf(q) !== -1;
          el.style.display = ok ? "" : "none";
          if (ok) shown++;
        });
        /* group head: sembunyikan kalau semua anak disembunyikan */
        document.querySelectorAll("[data-group]").forEach(function (g) {
          var any = false;
          g.querySelectorAll(itemSel).forEach(function (el) {
            if (el.style.display !== "none") any = true;
          });
          g.style.display = any ? "" : "none";
        });
        if (counter) counter.textContent = shown;
        if (empty) empty.style.display = shown ? "none" : "";
      }, 90);
    });
  };
})();
