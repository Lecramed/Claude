/* ===== Sitemap-stad (three.js) =====
   Elke pagina is een gebouw. De homepage staat als toren op het plein;
   elke sectie (pagina op niveau 1) krijgt een eigen straat vanaf de ringweg,
   met alle onderliggende pagina's als gebouwen langs die straat.
   Hoogte = paginagewicht (logaritmisch), dakkleur = verschil met de vorige meting,
   gevelscherm = screenshot. Rijden: pijltjes/WASD, Shift = turbo, C = camera. */
import * as THREE from "three";

const R = window.REPORT, U = window.UTIL;
const stage = document.getElementById("stage");
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
const css = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const isDark = () => {
  const t = document.documentElement.getAttribute("data-theme");
  return t ? t === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
};

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.domElement.tabIndex = 0;
renderer.domElement.setAttribute("aria-label", "Sitemap-stad. Gebruik de pijltjestoetsen of WASD om te rijden.");
stage.prepend(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, 1, 0.5, 3000);
const hemi = new THREE.HemisphereLight(0xffffff, 0x666655, 1.5); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffffff, 1.6); sun.position.set(120, 260, 80); scene.add(sun);

/* ---------- stadsplan ---------- */
const all = [...R.pages, ...R.removed.map((r) => ({ ...r, weight: { transfer: r.transfer }, dom: {} }))];
const byKey = new Map(all.map((p) => [p.key, p]));
const root = R.pages.find((p) => !p.parent) || R.pages[0];
const kids = new Map();
all.forEach((p) => {
  if (p === root) return;
  const par = p.parent && byKey.has(p.parent) ? p.parent : root.key;
  p._parent = par;
  (kids.get(par) || kids.set(par, []).get(par)).push(p);
});
const sections = (kids.get(root.key) || []).slice().sort((a, b) => a.key.localeCompare(b.key));
const descendants = (p) => { const out = []; const walk = (q) => (kids.get(q.key) || []).forEach((c) => { out.push(c); walk(c); }); walk(p); return out; };

const PLAZA_R = 46, ROAD_W = 14, LOT = 15, SET = 15; // plein, straatbreedte, kavelafstand, afstand gebouw–as
const GAP = 58; // afstand tussen twee dwarsstraten
const lots = [];     // {p, x, z, rot}
const streets = [];  // dwarsstraten: {x, z0, z1, key}
const maxKB = Math.max(...all.map((p) => p.weight.transfer / 1024));
const hOf = (b) => 7 + (b / 1024 / maxKB) * 80; // lineair: 2× zo zwaar = 2× zo hoog (boven een vaste begane grond)

/* Stratenplan: een boulevard (oost–west) door het plein met de homepage-toren.
   Elke sectie krijgt een dwarsstraat (noord–zuid); de sectiepagina staat op de
   hoek, de onderliggende pagina's staan aan beide kanten van die straat. */
lots.push({ p: root, x: 0, z: 0, rot: 0, tower: true });
let east = 0, west = 0;
sections.forEach((s, i) => {
  const sideX = i % 2 === 0 ? 1 : -1;
  const k = sideX > 0 ? east++ : west++;
  const sx = sideX * (PLAZA_R + 40 + k * GAP);
  const list = [s, ...descendants(s)];
  const north = list.slice(0, Math.ceil(list.length / 2)), south = list.slice(Math.ceil(list.length / 2));
  const place = (arr, dirZ) => arr.forEach((p, j) => {
    const along = ROAD_W / 2 + 12 + Math.floor(j / 2) * LOT;
    const side = j % 2 ? 1 : -1;
    lots.push({ p, x: sx + side * SET, z: dirZ * along, rot: -side * Math.PI / 2, section: s.key });
  });
  place(north, -1); place(south, 1);
  const len = (arr) => (arr.length ? ROAD_W / 2 + 12 + Math.floor((arr.length - 1) / 2) * LOT + 16 : ROAD_W / 2);
  streets.push({ x: sx, z0: -len(north), z1: len(south), key: s.key });
});
const xs = streets.map((s) => s.x);
const bx0 = Math.min(-PLAZA_R, ...xs) - 30, bx1 = Math.max(PLAZA_R, ...xs) + 30;
const bz0 = Math.min(-PLAZA_R, ...streets.map((s) => s.z0)) - 20, bz1 = Math.max(PLAZA_R, ...streets.map((s) => s.z1)) + 20;
const reach = Math.max(bx1 - bx0, bz1 - bz0) / 2 + 40;

