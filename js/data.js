/* ===================================================================
   KEIGOED — productdata + generatieve "geschilderde steen" SVG's
   Elke steen wordt on-the-fly getekend als SVG: een natuurlijke
   keivorm met een uniek beschilderd patroon erop, geclipt zodat de
   verf net echt binnen de rand van de steen blijft.
=================================================================== */

(function (global) {
  "use strict";

  /* ---------- basisvormen van de "kei" (steen) ---------- */
  const STONE_SHAPES = [
    "M40,150 C20,130 20,90 45,65 C60,45 90,30 120,35 C155,40 180,65 178,100 C176,135 150,160 115,165 C85,169 60,168 40,150 Z",
    "M35,120 C25,95 35,60 65,45 C95,30 140,35 160,60 C180,85 175,125 150,145 C125,165 85,168 60,155 C45,147 42,140 35,120 Z",
    "M30,140 C25,110 40,85 65,70 C90,55 130,50 155,65 C175,77 182,105 172,130 C162,155 130,168 95,168 C65,168 38,162 30,140 Z",
    "M55,35 C85,25 120,28 140,50 C160,72 165,110 155,140 C145,168 110,178 80,170 C50,162 32,135 32,100 C32,72 38,45 55,35 Z"
  ];

  const STONE_BASES = [
    { base: "#e3dccd", base2: "#c9bea6" }, // warm zand
    { base: "#d7dbd6", base2: "#b9c0b8" }, // koel grijs
    { base: "#e6d9bd", base2: "#cdb98f" }, // zandsteen
    { base: "#cfd5da", base2: "#aab3ba" }  // leisteen
  ];

  let uidCounter = 0;

  function polar(cx, cy, r, deg) {
    const a = (deg * Math.PI) / 180;
    return [+(cx + Math.cos(a) * r).toFixed(1), +(cy + Math.sin(a) * r).toFixed(1)];
  }

  /* ---------- geverfde patronen (elk rond punt 100,100) ---------- */
  const PATTERNS = {
    mandala(p) {
      const [c1, c2, c3] = p;
      let dots = "";
      for (let i = 0; i < 12; i++) {
        const [x, y] = polar(100, 100, 42, i * 30);
        dots += `<circle cx="${x}" cy="${y}" r="4.2" fill="${c3}"/>`;
      }
      for (let i = 0; i < 8; i++) {
        const [x, y] = polar(100, 100, 58, i * 45 + 22.5);
        dots += `<circle cx="${x}" cy="${y}" r="3" fill="${c2}"/>`;
      }
      let petals = "";
      for (let i = 0; i < 8; i++) {
        const [x, y] = polar(100, 100, 28, i * 45);
        petals += `<ellipse cx="${x}" cy="${y}" rx="9" ry="5" fill="${c2}" transform="rotate(${i * 45} ${x} ${y})"/>`;
      }
      return `
        <circle cx="100" cy="100" r="60" fill="none" stroke="${c1}" stroke-width="2.5"/>
        <circle cx="100" cy="100" r="45" fill="none" stroke="${c2}" stroke-width="2"/>
        ${petals}
        <circle cx="100" cy="100" r="13" fill="${c1}"/>
        <circle cx="100" cy="100" r="6" fill="${c3}"/>
        ${dots}`;
    },
    owl(p) {
      const [body, wing, eye] = p;
      return `
        <ellipse cx="100" cy="112" rx="34" ry="40" fill="${body}"/>
        <path d="M70,105 Q100,140 130,105 Q124,130 100,132 Q76,130 70,105 Z" fill="${wing}"/>
        <circle cx="86" cy="88" r="14" fill="#fff"/>
        <circle cx="114" cy="88" r="14" fill="#fff"/>
        <circle cx="86" cy="88" r="6" fill="${eye}"/>
        <circle cx="114" cy="88" r="6" fill="${eye}"/>
        <path d="M96,96 L100,104 L104,96 Z" fill="#e0913f"/>
        <path d="M74,74 L84,82 L68,84 Z" fill="${body}"/>
        <path d="M126,74 L116,82 L132,84 Z" fill="${body}"/>
        <path d="M90,124 h20 M84,132 h32" stroke="${wing}" stroke-width="3" fill="none" stroke-linecap="round"/>`;
    },
    ladybug(p) {
      const [red, black, white] = p;
      let spots = "";
      const pos = [[-14, -5], [14, -5], [-18, 15], [18, 15], [0, 22], [-6, -18], [6, -18]];
      pos.forEach(([dx, dy]) => (spots += `<circle cx="${100 + dx}" cy="${100 + dy}" r="5.5" fill="${black}"/>`));
      return `
        <ellipse cx="100" cy="100" rx="38" ry="34" fill="${red}"/>
        <line x1="100" y1="68" x2="100" y2="132" stroke="${black}" stroke-width="3"/>
        <path d="M64,88 a38,34 0 0 1 0,-4 Z" fill="${black}"/>
        <circle cx="100" cy="70" r="12" fill="${black}"/>
        <circle cx="94" cy="65" r="2.5" fill="${white}"/>
        <circle cx="106" cy="65" r="2.5" fill="${white}"/>
        ${spots}`;
    },
    fox(p) {
      const [orange, white, dark] = p;
      return `
        <path d="M100,60 L128,90 L118,130 Q100,145 82,130 L72,90 Z" fill="${orange}"/>
        <path d="M84,110 Q100,128 116,110 L110,132 Q100,140 90,132 Z" fill="${white}"/>
        <path d="M76,66 L92,86 L70,88 Z" fill="${orange}"/>
        <path d="M124,66 L108,86 L130,88 Z" fill="${orange}"/>
        <path d="M80,72 L90,84 L74,84 Z" fill="${dark}"/>
        <path d="M120,72 L110,84 L126,84 Z" fill="${dark}"/>
        <ellipse cx="90" cy="98" rx="5" ry="6" fill="${dark}"/>
        <ellipse cx="110" cy="98" rx="5" ry="6" fill="${dark}"/>
        <path d="M100,108 L94,116 L106,116 Z" fill="${dark}"/>
        <path d="M100,116 Q100,122 108,120" stroke="${dark}" stroke-width="2.5" fill="none" stroke-linecap="round"/>`;
    },
    hedgehog(p) {
      const [brown, cream, spike] = p;
      let spikes = "";
      for (let i = 0; i < 14; i++) {
        const [x1, y1] = polar(102, 92, 32, 200 + i * 11);
        const [x2, y2] = polar(102, 92, 46, 200 + i * 11);
        spikes += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${spike}" stroke-width="4" stroke-linecap="round"/>`;
      }
      return `
        ${spikes}
        <ellipse cx="102" cy="92" rx="34" ry="30" fill="${spike}"/>
        <ellipse cx="82" cy="112" rx="26" ry="20" fill="${cream}"/>
        <path d="M60,102 L48,96 L58,90 Z" fill="${brown}"/>
        <circle cx="55" cy="98" r="3.5" fill="#2f2a26"/>`;
    },
    bird(p) {
      const [blue, belly, beak] = p;
      return `
        <ellipse cx="100" cy="108" rx="34" ry="30" fill="${blue}"/>
        <ellipse cx="92" cy="122" rx="20" ry="14" fill="${belly}"/>
        <circle cx="112" cy="90" r="6" fill="#fff"/>
        <circle cx="113" cy="90" r="2.5" fill="#2f2a26"/>
        <path d="M124,92 L136,96 L124,100 Z" fill="${beak}"/>
        <path d="M74,104 Q60,110 66,124 Q78,120 80,108 Z" fill="${blue}"/>
        <path d="M76,138 L80,128 L86,138 M96,140 L100,130 L104,140" stroke="${beak}" stroke-width="3" fill="none" stroke-linecap="round"/>`;
    },
    cactus(p) {
      const [green, dark, flower, pot] = p;
      return `
        <rect x="70" y="140" width="60" height="22" rx="4" fill="${pot}"/>
        <path d="M90,145 C80,145 78,120 88,105 C82,102 80,86 90,80 C90,120 90,120 100,145 Z" fill="${green}"/>
        <path d="M100,145 C96,110 100,70 100,60 C104,70 108,110 104,145 Z" fill="${green}"/>
        <path d="M110,145 C120,145 122,124 112,112 C118,110 120,98 112,92 C112,120 112,120 100,145 Z" fill="${green}"/>
        <g stroke="${dark}" stroke-width="1.6" opacity="0.7">
          <path d="M96,70 v70 M108,90 v50 M84,110 v30"/>
        </g>
        <circle cx="100" cy="58" r="7" fill="${flower}"/>
        <circle cx="90" cy="80" r="4" fill="${flower}"/>`;
    },
    flower(p) {
      const [petal, center, leaf] = p;
      let petals = "";
      for (let i = 0; i < 6; i++) {
        const [x, y] = polar(100, 95, 22, i * 60);
        petals += `<ellipse cx="${x}" cy="${y}" rx="14" ry="9" fill="${petal}" transform="rotate(${i * 60} ${x} ${y})"/>`;
      }
      return `
        <path d="M100,120 Q90,140 100,160" stroke="${leaf}" stroke-width="4" fill="none" stroke-linecap="round"/>
        <ellipse cx="88" cy="140" rx="10" ry="5" fill="${leaf}" transform="rotate(-30 88 140)"/>
        ${petals}
        <circle cx="100" cy="95" r="13" fill="${center}"/>`;
    },
    mushroom(p) {
      const [cap, spot, stem] = p;
      let spots = "";
      [[-12, -4], [10, -6], [0, -14], [-4, 4], [16, 2]].forEach(([dx, dy]) => {
        spots += `<circle cx="${100 + dx}" cy="${80 + dy}" r="4.5" fill="${spot}"/>`;
      });
      return `
        <rect x="86" y="100" width="28" height="42" rx="10" fill="${stem}"/>
        <path d="M60,90 Q100,50 140,90 Q120,102 100,102 Q80,102 60,90 Z" fill="${cap}"/>
        ${spots}`;
    },
    waves(p) {
      const [dark, mid, light] = p;
      return `
        <path d="M40,150 Q60,135 80,150 T120,150 T160,150 V172 H40 Z" fill="${dark}"/>
        <path d="M35,128 Q55,113 75,128 T115,128 T155,128 V150 H35 Z" fill="${mid}"/>
        <path d="M32,106 Q52,91 72,106 T112,106 T152,106 V128 H32 Z" fill="${light}"/>
        <circle cx="130" cy="72" r="12" fill="#f4d35e"/>`;
    },
    heart(p) {
      const [red, light] = p;
      return `
        <path d="M100,132 C60,104 66,72 92,72 C98,72 100,78 100,82 C100,78 102,72 108,72 C134,72 140,104 100,132 Z" fill="${red}"/>
        <path d="M78,90 C80,84 86,80 92,82" stroke="${light}" stroke-width="3" fill="none" stroke-linecap="round" opacity="0.7"/>`;
    },
    sun(p) {
      const [core, ray] = p;
      let rays = "";
      for (let i = 0; i < 12; i++) {
        const [x1, y1] = polar(100, 100, 40, i * 30);
        const [x2, y2] = polar(100, 100, 56, i * 30);
        rays += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${ray}" stroke-width="5" stroke-linecap="round"/>`;
      }
      return `${rays}<circle cx="100" cy="100" r="32" fill="${core}"/>
        <circle cx="90" cy="94" r="4" fill="#fff" opacity="0.6"/>`;
    },
    moonstars(p) {
      const [bg, moon, star] = p;
      let stars = "";
      [[64, 70], [138, 60], [128, 118], [58, 118], [100, 140]].forEach(([x, y], i) => {
        stars += `<path transform="translate(${x} ${y}) scale(${i % 2 ? 0.7 : 1})" d="M0,-6 L1.8,-1.8 L6,0 L1.8,1.8 L0,6 L-1.8,1.8 L-6,0 L-1.8,-1.8 Z" fill="${star}"/>`;
      });
      return `
        <rect x="30" y="30" width="140" height="140" fill="${bg}"/>
        <circle cx="106" cy="92" r="30" fill="${moon}"/>
        <circle cx="118" cy="82" r="26" fill="${bg}"/>
        ${stars}`;
    },
    butterfly(p) {
      const [wing, wing2, body] = p;
      return `
        <path d="M100,100 C70,60 40,70 44,100 C40,130 70,140 100,105 Z" fill="${wing}"/>
        <path d="M100,100 C130,60 160,70 156,100 C160,130 130,140 100,105 Z" fill="${wing}"/>
        <path d="M100,102 C80,80 62,86 66,102 C64,118 82,124 100,106 Z" fill="${wing2}"/>
        <path d="M100,102 C120,80 138,86 134,102 C136,118 118,124 100,106 Z" fill="${wing2}"/>
        <line x1="100" y1="75" x2="100" y2="130" stroke="${body}" stroke-width="5" stroke-linecap="round"/>
        <path d="M100,78 L92,66 M100,78 L108,66" stroke="${body}" stroke-width="2.5" fill="none" stroke-linecap="round"/>`;
    },
    star(p) {
      const [c1, c2] = p;
      let pts = [];
      for (let i = 0; i < 10; i++) {
        const r = i % 2 === 0 ? 55 : 24;
        pts.push(polar(100, 100, r, i * 36 - 90).join(","));
      }
      return `<polygon points="${pts.join(" ")}" fill="${c1}"/>
        <polygon points="${pts.join(" ")}" fill="none" stroke="${c2}" stroke-width="3" stroke-dasharray="4 6"/>`;
    }
  };

  /* ---------- render één "geschilderde steen" SVG ---------- */
  function stoneSVG(pattern, palette, seed = 0) {
    const uid = "s" + uidCounter++;
    const shape = STONE_SHAPES[seed % STONE_SHAPES.length];
    const stoneBase = STONE_BASES[seed % STONE_BASES.length];
    const patternFn = PATTERNS[pattern] || PATTERNS.mandala;
    return `
<svg viewBox="0 0 200 200" class="stone-svg" role="img" aria-hidden="true">
  <defs>
    <linearGradient id="grad-${uid}" x1="0" y1="0" x2="0.3" y2="1">
      <stop offset="0%" stop-color="${stoneBase.base}"/>
      <stop offset="100%" stop-color="${stoneBase.base2}"/>
    </linearGradient>
    <radialGradient id="shine-${uid}" cx="32%" cy="24%" r="55%">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.55"/>
      <stop offset="100%" stop-color="#ffffff" stop-opacity="0"/>
    </radialGradient>
    <clipPath id="clip-${uid}"><path d="${shape}"/></clipPath>
  </defs>
  <ellipse cx="102" cy="180" rx="66" ry="10" fill="#2f2a26" opacity="0.10"/>
  <path d="${shape}" fill="url(#grad-${uid})" stroke="${stoneBase.base2}" stroke-width="2"/>
  <g clip-path="url(#clip-${uid})">${patternFn(palette)}</g>
  <path d="${shape}" fill="url(#shine-${uid})"/>
</svg>`.trim();
  }

  /* ---------- productcatalogus ---------- */
  const PRODUCTS = [
    { id: "uiltje-oker", name: "Uiltje bij Maanlicht", category: "Dieren", price: 18.5, pattern: "owl", palette: ["#c98a4b", "#5a3d2b", "#2f2a26"], seed: 0, rating: 4.9, reviews: 132, badge: "bestseller", desc: "Een wijs uiltje, met de hand beschilderd op een gladde rivierkei. Elk exemplaar is uniek en afgewerkt met een mat, weerbestendig vernislaagje." },
    { id: "lieveheersbeestje-rood", name: "Vrolijk Lieveheersbeestje", category: "Dieren", price: 14.95, pattern: "ladybug", palette: ["#d94f3d", "#2f2a26", "#fff"], seed: 1, rating: 4.8, reviews: 98, badge: "nieuw", desc: "Klein, kleurrijk en altijd goed gehumeurd — dit lieveheersbeestje brengt geluk in je tuin of op je vensterbank." },
    { id: "vosje-oranje", name: "Sluw Vosje", category: "Dieren", price: 19.5, pattern: "fox", palette: ["#e0793a", "#fdf6ec", "#2f2a26"], seed: 2, rating: 5, reviews: 61, desc: "Een pientere vos met een zachte blik, volledig met de hand geschilderd. Een echte blikvanger tussen je planten." },
    { id: "egeltje-bruin", name: "Prikkelig Egeltje", category: "Dieren", price: 17.5, pattern: "hedgehog", palette: ["#8a6a4a", "#f3e6cf", "#5c4530"], seed: 3, rating: 4.7, reviews: 44, desc: "Zacht van vorm, prikkelig van uiterlijk: dit egeltje is een lieve toevoeging aan elke stenen- of plantenverzameling." },
    { id: "vogeltje-blauw", name: "Blij Vogeltje", category: "Dieren", price: 15.5, pattern: "bird", palette: ["#5b8fb0", "#f4c95d", "#e0793a"], seed: 0, rating: 4.9, reviews: 77, badge: "nieuw", desc: "Een fleurig vogeltje dat het hele jaar door zingt, geschilderd op een stevige kei voor buiten of binnen." },
    { id: "mandala-zonsondergang", name: "Mandala Zonsondergang", category: "Mandala's", price: 22.5, pattern: "mandala", palette: ["#e0793a", "#f4c95d", "#c9503c"], seed: 1, rating: 5, reviews: 154, badge: "bestseller", desc: "Een fijn gedetailleerd mandalapatroon in warme zonsondergangtinten. Rustgevend om naar te kijken, perfect als cadeau." },
    { id: "mandala-oceaan", name: "Mandala Oceaan", category: "Mandala's", price: 22.5, pattern: "mandala", palette: ["#4f86a8", "#8fc1d9", "#2f5f78"], seed: 2, rating: 4.9, reviews: 89, desc: "Kalme blauwtinten in een symmetrisch mandalapatroon — als een golf van rust op je vensterbank." },
    { id: "mandala-bloesem", name: "Mandala Bloesem", category: "Mandala's", price: 22.5, pattern: "mandala", palette: ["#d685a0", "#f2b6c6", "#a3486a"], seed: 3, rating: 4.8, reviews: 66, desc: "Zachtroze mandala geïnspireerd op kersenbloesem. Een klein kunstwerkje van steen." },
    { id: "cactus-bloei", name: "Cactus in Bloei", category: "Natuur", price: 16.5, pattern: "cactus", palette: ["#6a9b6e", "#3f6b46", "#e07a9b", "#b5652f"], seed: 0, rating: 4.7, reviews: 52, desc: "Een vrolijke cactus met een roze bloem — onderhoudsvrije 'plant' die nooit water nodig heeft." },
    { id: "bloem-roze", name: "Roze Voorjaarsbloem", category: "Natuur", price: 15, pattern: "flower", palette: ["#e693b0", "#f4c95d", "#6a9b6e"], seed: 1, rating: 4.9, reviews: 71, badge: "nieuw", desc: "Een sierlijke bloem in zachte kleuren, symbool voor het voorjaar. Mooi in een schaal met andere stenen." },
    { id: "paddenstoel-rood", name: "Sprookjes Paddenstoel", category: "Natuur", price: 14.5, pattern: "mushroom", palette: ["#d9483c", "#fff8ec", "#e6d3ab"], seed: 2, rating: 4.8, reviews: 103, badge: "bestseller", desc: "Een klassieke rood-witte paddenstoel, alsof hij zo uit een sprookjesbos is geplukt." },
    { id: "golven-blauw", name: "Golven van de Zee", category: "Natuur", price: 17, pattern: "waves", palette: ["#2f5f78", "#4f86a8", "#a9d3e5"], seed: 3, rating: 4.9, reviews: 39, desc: "Rustgevende zeegolven onder een gouden zon — een herinnering aan de zomer, het hele jaar door." },
    { id: "maan-sterren", name: "Maan & Sterren", category: "Cadeaustenen", price: 19.95, pattern: "moonstars", palette: ["#2a2f4a", "#f4e9c9", "#f4c95d"], seed: 0, rating: 5, reviews: 118, badge: "bestseller", desc: "Een dromerige sterrenhemel met een volle maan, met de hand geschilderd op een gladde kei." },
    { id: "hart-liefde", name: "Hart vol Liefde", category: "Cadeaustenen", price: 13.5, pattern: "heart", palette: ["#c9503c", "#f2b6c6"], seed: 1, rating: 4.9, reviews: 142, desc: "Een lief hartje, perfect als klein cadeautje of als steun-steentje voor iemand die het nodig heeft." },
    { id: "zon-stralend", name: "Stralende Zon", category: "Cadeaustenen", price: 16, pattern: "sun", palette: ["#f4c95d", "#e0793a"], seed: 2, rating: 4.7, reviews: 58, desc: "Een stralende zon die altijd goed humeur uitstraalt — mooi op het bureau of in de vensterbank." },
    { id: "cadeauset-dieren", name: "Cadeauset Dieren Trio", category: "Cadeaustenen", price: 42, pattern: "owl", palette: ["#c98a4b", "#5a3d2b", "#2f2a26"], seed: 0, rating: 5, reviews: 27, badge: "set", desc: "Set van 3 handbeschilderde dierenstenen (uil, vos en vogeltje) in een leuke geschenkverpakking." },
    { id: "cadeauset-mandalas", name: "Cadeauset Mandala Duo", category: "Cadeaustenen", price: 39, pattern: "mandala", palette: ["#e0793a", "#f4c95d", "#c9503c"], seed: 1, rating: 4.9, reviews: 19, badge: "set", desc: "Set van 2 mandala-stenen in bijpassende kleuren — samen een klein kunstwerk voor je vensterbank." },
    { id: "vlinder-paars", name: "Paarse Vlinder", category: "Kinderstenen", price: 15.5, pattern: "butterfly", palette: ["#9b6fb0", "#c9a3d9", "#4a2f5c"], seed: 2, rating: 4.8, reviews: 84, desc: "Een fladderende vlinder in vrolijke paarstinten — favoriet bij de allerkleinsten." },
    { id: "vlinder-blauw", name: "Blauwe Vlinder", category: "Kinderstenen", price: 15.5, pattern: "butterfly", palette: ["#5b8fb0", "#a9d3e5", "#2f4a5c"], seed: 3, rating: 4.7, reviews: 46, badge: "nieuw", desc: "Dezelfde fladderende vriendin, nu in fris blauw. Leuk om te sparen of samen te geven." },
    { id: "ster-regenboog", name: "Regenboog Ster", category: "Kinderstenen", price: 12.5, pattern: "star", palette: ["#e0793a", "#f4c95d"], seed: 0, rating: 4.9, reviews: 63, desc: "Een stralende ster in vrolijke kleuren — een klein cadeautje dat grote glimlachen geeft." },
    { id: "egeltje-mini", name: "Mini Egeltje", category: "Kinderstenen", price: 11.5, pattern: "hedgehog", palette: ["#a9855f", "#fbeedd", "#6b4e33"], seed: 1, rating: 4.8, reviews: 35, desc: "Een schattig mini-egeltje, perfect formaat voor kleine handjes en kleine cadeautjes." }
  ];

  PRODUCTS.forEach((p) => {
    p.material = "Rivierkei · acrylverf · mat, UV- en waterbestendig vernislaagje";
    p.size = "± 5 – 9 cm (ieder exemplaar is uniek van vorm)";
    p.svg = stoneSVG(p.pattern, p.palette, p.seed);
  });

  const CATEGORIES = ["Dieren", "Mandala's", "Natuur", "Cadeaustenen", "Kinderstenen"];

  function getProductById(id) {
    return PRODUCTS.find((p) => p.id === id);
  }

  function formatPrice(n) {
    return "€ " + n.toFixed(2).replace(".", ",");
  }

  global.KEIGOED = global.KEIGOED || {};
  global.KEIGOED.PRODUCTS = PRODUCTS;
  global.KEIGOED.CATEGORIES = CATEGORIES;
  global.KEIGOED.getProductById = getProductById;
  global.KEIGOED.formatPrice = formatPrice;
  global.KEIGOED.stoneSVG = stoneSVG;
})(window);
