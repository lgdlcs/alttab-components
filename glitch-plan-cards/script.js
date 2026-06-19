/* Glitch Plan Cards
   ==================================================================
   Port *vanilla* (WebGL brut, zéro dépendance) de l'effet des cartes
   du portail Nous Research. L'image d'une carte est une texture ;
   un shader la découpe en 12 bandes horizontales et la DÉCHIRE selon
   la VITESSE du curseur (datamosh + aberration chromatique). Le JS ne
   fait que lire le pointeur et nourrir les uniforms — comme l'original,
   il n'écrit jamais dans le DOM (d'où l'invisibilité aux DevTools).

   Le shader (vertex + fragment) et la logique vitesse/bandes sont repris
   tels quels du bundle de Nous ; la texture est générée localement
   (aucun asset externe). La bordure « arc » au survol est en CSS.
   ================================================================== */
(function () {
  "use strict";

  /* ----- Shaders (repris du bundle Nous, à l'identique) ----- */
  var VERT =
    "attribute vec2 a;varying vec2 vUv;" +
    "void main(){vUv=vec2(a.x*.5+.5,.5-a.y*.5);gl_Position=vec4(a,0,1);}";

  var FRAG = [
    "precision highp float;",
    "uniform float t;",
    "uniform vec2 r,imgSize,vel;",
    "uniform sampler2D tex;",
    "uniform float bands[12];",
    "uniform vec3 tint;",
    "uniform float tintStrength;",
    "varying vec2 vUv;",
    "float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}",
    "vec2 coverUV(vec2 uv){",
    "  float canvasAspect=r.x/r.y;",
    "  float imgAspect=imgSize.x/imgSize.y;",
    "  vec2 scale=canvasAspect>imgAspect?vec2(1.0,imgAspect/canvasAspect):vec2(canvasAspect/imgAspect,1.0);",
    "  return(uv-0.5)*scale+0.5;",
    "}",
    "void main(){",
    "  vec2 uv=coverUV(vUv);",
    "  float scanY=floor(vUv.y*r.y);",
    "  float bandF=vUv.y*12.0;",
    "  int bandIdx=int(floor(bandF));",
    "  float bandFrac=fract(bandF);",
    "  float strength=0.0;",
    "  for(int i=0;i<12;i++){ if(i==bandIdx) strength=bands[i]; }",
    "  float neighborStr=0.0;",
    "  int neighborIdx=bandFrac>.5?bandIdx+1:bandIdx-1;",
    "  for(int i=0;i<12;i++){ if(i==neighborIdx) neighborStr=bands[i]; }",
    "  float edgeBlend=abs(bandFrac-.5)*2.0;",
    "  edgeBlend*=edgeBlend;",
    "  strength=mix(strength,neighborStr,edgeBlend*.3);",
    "  float speed=length(vel);",
    "  float dirBlend=smoothstep(0.0,0.02,speed);",
    "  vec2 dir=speed>.0001?vel/speed:vec2(0);",
    "  dir*=dirBlend;",
    "  float rowSeed=h(vec2(scanY,floor(t*3.)+float(bandIdx)*7.));",
    "  float rowVar=mix(.4,1.0,rowSeed);",
    "  float ySmooth=vUv.y*6.0+t*0.7;",
    "  float yNoise=mix(h(vec2(floor(ySmooth),13.)),h(vec2(floor(ySmooth)+1.0,13.)),smoothstep(0.0,1.0,fract(ySmooth)));",
    "  float colVar=mix(.4,1.0,yNoise);",
    "  float tearShiftX=dir.x*strength*rowVar*0.15;",
    "  float tearShiftY=dir.y*strength*colVar*0.10;",
    "  float bandSeed=h(vec2(float(bandIdx),42.));",
    "  tearShiftX+=strength*(.5-bandSeed)*0.05;",
    "  float yJitter=mix(h(vec2(floor(ySmooth),73.)),h(vec2(floor(ySmooth)+1.0,73.)),smoothstep(0.0,1.0,fract(ySmooth)));",
    "  tearShiftY+=strength*(.5-yJitter)*0.035;",
    "  uv.x+=tearShiftX;",
    "  uv.y+=tearShiftY;",
    "  float sortGate=step(.5,strength)*step(.4,rowSeed);",
    "  uv.x+=dir.x*sortGate*strength*0.03;",
    "  uv.y+=dir.y*sortGate*strength*0.02;",
    "  float caX=abs(tearShiftX)*2.5+sortGate*strength*0.01;",
    "  float caY=abs(tearShiftY)*2.5+sortGate*strength*0.01;",
    "  float cr=texture2D(tex,vec2(uv.x+caX,uv.y+caY)).r;",
    "  float cg=texture2D(tex,uv).g;",
    "  float cb=texture2D(tex,vec2(uv.x-caX,uv.y-caY)).b;",
    "  vec3 col=vec3(cr,cg,cb);",
    "  col*=.97+.03*sin(vUv.y*r.y*3.14159);",
    "  float bandEdge=smoothstep(.02,.0,min(bandFrac,1.0-bandFrac));",
    "  col+=vec3(bandEdge*strength*.1);",
    "  col=mix(col,col*tint,tintStrength);",
    "  gl_FragColor=vec4(col,1.0);",
    "}"
  ].join("\n");

  /* ----- Petit PRNG déterministe (pour des textures stables) ----- */
  function mulberry32(s) {
    return function () {
      s |= 0; s = (s + 0x6d2b79f5) | 0;
      var t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* ----- Palettes par formule ----- */
  var TEX_W = 600, TEX_H = 800;
  var PALETTES = {
    free:  { top: "#10131c", bot: "#04050a", glow: "rgba(120,150,255,0.20)", line: "180,200,255", shard: "210,225,255", seed: 11 },
    plus:  { top: "#2c1d06", bot: "#0a0600", glow: "rgba(255,172,2,0.24)",   line: "255,200,120", shard: "255,232,185", seed: 22 },
    super: { top: "#301504", bot: "#0a0400", glow: "rgba(255,120,24,0.24)",  line: "255,170,110", shard: "255,214,165", seed: 33 },
    ultra: { top: "#332700", bot: "#0c0900", glow: "rgba(255,210,63,0.26)",  line: "255,226,140", shard: "255,242,195", seed: 44 }
  };

  /* ----- Génère la texture « art » d'une carte (canvas 2D) -----
     Assez de détail et de contraste pour que la déchirure et
     l'aberration chromatique se voient bien. */
  function makeTexture(tier) {
    var P = PALETTES[tier] || PALETTES.plus;
    var c = document.createElement("canvas");
    c.width = TEX_W; c.height = TEX_H;
    var x = c.getContext("2d");
    var rnd = mulberry32(P.seed);

    var g = x.createLinearGradient(0, 0, 0, TEX_H);
    g.addColorStop(0, P.top); g.addColorStop(1, P.bot);
    x.fillStyle = g; x.fillRect(0, 0, TEX_W, TEX_H);

    var rg = x.createRadialGradient(TEX_W * 0.34, TEX_H * 0.28, 10, TEX_W * 0.34, TEX_H * 0.28, TEX_W * 0.95);
    rg.addColorStop(0, P.glow); rg.addColorStop(1, "rgba(0,0,0,0)");
    x.fillStyle = rg; x.fillRect(0, 0, TEX_W, TEX_H);

    // drapés (courbes douces) — du détail horizontal pour les tears
    x.lineWidth = 2;
    for (var i = 0; i < 28; i++) {
      x.strokeStyle = "rgba(" + P.line + "," + (0.05 + 0.10 * rnd()).toFixed(3) + ")";
      var y0 = rnd() * TEX_H;
      x.beginPath();
      x.moveTo(-20, y0);
      x.bezierCurveTo(TEX_W * 0.3, y0 - 120 + 240 * rnd(), TEX_W * 0.7, y0 - 120 + 240 * rnd(), TEX_W + 20, rnd() * TEX_H);
      x.stroke();
    }

    // éclats géométriques (bords nets)
    for (var j = 0; j < 6; j++) {
      x.fillStyle = "rgba(" + P.shard + "," + (0.06 + 0.12 * rnd()).toFixed(3) + ")";
      var sx = rnd() * TEX_W, sy = rnd() * TEX_H, sw = 50 + rnd() * 170;
      x.save(); x.translate(sx, sy); x.rotate(rnd() * Math.PI);
      x.fillRect(-sw / 2, -2, sw, 4); x.restore();
    }

    // grain
    var img = x.getImageData(0, 0, TEX_W, TEX_H), d = img.data;
    for (var k = 0; k < d.length; k += 4) {
      var n = (rnd() - 0.5) * 18;
      d[k] += n; d[k + 1] += n; d[k + 2] += n;
    }
    x.putImageData(img, 0, 0);

    // vignette
    var vg = x.createRadialGradient(TEX_W / 2, TEX_H / 2, TEX_H * 0.2, TEX_W / 2, TEX_H / 2, TEX_H * 0.72);
    vg.addColorStop(0, "rgba(0,0,0,0)"); vg.addColorStop(1, "rgba(0,0,0,0.55)");
    x.fillStyle = vg; x.fillRect(0, 0, TEX_W, TEX_H);

    return c;
  }

  /* ----- Dessine une image en mode "cover" dans un contexte 2D ----- */
  function coverDraw(ctx, img, W, H) {
    var ir = img.naturalWidth / img.naturalHeight, cr = W / H, dw, dh;
    if (ir > cr) { dh = H; dw = H * ir; } else { dw = W; dh = W / ir; }
    ctx.drawImage(img, (W - dw) / 2, (H - dh) / 2, dw, dh);
  }

  /* ----- Compilation WebGL ----- */
  function compile(gl, type, src) {
    var sh = gl.createShader(type);
    gl.shaderSource(sh, src); gl.compileShader(sh);
    return sh;
  }

  var TINT = [1.0, 0.69, 0.16]; // ambre

  /* ----- Initialise une carte ; renvoie son moteur ou null ----- */
  function initCard(card) {
    var canvas = card.querySelector(".card__gl");
    var tier = card.dataset.tier;
    var texCanvas = makeTexture(tier);

    var src = "img/" + tier + ".jpg";   // l'image de fond de la formule

    var gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
    if (!gl) {
      // Pas de WebGL : on peint l'image en statique (fallback honnête).
      // La texture procédurale sert de remplissage le temps du chargement.
      var ctx2d = canvas.getContext("2d");
      if (ctx2d) {
        canvas.width = TEX_W; canvas.height = TEX_H;
        ctx2d.drawImage(texCanvas, 0, 0);
        var im2 = new Image();
        im2.onload = function () { coverDraw(ctx2d, im2, TEX_W, TEX_H); };
        im2.src = src;
      }
      return null;
    }

    var prog = gl.createProgram();
    gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog); gl.useProgram(prog);

    var buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    var aLoc = gl.getAttribLocation(prog, "a");
    gl.enableVertexAttribArray(aLoc);
    gl.vertexAttribPointer(aLoc, 2, gl.FLOAT, false, 0, 0);

    var U = {
      t: gl.getUniformLocation(prog, "t"),
      r: gl.getUniformLocation(prog, "r"),
      imgSize: gl.getUniformLocation(prog, "imgSize"),
      vel: gl.getUniformLocation(prog, "vel"),
      tex: gl.getUniformLocation(prog, "tex"),
      tint: gl.getUniformLocation(prog, "tint"),
      tintStrength: gl.getUniformLocation(prog, "tintStrength"),
      bands: gl.getUniformLocation(prog, "bands[0]")
    };

    var tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, texCanvas);
    gl.activeTexture(gl.TEXTURE0);
    gl.uniform1i(U.tex, 0);

    // taux de lissage par bande (.02..0.08) — comme Nous
    var rate = new Float32Array(12);
    for (var b = 0; b < 12; b++) rate[b] = 0.02 + 0.06 * Math.random();

    var st = {
      mx: 0.5, my: 0.5, prevMx: 0.5, prevMy: 0.5,
      vx: 0, vy: 0, hoverTarget: 0, imgW: TEX_W, imgH: TEX_H,
      bands: new Float32Array(12), bandTargets: new Float32Array(12), rate: rate
    };

    // Charge l'image de fond et la peint dans la texture (la procédurale
    // reste affichée le temps du chargement / en cas d'échec réseau).
    var im = new Image();
    im.onload = function () {
      st.imgW = im.naturalWidth; st.imgH = im.naturalHeight;
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, im);
    };
    im.src = src;

    function resize() {
      var rect = canvas.getBoundingClientRect();
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      var w = Math.max(1, Math.round(rect.width * dpr));
      var h = Math.max(1, Math.round(rect.height * dpr));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w; canvas.height = h;
        gl.viewport(0, 0, w, h);
      }
    }
    resize();
    if (window.ResizeObserver) new ResizeObserver(resize).observe(canvas);

    // Pointeur → état (jamais le DOM)
    card.addEventListener("pointermove", function (e) {
      var rect = card.getBoundingClientRect();
      st.mx = (e.clientX - rect.left) / rect.width;
      st.my = (e.clientY - rect.top) / rect.height;
    }, { passive: true });
    card.addEventListener("pointerenter", function () { st.hoverTarget = 1; });
    card.addEventListener("pointerleave", function () { st.hoverTarget = 0; });

    var t0 = performance.now();

    function render() {
      resize();
      var st_ = st;
      // vitesse lissée (dérivée du déplacement, gain ×8, lerp .1)
      var sx = st_.mx - st_.prevMx, sy = st_.my - st_.prevMy;
      st_.vx += (8 * sx - st_.vx) * 0.1;
      st_.vy += (8 * sy - st_.vy) * 0.1;
      st_.prevMx = st_.mx; st_.prevMy = st_.my;
      var speed = Math.sqrt(st_.vx * st_.vx + st_.vy * st_.vy);

      // cible de chaque bande : proximité en Y × survol × (0.4 + 0.6·vitesse)
      for (var e = 0; e < 12; e++) {
        var center = (e + 0.5) / 12;
        var prox = Math.max(0, 1 - Math.abs(st_.my - center) / 0.3);
        st_.bandTargets[e] = st_.hoverTarget * prox * (0.4 + 0.6 * Math.min(speed, 1));
      }
      // lissage vers la cible
      for (var f = 0; f < 12; f++) {
        st_.bands[f] += (st_.bandTargets[f] - st_.bands[f]) * st_.rate[f];
        if (st_.bands[f] < 0.001) st_.bands[f] = 0;
      }

      var time = (performance.now() - t0) / 1000;
      gl.uniform1f(U.t, time);
      gl.uniform2f(U.r, canvas.width, canvas.height);
      gl.uniform2f(U.imgSize, st_.imgW, st_.imgH);
      gl.uniform2f(U.vel, st_.vx, st_.vy);
      gl.uniform3f(U.tint, TINT[0], TINT[1], TINT[2]);
      gl.uniform1f(U.tintStrength, 0.16 + 0.16 * st_.hoverTarget);
      gl.uniform1fv(U.bands, st_.bands);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }

    return { card: card, render: render, visible: true };
  }

  /* ================= Bootstrap ================= */
  var plans = document.getElementById("plans");
  if (!plans) return;

  var cards = Array.prototype.slice.call(plans.querySelectorAll(".card"));
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var engines = cards.map(initCard).filter(Boolean);

  if (reduce) {
    // une image fixe, pas de boucle
    engines.forEach(function (en) { en.render(); });
  } else {
    // une seule boucle pour toutes les cartes ; on saute celles hors écran
    var running = true;
    if (window.IntersectionObserver) {
      var io = new IntersectionObserver(function (ents) {
        ents.forEach(function (en) {
          var match = engines.filter(function (g) { return g.card === en.target; })[0];
          if (match) match.visible = en.isIntersecting;
        });
      }, { threshold: 0 });
      engines.forEach(function (g) { io.observe(g.card); });
    }
    document.addEventListener("visibilitychange", function () { running = !document.hidden; });
    (function loop() {
      requestAnimationFrame(loop);
      if (!running) return;
      for (var i = 0; i < engines.length; i++) if (engines[i].visible) engines[i].render();
    })();
  }

  /* ================= Sélection (radiogroup) ================= */
  function select(card) {
    cards.forEach(function (c) {
      var on = c === card;
      c.setAttribute("aria-checked", String(on));
      c.tabIndex = on ? 0 : -1;
      c.closest(".plan").classList.toggle("is-selected", on);
    });
  }
  cards.forEach(function (c) {
    c.tabIndex = c.getAttribute("aria-checked") === "true" ? 0 : -1;
    c.addEventListener("click", function () { select(c); });
  });
  plans.addEventListener("keydown", function (e) {
    var i = cards.indexOf(document.activeElement);
    if (i === -1) return;
    var next;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") next = (i + 1) % cards.length;
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") next = (i - 1 + cards.length) % cards.length;
    else return;
    e.preventDefault();
    select(cards[next]);
    cards[next].focus();
  });
})();