/* ---------- grond, wegen ---------- */
const groundMat = new THREE.MeshStandardMaterial({ roughness: 1 });
const ground = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000), groundMat);
ground.rotation.x = -Math.PI / 2; scene.add(ground);

function dashTexture() {
  const c = document.createElement("canvas"); c.width = 64; c.height = 256;
  const x = c.getContext("2d");
  x.fillStyle = "#3a3f44"; x.fillRect(0, 0, 64, 256);
  for (let i = 0; i < 1500; i++) { x.fillStyle = `rgba(255,255,255,${Math.random() * 0.05})`; x.fillRect(Math.random() * 64, Math.random() * 256, 1.5, 1.5); }
  x.fillStyle = "#e9e2c8"; x.fillRect(30, 20, 4, 110);
  x.fillStyle = "#d8d8d0"; x.fillRect(2, 0, 2, 256); x.fillRect(60, 0, 2, 256);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}
const roadTex = dashTexture();
const asphalt = new THREE.MeshStandardMaterial({ color: 0x3a3f44, roughness: 0.95 });
const plazaMat = new THREE.MeshStandardMaterial({ roughness: 0.9 });
const sidewalkMat = new THREE.MeshStandardMaterial({ roughness: 0.95 });
function road(x0, z0, x1, z1, y = 0.06) { // rechte weg van (x0,z0) naar (x1,z1)
  const L = Math.hypot(x1 - x0, z1 - z0); if (L < 1) return;
  const tex = roadTex.clone(); tex.repeat.set(1, L / 18); tex.needsUpdate = true;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(ROAD_W, L), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95 }));
  m.rotation.x = -Math.PI / 2;
  const h = new THREE.Group(); h.position.set((x0 + x1) / 2, y, (z0 + z1) / 2); h.rotation.y = Math.atan2(x1 - x0, z1 - z0);
  h.add(m); scene.add(h);
}
function sidewalk(x0, z0, x1, z1) {
  const L = Math.hypot(x1 - x0, z1 - z0); if (L < 2) return;
  const m = new THREE.Mesh(new THREE.BoxGeometry(3, 0.16, L), sidewalkMat);
  m.position.set((x0 + x1) / 2, 0.08, (z0 + z1) / 2); m.rotation.y = Math.atan2(x1 - x0, z1 - z0); scene.add(m);
}
const plaza = new THREE.Mesh(new THREE.CircleGeometry(PLAZA_R - ROAD_W / 2, 64), plazaMat);
plaza.rotation.x = -Math.PI / 2; plaza.position.y = 0.04; scene.add(plaza);
const ringRoad = new THREE.Mesh(new THREE.RingGeometry(PLAZA_R - ROAD_W / 2, PLAZA_R + ROAD_W / 2, 96), asphalt);
ringRoad.rotation.x = -Math.PI / 2; ringRoad.position.y = 0.05; scene.add(ringRoad);
// boulevard
const half = ROAD_W / 2, walkOff = half + 1.5;
road(PLAZA_R, 0, bx1 - 10, 0); road(-PLAZA_R, 0, bx0 + 10, 0);
const crossXs = xs.slice().sort((a, b) => a - b);
for (const dir of [1, -1]) {
  const stops = [dir * PLAZA_R, ...crossXs.filter((x) => Math.sign(x) === dir), dir > 0 ? bx1 - 10 : bx0 + 10].sort((a, b) => a - b);
  for (let i = 0; i < stops.length - 1; i++) for (const sz of [-1, 1]) sidewalk(stops[i] + (i ? walkOff : 6), sz * walkOff, stops[i + 1] - (i < stops.length - 2 ? walkOff : 0), sz * walkOff);
}
[bx0 + 10, bx1 - 10].forEach((x) => { const e = new THREE.Mesh(new THREE.CircleGeometry(ROAD_W * 0.9, 32), asphalt); e.rotation.x = -Math.PI / 2; e.position.set(x, 0.055, 0); scene.add(e); });
// dwarsstraten
streets.forEach((s) => {
  road(s.x, s.z0, s.x, s.z1, 0.065);
  for (const sx of [-1, 1]) { sidewalk(s.x + sx * walkOff, s.z0 + 4, s.x + sx * walkOff, -walkOff); sidewalk(s.x + sx * walkOff, walkOff, s.x + sx * walkOff, s.z1 - 4); }
  [s.z0, s.z1].forEach((z) => { if (Math.abs(z) > ROAD_W) { const e = new THREE.Mesh(new THREE.CircleGeometry(ROAD_W * 0.9, 32), asphalt); e.rotation.x = -Math.PI / 2; e.position.set(s.x, 0.055, z); scene.add(e); } });
});

