# Alt-Tab Components

Petite collection de composants web **autonomes et sans dépendance** : du HTML, du CSS et du JavaScript *vanilla*, rien d'autre. Chaque composant tient dans un seul dossier, se copie-colle tel quel et fonctionne en ouvrant simplement son `index.html`. Pensés pour être réutilisés sur les sites [Alt-Tab Studio](https://github.com/lgdlcs).

> Le fil rouge : des micro-interactions **pilotées par le scroll**, fluides, accessibles, et faciles à relire (chaque moteur fait ~30 lignes).

---

## 🧩 Composants

### 1 · Pinned scrollytelling

![Pinned scrollytelling — une section figée dont le scroll pilote une narration en 3 scènes](docs/pinned-scrollytelling.gif)

Une section **épinglée** (« pinned ») dont la *progression du scroll* anime une narration en trois scènes : on dépose une photo (drag & drop + analyse IA), on explore des variantes de style, puis le portrait est encadré et livré. Reproduction pédagogique du pattern vu sur [thelma.pet](https://thelma.pet/).

- **Le pattern** : un conteneur très haut (`height: 440vh`) crée la distance de scroll ; son enfant `position: sticky; height: 100vh` reste collé pendant toute la traversée. Des calques (texte + visuel) se croisent en fondu selon le pourcentage parcouru.
- **Anti-glitch** : *tout* est une fonction pure de la position de scène `pos` (0 → 2), recalculée à chaque frame. Aucune animation déclenchée « à l'entrée » donc rien ne se rejoue ni ne se superpose en revenant en arrière : c'est entièrement réversible et déterministe.
- **Détails** : curseur macOS qui glisse la carte, scanner « Analyse IA » qui pulse (pour signifier le chargement), sélection d'une variante par une onde de clic, cadre « drag & droppé » puis redressé. Respecte `prefers-reduced-motion`.

```bash
cd pinned-scrollytelling && python3 -m http.server 8000   # puis http://localhost:8000
```

### 2 · Floating pill navbar

![Floating pill navbar — la barre se condense en pilule flottante au scroll](docs/floating-pill-navbar.gif)

Une barre de navigation pleine largeur qui se **rétracte en pilule flottante frostée** dès qu'on scrolle : largeur réduite, coins arrondis, fond *backdrop-blur*, ombre douce. On remonte en haut, elle se redéploie.

- **Le pattern** : un seuil de scroll (24 px) bascule un attribut `data-state="top" | "scrolled"`. Tout le morph est une **transition CSS** (`max-width`, `border-radius`, `backdrop-filter`, `box-shadow`…) sur cet attribut — le JS ne fait que poser le drapeau.
- **Léger** : écouteur de scroll *passif* + `requestAnimationFrame`, aucun recalcul de layout au scroll. Menu burger responsive inclus.

```bash
cd floating-pill-navbar && python3 -m http.server 8001   # puis http://localhost:8001
```

---

## 🎯 Principes communs

- **Zéro dépendance** : pas de framework, pas de bundler, pas de librairie d'animation. On ouvre, ça marche.
- **Piloté par le scroll** : écouteurs passifs + `requestAnimationFrame`, jamais de scroll-jacking (le scroll natif reste maître).
- **Accessible** : chaque composant neutralise ses animations sous `prefers-reduced-motion: reduce`.
- **Relisible** : le cœur logique de chaque composant tient dans un petit `script.js` commenté.

## 🚀 Lancer toute la galerie

```bash
python3 -m http.server 8770
# http://localhost:8770/pinned-scrollytelling/
# http://localhost:8770/floating-pill-navbar/
```

---

<sub>Pattern scrollytelling inspiré de <a href="https://thelma.pet/">thelma.pet</a>. Construit par Alt-Tab Studio.</sub>
