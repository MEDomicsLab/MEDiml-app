#!/usr/bin/env node
/**
 * Computed-style baseline for the MEDiml-app renderer stylesheets.
 *
 * Runs under the project's own Electron binary, so the rendering engine is
 * exactly the Chromium that ships with the app (Electron 21 -> Chromium 106) --
 * not a separately installed browser that might disagree.
 *
 * It loads every stylesheet in the real order used by renderer/pages/_app.js,
 * mounts a fixture DOM covering the selectors the CSS refactor touches, and
 * records getComputedStyle() for each probe at several window widths.
 *
 * Purpose: prove that a CSS-only change is a no-op. A declaration the browser
 * already drops as invalid must produce a byte-identical snapshot once removed.
 * For a CSS-only diff this is stronger evidence than a screenshot comparison,
 * and it does not require booting the app, MongoDB or the Python backend.
 *
 * CommonJS on purpose: Electron 21 has no ESM support in the main process.
 *
 * Usage:
 *   npx electron utilScripts/css-snapshot.cjs out.json     capture
 *   node  utilScripts/css-snapshot.cjs --diff a.json b.json  compare
 *
 * OUT OF SCOPE: moduleLanding.css is loaded (it is part of the real cascade and
 * excluding it would make the snapshot unfaithful) but is never modified.
 */

const { readFileSync, writeFileSync, unlinkSync } = require("node:fs")
const { join } = require("node:path")
const { pathToFileURL } = require("node:url")

const ROOT = join(__dirname, "..")

// --------------------------------------------------------------------------
// Diff mode runs under plain node; no Electron needed.
// --------------------------------------------------------------------------
if (process.argv.includes("--diff")) {
  const rest = process.argv.slice(process.argv.indexOf("--diff") + 1)
  const before = JSON.parse(readFileSync(rest[0], "utf8"))
  const after = JSON.parse(readFileSync(rest[1], "utf8"))
  const diffs = []
  for (const width of Object.keys(before)) {
    for (const probe of Object.keys(before[width] || {})) {
      const x = before[width][probe]
      const y = (after[width] || {})[probe]
      if (!y) {
        diffs.push(`${width}px ${probe}: MISSING in after`)
        continue
      }
      for (const prop of Object.keys(x)) {
        if (x[prop] !== y[prop]) diffs.push(`${width}px  ${probe}  ${prop}: "${x[prop]}" -> "${y[prop]}"`)
      }
    }
  }
  if (diffs.length === 0) {
    console.log("\n  No computed-style differences. The change is a verified no-op.\n")
    process.exit(0)
  }
  console.log(`\n  ${diffs.length} computed-style difference(s):\n`)
  diffs.forEach((d) => console.log(`    ${d}`))
  console.log("")
  process.exit(1)
}

// --------------------------------------------------------------------------
// Snapshot mode (runs under Electron).
// --------------------------------------------------------------------------
const { app, BrowserWindow } = require("electron")

const WIDTHS = [420, 1366, 1920, 2560, 3840]

const PROPS = [
  "display",
  "position",
  "width",
  "height",
  "margin-top",
  "margin-right",
  "margin-bottom",
  "margin-left",
  "padding-top",
  "padding-right",
  "padding-bottom",
  "padding-left",
  "border-top-width",
  "border-right-width",
  "border-bottom-width",
  "border-left-width",
  "border-top-left-radius",
  "border-top-right-radius",
  "font-family",
  "font-size",
  "font-weight",
  "font-style",
  "line-height",
  "text-align",
  "color",
  "background-color",
  "box-shadow",
  "flex-direction",
  "justify-content",
  "align-items",
  // Resolved grid tracks. This is how the ParamGrid reflow is verified: the
  // computed value lists one length per column, so its length IS the column
  // count at that width.
  "grid-template-columns",
  "grid-column-start",
  "grid-column-end",
  "gap",
  "flex-grow",
  "flex-basis",
  "overflow-x",
  "overflow-y",
  "top",
  "right",
  "bottom",
  "left",
  "content",
  "z-index",
  "opacity",
  "max-width",
  "min-width"
]

/**
 * Fixture DOM. Each probe reproduces the real markup structure around a
 * selector the refactor touches, so the computed values are meaningful.
 */
