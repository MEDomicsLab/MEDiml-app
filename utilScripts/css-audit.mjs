#!/usr/bin/env node
/**
 * CSS health audit + regression ratchet for the MEDiml-app renderer.
 *
 * Measures the metrics that the CSS refactoring roadmap is meant to drive down,
 * and compares them against a committed baseline (css-baseline.json).
 *
 * The ratchet only ever allows metrics to improve:
 *   - a metric that goes DOWN  -> fine, and the baseline should be refreshed
 *   - a metric that goes UP    -> the run fails
 *
 * This is what makes the phased refactor safe: no phase can silently undo an
 * earlier one, and no new page can reintroduce inline styles or !important.
 *
 * Usage:
 *   node utilScripts/css-audit.mjs            report + ratchet against baseline
 *   node utilScripts/css-audit.mjs --write    refresh the baseline (after an
 *                                             intentional improvement)
 *   node utilScripts/css-audit.mjs --json     machine-readable output
 *
 * OUT OF SCOPE: the "MEDiml Modules" landing page is excluded from every
 * metric. See EXCLUDED below. Do not remove those entries.
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs"
import { readdir } from "node:fs/promises"
import { join, relative, sep, basename } from "node:path"
import { fileURLToPath } from "node:url"
import stylelint from "stylelint"

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..")
const BASELINE = join(ROOT, "css-baseline.json")

// ---------------------------------------------------------------------------
// OUT OF SCOPE — the MEDiml Modules landing page must remain exactly as it is.
// These two paths are excluded from every metric and every phase of the CSS
// refactor. DO NOT REMOVE.
// ---------------------------------------------------------------------------
const EXCLUDED = ["renderer/styles/moduleLanding.css", "renderer/components/mainPages/modulesLandingPage.jsx"]

const isExcluded = (relPath) => EXCLUDED.includes(relPath)

/** Recursively collect files under `dir` matching one of `exts`. */
async function walk(dir, exts, acc = []) {
  let entries
  try {
    entries = await readdir(dir, { withFileTypes: true })
  } catch {
    return acc
  }
  for (const e of entries) {
    const full = join(dir, e.name)
    if (e.isDirectory()) {
      if (e.name === "node_modules" || e.name.startsWith(".")) continue
      await walk(full, exts, acc)
    } else if (exts.some((x) => e.name.endsWith(x))) {
      acc.push(full)
    }
  }
  return acc
}

const rel = (p) => relative(ROOT, p).split(sep).join("/")

