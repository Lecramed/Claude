#!/usr/bin/env node
/* ===================================================================
   Sitemap 3D — crawler
   Doorloopt de site, maakt van elke pagina een screenshot, meet het
   paginagewicht (bytes per type, aantal requests, DOM-grootte) en
   vergelijkt alles met de vorige meting. Daarna wordt het 3D-rapport
   (report/index.html) opnieuw opgebouwd.

   Gebruik:
     node tools/sitemap-3d/crawl.cjs                 # lokale site (repo-root)
     node tools/sitemap-3d/crawl.cjs --url https://www.keigoed.nl
     node tools/sitemap-3d/crawl.cjs --root ./pad/naar/site --label "v2"
   Opties:
     --url <url>      crawl een live site i.p.v. de lokale bestanden
     --root <dir>     map die lokaal geserveerd wordt (standaard: repo-root)
     --label <tekst>  naam voor deze meting (standaard: git-commit)
     --max <n>        max. aantal pagina's (standaard 80)
     --keep-query <a,b>  query-parameters die een aparte pagina maken (standaard: id)
     --exclude <pad,pad> paden die worden overgeslagen, bv. /webwinkel (incl. alles eronder)
     --exclude-pattern <regex>  paden die op dit patroon lijken worden overgeslagen, bv. "-(a\\d{4,6}|\\d{5})$"
=================================================================== */
"use strict";

const fs = require("fs");
const path = require("path");
const http = require("http");
const { execSync } = require("child_process");
const { chromium } = require("playwright");

const TOOL_DIR = __dirname;
let RUNS_DIR = path.join(TOOL_DIR, "runs", "local");
const REPO_ROOT = path.resolve(TOOL_DIR, "..", "..");

/* ---------- argumenten ---------- */
function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith("--")) out[key] = true;
      else { out[key] = next; i++; }
    }
  }
  return out;
}
const args = parseArgs(process.argv.slice(2));
const MAX_PAGES = parseInt(args.max || "80", 10);
const KEEP_QUERY = String(args["keep-query"] || "id").split(",").filter(Boolean);
const VIEWPORT = { width: 1280, height: 800 };

/* ---------- mini statische server (geen dependencies) ---------- */
const MIME = {
  ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8", ".json": "application/json",
  ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg", ".webp": "image/webp", ".gif": "image/gif",
  ".ico": "image/x-icon", ".woff": "font/woff", ".woff2": "font/woff2"
};
function startServer(root) {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
      if (p.endsWith("/")) p += "index.html";
      const file = path.join(root, p);
      if (!file.startsWith(root)) { res.writeHead(403); return res.end(); }
      fs.readFile(file, (err, data) => {
        if (err) { res.writeHead(404); return res.end("Not found"); }
        res.writeHead(200, { "Content-Type": MIME[path.extname(file).toLowerCase()] || "application/octet-stream" });
        res.end(data);
      });
    });
    server.listen(0, "127.0.0.1", () => resolve(server));
  });
}

