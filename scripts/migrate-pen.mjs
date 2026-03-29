#!/usr/bin/env node

/**
 * migrate-pen.mjs
 *
 * 既存の .pen ファイルを pencil.dev 正式フォーマット (v2.9) に変換する。
 *
 * 変換内容:
 * - version: "1.0" → "2.9"
 * - fill: [{ type: "solid", color: X }] → X (文字列)
 * - stroke: { fills: [...], thickness, align } → { fill: X, thickness }
 * - padding: { top, right, bottom, left } → [top, right, bottom, left]
 * - cornerRadius: number → [n, n, n, n]
 * - refId → ref, overrides → descendants
 * - トップ要素に x, y 追加
 *
 * Usage: node scripts/migrate-pen.mjs
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { resolve, join, relative } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");

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
// Transform fill: [{ type: "solid", color: X }] → X
// ---------------------------------------------------------------------------
function migrateFill(fill) {
  if (Array.isArray(fill) && fill.length === 1 && fill[0].type === "solid") {
    return fill[0].color;
  }
  if (Array.isArray(fill) && fill.length > 1) {
    // Multiple fills → keep as array of strings
    return fill.map((f) => (f.type === "solid" ? f.color : f));
  }
  return fill;
}

// ---------------------------------------------------------------------------
// Transform stroke: { fills: [...], thickness, align } → { fill, thickness }
// ---------------------------------------------------------------------------
function migrateStroke(stroke) {
  if (!stroke) return stroke;
  if (stroke.fills && Array.isArray(stroke.fills)) {
    const fill = migrateFill(stroke.fills);
    const result = { fill, thickness: stroke.thickness || 1 };
    return result;
  }
  return stroke;
}

// ---------------------------------------------------------------------------
// Transform padding: { top, right, bottom, left } → [top, right, bottom, left]
// ---------------------------------------------------------------------------
function migratePadding(padding) {
  if (padding && typeof padding === "object" && !Array.isArray(padding)) {
    const t = padding.top ?? 0;
    const r = padding.right ?? 0;
    const b = padding.bottom ?? 0;
    const l = padding.left ?? 0;
    // Simplify: if all same → [n], if symmetric → [tb, rl]
    if (t === r && r === b && b === l) return [t];
    if (t === b && r === l) return [t, r];
    return [t, r, b, l];
  }
  return padding;
}

// ---------------------------------------------------------------------------
// Transform cornerRadius: number → [n, n, n, n]
// ---------------------------------------------------------------------------
function migrateCornerRadius(cr) {
  if (typeof cr === "number") {
    return [cr, cr, cr, cr];
  }
  return cr;
}

// ---------------------------------------------------------------------------
// Recursively migrate a node
// ---------------------------------------------------------------------------
function migrateNode(node, isTopLevel = false) {
  if (Array.isArray(node)) {
    return node.map((child, i) => migrateNode(child, isTopLevel));
  }
  if (!node || typeof node !== "object") return node;

  const out = {};

  for (const [key, value] of Object.entries(node)) {
    switch (key) {
      case "fill":
        out.fill = migrateFill(value);
        break;
      case "stroke":
        out.stroke = migrateStroke(value);
        break;
      case "padding":
        out.padding = migratePadding(value);
        break;
      case "cornerRadius":
        out.cornerRadius = migrateCornerRadius(value);
        break;
      case "refId":
        out.ref = value;
        break;
      case "overrides":
        out.descendants = migrateDescendants(value);
        break;
      case "children":
        out.children = Array.isArray(value)
          ? value.map((child) => migrateNode(child, false))
          : value;
        break;
      case "content":
        // Pencil uses "text" for text content, not "content"
        out.text = value;
        break;
      case "fontSize":
        out.fontSize = value;
        break;
      case "fontWeight":
        out.fontWeight = value;
        break;
      case "lineHeight":
        out.lineHeight = value;
        break;
      case "textAlign":
        out.textAlign = value;
        break;
      default:
        out[key] = value;
        break;
    }
  }

  return out;
}

// ---------------------------------------------------------------------------
// Transform overrides → descendants
// overrides: { "child-id": { prop: val } }
// descendants: { "child-id": { prop: val } }  (same structure, different key + migrate inner props)
// ---------------------------------------------------------------------------
function migrateDescendants(overrides) {
  if (!overrides || typeof overrides !== "object") return overrides;
  const desc = {};
  for (const [id, props] of Object.entries(overrides)) {
    desc[id] = migrateNode(props);
  }
  return desc;
}

// ---------------------------------------------------------------------------
// Migrate a full document
// ---------------------------------------------------------------------------
function migrateDocument(doc) {
  const result = {
    version: "2.9",
  };

  // Migrate variables (keep as-is, pencil uses same structure)
  if (doc.variables) {
    result.variables = doc.variables;
  }

  // Migrate imports
  if (doc.imports) {
    // Pencil imports is an object { alias: path }, not array
    // But if it's an array of paths, convert
    if (Array.isArray(doc.imports)) {
      const importsObj = {};
      for (const path of doc.imports) {
        importsObj[path] = path;
      }
      result.imports = importsObj;
    } else {
      result.imports = doc.imports;
    }
  }

  // Migrate children - top-level need x and y
  if (doc.children) {
    let yPos = 0;
    result.children = doc.children.map((child) => {
      const migrated = migrateNode(child, true);
      // Add x, y if missing (top-level)
      if (migrated.x === undefined) migrated.x = 0;
      if (migrated.y === undefined) {
        migrated.y = yPos;
        yPos += (migrated.height || 100) + 40;
      }
      return migrated;
    });
  } else {
    result.children = [];
  }

  return result;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
function main() {
  const penFiles = findPenFiles(join(ROOT, "src"));
  let count = 0;

  for (const file of penFiles) {
    const raw = readFileSync(file, "utf-8");
    const doc = JSON.parse(raw);

    // Skip if already migrated
    if (doc.version === "2.9") {
      console.log(`SKIP (already v2.9): ${relative(ROOT, file)}`);
      continue;
    }

    const migrated = migrateDocument(doc);
    writeFileSync(file, JSON.stringify(migrated, null, 2) + "\n");
    console.log(`MIGRATED: ${relative(ROOT, file)}`);
    count++;
  }

  console.log(`\nDone: ${count} files migrated.`);
}

main();
