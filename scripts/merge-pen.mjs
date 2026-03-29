#!/usr/bin/env node

/**
 * merge-pen.mjs
 *
 * 全 .pen ファイルを1つの design-preview.pen に統合する。
 * - tokens.pen の変数を全てインライン展開
 * - type: "ref" を実体コンポーネントに展開 (overrides 適用)
 * - 各コンポーネントをラベル付きでキャンバスに配置
 *
 * Usage: node scripts/merge-pen.mjs
 * Output: dist/design-preview.pen
 */

import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { resolve, join, basename, dirname, relative } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const OUT_DIR = join(ROOT, "dist");
const OUT_FILE = join(OUT_DIR, "design-preview.pen");

// ---------------------------------------------------------------------------
// 1. Discover all .pen files
// ---------------------------------------------------------------------------
function findPenFiles(dir) {
  const results = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory() && entry.name !== "node_modules" && entry.name !== "dist") {
      results.push(...findPenFiles(full));
    } else if (entry.isFile() && entry.name.endsWith(".pen")) {
      results.push(full);
    }
  }
  return results;
}

// ---------------------------------------------------------------------------
// 2. Load & parse tokens
// ---------------------------------------------------------------------------
function loadTokens(tokensPath) {
  const data = JSON.parse(readFileSync(tokensPath, "utf-8"));
  const vars = {};
  if (data.variables) {
    for (const [key, def] of Object.entries(data.variables)) {
      vars[key] = def.value;
    }
  }
  return vars;
}

// ---------------------------------------------------------------------------
// 3. Resolve $variable references deep in any JSON value
// ---------------------------------------------------------------------------
function resolveVars(node, vars) {
  if (typeof node === "string") {
    if (node.startsWith("$")) {
      const varName = node.slice(1);
      return vars[varName] !== undefined ? vars[varName] : node;
    }
    return node;
  }
  if (Array.isArray(node)) {
    return node.map((item) => resolveVars(item, vars));
  }
  if (node && typeof node === "object") {
    const out = {};
    for (const [k, v] of Object.entries(node)) {
      out[k] = resolveVars(v, vars);
    }
    return out;
  }
  return node;
}

// ---------------------------------------------------------------------------
// 4. Build reusable component registry (id → node)
// ---------------------------------------------------------------------------
function collectReusables(children, registry) {
  for (const child of children) {
    if (child.reusable && child.id) {
      registry[child.id] = child;
    }
    if (child.children) {
      collectReusables(child.children, registry);
    }
  }
}

// ---------------------------------------------------------------------------
// 5. Apply overrides to a deep-cloned component tree
// ---------------------------------------------------------------------------
function applyOverrides(node, overrides) {
  if (!overrides) return node;
  const clone = JSON.parse(JSON.stringify(node));
  applyOverridesRecursive(clone, overrides);
  return clone;
}

function applyOverridesRecursive(node, overrides) {
  if (node.id && overrides[node.id]) {
    Object.assign(node, overrides[node.id]);
  }
  if (node.children) {
    for (const child of node.children) {
      applyOverridesRecursive(child, overrides);
    }
  }
}

// ---------------------------------------------------------------------------
// 6. Expand ref nodes into actual component instances
// ---------------------------------------------------------------------------
function expandRefs(children, registry) {
  return children.map((child) => {
    if (child.type === "ref" && child.refId && registry[child.refId]) {
      const base = JSON.parse(JSON.stringify(registry[child.refId]));
      const expanded = applyOverrides(base, child.overrides);
      expanded.id = child.id;
      expanded.name = child.name || expanded.name;
      delete expanded.reusable;
      if (expanded.children) {
        expanded.children = expandRefs(expanded.children, registry);
      }
      return expanded;
    }
    if (child.children) {
      child.children = expandRefs(child.children, registry);
    }
    return child;
  });
}

// ---------------------------------------------------------------------------
// 7. Main: merge all .pen files into a single canvas
// ---------------------------------------------------------------------------
function main() {
  const penFiles = findPenFiles(join(ROOT, "src"));
  const tokensPath = join(ROOT, "src/styles/tokens.pen");

  // Load tokens
  const vars = loadTokens(tokensPath);

  // Load all .pen files (except tokens)
  const components = [];
  for (const file of penFiles) {
    if (file === tokensPath) continue;
    const data = JSON.parse(readFileSync(file, "utf-8"));
    const relPath = relative(ROOT, file);
    components.push({ path: relPath, data });
  }

  // Build reusable registry from all files
  const registry = {};
  for (const comp of components) {
    if (comp.data.children) {
      collectReusables(comp.data.children, registry);
    }
  }

  // Resolve vars + expand refs for each component
  const canvasChildren = [];
  let yOffset = 0;
  const SECTION_GAP = 60;
  const LABEL_HEIGHT = 30;

  // Define display order
  const order = [
    "src/layouts/HaLayout.pen",
    "src/components/ha/HaHeader/HaHeader.pen",
    "src/components/ha/HaEntryList/HaEntryList.pen",
    "src/components/ha/HaEntryCard/HaEntryCard.pen",
    "src/components/ha/HaBookmarkCount/HaBookmarkCount.pen",
    "src/components/ha/HaFooter/HaFooter.pen",
  ];

  const sorted = order
    .map((p) => components.find((c) => c.path === p))
    .filter(Boolean);

  // Add any not in order list
  for (const comp of components) {
    if (!sorted.includes(comp)) sorted.push(comp);
  }

  for (const comp of sorted) {
    // Section label
    canvasChildren.push({
      id: `label-${comp.path.replace(/[/\\. ]/g, "-")}`,
      type: "text",
      name: comp.path,
      x: 0,
      y: yOffset,
      width: 600,
      height: LABEL_HEIGHT,
      content: `── ${comp.path}`,
      fontSize: 14,
      fontWeight: "bold",
      fill: [{ type: "solid", color: "#666666" }],
    });
    yOffset += LABEL_HEIGHT;

    // Resolve variables
    let children = resolveVars(comp.data.children, vars);
    // Expand refs
    children = expandRefs(children, registry);

    // Position children
    for (const child of children) {
      child.x = 0;
      child.y = yOffset;
      // Remove reusable flag in preview
      delete child.reusable;
      canvasChildren.push(child);
      const h = child.height || 100;
      yOffset += h + 16;
    }

    yOffset += SECTION_GAP;
  }

  // Build output
  const output = {
    version: "1.0",
    name: "HN Hatena UI - Design Preview",
    width: 1440,
    height: yOffset,
    fill: [{ type: "solid", color: "#f8f8f8" }],
    children: canvasChildren,
  };

  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(OUT_FILE, JSON.stringify(output, null, 2));

  console.log(`Merged ${sorted.length} .pen files → ${relative(ROOT, OUT_FILE)}`);
  console.log(`Canvas: ${output.width} x ${output.height}`);
  console.log(`Components: ${canvasChildren.length} nodes`);
}

main();