/* ---------- helpers ---------- */
function parseRobots(txt) {
  const rules = []; let applies = false, inAgents = false;
  for (const raw of txt.split(/\r?\n/)) {
    const line = raw.replace(/#.*/, "").trim(); if (!line) continue;
    const m = line.match(/^([A-Za-z-]+)\s*:\s*(.*)$/); if (!m) continue;
    const field = m[1].toLowerCase(), val = m[2].trim();
    if (field === "user-agent") { if (!inAgents) applies = false; inAgents = true; if (val === "*") applies = true; continue; }
    inAgents = false;
    if (applies && field === "disallow" && val) {
      const re = "^" + val.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\\\$$/, "$");
      try { rules.push(new RegExp(re)); } catch {}
    }
  }
  return rules;
}
function gitInfo(root) {
  try {
    const sha = execSync("git rev-parse --short HEAD", { cwd: root }).toString().trim();
    const msg = execSync("git log -1 --format=%s", { cwd: root }).toString().trim();
    return { sha, msg };
  } catch { return null; }
}
function normalize(href, base, origin) {
  let u;
  try { u = new URL(href, base); } catch { return null; }
  if (u.origin !== origin) return null;
  if (!/^https?:$/.test(u.protocol)) return null;
  const ext = path.extname(u.pathname).toLowerCase();
  if (ext && ext !== ".html" && ext !== ".htm") return null;
  u.hash = "";
  const kept = new URLSearchParams();
  for (const k of KEEP_QUERY) if (u.searchParams.has(k)) kept.set(k, u.searchParams.get(k));
  u.search = kept.toString() ? "?" + kept.toString() : "";
  if (u.pathname.endsWith("/index.html")) u.pathname = u.pathname.slice(0, -10);
  return u.toString();
}
function pageKey(url, origin) {
  const u = new URL(url);
  let k = u.pathname.replace(/^\//, "") || "index.html";
  if (k.endsWith("/")) k += "index.html";
  return k + u.search;
}
function slugify(key) {
  return key.replace(/\.html?/g, "").replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "home";
}
function typeBucket(cdpType, mime, url) {
  const t = (cdpType || "").toLowerCase();
  if (t === "document") return "html";
  if (t === "stylesheet") return "css";
  if (t === "script") return "js";
  if (t === "image") return "img";
  if (t === "font") return "font";
  if (t === "media") return "media";
  if (/css/.test(mime)) return "css";
  if (/javascript/.test(mime)) return "js";
  if (/image/.test(mime)) return "img";
  if (/video|audio/.test(mime)) return "media";
  if (/font|woff/.test(mime) || /\.woff2?($|\?)/.test(url)) return "font";
  return "other";
}

/* ---------- beeldbewerking in de browser (geen npm-pakketten nodig) ---------- */
async function makeImageTools(browser) {
  const page = await browser.newPage();
  await page.setContent("<canvas id=c></canvas>");
  return {
    async resize(pngBuf, width, maxHeight, quality = 0.82) {
      return Buffer.from(await page.evaluate(async ({ src, width, maxHeight, quality }) => {
        const img = new Image(); img.src = src; await img.decode();
        const scale = width / img.naturalWidth;
        const h = Math.min(Math.round(img.naturalHeight * scale), maxHeight);
        const c = document.createElement("canvas"); c.width = width; c.height = h;
        const ctx = c.getContext("2d");
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(img, 0, 0, img.naturalWidth, img.naturalHeight * 1, 0, 0, width, img.naturalHeight * scale);
        return c.toDataURL("image/jpeg", quality).split(",")[1];
      }, { src: "data:image/png;base64," + pngBuf.toString("base64"), width, maxHeight, quality }), "base64");
    },
    /* Vergelijkt twee afbeeldingen op dezelfde breedte; geeft % gewijzigde pixels
       en een diff-beeld (huidige pagina gedimd, wijzigingen in magenta). */
    async diff(prevJpg, currJpg) {
      const r = await page.evaluate(async ({ a, b }) => {
        const load = async (s) => { const i = new Image(); i.src = s; await i.decode(); return i; };
        const [ia, ib] = await Promise.all([load(a), load(b)]);
        const w = ib.naturalWidth;
        const ha = Math.round(ia.naturalHeight * (w / ia.naturalWidth));
        const hb = ib.naturalHeight;
        const h = Math.max(ha, hb);
        const mk = () => { const c = document.createElement("canvas"); c.width = w; c.height = h; return c; };
        const ca = mk(), cb = mk();
        const xa = ca.getContext("2d"), xb = cb.getContext("2d");
        xa.fillStyle = xb.fillStyle = "#fff"; xa.fillRect(0, 0, w, h); xb.fillRect(0, 0, w, h);
        xa.drawImage(ia, 0, 0, w, ha); xb.drawImage(ib, 0, 0, w, hb);
        const da = xa.getImageData(0, 0, w, h).data, db = xb.getImageData(0, 0, w, h);
        const out = new ImageData(w, h);
        let changed = 0;
        const total = w * h;
        for (let p = 0; p < da.length; p += 4) {
          const y = Math.floor(p / 4 / w);
          const outside = y >= ha || y >= hb;
          const d = Math.abs(da[p] - db.data[p]) + Math.abs(da[p + 1] - db.data[p + 1]) + Math.abs(da[p + 2] - db.data[p + 2]);
          const hit = outside || d > 60; // drempel tegen JPEG-ruis
          if (hit) { changed++; out.data[p] = 236; out.data[p + 1] = 38; out.data[p + 2] = 143; out.data[p + 3] = 255; }
          else {
            const g = (db.data[p] + db.data[p + 1] + db.data[p + 2]) / 3;
            const v = 200 + g * 0.2;
            out.data[p] = out.data[p + 1] = out.data[p + 2] = v; out.data[p + 3] = 255;
          }
        }
        const co = mk(); co.getContext("2d").putImageData(out, 0, 0);
        return { pct: (changed / total) * 100, img: co.toDataURL("image/jpeg", 0.8).split(",")[1] };
      }, { a: "data:image/jpeg;base64," + prevJpg.toString("base64"), b: "data:image/jpeg;base64," + currJpg.toString("base64") });
      return { pct: r.pct, img: Buffer.from(r.img, "base64") };
    },
    close: () => page.close()
  };
}

/* ---------- één pagina meten ---------- */
async function measurePage(browser, url) {
  const context = await browser.newContext({ viewport: VIEWPORT, reducedMotion: "reduce", serviceWorkers: "block" });
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send("Network.enable");
  await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });

  const reqs = new Map();
  cdp.on("Network.requestWillBeSent", (e) => reqs.set(e.requestId, { url: e.request.url, type: e.type, mime: "", transfer: 0, decoded: 0, status: 0 }));
  cdp.on("Network.responseReceived", (e) => { const r = reqs.get(e.requestId); if (r) { r.mime = e.response.mimeType; r.status = e.response.status; r.type = e.type || r.type; } });
  cdp.on("Network.dataReceived", (e) => { const r = reqs.get(e.requestId); if (r) r.decoded += e.dataLength; });
  cdp.on("Network.loadingFinished", (e) => { const r = reqs.get(e.requestId); if (r) r.transfer = e.encodedDataLength; });
  cdp.on("Network.loadingFailed", (e) => { const r = reqs.get(e.requestId); if (r) { r.failed = e.errorText || "failed"; r.blocked = e.blockedReason || null; } });

  let status = 0, error = null;
  try {
    const resp = await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
    status = resp ? resp.status() : 0;
  } catch (e) { error = e.message.split("\n")[0]; }
  await page.waitForTimeout(1800); // preloader / fonts / JS-render laten afronden

  const info = await page.evaluate(() => {
    const nav = performance.getEntriesByType("navigation")[0];
    return {
      title: document.title,
      links: [...document.querySelectorAll("a[href]")].map((a) => a.getAttribute("href")),
      domNodes: document.getElementsByTagName("*").length,
      inlineSvg: document.querySelectorAll("svg").length,
      images: document.images.length,
      height: document.documentElement.scrollHeight,
      domContentLoaded: nav ? Math.round(nav.domContentLoadedEventEnd) : null,
      load: nav ? Math.round(nav.loadEventEnd) : null
    };
  }).catch(() => ({ title: "", links: [], domNodes: 0, inlineSvg: 0, images: 0, height: 0 }));

  const viewportPng = await page.screenshot({ type: "png" });
  const fullPng = await page.screenshot({ type: "png", fullPage: true });
  await context.close();

  const byType = {};
  let transfer = 0, decoded = 0, count = 0;
  const resources = [], failed = [];
  for (const r of reqs.values()) {
    if (r.url.startsWith("data:")) continue;
    if (r.failed) { failed.push({ url: r.url, type: typeBucket(r.type, r.mime, r.url), error: r.failed }); continue; }
    const b = typeBucket(r.type, r.mime, r.url);
    byType[b] = byType[b] || { bytes: 0, count: 0 };
    byType[b].bytes += r.transfer; byType[b].count++;
    transfer += r.transfer; decoded += r.decoded; count++;
    resources.push({ url: r.url, type: b, bytes: r.transfer, status: r.status });
  }
  resources.sort((a, b) => b.bytes - a.bytes);
  return { status, error, info, viewportPng, fullPng, weight: { transfer, decoded, requests: count, byType }, resources, failed };
}