/* straatnaambordjes op de hoek van elke dwarsstraat */
function signTexture(text) {
  const c = document.createElement("canvas"); c.width = 512; c.height = 96;
  const x = c.getContext("2d");
  x.fillStyle = "#1f5a8a"; x.fillRect(0, 0, 512, 96);
  x.strokeStyle = "#fff"; x.lineWidth = 5; x.strokeRect(8, 8, 496, 80);
  x.fillStyle = "#fff"; x.font = "600 44px 'Space Grotesk', system-ui, sans-serif"; x.textAlign = "center"; x.textBaseline = "middle";
  let t = text; while (x.measureText(t).width > 470 && t.length > 4) t = t.slice(0, -2); if (t !== text) t = t.trim() + "…";
  x.fillText(t, 256, 50);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; return tex;
}
const poleMat = new THREE.MeshStandardMaterial({ color: 0x7a8288, roughness: 0.5, metalness: 0.4 });
streets.forEach((s) => {
  const p = byKey.get(s.key);
  const g = new THREE.Group(); g.position.set(s.x + (half + 3) * (s.x > 0 ? -1 : 1), 0, half + 3); scene.add(g);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 6.5, 8), poleMat); pole.position.y = 3.25; g.add(pole);
  const mat = new THREE.MeshBasicMaterial({ map: signTexture(p.name || p.key) });
  for (const r of [0, Math.PI]) { const b = new THREE.Mesh(new THREE.PlaneGeometry(7, 1.3), mat); b.position.set(0, 6, r ? -0.03 : 0.03); b.rotation.y = r; g.add(b); }
});

