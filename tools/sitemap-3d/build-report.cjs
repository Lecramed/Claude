#!/usr/bin/env node
/* ===================================================================
   Sitemap 3D — rapportbouwer
   Leest een meting (runs/<id>/run.json) plus de vorige meting en
   schrijft report/index.html + report/img/*.
   Los te draaien:  node tools/sitemap-3d/build-report.cjs [run-id]
=================================================================== */
"use strict";

const fs = require("fs");
const path = require("path");

const TOOL_DIR = __dirname;
let RUNS_DIR = path.join(TOOL_DIR, "runs", "local");
let OUT_DIR = path.join(TOOL_DIR, "report", "local");

function readRun(id) {
  return JSON.parse(fs.readFileSync(path.join(RUNS_DIR, id, "run.json"), "utf8"));
}
function b64(file) {
  return fs.existsSync(file) ? "data:image/jpeg;base64," + fs.readFileSync(file).toString("base64") : null;
}

/* Boomstructuur voor de weergave: pagina's met hetzelfde pad en een andere
   query (zoals product.html?id=…) krijgen als ouder de pagina die naar de
   meeste van die varianten linkt (bv. de shop i.p.v. de homepage). */
function treeParents(pages) {
  const byPath = new Map();
  for (const p of pages) {
    const base = p.key.split("?")[0];
    if (!p.key.includes("?")) continue;
    if (!byPath.has(base)) byPath.set(base, []);
    byPath.get(base).push(p.key);
  }
  const parent = new Map(pages.map((p) => [p.key, p.parent]));
  for (const members of byPath.values()) {
    if (members.length < 2) continue;
    let best = null, bestN = 0;
    for (const p of pages) {
      if (members.includes(p.key)) continue;
      const n = p.links.filter((l) => members.includes(l)).length;
      if (n > bestN) { best = p.key; bestN = n; }
    }
    if (best) for (const m of members) parent.set(m, best);
  }
  const depth = new Map();
  const d = (k, guard = 0) => {
    if (depth.has(k)) return depth.get(k);
    const par = parent.get(k);
    const v = !par || guard > 50 ? 0 : d(par, guard + 1) + 1;
    depth.set(k, v); return v;
  };
  return pages.map((p) => ({ key: p.key, parent: parent.get(p.key), depth: d(p.key) }));
}

/* Leesbare paginanamen: de titel als die uniek is, anders afgeleid uit het pad
   (bv. "Vacature/Monteur-Afleveraar/VAC01322" → "Monteur Afleveraar (VAC01322)"). */
function pageNames(pages) {
  const first = (t) => (t || "").split(/\s[—|–-]\s/)[0].trim();
  const count = new Map();
  pages.forEach((p) => { const t = first(p.title); count.set(t, (count.get(t) || 0) + 1); });
  const fromPath = (key) => {
    const u = new URL(key, "http://x/");
    const id = u.searchParams.get("id");
    if (id) return { name: id, code: null };
    const segs = u.pathname.split("/").filter(Boolean).map((s) => { try { return decodeURIComponent(s); } catch { return s; } });
    if (!segs.length || /^index\.html?$/.test(segs[0])) return { name: "Home", code: null };
    const code = segs.length > 1 && /^[A-Z]{2,}\d{3,}$/.test(segs[segs.length - 1]) ? segs.pop() : null;
    return { name: segs[segs.length - 1], code, section: segs.length > 1 ? segs[0] : null };
  };
  const pretty = (s) => s.replace(/\.html?$/, "").replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim().replace(/^./, (c) => c.toUpperCase());
  const names = pages.map((p) => {
    const t = first(p.title);
    if (t && count.get(t) === 1 && !/not be found|404/i.test(t)) return t;
    const f = fromPath(p.key);
    let n = pretty(f.name);
    if (f.section && !f.code) n = pretty(f.section) + " · " + n;
    return f.code ? `${n} (${f.code})` : n;
  });
  return new Map(pages.map((p, i) => [p.key, names[i]]));
}

