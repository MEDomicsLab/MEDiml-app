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
 * @param {boolean} showHint Render the hint inline and always visible, with no
 *   toggle. For the rare parameter whose explanation must not be missed.
 * @param {string} docHref Link to the MEDiml documentation for this parameter.
 * @param {string} docLabel Link text. Defaults to "Read the documentation".
 * @param {boolean} inline Put the control beside the label instead of below.
 *   Use for switches and other short controls, where stacking spends three rows
 *   of height on one boolean.
 * @param {string} value Current value, shown under the control in monospace and
 *   truncated, with the full text kept in `title`.
 */
const Field = ({
  label,
  badge,
  hint,
  showHint = false,
  docHref,
  docLabel = "Read the documentation",
  inline = false,
  value,
  disabled = false,
  className = "",
  children,
  ...rest
}) => {
  const { collapsible, toggle, panel } = useHint({ hint, docHref, docLabel, showHint, label })

  return (
    <div className={`${styles.field} ${inline ? styles.inline : ""} ${className}`.trim()} {...rest}>
      <div className={styles.labelBlock}>
        {(label || badge || collapsible) && (
          <div className={styles.labelRow}>
            {label && <label className={`${styles.label} ${disabled ? styles.disabled : ""}`.trim()}>{label}</label>}
            {badge && <span className={hintStyles.badge}>{badge}</span>}
            {toggle}
          </div>
        )}
        {showHint && hint && <Caption>{hint}</Caption>}
        {panel}
      </div>

      {/* Only when there is something to render. A childless Field -- used in a
          few places purely to carry a label -- would otherwise emit an empty
          control div and the gap above it. */}
      {children && <div className={styles.control}>{children}</div>}

      {value && (
        <p className={styles.value} title={value}>
          {value}
        </p>
      )}
    </div>
  )
}

export default Field