/* ---------- gebouwen ---------- */
function stateVar(p) {
  if (p.state === "removed") return "--gone";
  if (p.state === "new") return "--new";
  if (p.state === "baseline") return "--accent";
  if (p.state === "same") return "--same";
  return (p.compare || {}).transfer < -52 ? "--down" : "--up";
}
const WALLS = ["#c9c3b8", "#b9c2c9", "#d3c6b0", "#a9b4ae", "#c4b5ae", "#bfc6cf"];
function windowTexture(seed) {
  const c = document.createElement("canvas"); c.width = 128; c.height = 128;
  const x = c.getContext("2d");
  x.fillStyle = "#ffffff"; x.fillRect(0, 0, 128, 128);
  let r = seed * 9301 + 49297;
  const rnd = () => ((r = (r * 9301 + 49297) % 233280) / 233280);
  for (let row = 0; row < 4; row++) for (let col = 0; col < 4; col++) {
    const lit = rnd() > 0.45;
    x.fillStyle = lit ? "#ffe2a6" : "#4a5560";
    x.fillRect(col * 32 + 7, row * 32 + 8, 18, 18);
  }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; return t;
}
function emissiveTexture(seed) {
  const c = document.createElement("canvas"); c.width = 128; c.height = 128;
  const x = c.getContext("2d"); x.fillStyle = "#000"; x.fillRect(0, 0, 128, 128);
  let r = seed * 9301 + 49297;
  const rnd = () => ((r = (r * 9301 + 49297) % 233280) / 233280);
  for (let row = 0; row < 4; row++) for (let col = 0; col < 4; col++) {
    if (rnd() > 0.45) { x.fillStyle = "#ffcf7a"; x.fillRect(col * 32 + 7, row * 32 + 8, 18, 18); }
  }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; return t;
}
function labelTexture(p) {
  const c = document.createElement("canvas"); c.width = 640; c.height = 150;
  const x = c.getContext("2d");
  x.fillStyle = "rgba(255,255,255,0.94)"; x.beginPath(); x.roundRect(4, 4, 632, 142, 22); x.fill();
  x.fillStyle = css(stateVar(p)); x.beginPath(); x.roundRect(4, 4, 18, 142, [22, 0, 0, 22]); x.fill();
  x.fillStyle = "#1b2227"; x.font = "600 46px 'Space Grotesk', system-ui, sans-serif";
  let name = p.name || p.key; const full = name;
  while (x.measureText(name).width > 590 && name.length > 4) name = name.slice(0, -2);
  if (name !== full) name = name.trim() + "…";
  x.fillText(name, 40, 64);
  x.font = "600 38px 'JetBrains Mono', monospace"; x.fillStyle = "#4b5660";
  const w = U.kb(p.weight.transfer); x.fillText(w, 40, 120);
  const c2 = p.compare || {}; let extra = "", col = "#4b5660";
  if (p.state === "removed") { extra = "verwijderd"; col = "#6f7880"; }
  else if (p.state === "new") { extra = "nieuw"; col = "#6448cc"; }
  else if (c2.transfer != null) { extra = U.dKB(c2.transfer); const k = U.dCls(c2.transfer); col = k === "up" ? "#cc4a2e" : k === "down" ? "#23905a" : "#4b5660"; }
  if (p.status >= 400) { extra = `HTTP ${p.status}`; col = "#cc2e2e"; }
  x.fillStyle = col; x.fillText(extra, 40 + x.measureText(w).width + 24, 120);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}