async function main() {
  // Both the global stylesheets and the component-level CSS Modules. Auditing
  // only renderer/styles would exempt the entire CSS Modules architecture that
  // Phases 4-5 are built on -- exactly the code that most needs the guardrails.
  const styleFiles = (await walk(join(ROOT, "renderer", "styles"), [".css"]))
    .concat(await walk(join(ROOT, "renderer", "components"), [".css"]))
    .filter((f) => !isExcluded(rel(f)))
  const jsxFiles = (await walk(join(ROOT, "renderer", "components"), [".jsx", ".js"]))
    .concat(await walk(join(ROOT, "renderer", "pages"), [".jsx", ".js"]))
    .filter((f) => !isExcluded(rel(f)))

  const metrics = {}
  const detail = {}

  // --- stylelint ----------------------------------------------------------
  const lint = await stylelint.lint({
    files: styleFiles.map((f) => f.split(sep).join("/")),
    formatter: "json"
  })
  const byRule = {}
  let errors = 0
  let warnings = 0
  for (const res of lint.results) {
    for (const w of res.warnings) {
      byRule[w.rule] = (byRule[w.rule] || 0) + 1
      if (w.severity === "error") errors++
      else warnings++
    }
  }
  metrics.stylelintErrors = errors
  metrics.stylelintWarnings = warnings
  detail.stylelintByRule = byRule

  // --- inline style props in JSX -----------------------------------------
  // The second, undeclared style layer. Target: 0 outside of genuinely
  // dynamic values (computed positions, chart colours).
  let inlineStyles = 0
  let captionPattern = 0
  let unresponsiveCols = 0
  const inlineByFile = {}
  // The copy-pasted "italic helper paragraph" that the roadmap replaces with
  // a single <Caption> component.
  const CAPTION = /fontSize:\s*"1[23]px",\s*fontStyle:\s*"italic"/g
  for (const f of jsxFiles) {
    const raw = readFileSync(f, "utf8")
    // Block comments are stripped first. A JSDoc block quoting the inline style
    // a component replaces is documentation, not an instance of the pattern --
    // Caption.jsx's own docblock was being counted as one of the 70 copies.
    const src = raw.replace(/\/\*[\s\S]*?\*\//g, "")
    const n = (src.match(/style=\{\{/g) || []).length
    if (n) inlineByFile[rel(f)] = n
    inlineStyles += n
    captionPattern += (src.match(CAPTION) || []).length
    // A Bootstrap <Col> with no breakpoint prop is `flex: 1 0 0%` forever: it
    // never reflows, at any width. This counts the ones still left.
    for (const tag of src.match(/<Col(\s[^>]*)?>/g) || []) {
      if (!/\b(xs|sm|md|lg|xl|xxl)=/.test(tag)) unresponsiveCols++
    }
  }
  metrics.inlineStyleProps = inlineStyles
  metrics.captionPatternCopies = captionPattern
  metrics.unresponsiveCols = unresponsiveCols
  detail.inlineStylesByFile = Object.fromEntries(Object.entries(inlineByFile).sort((a, b) => b[1] - a[1]))

  // --- raw values in CSS --------------------------------------------------
  const hexes = new Set()
  const pxValues = new Set()
  let importants = 0
  let mediaQueries = 0
  let containerQueries = 0
  const selectorOwners = {}

  for (const f of styleFiles) {
    const src = readFileSync(f, "utf8")
    // Comments are stripped before counting raw values. A comment explaining
    // that controls used to stretch to 1250px is documentation, not debt, and
    // counting it punishes writing the explanation down.
    const code = src.replace(/\/\*[\s\S]*?\*\//g, "")

    // tokens.css is the palette's definition, so literal values there are the
    // point, not debt. Counting them would make defining a token look like a
    // regression and push people to avoid the token layer. Everywhere else, a
    // raw value is exactly what these metrics exist to drive to zero.
    const isTokenSource = rel(f).endsWith("styles/tokens.css")
    if (!isTokenSource) {
      for (const m of code.match(/#[0-9a-fA-F]{3,8}\b/g) || []) hexes.add(m.toLowerCase())
      for (const m of code.match(/\b\d+px\b/g) || []) pxValues.add(m)
      importants += (code.match(/!important/g) || []).length
    }
    // Responsive queries only: prefers-color-scheme is not a breakpoint.
    for (const m of src.match(/@media[^{]+/g) || []) {
      if (!/prefers-color-scheme|prefers-reduced-motion|print/.test(m)) mediaQueries++
    }
    containerQueries += (src.match(/@container/g) || []).length
    // Intrinsically responsive CSS counts too, and is usually the better tool.
    // A `repeat(auto-fill, minmax(...))` grid or a `clamp()` size adapts to the
    // space actually available with no breakpoint to maintain -- which matters
    // here because these pages live in resizable panels, not the viewport.
    containerQueries += (src.match(/repeat\(\s*auto-(fill|fit)/g) || []).length
    containerQueries += (src.match(/clamp\(/g) || []).length

    // Top-level selectors, for cross-file duplicate detection. Stylelint's
    // no-duplicate-selectors only works within a single file.
    //
    // CSS Modules are skipped: their class names are hashed at build time, so
    // `.card` in SectionCard.module.css and `.card` in any other module are
    // different names in the output and cannot collide. Counting them as
    // duplicates would penalise the scoping that removes the collisions this
    // metric exists to find -- and would push people back to global CSS.
    if (!rel(f).endsWith(".module.css")) {
      for (const m of code.matchAll(/(^|[}\n])\s*([.#][^{}@;]+?)\s*\{/g)) {
        const sel = m[2].trim().replace(/\s+/g, " ")
        if (!sel || sel.includes("\n")) continue
        ;(selectorOwners[sel] ||= new Set()).add(rel(f))
      }
    }
  }
  metrics.uniqueHexColors = hexes.size
  metrics.distinctPxValues = pxValues.size
  metrics.importantCount = importants
  metrics.responsiveQueries = -mediaQueries - containerQueries // negative: MORE is better
  detail.responsiveQueriesActual = mediaQueries + containerQueries

  const crossFileDupes = Object.entries(selectorOwners)
    .filter(([, files]) => files.size > 1)
    .map(([sel, files]) => ({ selector: sel, files: [...files] }))
  metrics.crossFileDuplicateSelectors = crossFileDupes.length
  detail.crossFileDuplicateSelectors = crossFileDupes

  // --- dead stylesheets ---------------------------------------------------
  const allSource = (await walk(join(ROOT, "renderer"), [".js", ".jsx"]))
    .map((f) => readFileSync(f, "utf8"))
    .join("\n")
  const dead = styleFiles.map(rel).filter((p) => !allSource.includes(basename(p)))
  metrics.deadStylesheets = dead.length
  detail.deadStylesheets = dead

  // --- token migration report ---------------------------------------------
  // `--tokens` lists every raw value still in the stylesheets next to the token
  // that should replace it, split into EXACT matches (the token holds the same
  // value, so the swap is a byte-identical no-op and can be made mechanically)
  // and NEAR matches (a judgement call that needs design review, never a
  // codemod). This is what keeps the Phase 4-5 migration honest: the exact list
  // is safe to automate, the near list is not.
  if (process.argv.includes("--tokens")) {
    const tokensCss = readFileSync(join(ROOT, "renderer", "styles", "tokens.css"), "utf8")
    // Only the light :root block; the opt-in dark block would give duplicates.
    const lightBlock = tokensCss.split('[data-theme="dark"]')[0]
    const tokenMap = {}
    for (const m of lightBlock.matchAll(/(--med-[\w-]+)\s*:\s*([^;]+);/g)) {
      tokenMap[m[1]] = m[2].trim()
    }

    const norm = (hex) => {
      let h = hex.toLowerCase()
      if (h.length === 4) h = "#" + [...h.slice(1)].map((c) => c + c).join("")
      return h
    }
    const rgb = (hex) => {
      const h = norm(hex)
      if (h.length < 7) return null
      return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]
    }

    const colorTokens = Object.entries(tokenMap).filter(([, v]) => /^#[0-9a-f]{3,8}$/i.test(v))
    const spaceTokens = Object.entries(tokenMap).filter(([k, v]) => /^--med-(space|radius|text)-/.test(k) && /rem|px$/.test(v))

    const exact = []
    const near = []
    // tokens.css defines the palette; scanning it would just self-match.
    for (const f of styleFiles.filter((f) => !rel(f).endsWith("tokens.css"))) {
      const src = readFileSync(f, "utf8")
      const seen = new Set()
      for (const raw of src.match(/#[0-9a-fA-F]{3,6}\b/g) || []) {
        if (seen.has(raw)) continue
        seen.add(raw)
        // ALL tokens sharing the value, not just the first. Several values map
        // to more than one token (#dfdfdf is both --med-surface-sunken and
        // --med-text-inverse), and only the surrounding property says which is
        // meant. Swapping in the wrong one is invisible but leaves the code
        // lying about intent.
        const hits = colorTokens.filter(([, v]) => norm(v) === norm(raw)).map(([k]) => k)
        if (hits.length) {
          exact.push({ file: rel(f), raw, token: hits.join(" | ") })
          continue
        }
        const a = rgb(raw)
        if (!a) continue
        let best = null
        for (const [k, v] of colorTokens) {
          const b = rgb(v)
          if (!b) continue
          const d = Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])
          if (!best || d < best.d) best = { k, d }
        }
        if (best) near.push({ file: rel(f), raw, token: best.k, dist: Math.round(best.d) })
      }
    }

    console.log("\n  Token migration report")
    console.log("  (MEDiml Modules landing page excluded)\n")
    console.log(`  EXACT -- identical value, so the swap cannot change a pixel (${exact.length}).`)
    console.log("  Still read the surrounding property: where two tokens share a value,")
    console.log("  both are listed and only one is semantically right.\n")
    for (const e of exact) console.log(`    ${e.raw.padEnd(10)} -> ${e.token.padEnd(42)} ${e.file}`)
    console.log(`\n  NEAR -- needs design review, do NOT codemod (${near.length}):`)
    for (const n of near.sort((a, b) => a.dist - b.dist).slice(0, 40)) {
      console.log(`    ${n.raw.padEnd(10)} ~ ${n.token.padEnd(26)} d=${String(n.dist).padStart(3)}  ${n.file}`)
    }
    if (near.length > 40) console.log(`    ... and ${near.length - 40} more`)
    console.log(`\n  Spacing tokens available: ${spaceTokens.map(([k]) => k).join(", ")}\n`)
    return 0
  }

  // --- report -------------------------------------------------------------
  const json = process.argv.includes("--json")
  const write = process.argv.includes("--write")

  if (json) {
    // Return immediately: appending the human report or the ratchet output
    // after the JSON would make it unparseable.
    console.log(JSON.stringify({ metrics, detail }, null, 2))
    return 0
  }
  {
    const label = {
      stylelintErrors: "stylelint errors (real defects)",
      stylelintWarnings: "stylelint warnings (migration debt)",
      inlineStyleProps: "inline style={{}} props in JSX",
      captionPatternCopies: "copy-pasted caption paragraphs",
      uniqueHexColors: "unique hex colours",
      distinctPxValues: "distinct px values",
      importantCount: "!important declarations",
      crossFileDuplicateSelectors: "selectors defined in >1 file",
      deadStylesheets: "stylesheets imported nowhere",
      unresponsiveCols: "<Col> with no breakpoint (never reflows)",
      responsiveQueries: "responsive/intrinsic CSS constructs (more is better)"
    }
    console.log("\n  CSS health — MEDiml-app renderer")
    console.log("  (MEDiml Modules landing page excluded)\n")
    for (const [k, v] of Object.entries(metrics)) {
      const shown = k === "responsiveQueries" ? detail.responsiveQueriesActual : v
      console.log(`  ${String(shown).padStart(6)}  ${label[k] || k}`)
    }
    console.log("")
  }

  if (write) {
    writeFileSync(BASELINE, JSON.stringify(metrics, null, 2) + "\n")
    console.log(`  baseline written -> ${rel(BASELINE)}\n`)
    return 0
  }

  if (!existsSync(BASELINE)) {
    console.error("  No css-baseline.json found. Create one with: npm run css:baseline\n")
    return 1
  }

  // --- ratchet ------------------------------------------------------------
  const base = JSON.parse(readFileSync(BASELINE, "utf8"))
  const regressions = []
  const improvements = []
  for (const [k, v] of Object.entries(metrics)) {
    if (!(k in base)) continue
    if (v > base[k]) regressions.push(`${k}: ${base[k]} -> ${v}`)
    else if (v < base[k]) improvements.push(`${k}: ${base[k]} -> ${v}`)
  }

  if (improvements.length) {
    console.log("  Improved since baseline:")
    improvements.forEach((i) => console.log(`    + ${i}`))
    console.log("\n  Refresh the baseline with: npm run css:baseline\n")
  }

  if (regressions.length) {
    console.error("  CSS REGRESSION — these metrics got worse:")
    regressions.forEach((r) => console.error(`    ! ${r}`))
    console.error("\n  Use a design token or a CSS Module instead of a raw value or inline style.")
    console.error("  See the CSS refactoring roadmap for the intended pattern.\n")
    return 1
  }

  console.log("  No CSS regressions.\n")
  return 0
}

process.exit(await main())
