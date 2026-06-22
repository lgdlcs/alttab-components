/* ============================================================
   Background hero redreplier — grille de points + répulsion au curseur.

   Reproduit l'effet de hover de l'original : autour du curseur, les points
   sont repoussés vers l'extérieur (un « trou » qui suit la souris, avec un
   anneau plus dense au bord). Tout est dessiné sur un <canvas>.

   - Grille de points (#8b92fb, pas 16px) avec un glow radial haut-centre,
     pour matcher le fallback CSS.
   - Répulsion : chaque point dans un rayon du curseur est poussé dans la
     direction opposée, avec une force qui décroît avec la distance et un
     easing au retour. Le déplacement est une fonction lissée de l'état —
     aucune écriture DOM, juste du dessin canvas.
   - Accessibilité : sous prefers-reduced-motion (ou sans JS / sans canvas),
     on laisse le fallback CSS statique.
   ============================================================ */
(function () {
  "use strict";

  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var hero = document.querySelector(".rr-hero");
  var canvas = document.querySelector(".rr-hero__bg--canvas");
  var fallback = document.querySelector(".rr-hero__bg--fallback");
  if (!hero || !canvas || !canvas.getContext) return;   // → on garde le fallback CSS
  if (reduce) return;                                    // → idem, pas d'animation

  var ctx = canvas.getContext("2d");

  /* --- réglages (mesurés sur l'original) --- */
  var GAP = 16;            // pas de la grille (px)
  var R0 = 2;              // rayon de base d'un point
  var BR = "139,146,251";  // couleur de marque #8b92fb
  var REPEL = 115;         // rayon d'influence du curseur
  var PUSH = 24;           // poussée max
  var EASE = 0.18;         // lissage du déplacement (retour compris)

  var W = 0, H = 0, dpr = 1, dots = [];
  var mx = -1e5, my = -1e5; // curseur (hors champ au départ)

  /* glow radial : plein en haut-centre, s'estompe vers les bords
     (approxime le mask CSS radial-gradient(125% 85% at 50% 22%)) */
  function glow(gx, gy) {
    var d = Math.hypot((gx - W * 0.5) / (W * 0.72), (gy - H * 0.22) / (H * 0.92));
    var g = 1 - d; if (g < 0) g = 0;
    return g * g * (3 - 2 * g);
  }

  function build() {
    var rect = hero.getBoundingClientRect();
    W = rect.width; H = rect.height;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = W * dpr; canvas.height = H * dpr;
    canvas.style.width = W + "px"; canvas.style.height = H + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    var cols = Math.ceil(W / GAP) + 1, rows = Math.ceil(H / GAP) + 1;
    dots = [];
    for (var j = 0; j < rows; j++) {
      for (var i = 0; i < cols; i++) {
        var gx = i * GAP, gy = j * GAP;
        dots.push({ x: gx, y: gy, a: 0.55 * glow(gx, gy), ox: 0, oy: 0 });
      }
    }
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    for (var k = 0; k < dots.length; k++) {
      var d = dots[k];
      var dx = d.x - mx, dy = d.y - my, dist = Math.hypot(dx, dy);
      var tox = 0, toy = 0, bump = 0;
      if (dist < REPEL && dist > 0.001) {
        var f = 1 - dist / REPEL; f = f * f;       // force lissée, max au centre
        tox = (dx / dist) * f * PUSH;
        toy = (dy / dist) * f * PUSH;
        bump = f;
      }
      d.ox += (tox - d.ox) * EASE;                 // easing (poussée ET retour)
      d.oy += (toy - d.oy) * EASE;

      var a = d.a * (1 + bump * 1.3);              // léger surcroît de brillance au bord
      if (a > 0.95) a = 0.95;
      if (a <= 0.003) continue;
      ctx.beginPath();
      ctx.fillStyle = "rgba(" + BR + "," + a.toFixed(3) + ")";
      ctx.arc(d.x + d.ox, d.y + d.oy, R0 * (1 + bump * 0.5), 0, 6.2832);
      ctx.fill();
    }
  }

  /* --- boucle rAF (coupée hors écran / onglet caché) --- */
  var raf = null, running = false;
  function loop() { draw(); raf = window.requestAnimationFrame(loop); }
  function start() { if (!running) { running = true; loop(); } }
  function stop() { running = false; if (raf) window.cancelAnimationFrame(raf); raf = null; }

  /* --- curseur (le canvas est pointer-events:none → on écoute la section) --- */
  hero.addEventListener("pointermove", function (e) {
    var r = hero.getBoundingClientRect();
    mx = e.clientX - r.left; my = e.clientY - r.top;
  }, { passive: true });
  hero.addEventListener("pointerleave", function () { mx = -1e5; my = -1e5; });

  build();
  if (fallback) fallback.style.display = "none";  // le canvas prend la main
  start();

  var rt;
  window.addEventListener("resize", function () { clearTimeout(rt); rt = setTimeout(build, 150); });
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (es) {
      es.forEach(function (en) { en.isIntersecting ? start() : stop(); });
    }).observe(hero);
  }
  document.addEventListener("visibilitychange", function () { document.hidden ? stop() : start(); });
})();
