/* ===== Sitemap-stad (three.js), in kaartstijl =====
   Elke pagina is een gebouw. De homepage staat als toren in het park in het midden;
   elke sectie (pagina op niveau 1) krijgt een dwarsstraat aan de boulevard, met alle
   onderliggende pagina's als gebouwen langs die straat.
   Stijl: egale, licht steenkleurige blokken met getrapte vormen, witte wegen met
   straatnamen op het wegdek, lichtgroene parken, schuin bovenaanzicht.
   Hoogte = paginagewicht (lineair), dakkleur = verschil met de vorige meting,
   gevelpaneel = screenshot. Rijden: pijltjes/WASD, Shift = turbo, C = camera. */
import * as THREE from "three";

const R = window.REPORT, U = window.UTIL;
const stage = document.getElementById("stage");
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
const css = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const isDark = () => {
  const t = document.documentElement.getAttribute("data-theme");
  return t ? t === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
};

/* kaartpalet: licht (dag) en donker (nacht) */
const PAL = {
  light: { ground: "#f1efe6", park: "#dcebcf", parkEdge: "#b9d1a6", road: "#fdfdfb", kerb: "#c9c7bd", walk: "#e9e7df", walkDot: "#bdbab0",
    wall: "#d8d3c4", roof: "#ebe7da", label: "#7d7a58", labelHalo: "#ffffff", ink: "#3d3a2f", tree: "#9fc28a", fog: "#f1efe6" },
  dark: { ground: "#1b1f23", park: "#1f2a22", parkEdge: "#2e3d31", road: "#2c3238", kerb: "#3e464d", walk: "#252a2f", walkDot: "#3c444b",
    wall: "#4a4f55", roof: "#5c6168", label: "#a9ad8e", labelHalo: "#14171a", ink: "#e1e3d8", tree: "#3e5a3a", fog: "#1b1f23" }
};
let P = isDark() ? PAL.dark : PAL.light;

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.domElement.tabIndex = 0;
renderer.domElement.setAttribute("aria-label", "Sitemap-stad. Gebruik de pijltjestoetsen of WASD om te rijden.");
stage.prepend(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(38, 1, 1, 4000);
// zacht licht van boven, één kant duidelijk donkerder (zoals op de kaart)
const ambient = new THREE.AmbientLight(0xffffff, 1.15); scene.add(ambient);
const sun = new THREE.DirectionalLight(0xffffff, 1.9); sun.position.set(-160, 260, 110); scene.add(sun);
const fill = new THREE.DirectionalLight(0xffffff, 0.35); fill.position.set(120, 80, -60); scene.add(fill);

/* ---------- stadsplan ---------- */
const all = [...R.pages, ...R.removed.map((r) => ({ ...r, weight: { transfer: r.transfer }, dom: {} }))];
const byKey = new Map(all.map((p) => [p.key, p]));
const root = R.pages.find((p) => !p.parent) || R.pages[0];
const kids = new Map();
all.forEach((p) => {
  if (p === root) return;
  const par = p.parent && byKey.has(p.parent) ? p.parent : root.key;
  (kids.get(par) || kids.set(par, []).get(par)).push(p);
});
const descendants = (p) => { const out = []; const walk = (q) => (kids.get(q.key) || []).forEach((c) => { out.push(c); walk(c); }); walk(p); return out; };
/* straten: door de rapportbouwer ingedeeld op URL-pad; anders één straat per sectie uit de linkboom */
let sections;
if (all.some((p) => p.street)) {
  const g = new Map();
  all.forEach((p) => { if (p === root || !p.street) return; const [k, name] = p.street; (g.get(k) || g.set(k, { key: k, name, list: [] }).get(k)).list.push(p); });
  sections = [...g.values()].sort((a, b) => (a.key.startsWith("~") ? 1 : 0) - (b.key.startsWith("~") ? 1 : 0) || b.list.length - a.list.length || a.key.localeCompare(b.key));
  sections.forEach((s) => s.list.sort((a, b) => a.key.length - b.key.length || a.key.localeCompare(b.key)));
} else {
  sections = (kids.get(root.key) || []).slice().sort((a, b) => a.key.localeCompare(b.key)).map((s) => ({ key: s.key, name: s.name || s.key, list: [s, ...descendants(s)] }));
}

const PLAZA_R = 46, ROAD_W = 13, LOT = 17, SET = 17; // park, straatbreedte, kavelafstand, afstand gebouw–as
const GAP = 66; // afstand tussen twee dwarsstraten
const lots = [], streets = [];
const maxKB = Math.max(...all.map((p) => p.weight.transfer / 1024));
const hOf = (b) => 10 + (b / 1024 / maxKB) * 90; // lineair boven een vaste begane grond van 10

lots.push({ p: root, x: 0, z: 0, rot: 0, tower: true });
let east = 0, west = 0;
sections.forEach((s, i) => {
  const sideX = i % 2 === 0 ? 1 : -1;
  const k = sideX > 0 ? east++ : west++;
  const sx = sideX * (PLAZA_R + 44 + k * GAP);
  const list = s.list;
  const north = list.slice(0, Math.ceil(list.length / 2)), south = list.slice(Math.ceil(list.length / 2));
  const place = (arr, dirZ) => arr.forEach((p, j) => {
    const along = ROAD_W / 2 + 14 + Math.floor(j / 2) * LOT;
    const side = j % 2 ? 1 : -1;
    lots.push({ p, x: sx + side * SET, z: dirZ * along, rot: -side * Math.PI / 2, section: s.key });
  });
  place(north, -1); place(south, 1);
  const len = (arr) => (arr.length ? ROAD_W / 2 + 14 + Math.floor((arr.length - 1) / 2) * LOT + 18 : ROAD_W / 2);
  streets.push({ x: sx, z0: -len(north), z1: len(south), key: s.key, name: s.name });
});
const xs = streets.map((s) => s.x);
const bx0 = Math.min(-PLAZA_R, ...xs) - 40, bx1 = Math.max(PLAZA_R, ...xs) + 40;
const bz0 = Math.min(-PLAZA_R, ...streets.map((s) => s.z0)) - 30, bz1 = Math.max(PLAZA_R, ...streets.map((s) => s.z1)) + 30;

/* ---------- grond, parken, wegen ---------- */
const mats = {
  ground: new THREE.MeshLambertMaterial(), park: new THREE.MeshLambertMaterial(), road: new THREE.MeshLambertMaterial(),
  kerb: new THREE.MeshBasicMaterial(), walk: new THREE.MeshLambertMaterial(), tree: new THREE.MeshLambertMaterial(),
  wall: new THREE.MeshLambertMaterial(), parkEdge: new THREE.LineDashedMaterial({ dashSize: 1.4, gapSize: 1.2 })
};
const flat = (geo, mat, x, y, z, ry = 0) => {
  const m = new THREE.Mesh(geo, mat); m.rotation.x = -Math.PI / 2;
  const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = ry; g.add(m); scene.add(g); return g;
};
flat(new THREE.PlaneGeometry(6000, 6000), mats.ground, 0, 0, 0);

function dashedOutline(pts, y) {
  const g = new THREE.BufferGeometry().setFromPoints(pts.map(([x, z]) => new THREE.Vector3(x, y, z)));
  const l = new THREE.Line(g, mats.parkEdge); l.computeLineDistances(); scene.add(l);
}
function park(x0, z0, x1, z1) {
  flat(new THREE.PlaneGeometry(Math.abs(x1 - x0), Math.abs(z1 - z0)), mats.park, (x0 + x1) / 2, 0.02, (z0 + z1) / 2);
  dashedOutline([[x0 + 1, z0 + 1], [x1 - 1, z0 + 1], [x1 - 1, z1 - 1], [x0 + 1, z1 - 1], [x0 + 1, z0 + 1]], 0.05);
}
// middenpark rond de toren
flat(new THREE.CircleGeometry(PLAZA_R - ROAD_W / 2, 72), mats.park, 0, 0.02, 0);
{
  const pts = []; for (let i = 0; i <= 96; i++) { const a = (i / 96) * Math.PI * 2; pts.push([Math.cos(a) * (PLAZA_R - ROAD_W / 2 - 4), Math.sin(a) * (PLAZA_R - ROAD_W / 2 - 4)]); }
  dashedOutline(pts, 0.05);
}
// parken aan het eind van korte straten en tussen de straten
streets.forEach((s, i) => {
  const neighbours = xs.filter((x) => x !== s.x).map((x) => Math.abs(x - s.x));
  const w = Math.min(GAP, ...neighbours) - 8;
  if (s.z1 < 120) park(s.x - w / 2, s.z1 + 6, s.x + w / 2, s.z1 + 6 + 46 + (i % 3) * 14);
  if (-s.z0 < 120) park(s.x - w / 2, s.z0 - 6 - 40 - (i % 2) * 18, s.x + w / 2, s.z0 - 6);
});

function road(x0, z0, x1, z1, y = 0.06) {
  const L = Math.hypot(x1 - x0, z1 - z0); if (L < 1) return;
  const ry = Math.atan2(x1 - x0, z1 - z0), cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
  flat(new THREE.PlaneGeometry(ROAD_W + 0.8, L + 0.8), mats.kerb, cx, y - 0.01, cz, ry); // dunne stoeprandlijn
  flat(new THREE.PlaneGeometry(ROAD_W, L), mats.road, cx, y, cz, ry);
}
function sidewalk(x0, z0, x1, z1) {
  const L = Math.hypot(x1 - x0, z1 - z0); if (L < 2) return;
  flat(new THREE.PlaneGeometry(4, L), mats.walk, (x0 + x1) / 2, 0.035, (z0 + z1) / 2, Math.atan2(x1 - x0, z1 - z0));
}
const half = ROAD_W / 2, walkOff = half + 2.4;
// ringweg om het park
flat(new THREE.RingGeometry(PLAZA_R - half - 0.4, PLAZA_R + half + 0.4, 128), mats.kerb, 0, 0.05, 0);
flat(new THREE.RingGeometry(PLAZA_R - half, PLAZA_R + half, 128), mats.road, 0, 0.06, 0);
// boulevard en dwarsstraten
road(PLAZA_R, 0, bx1 - 14, 0); road(-PLAZA_R, 0, bx0 + 14, 0);
for (const sz of [-1, 1]) { sidewalk(PLAZA_R + 6, sz * walkOff, bx1 - 14, sz * walkOff); sidewalk(-PLAZA_R - 6, sz * walkOff, bx0 + 14, sz * walkOff); }
streets.forEach((s) => {
  road(s.x, s.z0, s.x, s.z1, 0.065);
  for (const sx of [-1, 1]) { sidewalk(s.x + sx * walkOff, s.z0 + 2, s.x + sx * walkOff, -walkOff); sidewalk(s.x + sx * walkOff, walkOff, s.x + sx * walkOff, s.z1 - 2); }
  [s.z0, s.z1].forEach((z) => { if (Math.abs(z) > ROAD_W) { flat(new THREE.CircleGeometry(ROAD_W * 0.85 + 0.4, 40), mats.kerb, s.x, 0.055, z); flat(new THREE.CircleGeometry(ROAD_W * 0.85, 40), mats.road, s.x, 0.062, z); } });
});
[bx0 + 14, bx1 - 14].forEach((x) => { flat(new THREE.CircleGeometry(ROAD_W * 0.85 + 0.4, 40), mats.kerb, x, 0.055, 0); flat(new THREE.CircleGeometry(ROAD_W * 0.85, 40), mats.road, x, 0.062, 0); });

/* ---------- tekst op de kaart: straatnamen op het wegdek ---------- */
const groundTexts = [];
function textTexture(text, size, weight = 600) {
  const c = document.createElement("canvas");
  const x = c.getContext("2d");
  const font = `${weight} ${size}px 'Inter', system-ui, sans-serif`;
  x.font = font; const w = Math.ceil(x.measureText(text).width) + 16;
  c.width = w; c.height = Math.ceil(size * 1.5);
  const draw = () => {
    x.clearRect(0, 0, c.width, c.height);
    x.font = font; x.textBaseline = "middle";
    x.lineWidth = size / 5; x.strokeStyle = P.labelHalo; x.lineJoin = "round"; x.strokeText(text, 8, c.height / 2);
    x.fillStyle = P.label; x.fillText(text, 8, c.height / 2);
  };
  draw();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return { t, w: c.width, h: c.height, redraw: () => { draw(); t.needsUpdate = true; } };
}
function groundText(text, x, z, ry, worldH = 3.2) {
  const tx = textTexture(text, 64);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(worldH * tx.w / tx.h, worldH), new THREE.MeshBasicMaterial({ map: tx.t, transparent: true, depthWrite: false }));
  m.rotation.x = -Math.PI / 2; m.rotation.z = ry;
  m.position.set(x, 0.09, z); scene.add(m); groundTexts.push(tx);
}
const streetName = (p) => (p.name || p.key).replace(/\s*\(.*\)$/, "");
streets.forEach((s) => {
  const name = s.name.replace(/\s*\(.*\)$/, "");
  for (let z = s.z0 + 30; z < s.z1 - 20; z += 110) if (Math.abs(z) > ROAD_W) groundText(name, s.x, z, Math.PI / 2);
});
groundText("Boulevard", PLAZA_R + 24, 0, 0, 3);
groundText(root.name || "Home", 0, PLAZA_R - half - 10, 0, 3.4);

