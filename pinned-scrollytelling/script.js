/* ============================================================
   Pinned Scrollytelling — moteur 100% piloté par le scroll.

   Principe anti-glitch : TOUT est une fonction pure de "pos"
   (la position de scène, 0 → STEPS-1). Aucune animation déclenchée
   "à l'entrée" : en revenant en arrière on ré-évalue exactement les
   mêmes valeurs → réversible, jamais rejoué, donc jamais de chevauchement.
   Les seules animations CSS sont AMBIANTES (halo, voyant, anneaux) :
   elles tournent en boucle et sont juste masquées par l'opacité (JS).

   Chaque geste est découpé avec seg(pos, a, b) : une rampe lissée 0→1
   sur l'intervalle [a, b]. On enchaîne les sous-gestes en juxtaposant
   ces intervalles.
   ============================================================ */
(function () {
  "use strict";

  var section   = document.querySelector("[data-pin-section]");
  var layers    = document.querySelectorAll("[data-step]");
  var gradients = document.querySelectorAll("[data-grad]");
  var dots      = document.querySelectorAll(".dot");
  var hud       = document.getElementById("hud");

  /* --- éléments de chorégraphie --- */
  var photo   = document.querySelector("[data-photo]");    // scène 1 : la carte
  var cue     = document.querySelector("[data-cue]");      // zone de dépôt (hint + anneaux)
  var cursor1 = document.querySelector("[data-cursor1]");  // curseur qui dépose la photo
  var halos   = document.querySelector("[data-halos]");    // halos de lumière (analyse)
  var analyse = document.querySelector("[data-analyse]");  // pastille "Analyse IA…"
  var tiles   = document.querySelectorAll("[data-tile]");  // scène 2 : variantes
  var grid    = document.querySelector(".grid");
  var tap     = document.querySelector("[data-select]");   // onde de clic (sélection)
  var cursor2 = document.querySelector("[data-cursor2]");  // curseur qui sélectionne
  var frame   = document.querySelector("[data-frame]");    // scène 3 : le cadre
  var badge   = document.querySelector("[data-badge]");    // "Livré sous 5 jours"

  var STEPS = 3;
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var ticking = false;

  /* --- helpers --- */
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function smooth(x) { return x * x * (3 - 2 * x); }                       // smoothstep
  function seg(pos, a, b) { return smooth(clamp((pos - a) / (b - a), 0, 1)); } // rampe 0→1 sur [a,b]
  function lerp(a, b, t) { return a + (b - a) * t; }

  /* Opacité d'un calque (modèle PLATEAU : plein sur un palier, fondu serré aux frontières) */
  var EDGE = 0.5, FADE_VISUAL = 0.34, FADE_TEXT = 0.10;
  function bandOpacity(pos, i, fade) {
    var d = Math.abs(pos - i);
    return smooth(clamp((EDGE + fade / 2 - d) / fade, 0, 1));
  }

  /* Place l'anneau + le curseur de sélection PILE sur la 1re tuile (recalculé au resize) */
  function layout() {
    if (!grid || !tiles.length || !tap) return;
    var g = grid.getBoundingClientRect();
    var t = tiles[0].getBoundingClientRect();
    var cx = t.left - g.left + t.width / 2;
    var cy = t.top - g.top + t.height / 2;
    tap.style.left = cx + "px"; tap.style.top = cy + "px";
    tap.style.width = t.width + "px"; tap.style.height = t.height + "px";
    if (cursor2) { cursor2.style.left = cx + "px"; cursor2.style.top = cy + "px"; }
  }

  function update() {
    ticking = false;
    var rect = section.getBoundingClientRect();
    var distance = section.offsetHeight - window.innerHeight;
    var progress = clamp(-rect.top / distance, 0, 1);
    var pos = progress * (STEPS - 1);

    /* 1) Opacité des scènes + texte (le texte monte légèrement en arrivant) */
    Array.prototype.forEach.call(layers, function (el) {
      var i = +el.dataset.step;
      var isText = el.classList.contains("panel");
      var op = bandOpacity(pos, i, isText ? FADE_TEXT : FADE_VISUAL);
      el.style.opacity = op;
      if (isText && !reduceMotion) {
        // glisse : entre par le bas, sort par le haut → à la frontière les deux
        // titres sont décalés verticalement (plus de chevauchement lettre sur lettre)
        el.style.transform = "translateY(" + clamp((i - pos) * 30, -30, 30) + "px)";
      }
      el.style.pointerEvents = op > 0.5 ? "auto" : "none";
    });
    Array.prototype.forEach.call(gradients, function (el) {
      el.style.opacity = bandOpacity(pos, +el.dataset.grad, FADE_VISUAL);
    });

    if (reduceMotion) { sugar(pos, progress); return; }

    /* ============ SCÈNE 1 — le curseur dépose la photo, puis analyse IA ============
       Séquence : approche (droite→centre) · drag (carte→zone) · relâche · révélation */
    var approach = seg(pos, 0.00, 0.12);
    var drag     = seg(pos, 0.10, 0.30);
    var release  = seg(pos, 0.26, 0.36);
    var reveal   = seg(pos, 0.30, 0.42);
    if (photo) {
      photo.style.transform =
        "translate(" + lerp(132, 0, drag) + "px," + lerp(-56, 0, drag) + "px) " +
        "rotate(" + lerp(-7, 0, drag) + "deg) scale(" + lerp(1.04, 1, drag) + ")";
    }
    if (cue)     cue.style.opacity = (1 - drag);
    if (cursor1) {
      cursor1.style.opacity = clamp(1 - release, 0, 1);
      // part à droite de la photo (approach 0) → centre (approach 1) ; reste droit malgré l'inclinaison
      cursor1.style.transform = "translate(" + lerp(132, 0, approach) + "px,0) rotate(" + ((1 - drag) * 7) + "deg)";
    }
    if (halos)   halos.style.opacity = reveal;
    if (analyse) analyse.style.opacity = reveal;

    /* ============ SCÈNE 2 — les variantes apparaissent, le curseur sélectionne la 1re ============ */
    var c2enter = seg(pos, 0.98, 1.18);                       // curseur arrive du côté
    var c2vis   = seg(pos, 0.95, 1.05) * (1 - seg(pos, 1.30, 1.42));
    var select  = seg(pos, 1.16, 1.28);                       // clic → sélection
    var clickPulse = Math.sin(clamp(select, 0, 1) * Math.PI); // 0→1→0 : pic au clic
    Array.prototype.forEach.call(tiles, function (t, k) {
      var e = seg(pos, 0.60 + k * 0.05, 0.80 + k * 0.05);     // cascade
      var sc = lerp(0.82, 1, e);
      if (k === 0) sc *= (1 + clickPulse * 0.12);             // la 1re tuile PULSE au clic
      t.style.opacity = e;
      t.style.transform = "translateY(" + ((1 - e) * 16) + "px) scale(" + sc + ")";
    });
    if (cursor2) {
      cursor2.style.opacity = c2vis;
      cursor2.style.transform = "translate(" + lerp(150, 10, c2enter) + "px," + lerp(96, 10, c2enter) + "px) scale(" + (1 - select * 0.16) + ")";
    }
    if (tap) {                                                // onde de clic qui pulse depuis la tuile
      tap.style.opacity = clickPulse * 0.85;
      tap.style.transform = "translate(-50%,-50%) scale(" + lerp(0.5, 1.5, select) + ")";
    }

    /* ============ SCÈNE 3 — le cadre est "drag & droppé" du coin sup-droit, puis redressé ============ */
    var fdrag   = seg(pos, 1.55, 1.92);
    var badgeR  = seg(pos, 1.90, 2.00);
    if (frame) {
      frame.style.transform =
        "translate(" + lerp(150, 0, fdrag) + "px," + lerp(-110, 0, fdrag) + "px) " +
        "rotate(" + lerp(8, 0, fdrag) + "deg) scale(" + lerp(0.94, 1, fdrag) + ")";
    }
    if (badge) {
      badge.style.opacity = badgeR;
      badge.style.transform = "translateX(-50%) scale(" + lerp(0.6, 1, badgeR) + ")";
    }

    sugar(pos, progress);
  }

  /* pastille active + HUD pédagogique */
  function sugar(pos, progress) {
    var active = Math.round(pos);
    Array.prototype.forEach.call(dots, function (d, i) { d.classList.toggle("is-active", i === active); });
    if (hud) hud.textContent = "progress " + progress.toFixed(2) + " · pos " + pos.toFixed(2) + " · étape " + (active + 1) + "/" + STEPS;
  }

  function onScroll() { if (!ticking) { window.requestAnimationFrame(update); ticking = true; } }
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", function () { layout(); update(); });
  window.addEventListener("load", function () { layout(); update(); });
  layout();
  update();
})();
