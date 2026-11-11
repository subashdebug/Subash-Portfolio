/* motion.js - shared animation engine (no dependencies).
   Page-specific options go in window.MOTION before this file loads:
   { sparkles: ".arch", burst: true }
   If anything fails, html.mo is removed and the page simply shows normally. */
(function () {
  var root = document.documentElement;
  if (!root.classList.contains("mo")) return; // reduced motion, or the safety timer already fired
  var cfg = window.MOTION || {};
  var fine = window.matchMedia && matchMedia("(hover:hover) and (pointer:fine)").matches;
  var hasIO = "IntersectionObserver" in window;

  function $(s, c) { return (c || document).querySelector(s); }
  function $$(s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  try { init(); window.__mo = true; }
  catch (err) { root.classList.remove("mo"); window.__mo = true; if (window.console) console.warn("motion off:", err); }

  function init() {
    /* ---- split headlines into words / characters ---- */
    $$("[data-split]").forEach(function (el) {
      var i = 0;
      (function walk(node) {
        Array.prototype.slice.call(node.childNodes).forEach(function (n) {
          if (n.nodeType === 3) {
            var frag = document.createDocumentFragment();
            n.nodeValue.split(/(\s+)/).forEach(function (p) {
              if (!p) return;
              if (/^\s+$/.test(p)) { frag.appendChild(document.createTextNode(p)); return; }
              var s = document.createElement("span");
              s.className = "wi"; s.style.setProperty("--i", i++); s.textContent = p;
              frag.appendChild(s);
            });
            node.replaceChild(frag, n);
          } else if (n.nodeType === 1 && n.tagName !== "BR") walk(n);
        });
      })(el);
      el.setAttribute("data-split-done", "");
    });
    $$("[data-chars]").forEach(function (el) {
      var t = el.textContent, i = 0; el.textContent = "";
      t.split("").forEach(function (c) {
        var s = document.createElement("span"); s.className = "ch"; s.style.setProperty("--i", i++); s.textContent = c; el.appendChild(s);
      });
    });
    $$("[data-ln-group]").forEach(function (g) {
      $$("[data-ln]", g).forEach(function (e, i) { e.style.setProperty("--k", i); });
    });

    /* ---- scroll reveal ---- */
    function prep(el) { // el is a [data-rv] / [data-split] / [data-chars] element
      $$("[data-count]", el).concat(el.hasAttribute("data-count") ? [el] : []).forEach(function (c) {
        if (!c._final) { c._final = parseFloat(c.getAttribute("data-count")); c.textContent = "0"; }
      });
    }
    function countUp(c) {
      var end = c._final, t0 = null, dur = 1300;
      function step(t) {
        if (t0 === null) t0 = t;
        var p = clamp((t - t0) / dur, 0, 1), e = p === 1 ? 1 : 1 - Math.pow(2, -10 * p);
        c.textContent = Math.round(end * e).toLocaleString("en-US");
        if (p < 1) requestAnimationFrame(step);
      }
      requestAnimationFrame(step);
    }
    function show(el, delay) {
      if (delay && !el.style.getPropertyValue("--d")) el.style.setProperty("--d", delay + "s");
      el.classList.add("is-in");
      $$("[data-count]", el).forEach(function (c) { if (c._final !== undefined) countUp(c); });
    }
    var io = hasIO ? new IntersectionObserver(function (entries) {
      var vis = entries.filter(function (e) { return e.isIntersecting; });
      vis.sort(function (a, b) {
        var ra = a.boundingClientRect, rb = b.boundingClientRect, da = Math.round(ra.top / 40) - Math.round(rb.top / 40);
        return da || ra.left - rb.left;
      });
      vis.forEach(function (e, i) { show(e.target, Math.min(i, 6) * 0.08); io.unobserve(e.target); });
    }, { threshold: 0.12, rootMargin: "0px 0px -5% 0px" }) : null;

    function watch(el) { prep(el); if (io) io.observe(el); else show(el, 0); }

    $$("[data-rv-group]").forEach(function (g) {
      var v = g.getAttribute("data-rv-group");
      Array.prototype.slice.call(g.children).forEach(function (k) { if (!k.hasAttribute("data-rv")) k.setAttribute("data-rv", v); });
    });
    $$("[data-rv],[data-split],[data-chars]").forEach(watch);

    /* live grids: products re-render on every filter / search */
    $$("[data-rv-live]").forEach(function (g) {
      var v = g.getAttribute("data-rv-live") || "";
      new MutationObserver(function (muts) {
        muts.forEach(function (m) {
          Array.prototype.forEach.call(m.addedNodes, function (n) {
            if (n.nodeType === 1 && !n.hasAttribute("data-rv")) { n.setAttribute("data-rv", v); watch(n); }
          });
        });
      }).observe(g, { childList: true });
      Array.prototype.slice.call(g.children).forEach(function (n) { n.setAttribute("data-rv", v); watch(n); });
    });

    window.addEventListener("beforeprint", function () {
      $$("[data-rv],[data-split],[data-chars]").forEach(function (e) { e.classList.add("is-in"); });
    });

    /* ---- scroll progress bar, sticky header, scroll-spy, progress lines, parallax ---- */
    var bar = document.createElement("div"); bar.className = "mo-bar"; document.body.appendChild(bar);
    var sticky = $$("[data-stick],header.mo-sticky");
    var spyLinks = $$("[data-spy] a[href^='#']").map(function (a) {
      var t = document.getElementById(a.getAttribute("href").slice(1)); return t ? { a: a, t: t } : null;
    }).filter(Boolean);
    var prog = $$("[data-progress]");
    var par = $$("[data-parallax]");
    var ticking = false;
    function onScroll() {
      var y = window.pageYOffset, vh = window.innerHeight, max = document.documentElement.scrollHeight - vh;
      bar.style.transform = "scaleX(" + (max > 0 ? clamp(y / max, 0, 1) : 0) + ")";
      sticky.forEach(function (s) { s.classList.toggle("stuck", y > 10); });
      if (spyLinks.length) {
        var cur = null;
        spyLinks.forEach(function (s) { if (s.t.getBoundingClientRect().top < vh * 0.4) cur = s; });
        spyLinks.forEach(function (s) { s.a.classList.toggle("on", s === cur); });
      }
      prog.forEach(function (p) {
        var r = p.getBoundingClientRect();
        p.style.setProperty("--p", clamp((vh * 0.65 - r.top) / r.height, 0, 1).toFixed(3));
      });
      par.forEach(function (p) {
        var r = p.getBoundingClientRect(), f = parseFloat(p.getAttribute("data-parallax")) || 0.08;
        if (r.bottom < -100 || r.top > vh + 100) return;
        p.style.translate = "0 " + ((r.top + r.height / 2 - vh / 2) * -f).toFixed(1) + "px";
      });
      ticking = false;
    }
    window.addEventListener("scroll", function () { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });
    window.addEventListener("resize", onScroll);
    onScroll();

    /* ---- pointer effects (mouse devices only) ---- */
    if (fine) {
      $$("[data-tilt]").forEach(function (el) {
        el.addEventListener("pointermove", function (e) {
          var r = el.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
          el.style.setProperty("--ry", (x * 9).toFixed(2) + "deg"); el.style.setProperty("--rx", (-y * 7).toFixed(2) + "deg");
        });
        el.addEventListener("pointerleave", function () { el.style.setProperty("--rx", "0deg"); el.style.setProperty("--ry", "0deg"); });
      });
      $$(".spot").forEach(function (el) {
        el.addEventListener("pointermove", function (e) {
          var r = el.getBoundingClientRect();
          el.style.setProperty("--mx", (e.clientX - r.left) + "px"); el.style.setProperty("--my", (e.clientY - r.top) + "px");
        });
      });
      $$("[data-magnet]").forEach(function (el) {
        el.addEventListener("pointermove", function (e) {
          var r = el.getBoundingClientRect();
          el.style.translate = ((e.clientX - r.left - r.width / 2) * 0.22).toFixed(1) + "px " + ((e.clientY - r.top - r.height / 2) * 0.3).toFixed(1) + "px";
        });
        el.addEventListener("pointerleave", function () { el.style.translate = "0 0"; });
      });
    }

    /* ---- sparkles ---- */
    if (cfg.sparkles) {
      var host = $(cfg.sparkles);
      if (host) for (var n = 0; n < 14; n++) {
        var s = document.createElement("i"); s.className = "mo-sp"; s.setAttribute("aria-hidden", "true");
        s.style.left = (Math.random() * 120 - 10) + "%"; s.style.top = (Math.random() * 110 - 5) + "%";
        s.style.setProperty("--s", (6 + Math.random() * 12).toFixed(1) + "px");
        s.style.setProperty("--t", (2.4 + Math.random() * 2.6).toFixed(1) + "s");
        s.style.setProperty("--dl", (1.2 + Math.random() * 4).toFixed(1) + "s");
        host.appendChild(s);
      }
    }

    /* ---- store: cart feedback (bump, fly-to-cart, confetti, drawer stagger) ---- */
    var counts = $$(".cartcount");
    if (counts.length) {
      var last = null, prev = parseInt(counts[0].textContent, 10) || 0;
      document.addEventListener("click", function (e) {
        var a = e.target.closest ? e.target.closest("[data-a],#madd") : null;
        if (!a) { return; }
        var src = a.id === "madd" ? $("#modal .mart") : (a.closest(".card") ? $(".art", a.closest(".card")) : null);
        last = { t: Date.now(), btn: a.getBoundingClientRect(), rect: src ? src.getBoundingClientRect() : null, html: src ? src.innerHTML : "" };
      }, true);
      new MutationObserver(function () {
        var n = parseInt(counts[0].textContent, 10) || 0;
        if (n > prev) {
          counts.forEach(function (c) { c.classList.remove("bump"); void c.offsetWidth; c.classList.add("bump"); });
          $$(".cartbtn").forEach(function (b) { b.classList.remove("ping"); void b.offsetWidth; b.classList.add("ping"); });
          if (last && Date.now() - last.t < 900) {
            if (last.rect) fly(last);
            if (cfg.burst) burst(last.btn);
          }
          last = null;
        }
        prev = n;
      }).observe(counts[0], { childList: true, characterData: true, subtree: true });
    }
    function visible(el) { var r = el.getBoundingClientRect(); return r.width > 0 && r.bottom > 0 && r.top < window.innerHeight; }
    function fly(src) {
      var tgt = $$(".cartbtn").filter(visible)[0], ob = $("#obar");
      if (!tgt && ob && getComputedStyle(ob).display !== "none") tgt = ob;
      if (!tgt) return;
      var w = Math.min(110, src.rect.width * 0.5), f = document.createElement("div");
      f.className = "mo-fly"; f.style.width = f.style.height = w + "px"; f.innerHTML = src.html;
      document.body.appendChild(f);
      var t = tgt.getBoundingClientRect(),
        x0 = src.rect.left + src.rect.width / 2 - w / 2, y0 = src.rect.top + src.rect.height / 2 - w / 2,
        x1 = t.left + t.width / 2 - w / 2, y1 = t.top + t.height / 2 - w / 2;
      var anim = f.animate([
        { transform: "translate(" + x0 + "px," + y0 + "px) scale(1)", opacity: 1 },
        { transform: "translate(" + (x0 + x1) / 2 + "px," + (Math.min(y0, y1) - 90) + "px) scale(.7)", opacity: 1, offset: 0.5 },
        { transform: "translate(" + x1 + "px," + y1 + "px) scale(.12)", opacity: 0.35 }
      ], { duration: 800, easing: "cubic-bezier(.5,0,.3,1)" });
      anim.onfinish = function () { if (f.parentNode) f.parentNode.removeChild(f); };
    }
    function burst(b) {
      var cs = getComputedStyle(root), cols = ["--accent", "--peach", "--mint", "--sun"].map(function (v) { return cs.getPropertyValue(v).trim(); }).filter(Boolean);
      if (!cols.length) cols = ["#ff6fa0", "#ffd9b0", "#bfe6d2", "#ffe08a"];
      var cx = b.left + b.width / 2, cy = b.top + b.height / 2;
      for (var i = 0; i < 16; i++) {
        var d = document.createElement("i"), a = (Math.PI * 2 * i) / 16 + Math.random() * 0.4, dist = 50 + Math.random() * 60, sz = 6 + Math.random() * 6;
        d.className = "mo-conf"; d.style.width = d.style.height = sz + "px"; d.style.background = cols[i % cols.length];
        document.body.appendChild(d);
        (function (d) {
          d.animate([
            { transform: "translate(" + cx + "px," + cy + "px) scale(1)", opacity: 1 },
            { transform: "translate(" + (cx + Math.cos(a) * dist) + "px," + (cy + Math.sin(a) * dist - 20) + "px) scale(1)", opacity: 1, offset: 0.55 },
            { transform: "translate(" + (cx + Math.cos(a) * dist * 1.2) + "px," + (cy + Math.sin(a) * dist + 50) + "px) scale(.3)", opacity: 0 }
          ], { duration: 800 + Math.random() * 300, easing: "cubic-bezier(.2,.7,.3,1)" }).onfinish = function () { if (d.parentNode) d.parentNode.removeChild(d); };
        })(d);
      }
    }
    var drawer = $("#drawer");
    if (drawer) {
      var was = drawer.classList.contains("open");
      new MutationObserver(function () {
        var now = drawer.classList.contains("open");
        if (now && !was) { drawer.classList.add("enter"); setTimeout(function () { drawer.classList.remove("enter"); }, 1100); }
        was = now;
      }).observe(drawer, { attributes: true, attributeFilter: ["class"] });
    }
  }
})();