/* ---------- gebouwen ---------- */
function stateVar(p) {
  if (p.state === "removed") return "--gone";
  if (p.state === "new") return "--new";
  if (p.state === "same") return "--same";
  if (p.state === "baseline") return null; // eerste meting: gewoon dak
  return (p.compare || {}).transfer < -52 ? "--down" : "--up";
}
function rng(seed) { let r = (seed * 9301 + 49297) % 233280; return () => ((r = (r * 9301 + 49297) % 233280) / 233280); }
function hashKey(k) { let h = 0; for (const c of k) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h % 100000; }

function labelTexture(p) {
  const c = document.createElement("canvas"); c.width = 720; c.height = 150;
  const x = c.getContext("2d");
  x.lineJoin = "round"; x.textAlign = "center";
  let name = p.name || p.key; const full = name;
  x.font = "600 50px 'Inter', system-ui, sans-serif";
  while (x.measureText(name).width > 690 && name.length > 4) name = name.slice(0, -2);
  if (name !== full) name = name.trim() + "…";
  x.lineWidth = 12; x.strokeStyle = P.labelHalo; x.strokeText(name, 360, 62); x.fillStyle = P.ink; x.fillText(name, 360, 62);
  const c2 = p.compare || {};
  let sub = U.kb(p.weight.transfer), col = P.label;
  if (p.status >= 400) { sub += `  ·  HTTP ${p.status}`; col = "#c62828"; }
  else if (p.state === "removed") sub += "  ·  verwijderd";
  else if (p.state === "new") { sub += "  ·  nieuw"; col = css("--new"); }
  else if (c2.transfer != null && Math.abs(c2.transfer) >= 52) { sub += "  ·  " + U.dKB(c2.transfer); col = c2.transfer > 0 ? css("--up") : css("--down"); }
  x.font = "600 42px 'JetBrains Mono', monospace";
  x.lineWidth = 10; x.strokeText(sub, 360, 124); x.fillStyle = col; x.fillText(sub, 360, 124);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}