const loader = new THREE.TextureLoader();
const buildings = new Map(); const pickables = [];
lots.forEach((lot, i) => {
  const p = lot.p;
  const broken = p.status >= 400 || p.error;
  const removed = p.state === "removed";
  const W = lot.tower ? 16 : 11, D = lot.tower ? 16 : 10;
  const H = broken ? 5 : hOf(p.weight.transfer) + (lot.tower ? 6 : 0);
  const g = new THREE.Group(); g.position.set(lot.x, 0, lot.z); g.rotation.y = lot.rot; scene.add(g);

  const wt = windowTexture(i + 3); wt.repeat.set(W / 6, H / 6);
  const et = emissiveTexture(i + 3); et.repeat.set(W / 6, H / 6);
  const wallMat = new THREE.MeshStandardMaterial({
    color: broken ? "#5b5f63" : WALLS[i % WALLS.length], map: wt, emissiveMap: et, emissive: new THREE.Color("#ffffff"), emissiveIntensity: 0,
    roughness: 0.85, transparent: removed, opacity: removed ? 0.3 : 1
  });
  const roofMat = new THREE.MeshStandardMaterial({ roughness: 0.6, transparent: removed, opacity: removed ? 0.4 : 1 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(W, H, D), [wallMat, wallMat, roofMat, wallMat, wallMat, wallMat]);
  body.position.y = H / 2; g.add(body);
  const crown = new THREE.Mesh(new THREE.BoxGeometry(W + 0.6, 1.2, D + 0.6), new THREE.MeshStandardMaterial({ roughness: 0.4, emissiveIntensity: 0.35, transparent: removed, opacity: removed ? 0.4 : 1 }));
  crown.position.y = H + 0.6; g.add(crown);
  const plinth = new THREE.Mesh(new THREE.BoxGeometry(W + 3, 0.35, D + 3), sidewalkMat); plinth.position.y = 0.17; g.add(plinth);

  // gevelscherm met screenshot (aan de straatkant = lokale +z)
  const sw = W - 1.2, sh = sw * 400 / 640;
  const screenY = Math.max(sh / 2 + 2.2, H - sh / 2 - 1.2);
  const frame = new THREE.Mesh(new THREE.BoxGeometry(sw + 0.5, sh + 0.5, 0.3), new THREE.MeshStandardMaterial({ color: 0x22272b, roughness: 0.4 }));
  frame.position.set(0, screenY, D / 2 + 0.15); g.add(frame);
  const scrMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: removed, opacity: removed ? 0.5 : 1 });
  const src = p.thumb || p.prevThumb;
  if (src) loader.load(src, (t) => { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; scrMat.map = t; scrMat.needsUpdate = true; });
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(sw, sh), scrMat); screen.position.set(0, screenY, D / 2 + 0.32); g.add(screen);
  if (lot.tower) { // toren: scherm op alle vier de gevels
    for (let k = 1; k < 4; k++) {
      const s2 = screen.clone(); const f2 = frame.clone();
      const a = (k * Math.PI) / 2;
      [s2, f2].forEach((m, mi) => { m.position.set(Math.sin(a) * (D / 2 + (mi ? 0.15 : 0.32)), screenY, Math.cos(a) * (D / 2 + (mi ? 0.15 : 0.32))); m.rotation.y = a; g.add(m); });
    }
  }
  // deur
  const door = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 3.4), new THREE.MeshStandardMaterial({ color: 0x2c3338 }));
  door.position.set(0, 1.9, D / 2 + 0.02); g.add(door);

  // label boven het dak
  const label = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthWrite: false }));
  label.scale.set(17, 4, 1); label.position.y = H + 5.5; g.add(label);

  // markering voor de geselecteerde pagina
  const halo = new THREE.Mesh(new THREE.RingGeometry(Math.max(W, D) * 0.85, Math.max(W, D) * 0.85 + 1.1, 48), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.9 }));
  halo.rotation.x = -Math.PI / 2; halo.position.y = 0.4; halo.visible = false; g.add(halo);

  // waarschuwing voor kapotte pagina's
  if (broken) {
    const c = document.createElement("canvas"); c.width = 256; c.height = 128;
    const x = c.getContext("2d"); x.fillStyle = "#c62828"; x.fillRect(0, 0, 256, 128);
    x.fillStyle = "#fff"; x.font = "700 64px 'Space Grotesk', sans-serif"; x.textAlign = "center"; x.textBaseline = "middle";
    x.fillText(p.status ? String(p.status) : "FOUT", 128, 66);
    const warn = new THREE.Mesh(new THREE.PlaneGeometry(5, 2.5), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c) }));
    warn.position.set(0, H + 2.6, D / 2); g.add(warn);
  }

  [body, screen, frame, door].forEach((m) => { m.userData.key = p.key; pickables.push(m); });
  const world = new THREE.Vector3(lot.x, 0, lot.z);
  const front = new THREE.Vector3(Math.sin(lot.rot), 0, Math.cos(lot.rot));
  buildings.set(p.key, { p, g, H, W, D, wallMat, roofMat, crown, label, halo, world, front, radius: Math.hypot(W, D) / 2 + 0.6, tower: !!lot.tower });
});

