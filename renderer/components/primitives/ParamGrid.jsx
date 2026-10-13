import React from "react"
import styles from "./ParamGrid.module.css"

/**
 * A row of form parameters that reflows to the width actually available.
 *
 * Replaces the `<Row><Col>...</Col></Row>` pattern used across the extraction
 * pages. Those rows never reflowed: of the 45 `<Col>` elements on the
 * DataManager and BatchExtractor pages only 3 carried a breakpoint prop, so a
 * three-column row stayed three columns at every size -- squashed at 1366px,
 * stretched to 1250px-wide controls at 4K.
 *
 * WHY NOT A CONTAINER QUERY
 * The audit called for container queries rather than viewport media queries,
 * because these pages render inside resizable flexlayout panels whose width is
 * unrelated to the viewport. That reasoning holds, but `@container` needs an
 * ancestor with `container-type`, and `container-type` makes that ancestor a
 * containing block for absolutely positioned descendants. PrimeReact defaults
 * to `appendTo: null`, so every Dropdown and MultiSelect panel on these pages is
 * absolutely positioned INSIDE the form. Adding containment above them risks
 * mis-positioning or clipping every overlay in the app -- a regression that only
 * shows up when a menu is open, which is exactly what a static snapshot cannot
 * catch.
 *
 * `repeat(auto-fit, minmax(...))` gets the same result intrinsically: the grid
 * responds to its own available width with no query, no breakpoint and no
 * containment. It is the stronger tool here, not the compromise.
 *
 * @param {ReactNode} children One element per parameter. Plain <div>s are fine;
 *   there is no Col wrapper and no breakpoint prop to choose.
 * @param {string} className Extra classes, e.g. the existing `form-group-box`
 *   card styling, which Phase 4 replaces with <SectionCard>.
 * @param {string} min Minimum column width before the grid drops to fewer
 *   columns. Defaults to `clamp(15rem, 22vw, 20rem)`. Widen it for rows whose
 *   controls need more room (long file paths), narrow it for compact rows.
 * @param {string} as Element to render. Defaults to "div".
 */
const ParamGrid = ({ children, className = "", min, as: Tag = "div", style, ...rest }) => {
  const mergedStyle = min ? { ...style, "--med-paramgrid-min": min } : style

  return (
    <Tag className={`${styles.grid} ${className}`.trim()} style={mergedStyle} {...rest}>
      {children}
    </Tag>
  )
}

/**
 * The row's label and help text, spanning every column.
 *
 * Needed because in the old `<Row>` markup the label and the help paragraph
 * were direct children of the row. Left as-is inside a grid they would each
 * take a column and sit beside the first control instead of above the row.
 */
const Header = ({ children, className = "", ...rest }) => (
  <div className={`${styles.header} ${className}`.trim()} {...rest}>
    {children}
  </div>
)

/** A field that spans the whole row whatever the current column count. */
const Full = ({ children, className = "", ...rest }) => (
  <div className={`${styles.full} ${className}`.trim()} {...rest}>
    {children}
  </div>
)

ParamGrid.Header = Header
ParamGrid.Full = Full

export default ParamGrid
export { styles as paramGridStyles }