const loader = new THREE.TextureLoader();
const buildings = new Map(); const pickables = [];
const box = (w, h, d) => { const g = new THREE.BoxGeometry(w, h, d); g.translate(0, h / 2, 0); return g; };
lots.forEach((lot) => {
  const p = lot.p;
  const rnd = rng(hashKey(p.key) + 7);
  const broken = p.status >= 400 || p.error;
  const removed = p.state === "removed";
  const H = broken ? 4 : hOf(p.weight.transfer);
  const W = lot.tower ? 20 : 12 + Math.round(rnd() * 2), D = lot.tower ? 16 : 10 + Math.round(rnd() * 3);
  const g = new THREE.Group(); g.position.set(lot.x, 0, lot.z); g.rotation.y = lot.rot; scene.add(g);

  const wallMat = new THREE.MeshLambertMaterial({ transparent: removed, opacity: removed ? 0.35 : 1 });
  const roofMat = new THREE.MeshLambertMaterial({ transparent: removed, opacity: removed ? 0.45 : 1 });
  const mk = (w, h, d, x, z, y = 0) => {
    const m = new THREE.Mesh(box(w, h, d), [wallMat, wallMat, roofMat, wallMat, wallMat, wallMat]);
    m.position.set(x, y, z); g.add(m); m.userData.key = p.key; pickables.push(m); return m;
  };
  // hoofdvolume met getrapte top en een lagere vleugel aan de achterkant, zoals op de kaart
  const tiers = [];
  if (!broken && H > 26 && rnd() > 0.35) {
    const hMain = H * (0.72 + rnd() * 0.12);
    mk(W, hMain, D, 0, 0); tiers.push(hMain);
    mk(W * (0.55 + rnd() * 0.2), H - hMain, D * (0.6 + rnd() * 0.2), (rnd() - 0.5) * 2, -(rnd()) * 1.5, hMain);
  } else mk(W, H, D, 0, 0);
  if (!broken && !lot.tower) {
    const wh = Math.max(5, H * (0.3 + rnd() * 0.3)), wd = 4 + rnd() * 4, ww = W * (0.6 + rnd() * 0.4);
    mk(ww, Math.min(wh, H - 1), wd, (rnd() - 0.5) * (W - ww), -D / 2 - wd / 2 + 0.01);
  }
  if (lot.tower) mk(W + 10, 6, D + 10, 0, 0); // sokkel

  // screenshot als gevelpaneel aan de straatkant (lokale +z)
  const sw = Math.min(W - 1.6, 11), sh = sw * 400 / 640;
  const topOfFront = tiers[0] || H;
  const screenY = Math.max(sh / 2 + 1.6, Math.min(topOfFront - sh / 2 - 1.2, 14));
  const scrMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: removed, opacity: removed ? 0.5 : 1 });
  const src = p.thumb || p.prevThumb;
  if (src) loader.load(src, (t) => { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; scrMat.map = t; scrMat.needsUpdate = true; });
  const faces = lot.tower ? [0, 1, 2, 3] : [0];
  faces.forEach((f) => {
    const a = (f * Math.PI) / 2, dist = (f % 2 ? W : D) / 2 + (lot.tower ? 5 : 0) + 0.06;
    const frame = new THREE.Mesh(new THREE.PlaneGeometry(sw + 0.5, sh + 0.5), new THREE.MeshBasicMaterial({ color: 0x8c8878 }));
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(sw, sh), scrMat);
    const y = lot.tower ? 9 + sh / 2 + 3 : screenY;
    frame.position.set(Math.sin(a) * dist, y, Math.cos(a) * dist); frame.rotation.y = a;
    scr.position.set(Math.sin(a) * (dist + 0.03), y, Math.cos(a) * (dist + 0.03)); scr.rotation.y = a;
    if (lot.tower) { const off = (f % 2 ? W : D) / 2 + 0.06; frame.position.set(Math.sin(a) * off, H * 0.55, Math.cos(a) * off); scr.position.set(Math.sin(a) * (off + 0.03), H * 0.55, Math.cos(a) * (off + 0.03)); }
    g.add(frame); g.add(scr); scr.userData.key = p.key; pickables.push(scr);
  });

  // label boven het gebouw (kaartlabel met halo)
  const label = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthWrite: false }));
  label.scale.set(20, 4.2, 1); label.position.y = H + 5; label.renderOrder = 5; g.add(label);

  // selectie: gestippelde contour op de grond
  const halo = new THREE.Mesh(new THREE.RingGeometry(Math.max(W, D) * 0.8, Math.max(W, D) * 0.8 + 0.9, 48), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.95 }));
  halo.rotation.x = -Math.PI / 2; halo.position.y = 0.12; halo.visible = false; g.add(halo);

  if (broken) {
    const c = document.createElement("canvas"); c.width = 256; c.height = 128;
    const x = c.getContext("2d"); x.fillStyle = "#c62828"; x.fillRect(0, 0, 256, 128);
    x.fillStyle = "#fff"; x.font = "700 64px 'Inter', sans-serif"; x.textAlign = "center"; x.textBaseline = "middle";
    x.fillText(p.status ? String(p.status) : "FOUT", 128, 66);
    const warn = new THREE.Mesh(new THREE.PlaneGeometry(5, 2.5), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c) }));
    warn.position.set(0, H + 1.8, D / 2); g.add(warn);
  }

  const world = new THREE.Vector3(lot.x, 0, lot.z);
  const front = new THREE.Vector3(Math.sin(lot.rot), 0, Math.cos(lot.rot));
  buildings.set(p.key, { p, g, H, W, D, wallMat, roofMat, label, halo, world, front, radius: (lot.tower ? 21 : Math.hypot(W, D) / 2) + 0.4, tower: !!lot.tower, broken });
});

