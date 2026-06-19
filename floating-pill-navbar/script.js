/* Navbar flottante : bascule l'état "scrolled" au-delà d'un seuil.
   Écouteur passif + requestAnimationFrame pour rester fluide. */
(function () {
  "use strict";

  var nav = document.getElementById("nav");
  var burger = document.getElementById("burger");
  var THRESHOLD = 24; // px de scroll avant de condenser la barre
  var ticking = false;

  function update() {
    var y = window.scrollY || window.pageYOffset;
    nav.dataset.state = y > THRESHOLD ? "scrolled" : "top";
    ticking = false;
  }

  function onScroll() {
    if (!ticking) {
      window.requestAnimationFrame(update);
      ticking = true;
    }
  }

  window.addEventListener("scroll", onScroll, { passive: true });
  update(); // état initial (utile si la page est rechargée en cours de scroll)

  /* Menu mobile : simple toggle d'attribut (démo) */
  if (burger) {
    burger.addEventListener("click", function () {
      var open = burger.getAttribute("aria-expanded") === "true";
      burger.setAttribute("aria-expanded", String(!open));
    });
  }
})();
