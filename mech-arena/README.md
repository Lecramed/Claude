# Titan Arena

3D vechtgame in de stijl van Street Fighter: bestuur een gevechtsmech en versla kaiju's en rivaliserende mechs in vijf arena's. Met de credits die je verdient koop je upgrades in de werkplaats.

Open `index.html` in een browser (Three.js wordt via cdnjs geladen, dus er is internet nodig). Voortgang wordt opgeslagen in `localStorage`.

## Besturing

| Toets | Actie |
| --- | --- |
| `A` / `D` of `←` / `→` | Lopen (naar achteren lopen = blokkeren) |
| `W` / `↑` | Springen |
| `S` / `↓` | Blokkeren |
| `J` | Lichte stoot |
| `K` | Zware stoot |
| `L` | Trap |
| `U` | Speciaal wapen (25% reactor) |
| `I` | Super-aanval (100% reactor) |
| `Esc` / `P` | Pauze |

Op een touchscreen verschijnt een zwevende joystick: raak de linkerhelft van het scherm aan en duw opzij om te lopen, omhoog om te springen en omlaag om te blokkeren. Rechts staan de aanvalsknoppen. Raakt een aanval, dan kun je hem direct afbreken in een zwaardere aanval (combo's).

## Tegenstanders

1. **Scrapjaw** (kaiju) in Rotterdam-Haven
2. **Ironclad MK-II** (mech, raketsalvo) in Basis Sahara-4
3. **Gorrath** (kaiju) in de Brandende stad
4. **Vortex** (mech, raketvuist) in Neonstad
5. **Krakatoa** (eindbaas-kaiju) in de Vulkaankrater

## Werkplaats

- **Systemen:** pantser (HP), servo's (schade), thrusters (snelheid/sprong), reactor (energie), schildgenerator (blokkeren)
- **Speciale wapens:** plasmakanon, raketsalvo, raketvuist, tesla-boog
- **Lak:** zes kleurenschema's voor je mech