/* ---------- bomen: ronde kruinen langs de straten en in de parken ---------- */
const treeGeo = new THREE.SphereGeometry(1.6, 10, 8); treeGeo.scale(1, 0.85, 1); treeGeo.translate(0, 2.2, 0);
const props = [];
function tree(x, z, s = 1) { const t = new THREE.Mesh(treeGeo, mats.tree); t.position.set(x, 0, z); t.scale.setScalar(s); scene.add(t); props.push({ x, z, r: 1.2 * s }); }
streets.forEach((s) => {
  for (const side of [-1, 1]) {
    for (let z = ROAD_W / 2 + 14 + LOT / 2; z < s.z1 - 6; z += LOT * 2) tree(s.x + side * walkOff, z, 0.8);
    for (let z = -(ROAD_W / 2 + 14 + LOT / 2); z > s.z0 + 6; z -= LOT * 2) tree(s.x + side * walkOff, z, 0.8);
  }
});
for (let i = 0; i < 14; i++) { const a = (i / 14) * Math.PI * 2, r = PLAZA_R - ROAD_W / 2 - 8; tree(Math.cos(a) * r, Math.sin(a) * r, 1.1); }

/* ---------- auto ---------- */
const car = new THREE.Group(); scene.add(car);
const carPaint = new THREE.MeshLambertMaterial();
const carBody = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.8, 4.2), carPaint); carBody.position.y = 0.75; car.add(carBody);
const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.7, 2.1), new THREE.MeshLambertMaterial({ color: 0x2a3338 }));
cabin.position.set(0, 1.45, -0.25); car.add(cabin);
const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.35, 16); wheelGeo.rotateZ(Math.PI / 2);
const wheelMat = new THREE.MeshLambertMaterial({ color: 0x1a1a1a });
const wheels = [[-1.1, 1.35], [1.1, 1.35], [-1.1, -1.35], [1.1, -1.35]].map(([x, z]) => { const w = new THREE.Mesh(wheelGeo, wheelMat); w.position.set(x, 0.42, z); car.add(w); return w; });
const headlight = new THREE.SpotLight(0xfff2c8, 0, 60, 0.55, 0.6, 1.2); headlight.position.set(0, 1, 2); car.add(headlight);
const hlTarget = new THREE.Object3D(); hlTarget.position.set(0, 0, 14); car.add(hlTarget); headlight.target = hlTarget;

