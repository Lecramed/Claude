# KEIGOED — Handbeschilderde Stenen Webshop

Een volledig statische, geanimeerde webshop over handbeschilderde stenen ("geschilderde stenen"). Gebouwd in vanilla HTML/CSS/JavaScript — geen build stap, geen dependencies.

## Bekijken

Open gewoon `index.html` in een lokale webserver, bijvoorbeeld:

```bash
python3 -m http.server 8000
# of
npx serve .
```

Ga daarna naar `http://localhost:8000`.

> Direct openen via `file://` werkt grotendeels ook, maar sommige browsers blokkeren dan `fetch`/module-achtig gedrag — een lokale server is aan te raden.

## Structuur

```
index.html      Homepage met hero, uitgelichte producten, proces & testimonials
shop.html       Volledige productcatalogus met filters, zoeken en sorteren
product.html    Productdetailpagina (?id=<product-id>)
cart.html       Winkelwagen + afreken-flow (mock, geen echte betaling)
about.html      Verhaal, proces en fotogalerij
contact.html    Contactformulier + FAQ
css/style.css   Alle styling en animaties
js/data.js      Productdata + generatieve SVG "geschilderde steen" illustraties
js/cart.js      Winkelwagenlogica (localStorage) + mini-cart drawer
js/animations.js  Scroll-reveal, parallax, 3D-tilt, custom cursor, fly-to-cart, confetti
js/main.js      Paginalogica: productgrids, filters, checkout, FAQ, contactformulier
```

## Features

- Elke steen is een **uniek gegenereerde SVG-illustratie** (natuurlijke keivorm + beschilderd patroon), geen externe afbeeldingen nodig.
- Winkelwagen met **localStorage**, mini-cart drawer, aantal-stappers en een mock-afrekenflow.
- Animaties: parallax hero, 3D tilt op productkaarten, "fly-to-cart", custom cursor, scroll-reveal, animerende brush-stroke dividers, confetti bij bestelling, en een preloader.
- Volledig responsive, met een mobiel hamburgermenu.
- `prefers-reduced-motion` wordt gerespecteerd.

## Volgende stappen (optioneel)

- Koppel een echte betaalprovider (Mollie, Stripe) aan de afreken-flow.
- Vervang de gegenereerde SVG-stenen door echte productfoto's.
- Host de site via GitHub Pages, Netlify of Vercel — het is 100% statisch.

## Sitemap 3D openen in VS Code

```bash
git clone https://github.com/lecramed/claude.git
cd claude
git checkout claude/epic-mendel-qwt7pe
code .
npm run setup          # eenmalig: installeert Playwright + Chromium
```

In VS Code staan de belangrijkste acties onder **Terminal → Run Task…**:

- *Sitemap 3D: meet vegro.nl* / *meet werkenbijvegro.nl* / *meet lokale webshop* — nieuwe meting, vergeleken met de vorige
- *Sitemap 3D: rapporten bekijken* — start een lokale server en opent `tools/sitemap-3d/report/`

Of via de terminal: `npm run crawl:vegro`, `npm run serve`, enzovoort (zie `package.json`). De steden staan in `tools/sitemap-3d/report/<site>/index.html`; zie `tools/sitemap-3d/README.md` voor alle opties.
