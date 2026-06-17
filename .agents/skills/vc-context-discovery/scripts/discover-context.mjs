#!/usr/bin/env node
// Auto-discovery for vc-context-discovery.
// Lists nested files under context/protocol/feature/plan roots and extracts ONLY
// the leading YAML frontmatter block of each .md file (no whole-file parsing).
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const root = execSync("git rev-parse --show-toplevel").toString().trim();

// --- arg parsing -----------------------------------------------------------
const args = process.argv.slice(2);
let feature = null;
let asJson = false;
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === "--json") asJson = true;
  else if (a === "--feature") {
    feature = args[++i];
    if (!feature) {
      console.error("--feature requires a value");
      process.exit(2);
    }
  } else if (a.startsWith("--feature=")) {
    feature = a.slice("--feature=".length);
  } else {
    console.error(`unknown flag: ${a}`);
    process.exit(2);
  }
}

// --- helpers ---------------------------------------------------------------
function walk(dir, out = []) {
  const abs = path.join(root, dir);
  if (!fs.existsSync(abs)) return out; // never throw on missing root
  for (const entry of fs.readdirSync(abs, { withFileTypes: true })) {
    const rel = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(rel, out);
    else out.push(rel);
  }
  return out;
}

function stripQuotes(v) {
  const t = v.trim();
  if (
    (t.startsWith('"') && t.endsWith('"')) ||
    (t.startsWith("'") && t.endsWith("'"))
  ) {
    return t.slice(1, -1);
  }
  return t;
}

// Read only the first ~60 lines and extract a leading `---` frontmatter block.
// Minimal line parser: top-level `key: value` plus one level of `metadata:` nesting.
function readFrontmatter(relPath) {
  let head;
  try {
    const buf = fs.readFileSync(path.join(root, relPath), "utf8");
    head = buf.split("\n", 80);
  } catch {
    return null;
  }
  if (head.length === 0 || head[0].trim() !== "---") return null;

  let end = -1;
  for (let i = 1; i < head.length; i++) {
    if (head[i].trim() === "---") {
      end = i;
      break;
    }
  }
  if (end === -1) return null; // no closing delimiter within window

  const top = {};
  const metadata = {};
  let inMetadata = false;
  for (let i = 1; i < end; i++) {
    const line = head[i];
    if (line.trim() === "" || line.trim().startsWith("#")) continue;
    const indent = line.length - line.trimStart().length;
    const m = line.trim().match(/^([A-Za-z0-9_-]+):(.*)$/);
    if (!m) continue;
    const key = m[1];
    const rawVal = m[2].trim();

    if (key === "metadata" && rawVal === "") {
      inMetadata = true;
      continue;
    }
    if (inMetadata && indent >= 2) {
      metadata[key] = stripQuotes(rawVal);
    } else {
      inMetadata = false;
      if (rawVal !== "") top[key] = stripQuotes(rawVal);
    }
  }

  return {
    name: top.name ?? null,
    description: top.description ?? null,
    date: top.date ?? null,
    type: top.type ?? metadata.type ?? null,
    feature: top.feature ?? metadata.feature ?? null,
    phase: top.phase ?? metadata.phase ?? null,
    readOrder: metadata.read_order ?? null,
    required: metadata.required === "true",
    readWhen: metadata.read_when ?? null,
    hasFrontmatter: true,
  };
}

function describe(relPath) {
  const fm = relPath.endsWith(".md") ? readFrontmatter(relPath) : null;
  return { path: relPath, fm };
}

// --- collect ---------------------------------------------------------------
const contextFiles = walk("process/context").map(describe);
const protocolFiles = walk("process/development-protocols").map(describe);
const generalPlanFiles = walk("process/general-plans/active").map(describe);

let featureFiles = [];
if (feature) {
  featureFiles = walk(`process/features/${feature}`).map(describe);
}

// --- output ----------------------------------------------------------------
function line(d) {
  if (d.fm && (d.fm.name || d.fm.description)) {
    return `  ${d.path} (name: ${d.fm.name ?? "—"} — description: ${d.fm.description ?? "—"})`;
  }
  return `  ${d.path}`;
}

// Richer renderer for protocol files: name — description — read_when, with a [REQUIRED] tag.
function protocolLine(d) {
  if (!(d.fm && (d.fm.name || d.fm.description))) return `  ${d.path}`;
  const tag = d.fm.required ? "[REQUIRED] " : "";
  return `  ${tag}${d.path} (name: ${d.fm.name ?? "—"} — description: ${d.fm.description ?? "—"} — read_when: ${d.fm.readWhen ?? "—"})`;
}

// Sort protocols: required first, then by numeric read_order, then by path.
function sortedProtocols(list) {
  return [...list].sort((a, b) => {
    const ar = a.fm?.required ? 0 : 1;
    const br = b.fm?.required ? 0 : 1;
    if (ar !== br) return ar - br;
    const ao = Number(a.fm?.readOrder ?? 99);
    const bo = Number(b.fm?.readOrder ?? 99);
    if (ao !== bo) return ao - bo;
    return a.path.localeCompare(b.path);
  });
}

function withFm(list) {
  return list.filter((d) => d.fm && (d.fm.name || d.fm.description));
}
function withoutFm(list) {
  return list.filter((d) => !(d.fm && (d.fm.name || d.fm.description)));
}

if (asJson) {
  const out = {
    feature: feature ?? null,
    context: contextFiles.map((d) => ({ path: d.path, ...(d.fm ?? { hasFrontmatter: false }) })),
    protocols: protocolFiles.map((d) => ({ path: d.path, ...(d.fm ?? { hasFrontmatter: false }) })),
    features: featureFiles.map((d) => ({ path: d.path, ...(d.fm ?? { hasFrontmatter: false }) })),
    generalPlansActive: generalPlanFiles.map((d) => ({ path: d.path, ...(d.fm ?? { hasFrontmatter: false }) })),
  };
  console.log(JSON.stringify(out, null, 2));
  process.exit(0);
}

const lines = [];
lines.push("Context files with frontmatter:");
for (const d of withFm(contextFiles)) lines.push(line(d));

lines.push("");
lines.push("Protocol files (required first, then read order):");
for (const d of sortedProtocols(protocolFiles)) lines.push(protocolLine(d));

if (feature) {
  lines.push("");
  lines.push(`Feature files (by subfolder) — ${feature}:`);
  // group by the subfolder directly under the feature root (active/completed/backlog/reports/references)
  const base = `process/features/${feature}/`;
  const groups = new Map();
  for (const d of featureFiles) {
    const rest = d.path.startsWith(base) ? d.path.slice(base.length) : d.path;
    const sub = rest.split(path.sep)[0] || ".";
    if (!groups.has(sub)) groups.set(sub, []);
    groups.get(sub).push(d);
  }
  for (const sub of [...groups.keys()].sort()) {
    lines.push(`  [${sub}/]`);
    for (const d of groups.get(sub)) lines.push(line(d));
  }
}

lines.push("");
lines.push("Active general plans:");
for (const d of generalPlanFiles) lines.push(line(d));

lines.push("");
lines.push("Files without frontmatter (path only):");
const noFm = [
  ...withoutFm(contextFiles),
  ...withoutFm(protocolFiles),
  ...withoutFm(featureFiles),
  ...withoutFm(generalPlanFiles),
];
for (const d of noFm) lines.push(`  ${d.path}`);

console.log(lines.join("\n"));
process.exit(0);
