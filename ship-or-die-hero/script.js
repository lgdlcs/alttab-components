/* ============================================================
   Ship or Die — moteur 100% piloté par le scroll.

   Principe anti-glitch (comme tous les composants de la galerie) :
   TOUT est une fonction pure de "p" (la progression de scroll, 0 → 1).
   Aucune animation déclenchée "à l'entrée" : on recalcule les mêmes
   valeurs à chaque frame, donc en remontant tout se rejoue à l'envers,
   sans jamais se chevaucher. Le JS ne fait que poser des variables CSS
   sur .sod-pin ; le rendu (transforms, opacités) est 100% en CSS.

   Les seules animations CSS sont AMBIANTES (dérive des nuages, pluie,
   tangage, marche du capitaine) : elles tournent en boucle et sont
   juste révélées/masquées par l'opacité pilotée ici.

   La trame : SHIP your app in 30 days … l'orage monte … le capitaine
   débarque, marche jusqu'au glandeur qui n'a rien shippé, le balance
   par-dessus bord (chute en parabole) … SPLASH … « or DIE ».
   ============================================================ */
(function () {
  "use strict";

  var section = document.querySelector("[data-sod-section]");
  var scene = document.querySelector("[data-sod-scene]");
  var hud = document.getElementById("sodHud");
  if (!section || !scene) return;

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var ticking = false;

  /* --- helpers --- */
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function smooth(x) { return x * x * (3 - 2 * x); }                          // smoothstep
  function seg(p, a, b) { return smooth(clamp((p - a) / (b - a), 0, 1)); }    // rampe lissée 0→1 sur [a,b]
  function lerp(a, b, t) { return a + (b - a) * t; }
  /* pulse lissé 0→1→0, centré en c, largeur w → sert aux éclairs (réversible) */
  function pulse(p, c, w) { var x = Math.abs(p - c) / w; return x < 1 ? (1 - x) * (1 - x) : 0; }

  /* Écrit toutes les variables d'un coup sur la scène */
  function paint(v) {
    var s = scene.style;
    s.setProperty("--scene-progress", v.p.toFixed(3));
    s.setProperty("--storm-opacity", v.storm.toFixed(3));
    s.setProperty("--storm-strike", v.strike.toFixed(3));
    s.setProperty("--storm-ambient", v.ambient.toFixed(3));
    s.setProperty("--rain-opacity", v.rain.toFixed(3));
    s.setProperty("--moon-opacity", v.moon.toFixed(3));
    s.setProperty("--captain-opacity", v.capOp.toFixed(3));
    s.setProperty("--captain-x", v.capX.toFixed(1) + "px");
    s.setProperty("--captain-throw", v.throw.toFixed(3));
    s.setProperty("--slacker-opacity", v.slackOp.toFixed(3));
    s.setProperty("--fall-opacity", v.fallOp.toFixed(3));
    s.setProperty("--fall-x", v.fallX.toFixed(1) + "px");
    s.setProperty("--fall-y", v.fallY.toFixed(1) + "px");
    s.setProperty("--fall-rotate", v.fallR.toFixed(1) + "deg");
    s.setProperty("--splash-opacity", v.splashOp.toFixed(3));
    s.setProperty("--splash-scale", v.splashSc.toFixed(3));
    s.setProperty("--launch-opacity", v.launch.toFixed(3));
    s.setProperty("--cue-opacity", v.cue.toFixed(3));
    s.setProperty("--cue-y", v.cueY.toFixed(1) + "px");
    s.setProperty("--consequence-opacity", v.conseq.toFixed(3));
    s.setProperty("--consequence-y", v.conseqY.toFixed(1) + "px");
  }

  /* Calcule l'état complet de la scène pour une progression p (fonction PURE) */
  function compute(p) {
    /* --- l'orage s'installe, la lune s'éteint --- */
    var storm = seg(p, 0.10, 0.46);
    var rain = seg(p, 0.16, 0.42);
    var moon = lerp(1, 0.12, seg(p, 0.10, 0.40));
    /* éclairs : quelques pics nets pendant que l'orage est présent (réversibles) */
    var strike = Math.min(1, pulse(p, 0.22, 0.025) + pulse(p, 0.34, 0.02) +
                             pulse(p, 0.52, 0.022) + pulse(p, 0.63, 0.018)) * Math.min(1, storm * 1.2);
    var ambient = storm;

    /* --- le capitaine débarque puis marche jusqu'au glandeur --- */
    var capOp = seg(p, 0.14, 0.24);
    var capX = lerp(-100, 66, seg(p, 0.16, 0.44));
    /* le bras se lève (le lancer) entre 0.44 et 0.54 */
    var thr = seg(p, 0.44, 0.54);

    /* --- le glandeur tient jusqu'à la prise, puis devient le corps qui chute --- */
    var slackOp = 1 - seg(p, 0.50, 0.55);

    /* --- la chute : balancé par-dessus le bastingage, parabole + vrille ---
       Le corps sort vers la droite, passe DERRIÈRE la vague avant et entre
       dans l'eau juste à côté de la coque (là où le splash jaillit). */
    var fp = seg(p, 0.52, 0.80);
    var fallOp = seg(p, 0.52, 0.56) * (1 - seg(p, 0.74, 0.80));
    var fallX = lerp(0, 100, fp);
    /* arc : pop vers le haut au lancer, puis descente jusqu'à la flottaison */
    var fallY = lerp(0, 64, fp) - 50 * Math.sin(fp * Math.PI);
    var fallR = lerp(0, 500, fp);

    /* --- le splash quand le corps touche l'eau (pic à fp≈1) --- */
    var splashOp = pulse(p, 0.80, 0.055);
    var splashSc = lerp(0.7, 1.4, seg(p, 0.74, 0.84));

    /* --- la copie : l'amorce se dissout, la sentence monte --- */
    var launch = 1 - seg(p, 0.34, 0.50);
    var cue = 1 - seg(p, 0.05, 0.18);
    var cueY = lerp(0, 16, seg(p, 0.05, 0.18));
    var conseq = seg(p, 0.50, 0.72);
    var conseqY = lerp(22, 0, seg(p, 0.50, 0.72));

    return {
      p: p, storm: storm, strike: strike, ambient: ambient, rain: rain, moon: moon,
      capOp: capOp, capX: capX, throw: thr, slackOp: slackOp,
      fallOp: fallOp, fallX: fallX, fallY: fallY, fallR: fallR,
      splashOp: splashOp, splashSc: splashSc,
      launch: launch, cue: cue, cueY: cueY, conseq: conseq, conseqY: conseqY
    };
  }

  function sceneLabel(p) {
    if (p < 0.15) return "1/4 · calme";
    if (p < 0.50) return "2/4 · tempête";
    if (p < 0.80) return "3/4 · largué";
    return "4/4 · DIE";
  }

  function update() {
    ticking = false;
    var rect = section.getBoundingClientRect();
    var distance = section.offsetHeight - window.innerHeight;
    var p = clamp(-rect.top / distance, 0, 1);

    var v = compute(p);
    paint(v);
    if (hud) hud.textContent = "progress " + p.toFixed(2) + " · storm " + v.storm.toFixed(2) + " · scène " + sceneLabel(p);
  }

  function onScroll() { if (!ticking) { window.requestAnimationFrame(update); ticking = true; } }

  /* Mouvement réduit : on fige une composition « sentence tombée »
     (orage installé, corps déjà à l'eau) plutôt que de jouer le scroll. */
  if (reduceMotion) {
    var still = compute(0.92);
    still.strike = 0; still.splashOp = 0; still.fallOp = 0;
    paint(still);
    if (hud) hud.textContent = "mouvement réduit · composition figée";
    return;
  }

  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", update);
  window.addEventListener("load", update);
  update();
})();