const firstEast = Math.min(...xs.filter((x) => x > 0), PLAZA_R + 60);
const START = { x: firstEast - 26, z: 3.2, heading: Math.PI / 2 };
const state = { ...START, speed: 0 };
car.position.set(state.x, 0, state.z);

/* ---------- thema ---------- */
function applyTheme() {
  const dark = isDark(); P = dark ? PAL.dark : PAL.light;
  scene.background = new THREE.Color(P.fog);
  scene.fog = new THREE.Fog(P.fog, 260, 1100);
  ambient.intensity = dark ? 0.7 : 0.95; sun.intensity = dark ? 1.3 : 2.3;
  mats.ground.color.set(P.ground); mats.park.color.set(P.park); mats.road.color.set(P.road);
  mats.kerb.color.set(P.kerb); mats.walk.color.set(P.walk); mats.tree.color.set(P.tree); mats.parkEdge.color.set(P.parkEdge);
  headlight.intensity = dark ? 40 : 0;
  carPaint.color.set(css("--accent"));
  groundTexts.forEach((t) => t.redraw());
  buildings.forEach((b) => {
    b.wallMat.color.set(b.broken ? (dark ? "#3a3d40" : "#a9a69c") : P.wall);
    const v = stateVar(b.p);
    b.roofMat.color = v ? new THREE.Color(P.roof).lerp(new THREE.Color(css(v)), 0.55) : new THREE.Color(P.roof);
    b.halo.material.color = new THREE.Color(css("--accent"));
    if (b.label.material.map) b.label.material.map.dispose();
    b.label.material.map = labelTexture(b.p); b.label.material.needsUpdate = true;
  });
  drawMinimapBase();
}