const FIXTURE_BODY = `
<div class="html-body">
  <div class="icon-sidebar" id="p-icon-sidebar"></div>
  <div class="main-app-container">
    <div class="module-page with-shadow">
      <div class="module-page-subdiv">

        <!-- extractionMEDiml.css: .docLink / .docLink-image (quoted values) -->
        <p class="docLink" id="p-doclink">
          <img class="docLink-image" id="p-doclink-image" alt="" width="24" height="24">
          <u><a href="#" id="p-doclink-anchor">Documentation</a></u>
        </p>

        <!-- extractionMEDiml.css: .inputFile (display: flexbox) -->
        <form class="inputFile" id="p-inputfile">
          <label class="csv-file" id="p-csv-label">Path to CSV File</label>
          <div class="form-group" id="p-form-group"><input type="file"></div>
        </form>

        <!-- extractionMEDiml.css: .form-group-box, the main layout primitive -->
        <div class="row form-group-box" id="p-form-group-box">
          <div class="col" id="p-col">
            <h6 id="p-col-h6">Label</h6>
            <p id="p-col-caption">Caption text</p>
          </div>
        </div>

        <div class="warning-message" id="p-warning"></div>
        <div class="standard-form" id="p-standard-form"></div>
        <button class="upload-button" id="p-upload-button"></button>
        <button class="results-button" id="p-results-button"></button>
        <button class="viewButton" id="p-viewbutton"></button>
        <img class="viewImage" id="p-viewimage" alt="">
        <div class="cute-box" id="p-cutebox"></div>

        <!-- reactFlow.css: .minimapStyle (height: 120, unitless) -->
        <div class="minimapStyle" id="p-minimap"></div>

        <!-- workspaceSidebar.css / inputPage.css accordion probes -->
        <div class="card-accordion" id="p-card-accordion">
          <div class="accordion-header" id="p-accordion-header">
            <button class="accordion-button" id="p-accordion-button"><div><p id="p-accordion-p">x</p></div></button>
          </div>
          <div class="accordion-body" id="p-accordion-body"></div>
        </div>
        <button class="sidebar-file-main-button" id="p-sidebar-file-btn"></button>

        <div class="progress-bar-requests" id="p-progress"><label id="p-progress-label">x</label></div>
        <div class="center-page" id="p-center-page"></div>

        <!-- ParamGrid (Phase 3). Class names are the raw ones from
             ParamGrid.module.css; CSS Modules hash them at build time, so this
             tests the stylesheet rather than the React binding. What matters
             here is grid-template-columns: it reports the actual column count
             at each width, which is the behaviour Phase 3 exists to deliver. -->
        <div class="form-group-box grid" id="p-paramgrid">
          <label id="p-pg-label">Saving Options</label>
          <p id="p-pg-caption">Folder to where the processed data will be saved</p>
          <div id="p-pg-field-1"><input type="text"></div>
          <div id="p-pg-field-2"><input type="text"></div>
          <div id="p-pg-field-3"><input type="text"></div>
        </div>

        <!-- Phase 4 primitives. The legacy .form-group-box is probed beside
             the new .card so the diff shows exactly what retiring it changes:
             padding, text-align, font-weight and elevation.
             (No backticks in here: FIXTURE_BODY is a template literal.) -->
        <!-- .form-group-box was deleted in Phase 5. This probe asserts it stays
             deleted: every value here should be a UA default. -->
        <div class="form-group-box" id="p-legacy-box">
          <label id="p-legacy-label">Legacy row</label>
          <p id="p-legacy-caption">Should be unstyled</p>
        </div>

        <!-- The card applied to a Bootstrap .row, which is how 30 call sites
             use it mid-migration. Guards against the row's -12px side margins
             making the card overhang its container. -->
        <div class="row card" id="p-row-card">
          <div class="col" id="p-row-card-col">field</div>
        </div>

        <section class="card grid" id="p-sectioncard">
          <header class="header" id="p-sc-header"><h3 class="title" id="p-sc-title">Pre-checks input</h3></header>
          <label id="p-sc-label">ROI definitions</label>
          <p class="caption" id="p-sc-caption">CSV listing the scans to check and their associated ROIs.</p>
          <div class="field" id="p-field">
            <div class="labelRow" id="p-field-labelrow">
              <label class="label" id="p-field-label">ROI definitions</label>
              <span class="badge" id="p-field-badge">optional</span>
              <button type="button" class="info" id="p-field-info">i</button>
            </div>
            <div class="control" id="p-field-control"><input type="text"></div>
            <p class="value" id="p-field-value">C:\\data\\STS-McGill\\scan.npy</p>
          </div>
        </section>

        <!-- SectionCard row layout. Raw class names again: CSS Modules hash
             them at build time, so this covers the stylesheet. -->
        <section class="card cardRow" id="p-rowcard">
          <div class="rowTitle" id="p-row-title"><h3 class="title" id="p-row-h3">Save folder</h3></div>
          <div class="grid rowBody" id="p-row-body"><div id="p-row-ctl"><input type="text"></div></div>
          <div class="rowHint" id="p-row-hint">Where the results are written.</div>
        </section>

        <div class="toolbar" id="p-toolbar">
          <button id="p-toolbar-primary">RUN</button>
          <button id="p-toolbar-secondary">Show results</button>
        </div>
      </div>
    </div>
  </div>
</div>`