/* ---------- bomen en lantaarnpalen langs de straten (sfeer) ---------- */
const treeTrunk = new THREE.CylinderGeometry(0.25, 0.35, 2.4, 6), treeTop = new THREE.IcosahedronGeometry(1.8, 0);
const trunkMat = new THREE.MeshStandardMaterial({ color: 0x6b4f37, roughness: 1 });
const leafMat = new THREE.MeshStandardMaterial({ color: 0x5f8f4e, roughness: 0.9, flatShading: true });
const lampHead = new THREE.SphereGeometry(0.45, 10, 8);
const lampMat = new THREE.MeshStandardMaterial({ color: 0xfff1c4, emissive: 0xffd27a, emissiveIntensity: 0 });
const props = [];
function prop(x, z, j) {
  if ((j % 2) === 0) {
    const t = new THREE.Group(); t.position.set(x, 0, z);
    const tr = new THREE.Mesh(treeTrunk, trunkMat); tr.position.y = 1.2; t.add(tr);
    const tp = new THREE.Mesh(treeTop, leafMat); tp.position.y = 3.4; tp.rotation.y = j; t.add(tp);
    scene.add(t); props.push({ x, z, r: 0.8 });
  } else {
    const l = new THREE.Group(); l.position.set(x, 0, z);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 5, 6), poleMat); pole.position.y = 2.5; l.add(pole);
    const head = new THREE.Mesh(lampHead, lampMat); head.position.y = 5.1; l.add(head);
    scene.add(l); props.push({ x, z, r: 0.5 });
  }
}
streets.forEach((s) => {
  for (const side of [-1, 1]) {
    let j = side > 0 ? 1 : 0;
    for (let z = ROAD_W / 2 + 12 + LOT / 2; z < s.z1 - 6; z += LOT) prop(s.x + side * walkOff, z, j++);
    for (let z = -(ROAD_W / 2 + 12 + LOT / 2); z > s.z0 + 6; z -= LOT) prop(s.x + side * walkOff, z, j++);
  }
});
for (let x = PLAZA_R + 20; x < bx1 - 20; x += 22) for (const sz of [-1, 1]) if (!xs.some((cx) => Math.abs(cx - x) < 12)) prop(x, sz * walkOff, Math.round(x / 22));
for (let x = -PLAZA_R - 20; x > bx0 + 20; x -= 22) for (const sz of [-1, 1]) if (!xs.some((cx) => Math.abs(cx - x) < 12)) prop(x, sz * walkOff, Math.round(-x / 22));

/* ---------- auto ---------- */
const car = new THREE.Group(); scene.add(car);
const carPaint = new THREE.MeshStandardMaterial({ roughness: 0.35, metalness: 0.3 });
const carBody = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.8, 4.2), carPaint); carBody.position.y = 0.75; car.add(carBody);
const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.7, 2.1), new THREE.MeshStandardMaterial({ color: 0x1c2833, roughness: 0.15, metalness: 0.6 }));
cabin.position.set(0, 1.45, -0.25); car.add(cabin);
const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.35, 16); wheelGeo.rotateZ(Math.PI / 2);
const wheelMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.8 });
const wheels = [[-1.1, 1.35], [1.1, 1.35], [-1.1, -1.35], [1.1, -1.35]].map(([x, z]) => { const w = new THREE.Mesh(wheelGeo, wheelMat); w.position.set(x, 0.42, z); car.add(w); return w; });
const lightMat = new THREE.MeshStandardMaterial({ color: 0xfff6d8, emissive: 0xfff2c0, emissiveIntensity: 0.2 });
[-0.7, 0.7].forEach((x) => { const l = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.22, 0.05), lightMat); l.position.set(x, 0.85, 2.11); car.add(l); });
const headlight = new THREE.SpotLight(0xfff2c8, 0, 60, 0.55, 0.6, 1.2); headlight.position.set(0, 1, 2); car.add(headlight);
const hlTarget = new THREE.Object3D(); hlTarget.position.set(0, 0, 14); car.add(hlTarget); headlight.target = hlTarget;

const START = { x: PLAZA_R + 4, z: 3.5, heading: Math.PI / 2 };
const state = { ...START, speed: 0 };
car.position.set(state.x, 0, state.z);