/* ---------- minikaart ---------- */
const mini = document.getElementById("minimap");
const mctx = mini.getContext("2d");
let miniBase = null;
const MS = mini.width;
const mScale = (MS - 16) / Math.max(bx1 - bx0, bz1 - bz0);
const mcx = (bx0 + bx1) / 2, mcz = (bz0 + bz1) / 2;
const toMini = (x, z) => [MS / 2 + (x - mcx) * mScale, MS / 2 + (z - mcz) * mScale];
function drawMinimapBase() {
  const c = document.createElement("canvas"); c.width = c.height = MS;
  const x = c.getContext("2d");
  x.fillStyle = P.ground; x.fillRect(0, 0, MS, MS);
  const [ox, oy] = toMini(0, 0);
  x.fillStyle = P.park; x.beginPath(); x.arc(ox, oy, (PLAZA_R - half) * mScale, 0, Math.PI * 2); x.fill();
  x.strokeStyle = P.kerb; x.lineCap = "round"; x.lineWidth = Math.max(2.5, ROAD_W * mScale);
  x.beginPath(); x.arc(ox, oy, PLAZA_R * mScale, 0, Math.PI * 2); x.stroke();
  const seg = (a, b, c2, d) => { const [p, q] = toMini(a, b), [r, t] = toMini(c2, d); x.beginPath(); x.moveTo(p, q); x.lineTo(r, t); x.stroke(); };
  seg(bx0 + 14, 0, -PLAZA_R, 0); seg(PLAZA_R, 0, bx1 - 14, 0);
  streets.forEach((s) => seg(s.x, s.z0, s.x, s.z1));
  buildings.forEach((b) => {
    const [px, py] = toMini(b.world.x, b.world.z);
    const v = stateVar(b.p);
    x.fillStyle = v ? css(v) : P.wall; x.strokeStyle = P.ink; x.lineWidth = 0.5;
    const s = b.tower ? 8 : 5; x.fillRect(px - s / 2, py - s / 2, s, s); x.strokeRect(px - s / 2, py - s / 2, s, s);
  });
  miniBase = c;
}
function drawMinimap() {
  if (!miniBase) return;
  mctx.drawImage(miniBase, 0, 0);
  if (selected && buildings.get(selected)) {
    const b = buildings.get(selected); const [px, py] = toMini(b.world.x, b.world.z);
    mctx.strokeStyle = css("--accent"); mctx.lineWidth = 2; mctx.strokeRect(px - 5, py - 5, 10, 10);
  }
  const [cx, cy] = toMini(state.x, state.z);
  mctx.save(); mctx.translate(cx, cy); mctx.rotate(-state.heading + Math.PI / 2);
  mctx.fillStyle = css("--accent"); mctx.beginPath(); mctx.moveTo(7, 0); mctx.lineTo(-4, 4.5); mctx.lineTo(-4, -4.5); mctx.closePath(); mctx.fill();
  mctx.restore();
}
mini.addEventListener("click", (e) => {
  const r = mini.getBoundingClientRect();
  const mx = ((e.clientX - r.left) / r.width) * MS, my = ((e.clientY - r.top) / r.height) * MS;
  let best = null, bd = 1e9;
  buildings.forEach((b) => { const [px, py] = toMini(b.world.x, b.world.z); const d = Math.hypot(px - mx, py - my); if (d < bd) { bd = d; best = b; } });
  if (best && bd < 14) driveTo(best.p.key);
});

