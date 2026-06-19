#!/usr/bin/env node
/* Règle de la galerie : tout composant (= un dossier contenant index.html)
   DOIT avoir un GIF de démo `docs/<composant>.gif` ET être référencé dans
   le README. Sans ça, ce script sort en erreur (utilisé par le hook
   pre-commit et la CI GitHub).

   Usage : node scripts/check-component-gifs.mjs
*/
import { readdirSync, existsSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const IGNORE = new Set(["docs", "scripts", "hooks", "node_modules"]);

function isComponent(name) {
  if (name.startsWith(".") || name.startsWith("_") || IGNORE.has(name)) return false;
  const p = join(ROOT, name);
  return statSync(p).isDirectory() && existsSync(join(p, "index.html"));
}

const components = readdirSync(ROOT).filter(isComponent).sort();
const readme = existsSync(join(ROOT, "README.md")) ? readFileSync(join(ROOT, "README.md"), "utf8") : "";

const problems = [];
for (const c of components) {
  const gifRel = `docs/${c}.gif`;
  if (!existsSync(join(ROOT, gifRel))) {
    problems.push(`✖ ${c} : GIF manquant — attendu \`${gifRel}\``);
  }
  if (!readme.includes(gifRel)) {
    problems.push(`✖ ${c} : le README ne référence pas \`${gifRel}\``);
  }
}

if (components.length === 0) {
  console.log("Aucun composant détecté.");
  process.exit(0);
}

if (problems.length) {
  console.error("\nRègle GIF non respectée :\n");
  console.error(problems.join("\n"));
  console.error(
    `\nChaque composant a besoin d'un GIF de démo. Générez-le (voir scripts/gen-gif.md),` +
    ` posez-le dans docs/, et ajoutez-le au README. Composants vérifiés : ${components.join(", ")}.\n`
  );
  process.exit(1);
}

console.log(`✓ Règle GIF OK — ${components.length} composant(s) avec GIF : ${components.join(", ")}`);
process.exit(0);