/* ---------- vergelijken met vorige meting ---------- */
function latestRunBefore(currentId) {
  if (!fs.existsSync(RUNS_DIR)) return null;
  const ids = fs.readdirSync(RUNS_DIR).filter((d) => d < currentId && fs.existsSync(path.join(RUNS_DIR, d, "run.json"))).sort();
  return ids.length ? ids[ids.length - 1] : null;
}

/* ---------- hoofdprogramma ---------- */
(async () => {
  let server = null, baseUrl;
  const root = path.resolve(args.root || REPO_ROOT);
  if (args.url) { baseUrl = new URL(args.url).toString(); RUNS_DIR = path.join(TOOL_DIR, "runs", new URL(baseUrl).hostname.replace(/^www\./, "")); }
  else {
    server = await startServer(root);
    baseUrl = `http://127.0.0.1:${server.address().port}/`;
  }
  const origin = new URL(baseUrl).origin;
  const git = args.url ? null : gitInfo(root);
  const now = new Date();
  const runId = now.toISOString().replace(/[:.]/g, "-").replace("Z", "");
  const runDir = path.join(RUNS_DIR, runId);
  fs.mkdirSync(runDir, { recursive: true });

  const browser = await chromium.launch();
  const imgs = await makeImageTools(browser);

  /* robots.txt respecteren (User-agent: *) */
  let disallow = [];
  if (args.url && !args["ignore-robots"]) {
    const rp = await browser.newPage();
    try {
      const resp = await rp.goto(origin + "/robots.txt", { timeout: 15000 });
      if (resp && resp.ok()) disallow = parseRobots(await resp.text());
    } catch {}
    await rp.close();
    if (disallow.length) console.log(`robots.txt: ${disallow.length} uitgesloten paden`);
  }
  /* eigen uitsluitingen, bv. --exclude /webwinkel (productoverzichten en productpagina's overslaan) */
  const excludes = String(args.exclude || "").split(",").map((s) => s.trim()).filter(Boolean).map((s) => (s.startsWith("/") ? s : "/" + s));
  if (excludes.length) console.log(`overgeslagen: ${excludes.join(", ")}`);
  const excludeRe = args["exclude-pattern"] ? new RegExp(args["exclude-pattern"]) : null;
  if (excludeRe) console.log(`overgeslagen patroon: ${excludeRe}`);
  const allowed = (u) => {
    const x = new URL(u);
    if (excludeRe && excludeRe.test(x.pathname.replace(/\/$/, ""))) return false;
    if (excludes.some((e) => x.pathname === e || x.pathname.startsWith(e.replace(/\/$/, "") + "/"))) return false;
    return !disallow.some((re) => re.test(x.pathname + x.search));
  };

  const start = normalize(baseUrl, baseUrl, origin);
  const queue = [{ url: start, parent: null, depth: 0 }];
  const seen = new Set([start]);
  const pages = [];

  while (queue.length && pages.length < MAX_PAGES) {
    const { url, parent, depth } = queue.shift();
    const key = pageKey(url, origin);
    process.stdout.write(`  · ${key} ... `);
    const m = await measurePage(browser, url);
    const slug = slugify(key);
    fs.writeFileSync(path.join(runDir, `${slug}.jpg`), await imgs.resize(m.viewportPng, 640, 400));
    fs.writeFileSync(path.join(runDir, `${slug}-full.jpg`), await imgs.resize(m.fullPng, 420, 4000, 0.78));

    const links = [];
    for (const href of m.info.links) {
      const n = normalize(href, url, origin);
      if (!n) continue;
      const lk = pageKey(n, origin);
      if (lk !== key && !links.includes(lk)) links.push(lk);
      if (!seen.has(n) && allowed(n)) { seen.add(n); queue.push({ url: n, parent: key, depth: depth + 1 }); }
    }
    pages.push({
      key, slug, url, parent, depth, status: m.status, error: m.error,
      title: m.info.title, links,
      weight: m.weight,
      dom: { nodes: m.info.domNodes, svg: m.info.inlineSvg, images: m.info.images, height: m.info.height },
      timing: { domContentLoaded: m.info.domContentLoaded, load: m.info.load },
      resources: m.resources.slice(0, 25),
      failed: m.failed
    });
    console.log(`${(m.weight.transfer / 1024).toFixed(1)} KB, ${m.weight.requests} req`);
  }

  /* vergelijking */
  const prevId = latestRunBefore(runId);
  let prev = null;
  if (prevId) prev = JSON.parse(fs.readFileSync(path.join(RUNS_DIR, prevId, "run.json"), "utf8"));
  const prevByKey = new Map((prev ? prev.pages : []).map((p) => [p.key, p]));
  for (const p of pages) {
    const o = prevByKey.get(p.key);
    if (!prev) { p.compare = { status: "baseline" }; continue; }
    if (!o) { p.compare = { status: "new" }; continue; }
    const prevFull = path.join(RUNS_DIR, prevId, `${o.slug}-full.jpg`);
    let visual = null;
    if (fs.existsSync(prevFull)) {
      const d = await imgs.diff(fs.readFileSync(prevFull), fs.readFileSync(path.join(runDir, `${p.slug}-full.jpg`)));
      fs.writeFileSync(path.join(runDir, `${p.slug}-diff.jpg`), d.img);
      visual = +d.pct.toFixed(2);
    }
    const byType = {};
    for (const t of new Set([...Object.keys(p.weight.byType), ...Object.keys(o.weight.byType)])) {
      byType[t] = ((p.weight.byType[t] || {}).bytes || 0) - ((o.weight.byType[t] || {}).bytes || 0);
    }
    const dBytes = p.weight.transfer - o.weight.transfer;
    const changed = Math.abs(dBytes) > 64 || p.weight.requests !== o.weight.requests || (visual !== null && visual > 0.5) || p.dom.nodes !== o.dom.nodes;
    p.compare = {
      status: changed ? "changed" : "same",
      prevSlug: o.slug,
      transfer: dBytes, requests: p.weight.requests - o.weight.requests,
      domNodes: p.dom.nodes - o.dom.nodes, height: p.dom.height - o.dom.height,
      visual, byType,
      prevTransfer: o.weight.transfer
    };
  }
  const removed = prev ? prev.pages.filter((o) => !pages.some((p) => p.key === o.key)).map((o) => ({ key: o.key, slug: o.slug, title: o.title, parent: o.parent, depth: o.depth, transfer: o.weight.transfer })) : [];

  await imgs.close();
  await browser.close();
  if (server) server.close();

  const run = {
    id: runId, date: now.toISOString(), base: args.url ? baseUrl : "(lokaal) " + path.relative(REPO_ROOT, root || ".") || ".",
    label: args.label || (git ? `${git.sha} — ${git.msg}` : baseUrl),
    git, viewport: VIEWPORT, excludes: String(args.exclude || "").split(",").filter(Boolean), excludePattern: args["exclude-pattern"] || null, previous: prevId, removed, pages
  };
  fs.writeFileSync(path.join(runDir, "run.json"), JSON.stringify(run, null, 2));
  console.log(`\nMeting opgeslagen: ${path.relative(REPO_ROOT, runDir)}  (${pages.length} pagina's${prevId ? `, vergeleken met ${prevId}` : ", eerste meting"})`);

  require("./build-report.cjs").build(runId, RUNS_DIR);
})().catch((e) => { console.error(e); process.exit(1); });