function build(runId, runsDir) {
  if (runsDir) { RUNS_DIR = runsDir; OUT_DIR = path.join(TOOL_DIR, "report", path.basename(runsDir)); }
  if (!runId) {
    const ids = fs.readdirSync(RUNS_DIR).filter((d) => fs.existsSync(path.join(RUNS_DIR, d, "run.json"))).sort();
    runId = ids[ids.length - 1];
  }
  const run = readRun(runId);
  const prev = run.previous ? readRun(run.previous) : null;
  const runDir = path.join(RUNS_DIR, runId);
  const prevDir = run.previous ? path.join(RUNS_DIR, run.previous) : null;

  fs.rmSync(OUT_DIR, { recursive: true, force: true });
  fs.mkdirSync(path.join(OUT_DIR, "img"), { recursive: true });
  const copy = (src, name) => {
    if (!src || !fs.existsSync(src)) return null;
    fs.copyFileSync(src, path.join(OUT_DIR, "img", name));
    return "img/" + name;
  };

  const tree = new Map(treeParents(run.pages).map((t) => [t.key, t]));
  const names = pageNames([...run.pages, ...(run.removed || [])]);
  const pages = run.pages.map((p) => {
    const c = p.compare || {};
    return {
      key: p.key, name: names.get(p.key), title: p.title, url: p.url, status: p.status, error: p.error,
      parent: tree.get(p.key).parent, depth: tree.get(p.key).depth, links: p.links,
      weight: p.weight, dom: p.dom, timing: p.timing, resources: p.resources.slice(0, 8), failed: p.failed || [],
      compare: c,
      thumb: b64(path.join(runDir, `${p.slug}.jpg`)),
      prevThumb: c.prevSlug ? b64(path.join(prevDir, `${c.prevSlug}.jpg`)) : null,
      full: copy(path.join(runDir, `${p.slug}-full.jpg`), `${p.slug}-now.jpg`),
      prevFull: c.prevSlug ? copy(path.join(prevDir, `${c.prevSlug}-full.jpg`), `${p.slug}-prev.jpg`) : null,
      diff: copy(path.join(runDir, `${p.slug}-diff.jpg`), `${p.slug}-diff.jpg`)
    };
  });
  const removed = (run.removed || []).map((r) => ({
    ...r, name: names.get(r.key), prevThumb: b64(path.join(prevDir, `${r.slug}.jpg`)),
    prevFull: copy(path.join(prevDir, `${r.slug}-full.jpg`), `${r.slug}-prev.jpg`)
  }));

  const history = fs.readdirSync(RUNS_DIR).filter((d) => d <= runId && fs.existsSync(path.join(RUNS_DIR, d, "run.json"))).sort().map((id) => {
    const r = readRun(id);
    return { id, date: r.date, label: r.label, pages: r.pages.length, transfer: r.pages.reduce((s, p) => s + p.weight.transfer, 0) };
  });

  const data = {
    run: { id: run.id, date: run.date, label: run.label, base: run.base, viewport: run.viewport },
    prev: prev ? { id: prev.id, date: prev.date, label: prev.label } : null,
    pages, removed, history
  };
  const json = JSON.stringify(data).replace(/</g, "\\u003c");
  for (const [tplName, outName] of [["template-city.html", "index.html"], ["template.html", "sitemap.html"]]) {
    const tpl = fs.readFileSync(path.join(TOOL_DIR, tplName), "utf8");
    const html = tpl.replace("/*__REPORT_DATA__*/null", () => json).replace("/*__CITY_SCENE__*/", () => fs.readFileSync(path.join(TOOL_DIR, "city-scene.js"), "utf8"));
    fs.writeFileSync(path.join(OUT_DIR, outName), html);
    console.log(`Rapport: ${path.relative(process.cwd(), path.join(OUT_DIR, outName))}  (${(html.length / 1024 / 1024).toFixed(1)} MB)`);
  }
}

module.exports = { build };
if (require.main === module) build(process.argv[3], process.argv[2] ? path.join(RUNS_DIR, "..", process.argv[2]) : undefined);
