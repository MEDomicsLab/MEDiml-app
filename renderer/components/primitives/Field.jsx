import React from "react"
import Caption from "./Caption"
import styles from "./Field.module.css"
import useHint, { hintStyles } from "./useHint"

/**
 * One labelled parameter: label, optional badge, a togglable hint, the control.
 *
 * The hint is togglable text, not a tooltip -- see useHint.jsx for why.
 *
 * WHERE TO PUT THE HINT: when a card holds a single control, put the hint on the
 * <SectionCard> instead and leave the Field unlabelled. Use Field's own hint only
 * when a card holds several parameters that each need explaining.
 *
 * @param {string} label Parameter name. Domain terms ("ROI definitions",
 *   "Re-segmentation range") always stay as text; icons supplement, never
 *   replace them.
 * @param {string} badge Short metadata, e.g. "optional" or a unit.
 * @param {ReactNode} hint Help text, shown when the toggle is opened.
 * @param {{title: string, content: ReactNode}} doc Open this documentation in a
 *   side panel from the info pill instead of the inline hint (see DocPanel.jsx).
 * @param {boolean} showHint Render the hint inline and always visible, with no
 *   toggle. For the rare parameter whose explanation must not be missed.
 * @param {string} docHref Link to the MEDiml documentation for this parameter.
 * @param {string} docLabel Link text. Defaults to "Read the documentation".
 * @param {boolean} inline Put the control beside the label instead of below.
 *   Use for switches and other short controls, where stacking spends three rows
 *   of height on one boolean.
 * @param {boolean} leading Put the control right before the label, like a
 *   checkbox. Use when several switches share a card: with `inline` each label
 *   stretches across its grid track and pushes the switch next to the
 *   neighbouring label instead of its own.
 * @param {string} htmlFor Id of the control, so clicking the label toggles it
 *   (pass the same value as the PrimeReact control's `inputId`).
 * @param {string} value Current value, shown under the control in monospace and
 *   truncated, with the full text kept in `title`.
 */
const Field = ({
  label,
  badge,
  hint,
  doc,
  showHint = false,
  docHref,
  docLabel = "Read the documentation",
  inline = false,
  leading = false,
  htmlFor,
  value,
  disabled = false,
  className = "",
  children,
  ...rest
}) => {
  const { collapsible, toggle, panel, docPanel } = useHint({ hint, doc, docHref, docLabel, showHint, label })
  const layout = leading ? styles.leading : inline ? styles.inline : ""

  // Only when there is something to render. A childless Field -- used in a
  // few places purely to carry a label -- would otherwise emit an empty
  // control div and the gap above it.
  const control = children && <div className={styles.control}>{children}</div>

  return (
    <div className={`${styles.field} ${layout} ${className}`.trim()} {...rest}>
      {leading && control}
      <div className={styles.labelBlock}>
        {(label || badge || collapsible) && (
          <div className={styles.labelRow}>
            {label && <label htmlFor={htmlFor} className={`${styles.label} ${disabled ? styles.disabled : ""}`.trim()}>{label}</label>}
            {badge && <span className={hintStyles.badge}>{badge}</span>}
            {toggle}
          </div>
        )}
        {showHint && hint && <Caption>{hint}</Caption>}
        {panel}
        {docPanel}
      </div>

      {!leading && control}

      {value && (
        <p className={styles.value} title={value}>
          {value}
        </p>
      )}
    </div>
  )
}

export default Field