/* ---------- thema: dag (licht) of avond (donker) ---------- */
function applyTheme() {
  const dark = isDark();
  const sky = new THREE.Color(dark ? "#0f1624" : "#cfe0ea");
  scene.background = sky; scene.fog = new THREE.Fog(sky, 140, dark ? 520 : 760);
  hemi.intensity = dark ? 0.55 : 1.5; sun.intensity = dark ? 0.35 : 1.6;
  hemi.color.set(dark ? "#8fa3c4" : "#ffffff");
  groundMat.color.set(dark ? "#1d2a22" : "#9fb98f");
  plazaMat.color.set(dark ? "#3a3f45" : "#d9d6cf");
  sidewalkMat.color.set(dark ? "#4b5157" : "#c9c6c0");
  lampMat.emissiveIntensity = dark ? 1.4 : 0; lightMat.emissiveIntensity = dark ? 2 : 0.2;
  headlight.intensity = dark ? 60 : 0;
  carPaint.color.set(css("--accent"));
  buildings.forEach((b) => {
    b.wallMat.emissiveIntensity = dark ? 0.85 : 0;
    const c = new THREE.Color(css(stateVar(b.p)));
    b.roofMat.color = c; b.crown.material.color = c; b.crown.material.emissive = c;
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
  x.fillStyle = css("--surface"); x.fillRect(0, 0, MS, MS);
  x.strokeStyle = css("--muted"); x.lineCap = "round"; x.lineWidth = Math.max(2, ROAD_W * mScale);
  const [ox, oy] = toMini(0, 0);
  x.beginPath(); x.arc(ox, oy, PLAZA_R * mScale, 0, Math.PI * 2); x.stroke();
  const seg = (a, b, c2, d) => { const [p, q] = toMini(a, b), [r, t] = toMini(c2, d); x.beginPath(); x.moveTo(p, q); x.lineTo(r, t); x.stroke(); };
  seg(bx0 + 10, 0, -PLAZA_R, 0); seg(PLAZA_R, 0, bx1 - 10, 0);
  streets.forEach((s) => seg(s.x, s.z0, s.x, s.z1));
  buildings.forEach((b) => {
    const [px, py] = toMini(b.world.x, b.world.z);
    x.fillStyle = css(stateVar(b.p)); const s = b.tower ? 8 : 5; x.fillRect(px - s / 2, py - s / 2, s, s);
  });
  miniBase = c;
}
function drawMinimap() {
  if (!miniBase) return;
  mctx.drawImage(miniBase, 0, 0);
  if (selected && buildings.get(selected)) {
    const b = buildings.get(selected); const [px, py] = toMini(b.world.x, b.world.z);
    mctx.strokeStyle = css("--ink"); mctx.lineWidth = 2; mctx.strokeRect(px - 5, py - 5, 10, 10);
  }
  const [cx, cy] = toMini(state.x, state.z);
  mctx.save(); mctx.translate(cx, cy); mctx.rotate(-state.heading + Math.PI / 2);
  mctx.fillStyle = css("--ink"); mctx.beginPath(); mctx.moveTo(6, 0); mctx.lineTo(-4, 4); mctx.lineTo(-4, -4); mctx.closePath(); mctx.fill();
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
  // zet de auto op straat voor de gevel, met de neus richting het gebouw
  const p = b.world.clone().add(b.front.clone().multiplyScalar(b.tower ? 26 : SET + 2 - (b.D / 2) + 3));
  state.x = p.x; state.z = p.z; state.speed = 0;
  state.heading = Math.atan2(-b.front.x, -b.front.z);
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
const initial = document.querySelector("#table tbody tr.sel");
if (initial) window.selectPage(initial.dataset.key, false);

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

const camState = { mode: "chase", snap: true };
const btnCam = document.getElementById("btn-cam");
function toggleCam() { camState.mode = camState.mode === "chase" ? "air" : "chase"; btnCam.setAttribute("aria-pressed", String(camState.mode === "air")); btnCam.textContent = camState.mode === "air" ? "Vogelvlucht" : "Achter de auto"; }
btnCam.addEventListener("click", toggleCam);
document.getElementById("btn-home").addEventListener("click", () => driveTo(root.key));

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

/* ---------- natuurkunde (eenvoudig) ---------- */
const speedEl = document.getElementById("speed");
const nearEl = document.getElementById("near");
let nearKey = null;
function step(dt) {
  const max = keys.has("boost") ? 70 : 38;
  const acc = 34, brake = 70, drag = 0.9;
  if (keys.has("up")) state.speed += acc * dt;
  else if (keys.has("down")) state.speed -= (state.speed > 0 ? brake : acc * 0.6) * dt;
  else state.speed -= Math.sign(state.speed) * Math.min(Math.abs(state.speed), drag * 10 * dt);
  if (keys.has("brake")) state.speed -= Math.sign(state.speed) * Math.min(Math.abs(state.speed), brake * dt);
  state.speed = Math.max(-14, Math.min(max, state.speed));
  if (!keys.has("boost") && state.speed > 38) state.speed -= 40 * dt;
  const steer = (keys.has("left") ? 1 : 0) - (keys.has("right") ? 1 : 0);
  const grip = Math.min(1, Math.abs(state.speed) / 8);
  state.heading += steer * 1.9 * dt * grip * Math.sign(state.speed || 1);
  let nx = state.x + Math.sin(state.heading) * state.speed * dt;
  let nz = state.z + Math.cos(state.heading) * state.speed * dt;
  // botsen: gebouwen (cirkel) en aankleding
  const CAR_R = 2.1;
  buildings.forEach((b) => {
    const dx = nx - b.world.x, dz = nz - b.world.z, d = Math.hypot(dx, dz), min = b.radius + CAR_R;
    if (d < min && d > 0.001) { nx = b.world.x + (dx / d) * min; nz = b.world.z + (dz / d) * min; state.speed *= 0.3; }
  });
  props.forEach((o) => {
    const dx = nx - o.x, dz = nz - o.z, d = Math.hypot(dx, dz), min = o.r + CAR_R * 0.8;
    if (d < min && d > 0.001) { nx = o.x + (dx / d) * min; nz = o.z + (dz / d) * min; state.speed *= 0.6; }
  });
  if (nx < bx0 - 60 || nx > bx1 + 60 || nz < bz0 - 60 || nz > bz1 + 60) { nx = Math.max(bx0 - 60, Math.min(bx1 + 60, nx)); nz = Math.max(bz0 - 60, Math.min(bz1 + 60, nz)); state.speed = 0; }
  state.x = nx; state.z = nz;
  car.position.set(state.x, 0, state.z); car.rotation.y = state.heading;
  wheels.forEach((w) => (w.rotation.x += state.speed * dt / 0.42));
  speedEl.textContent = Math.round(Math.abs(state.speed) * 3) + " km/u";

  // dichtstbijzijnde gebouw: paneel volgt mee tijdens het rijden
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
    want = new THREE.Vector3(state.x, 7.5, state.z).addScaledVector(fwd, -15);
    look = new THREE.Vector3(state.x, 4, state.z).addScaledVector(fwd, 10);
  } else {
    want = new THREE.Vector3(state.x, 120, state.z).addScaledVector(fwd, -70);
    look = new THREE.Vector3(state.x, 0, state.z).addScaledVector(fwd, 10);
  }
  if (camState.snap || reduce) { camPos.copy(want); camLook.copy(look); camState.snap = false; }
  else { const k = 1 - Math.exp(-dt * 5); camPos.lerp(want, k); camLook.lerp(look, k); }
  camera.position.copy(camPos); camera.lookAt(camLook);
}

/* ---------- labels: vervagen met afstand ---------- */
function updateLabels() {
  buildings.forEach((b) => {
    const d = camera.position.distanceTo(b.world);
    b.label.material.opacity = b.p.key === selected ? 1 : Math.max(0, Math.min(1, (camState.mode === "air" ? 320 : 170) - d) / 60);
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

const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  const dt = Math.min(0.05, clock.getDelta());
  step(dt); updateCamera(dt); updateLabels(); drawMinimap();
  renderer.render(scene, camera);
});
