import React from "react"
import ParamGrid from "./ParamGrid"
import styles from "./SectionCard.module.css"
import useHint, { hintStyles } from "./useHint"

/**
 * A titled group of parameters. Replaces `.form-group-box`.
 *
 * Two layouts:
 *
 *   STACK (default) -- title above, body below. Byte-identical to what this
 *   component has always rendered, because `.card` is shared with 30 call sites
 *   outside these pages (settingsEditor.jsx, the learning nodes).
 *
 *   ROW (`row`) -- title and its info pill on the LEFT, controls on the RIGHT,
 *   on one line, wrapping to stacked on a narrow panel. Every card's controls
 *   begin at the same x because the title column is a fixed
 *   --med-card-title-col wide and every card shares --med-card-padding. That
 *   alignment is the point; see the CSS for the invariant it depends on.
 *
 * ONE CONTROL PER CARD is the intended shape in row mode: the title names the
 * parameter, so the control needs no label of its own. When a card genuinely
 * holds several parameters, wrap each in a <Field> with its own label -- but
 * prefer splitting it into two cards, which keeps every title in the same place.
 *
 * HINTS: put the hint here when the card holds one control; put it on the
 * <Field> when the card holds several. Two pill levels on one card is the
 * failure mode to avoid.
 *
 * @param {ReactNode} title Section heading. Renders an <h3>.
 * @param {ReactNode} icon Optional leading icon, decorative. A domain term like
 *   "ROI" has no universal glyph, so icons supplement text, never replace it.
 * @param {string} badge Short metadata beside the title, e.g. "optional".
 * @param {ReactNode} hint Togglable help text (see useHint.jsx -- not a tooltip).
 * @param {string} docHref Link into the MEDiml documentation.
 * @param {string} docLabel Link text.
 * @param {ReactNode} headerEnd Trailing header content. In row mode it sits
 *   beside the title inside the title column; in stack mode, at the far edge.
 * @param {boolean} row Use the horizontal layout.
 * @param {"start"|"center"} align Row cross-axis alignment. `center` only for a
 *   single short control with no sub-label.
 * @param {boolean} bare Row with no surface, for use inside <Disclosure>.
 * @param {string} bodyMin Minimum control-column width, forwarded to ParamGrid.
 * @param {boolean} raised Use the one elevation step. Reserve for the primary
 *   card on a page; if everything is raised, nothing is.
 */
const SectionCard = ({
  title,
  icon,
  badge,
  hint,
  docHref,
  docLabel,
  headerEnd,
  row = false,
  align = "start",
  bare = false,
  bodyMin,
  raised = false,
  warning = false,
  compact = false,
  className = "",
  children,
  ...rest
}) => {
  const { toggle, panel } = useHint({ hint, docHref, docLabel, label: typeof title === "string" ? title : undefined })

  const classes = [
    styles.card,
    row ? styles.cardRow : "",
    row && align === "center" ? styles.alignCenter : "",
    row && bare ? styles.bare : "",
    raised ? styles.raised : "",
    warning ? styles.warning : "",
    compact ? styles.compact : "",
    className
  ]
    .filter(Boolean)
    .join(" ")

  if (row) {
    return (
      <section className={classes} {...rest}>
        <div className={styles.rowTitle}>
          {icon && (
            <span className={styles.icon} aria-hidden="true">
              {icon}
            </span>
          )}
          {title && <h3 className={styles.title}>{title}</h3>}
          {badge && <span className={hintStyles.badge}>{badge}</span>}
          {toggle}
          {headerEnd}
        </div>

        {/* The body is a ParamGrid, not a plain block: a lone Dropdown in a
            block would stretch to ~3000px at 3840, which is exactly what
            ParamGrid's auto-fill tracks exist to prevent. */}
        <ParamGrid className={styles.rowBody} min={bodyMin}>
          {children}
        </ParamGrid>

        {panel && <div className={styles.rowHint}>{panel}</div>}
      </section>
    )
  }

  return (
    <section className={classes} {...rest}>
      {(title || icon || headerEnd) && (
        <header className={styles.header}>
          {icon && (
            <span className={styles.icon} aria-hidden="true">
              {icon}
            </span>
          )}
          {title && <h3 className={styles.title}>{title}</h3>}
          {headerEnd && <span className={styles.headerEnd}>{headerEnd}</span>}
        </header>
      )}
      <div className={styles.body}>{children}</div>
    </section>
  )
}

export default SectionCard

/**
 * The card surface class on its own, for markup that carries its own structure
 * and only needs the surface. Used by ~30 call sites outside these two pages.
 * New code should use <SectionCard>.
 */
export const sectionCardClass = styles.card