/* ---------- selectie + naar een gebouw rijden ---------- */
let selected = null;
function driveTo(key) {
  const b = buildings.get(key); if (!b) return;
  const p = b.tower ? new THREE.Vector3(0, 0, PLAZA_R - 2) : b.world.clone().add(b.front.clone().multiplyScalar(SET + 2.5));
  state.x = p.x; state.z = p.z; state.speed = 0;
  state.heading = b.tower ? Math.PI : Math.atan2(-b.front.x, -b.front.z);
  camState.snap = true;
  window.selectPage(key, false);
  renderer.domElement.focus({ preventScroll: true });
}
window.SCENE = {
  select(key, fromList) {
    selected = key;
    buildings.forEach((b) => { b.halo.visible = b.p.key === key; });
    if (fromList) driveTo(key);
  },
  driveTo
};

/* ---------- invoer ---------- */
const keys = new Set();
const KEYMAP = { ArrowUp: "up", KeyW: "up", ArrowDown: "down", KeyS: "down", ArrowLeft: "left", KeyA: "left", ArrowRight: "right", KeyD: "right", ShiftLeft: "boost", ShiftRight: "boost", Space: "brake" };
renderer.domElement.addEventListener("keydown", (e) => {
  const hint = stage.querySelector(".hint"); if (hint && KEYMAP[e.code]) hint.hidden = true;
  if (KEYMAP[e.code]) { keys.add(KEYMAP[e.code]); e.preventDefault(); }
  if (e.code === "KeyC") toggleCam();
  if (e.code === "KeyR") { Object.assign(state, START, { speed: 0 }); camState.snap = true; }
});
renderer.domElement.addEventListener("keyup", (e) => { if (KEYMAP[e.code]) keys.delete(KEYMAP[e.code]); });
renderer.domElement.addEventListener("blur", () => keys.clear());
document.querySelectorAll("[data-touch]").forEach((btn) => {
  const k = btn.dataset.touch;
  const on = (e) => { e.preventDefault(); keys.add(k); btn.setAttribute("aria-pressed", "true"); };
  const off = () => { keys.delete(k); btn.setAttribute("aria-pressed", "false"); };
  btn.addEventListener("pointerdown", on); btn.addEventListener("pointerup", off); btn.addEventListener("pointerleave", off); btn.addEventListener("pointercancel", off);
});

// standaard: schuin bovenaanzicht (kaart), C wisselt naar achter de auto
const camState = { mode: "map", snap: true, zoom: 1.45 };
const btnCam = document.getElementById("btn-cam");
function syncCamBtn() { btnCam.textContent = camState.mode === "map" ? "Achter de auto" : "Kaartweergave"; btnCam.setAttribute("aria-pressed", "false"); }
function toggleCam() { camState.mode = camState.mode === "map" ? "chase" : "map"; syncCamBtn(); }
syncCamBtn();
btnCam.addEventListener("click", toggleCam);
document.getElementById("btn-home").addEventListener("click", () => driveTo(root.key));
renderer.domElement.addEventListener("wheel", (e) => {
  if (camState.mode !== "map") return;
  e.preventDefault(); camState.zoom = Math.max(0.35, Math.min(2.6, camState.zoom * (e.deltaY > 0 ? 1.1 : 0.9)));
}, { passive: false });

const ray = new THREE.Raycaster(), mouse = new THREE.Vector2();
let downAt = null;
renderer.domElement.addEventListener("pointerdown", (e) => { downAt = [e.clientX, e.clientY]; });
renderer.domElement.addEventListener("pointerup", (e) => {
  if (!downAt || Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) > 5) return;
  const r = renderer.domElement.getBoundingClientRect();
  mouse.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(mouse, camera);
  const hit = ray.intersectObjects(pickables, false)[0];
  if (hit) window.selectPage(hit.object.userData.key, false);
});
renderer.domElement.addEventListener("pointermove", (e) => {
  const r = renderer.domElement.getBoundingClientRect();
  mouse.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(mouse, camera);
  renderer.domElement.style.cursor = ray.intersectObjects(pickables, false).length ? "pointer" : "default";
});

