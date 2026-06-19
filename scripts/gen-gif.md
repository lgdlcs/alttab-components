# Générer le GIF de démo d'un composant

La galerie impose **un GIF par composant** (`docs/<composant>.gif`), vérifié par
`scripts/check-component-gifs.mjs` (hook pre-commit + CI). La génération n'est
**pas** automatisée (elle a besoin d'un navigateur, parfois d'un GPU, et de
capter une interaction) ; voici la recette.

## 1. Servir la galerie

```bash
python3 -m http.server 8770   # depuis la racine du repo
```

## 2. Capturer des frames pendant l'interaction (Playwright)

Pilotez le composant et enregistrez ~30 captures de l'élément qui bouge. Pour un
composant **WebGL** (ex. `glitch-plan-cards`), lancez un Chromium avec
SwiftShader pour que le rendu marche même sans GPU :

```js
// gen-frames.cjs — node gen-frames.cjs
const { chromium } = require("playwright-core");
const fs = require("fs");
(async () => {
  fs.rmSync("/tmp/frames", { recursive: true, force: true });
  fs.mkdirSync("/tmp/frames");
  const browser = await chromium.launch({
    headless: true,
    args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
  });
  const page = await browser.newPage({ viewport: { width: 1180, height: 660 } });
  await page.goto("http://localhost:8770/glitch-plan-cards/", { waitUntil: "load" });
  await page.waitForTimeout(1700);
  const box = await page.locator(".card").nth(2).boundingBox();
  for (let i = 0; i < 30; i++) {
    const a = (i / 30) * Math.PI * 4;
    const x = box.x + box.width * (0.5 + 0.34 * Math.cos(a));
    const y = box.y + box.height * (0.5 + 0.34 * Math.sin(a * 1.3));
    await page.mouse.move(x, y, { steps: 1 });
    await page.mouse.move(x + 6, y - 6, { steps: 1 });
    await page.locator("#plans").screenshot({ path: `/tmp/frames/f${String(i).padStart(3, "0")}.png` });
  }
  await browser.close();
})();
```

```bash
NODE_PATH=~/.claude/skills/gstack/node_modules node gen-frames.cjs
```

(Pour un composant **piloté au scroll**, remplacez les `mouse.move` par des
`page.mouse.wheel(0, dy)` ou `page.evaluate(() => scrollTo(...))`.)

## 3. Assembler le GIF (ffmpeg)

```bash
ffmpeg -y -framerate 14 -i /tmp/frames/f%03d.png \
  -vf "scale=820:-1:flags=lanczos,split[s0][s1];[s0]palettegen=stats_mode=diff[p];[s1][p]paletteuse=dither=bayer:bayer_scale=3" \
  docs/<composant>.gif
```

## 4. Référencer dans le README

Ajoutez `![…](docs/<composant>.gif)` dans la section du composant, puis commitez.
Le hook / la CI passeront au vert.