/** Pseudo-elements worth probing: several of the defects live in ::before/::after. */
const PSEUDO_PROBES = [
  ["#p-accordion-button", "::before"],
  ["#p-accordion-button", "::after"],
  ["#p-icon-sidebar", "::after"]
]

/**
 * Design tokens whose RESOLVED value is recorded on :root.
 *
 * This exists because computed-style equality alone cannot tell a working token
 * from a broken one. `body { font-family: var(--font-family) }` with
 * --font-family undefined is an invalid declaration, so body falls back to
 * inheriting the identical stack from :root -- the rendered result is the same
 * either way. Recording the token's own value is the only way to prove it
 * actually resolves. An unresolved custom property reads as "".
 */
const TOKEN_PROBES = [
  "--font-family",
  "--med-font-sans",
  "--med-font-mono",
  "--med-text-sm",
  "--med-text-base",
  "--med-space-4",
  "--med-surface-card",
  "--med-surface-inverse",
  "--med-text-primary",
  "--med-border-subtle",
  "--med-accent",
  "--med-elev-2",
  "--med-radius-md",
  "--med-density",
  "--med-card-title-col",
  "--med-row-gap",
  "--sidebar-width",
  "--med-shadow"
]

function buildFixtureHtml() {
  // Derive the stylesheet list (and order) from _app.js so the snapshot can
  // never drift from what the app actually loads.
  //
  // `--app <path>` points at an alternative _app.js. That is what makes an
  // import-order change verifiable: snapshot the old order and the new one,
  // then diff, without having to edit the real file twice.
  const appArg = process.argv.indexOf("--app")
  const appPath = appArg !== -1 ? process.argv[appArg + 1] : join(ROOT, "renderer", "pages", "_app.js")
  const appJs = readFileSync(appPath, "utf8")
  const imports = []
  const re = /^import\s+"([^"]+\.css)"/gm
  let m
  while ((m = re.exec(appJs)) !== null) imports.push(m[1])

  const links = imports
    .map((spec) => {
      const abs = spec.startsWith("../") ? join(ROOT, "renderer", "pages", spec) : join(ROOT, "node_modules", spec)
      return `<link rel="stylesheet" href="${pathToFileURL(abs).href}">`
    })
    .join("\n")

  // CSS Modules are imported by their component, not by _app.js, so they have
  // to be listed here to be covered.
  const moduleSheets = ["ParamGrid", "Caption", "SectionCard", "Field", "Toolbar", "Disclosure", "Hint"]
    .map((n) => join(ROOT, "renderer", "components", "primitives", `${n}.module.css`))
    .map((p) => `<link rel="stylesheet" href="${pathToFileURL(p).href}">`)
    .join("\n")

  // Force the scrollbar to be permanently present.
  //
  // Without this, adding probes to the fixture eventually makes the page tall
  // enough to scroll, a vertical scrollbar appears, and EVERY element loses the
  // scrollbar's width (8px here, from globals.css's `::-webkit-scrollbar`).
  // That shows up as a uniform width change across every probe and reads
  // exactly like a global regression -- including on elements the change never
  // touched. Reserving the gutter unconditionally keeps measurements stable as
  // the fixture grows. It is applied only to the fixture, never to the app.
  // Make measurements independent of how much content the fixture holds.
  //
  // Two separate ways adding a probe used to shift EVERY existing probe and
  // read like a global regression:
  //   1. the page grew tall enough to scroll, and the scrollbar narrowed the
  //      viewport (`overflow-y: scroll` reserves the gutter unconditionally);
  //   2. globals.css sizes the container chain in vh/100%, so once content
  //      overflowed, an inner container took its own scrollbar -- costing every
  //      descendant another 8px.
  // Letting the fixture's containers grow to their content removes both. This
  // is fixture-only; the app keeps its real heights.
  const stableGutter =
    "<style>html { overflow-y: scroll; }" +
    ".html-body, .main-app-container, .module-page, .module-page-subdiv" +
    " { height: auto !important; max-height: none !important; overflow: visible !important; }</style>"

  return `<!doctype html><html><head><meta charset="utf-8">\n${links}\n${moduleSheets}\n${stableGutter}\n</head><body>${FIXTURE_BODY}</body></html>`
}

const outPath = process.argv[2] || join(ROOT, "css-snapshot.json")