/* ---------- rijden ---------- */
const speedEl = document.getElementById("speed");
const nearEl = document.getElementById("near");
let nearKey = null;
function step(dt) {
  const max = keys.has("boost") ? 70 : 38;
  const acc = 34, brake = 70;
  if (keys.has("up")) state.speed += acc * dt;
  else if (keys.has("down")) state.speed -= (state.speed > 0 ? brake : acc * 0.6) * dt;
  else state.speed -= Math.sign(state.speed) * Math.min(Math.abs(state.speed), 9 * dt);
  if (keys.has("brake")) state.speed -= Math.sign(state.speed) * Math.min(Math.abs(state.speed), brake * dt);
  state.speed = Math.max(-14, Math.min(max, state.speed));
  if (!keys.has("boost") && state.speed > 38) state.speed -= 40 * dt;
  const steer = (keys.has("left") ? 1 : 0) - (keys.has("right") ? 1 : 0);
  const grip = Math.min(1, Math.abs(state.speed) / 8);
  state.heading += steer * 1.9 * dt * grip * Math.sign(state.speed || 1);
  let nx = state.x + Math.sin(state.heading) * state.speed * dt;
  let nz = state.z + Math.cos(state.heading) * state.speed * dt;
  const CAR_R = 2.1;
  const push = (ox, oz, r, damp) => {
    const dx = nx - ox, dz = nz - oz, d = Math.hypot(dx, dz), min = r + CAR_R;
    if (d < min && d > 0.001) { nx = ox + (dx / d) * min; nz = oz + (dz / d) * min; state.speed *= damp; }
  };
  buildings.forEach((b) => push(b.world.x, b.world.z, b.radius, 0.3));
  props.forEach((o) => push(o.x, o.z, o.r, 0.6));
  if (nx < bx0 - 60 || nx > bx1 + 60 || nz < bz0 - 60 || nz > bz1 + 60) { nx = Math.max(bx0 - 60, Math.min(bx1 + 60, nx)); nz = Math.max(bz0 - 60, Math.min(bz1 + 60, nz)); state.speed = 0; }
  state.x = nx; state.z = nz;
  car.position.set(state.x, 0, state.z); car.rotation.y = state.heading;
  wheels.forEach((w) => (w.rotation.x += state.speed * dt / 0.42));
  speedEl.textContent = Math.round(Math.abs(state.speed) * 3) + " km/u";

  let best = null, bd = 1e9;
  buildings.forEach((b) => { const d = Math.hypot(b.world.x - state.x, b.world.z - state.z) - b.radius; if (d < bd) { bd = d; best = b; } });
  const k = best && bd < 14 ? best.p.key : null;
  if (k !== nearKey) {
    nearKey = k;
    nearEl.hidden = !k;
    if (k) { nearEl.textContent = "Je staat bij: " + (best.p.name || k); if (Math.abs(state.speed) > 0.5 || selected !== k) window.selectPage(k, false); }
  }
}

/* ---------- camera ---------- */
const camPos = new THREE.Vector3(), camLook = new THREE.Vector3();
function updateCamera(dt) {
  const fwd = new THREE.Vector3(Math.sin(state.heading), 0, Math.cos(state.heading));
  let want, look;
  if (camState.mode === "chase") {
    camera.fov = 58;
    want = new THREE.Vector3(state.x, 7.5, state.z).addScaledVector(fwd, -15);
    look = new THREE.Vector3(state.x, 4, state.z).addScaledVector(fwd, 10);
  } else {
    camera.fov = 38;
    // vaste kijkrichting (zuidoost → noordwest), zoals een kaart; de auto blijft in het midden
    const dist = 150 * camState.zoom;
    want = new THREE.Vector3(state.x + dist * 0.42, dist * 0.74, state.z + dist * 0.62);
    look = new THREE.Vector3(state.x, 0, state.z);
  }
  camera.updateProjectionMatrix();
  if (camState.snap || reduce) { camPos.copy(want); camLook.copy(look); camState.snap = false; }
  else { const k = 1 - Math.exp(-dt * 4); camPos.lerp(want, k); camLook.lerp(look, k); }
  camera.position.copy(camPos); camera.lookAt(camLook);
}

function updateLabels() {
  // alleen labels rond de auto (en van de gekozen pagina en de homepage), zoals een kaart die op zoomniveau filtert
  const far = camState.mode === "map" ? 70 * camState.zoom + 20 : 120;
  buildings.forEach((b) => {
    const d = Math.hypot(b.world.x - state.x, b.world.z - state.z);
    b.label.material.opacity = b.p.key === selected || b.tower ? 1 : Math.max(0, Math.min(1, (far - d) / 25));
    b.label.visible = b.label.material.opacity > 0.02;
  });
}

function resize() {
  const w = stage.clientWidth, h = stage.clientHeight;
  renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(stage); resize();
matchMedia("(prefers-color-scheme: dark)").addEventListener("change", applyTheme);
new MutationObserver(applyTheme).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
document.fonts.ready.then(applyTheme);
applyTheme();
const initial = document.querySelector("#table tbody tr.sel");
if (initial) window.selectPage(initial.dataset.key, false);

const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  const dt = Math.min(0.05, clock.getDelta());
  step(dt); updateCamera(dt); updateLabels(); drawMinimap();
  renderer.render(scene, camera);
});
