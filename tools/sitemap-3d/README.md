# Sitemap 3D

Een 3D-weergave van de sitemap van de site, met per pagina een screenshot, het paginagewicht en de verschillen met de vorige meting.

## Meting uitvoeren

```bash
node tools/sitemap-3d/crawl.cjs                       # lokale bestanden in deze repo
node tools/sitemap-3d/crawl.cjs --url https://jouw-domein.nl   # live site
```

Vereist Node 18+ en Playwright met Chromium (`npm i -g playwright && npx playwright install chromium` als je het nog niet hebt).

Elke meting:

1. Begint bij de homepage en volgt alle interne links (ook links die JavaScript toevoegt, zoals productkaarten).
2. Laadt elke pagina met een lege cache (1280×800) en meet:
   - **Gewicht**: bytes over het netwerk, per type (HTML, CSS, JS, afbeeldingen, fonts, overig), inclusief externe bestanden zoals Google Fonts
   - aantal requests, DOM-elementen, inline SVG's en paginahoogte
3. Maakt een screenshot van het zichtbare deel en van de volledige pagina.
4. Vergelijkt met de **vorige meting** in `runs/`: verschil in gewicht per type, requests, DOM, en een pixelvergelijking van de screenshots (met een verschilbeeld).
5. Schrijft `report/index.html`: open die in de browser (via een lokale server of rechtstreeks).

Opties: `--root <map>`, `--label <naam>`, `--max <aantal pagina's>`, `--keep-query id` (welke query-parameters een aparte pagina vormen; standaard alleen `id`, zodat `shop.html?categorie=…` niet als losse pagina telt).

## Bestanden

```
crawl.cjs         crawler + metingen + vergelijking
build-report.cjs  bouwt report/ uit de laatste meting (los te draaien: node build-report.cjs [run-id])
template.html     de 3D-weergave (three.js)
runs/<datum>/     run.json + screenshots per meting; commit deze map, dan blijft "vorige keer" bewaard
report/           gegenereerd rapport
```

## Lezen van de 3D-weergave

- De homepage staat in het midden; elke ring is een niveau dieper in de site.
- De **hoogte van de zuil** is het paginagewicht; het **zwarte ringetje** op de zuil is het gewicht bij de vorige meting.
- Kleur: rood = zwaarder of gewijzigd, groen = lichter, grijs = ongewijzigd, paars = nieuwe pagina, doorschijnend = verwijderde pagina.
- Klik op een pagina (of een rij in de tabel) voor details: gewichtsverdeling, verschillen, en de screenshot als *Nu*, *Vorige* of *Verschil* (gewijzigde pixels in magenta).