app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false, width: 1366, height: 900 })

  const tmp = join(ROOT, ".css-snapshot-fixture.html")
  writeFileSync(tmp, buildFixtureHtml())
  await win.loadURL(pathToFileURL(tmp).href)

  const result = {}
  for (const width of WIDTHS) {
    // Device emulation, NOT win.setContentSize(). setContentSize is clamped by
    // the display work area, so on a 2560px monitor a request for 3840 silently
    // leaves the window at its previous size and the run reports the PREVIOUS
    // width's measurements -- a false "no differences" or a phantom diff.
    // enableDeviceEmulation overrides the viewport regardless of the physical
    // display, so every width is measured faithfully on any machine.
    win.webContents.enableDeviceEmulation({
      screenPosition: "desktop",
      screenSize: { width, height: 900 },
      viewSize: { width, height: 900 },
      viewPosition: { x: 0, y: 0 },
      deviceScaleFactor: 1,
      scale: 1
    })
    await new Promise((r) => setTimeout(r, 150)) // let layout settle

    // Fail loudly rather than silently recording the wrong width.
    const actual = await win.webContents.executeJavaScript("window.innerWidth")
    if (actual !== width) {
      console.error(`\n  ERROR: requested viewport ${width}px but measured ${actual}px.`)
      console.error("  Refusing to write a snapshot that would misreport the layout.\n")
      app.exit(2)
      return
    }

    result[width] = await win.webContents.executeJavaScript(`
      (() => {
        const props = ${JSON.stringify(PROPS)};
        const pseudo = ${JSON.stringify(PSEUDO_PROBES)};
        const out = {};
        for (const el of document.querySelectorAll("[id^='p-']")) {
          const cs = getComputedStyle(el);
          const o = {};
          for (const p of props) o[p] = cs.getPropertyValue(p);
          out["#" + el.id] = o;
        }
        for (const [sel, pe] of pseudo) {
          const el = document.querySelector(sel);
          if (!el) continue;
          const cs = getComputedStyle(el, pe);
          const o = {};
          for (const p of props) o[p] = cs.getPropertyValue(p);
          out[sel + pe] = o;
        }
        // Viewport bookkeeping. A scrollbar appearing or disappearing shifts
        // the width of EVERY element by its thickness, which reads exactly like
        // a global regression. Recording it here makes such a diff explain
        // itself instead of sending the next reader hunting.
        out[":viewport"] = {
          innerWidth: String(window.innerWidth),
          clientWidth: String(document.documentElement.clientWidth),
          scrollbarWidth: String(window.innerWidth - document.documentElement.clientWidth),
          htmlOverflowY: getComputedStyle(document.documentElement).overflowY
        };
        const rootCs = getComputedStyle(document.documentElement);
        const tokens = {};
        for (const t of ${JSON.stringify(TOKEN_PROBES)}) {
          tokens[t] = rootCs.getPropertyValue(t).trim();
        }
        out[":root tokens"] = tokens;
        return out;
      })()
    `)
  }

  // Density and focus modes. Both are driven by state that the static probes
  // above never enter -- a `data-density` attribute and :focus-visible -- so
  // they would otherwise be entirely unverified.
  result.modes = await win.webContents.executeJavaScript(`
    (() => {
      const root = document.documentElement;
      const card = document.querySelector("#p-sectioncard");
      const read = () => {
        const cs = getComputedStyle(card);
        const rs = getComputedStyle(root);
        return {
          density: rs.getPropertyValue("--med-density").trim(),
          cardPadding: cs.paddingLeft,
          rowGap: getComputedStyle(document.querySelector("#p-paramgrid")).rowGap,
          fontSize: cs.fontSize
        };
      };
      // Density is FIXED. The Comfortable/Compact control was removed, so a
      // data-density attribute must now have no effect at all. Asserting that is
      // more useful than measuring two modes that no longer exist: if
      // densityAttributeIgnored ever reads false, a density variant is back.
      const base = read();
      root.setAttribute("data-density", "comfortable");
      const withAttribute = read();
      root.removeAttribute("data-density");
      const densityAttributeIgnored = JSON.stringify(base) === JSON.stringify(withAttribute);

      // :focus-visible cannot be triggered synthetically, so assert the rule
      // exists and resolves instead of trying to focus something.
      let focusRule = null;
      for (const sheet of document.styleSheets) {
        let rules;
        try { rules = sheet.cssRules; } catch (e) { continue; }
        for (const r of rules) {
          if (r.selectorText === ":focus-visible") focusRule = r.style.outline || r.style.outlineColor;
        }
      }
      return { density: base, densityAttributeIgnored, focusVisibleRule: focusRule };
    })()
  `)

  win.webContents.disableDeviceEmulation()
  writeFileSync(outPath, JSON.stringify(result, null, 2) + "\n")
  const probes = Object.keys(result[WIDTHS[0]]).length
  console.log(`\n  Snapshot: ${probes} probes x ${WIDTHS.length} widths x ${PROPS.length} properties`)
  console.log(`  -> ${outPath}\n`)

  try {
    unlinkSync(tmp)
  } catch (e) {
    /* ignore */
  }
  app.exit(0)
})
