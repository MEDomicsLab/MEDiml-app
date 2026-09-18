import React from "react"
import styles from "./Disclosure.module.css"

/**
 * A collapsible group of rarely-changed parameters.
 *
 * Progressive disclosure is how these pages get shorter without losing
 * anything. It is also the single easiest way to damage a scientific tool, so
 * this component is built to make the dangerous version hard to write:
 *
 *   1. It is always VISIBLE and LABELLED. Collapsed is not hidden -- the
 *      section header stays on the page, so a user can see that more settings
 *      exist without knowing to look for them.
 *
 *   2. `modifiedCount` is REQUIRED. A collapsed parameter that silently differs
 *      from its default while silently affecting the output is a reproducibility
 *      hazard: two runs that look identical on screen produce different feature
 *      values. The badge makes divergence visible while closed.
 *
 *   3. When nothing is modified it says so ("all defaults") instead of showing
 *      no badge. An absent badge is ambiguous between "all defaults" and "not
 *      computed", and the ambiguity defeats the point.
 *
 * Built on <details>/<summary>, so keyboard operation, the accessibility tree
 * and in-page find all work without any JavaScript.
 *
 * @param {string} title Section name, e.g. "Advanced".
 * @param {number} modifiedCount How many parameters inside differ from their
 *   default. Compute it from the same values the extraction actually uses.
 * @param {boolean} defaultOpen Start expanded. Prefer leaving it closed; if a
 *   section usually needs opening, it is not advanced and should not be here.
 */
const Disclosure = ({ title, modifiedCount, defaultOpen = false, className = "", children, ...rest }) => {
  const n = Number(modifiedCount) || 0

  return (
    <details className={`${styles.disclosure} ${className}`.trim()} open={defaultOpen} {...rest}>
      <summary className={styles.summary}>
        <span className={styles.caret} aria-hidden="true">
          &#9656;
        </span>
        {title}
        {n > 0 ? (
          <span className={styles.count}>
            {n} modified
          </span>
        ) : (
          <span className={styles.countNone}>all defaults</span>
        )}
      </summary>
      <div className={styles.body}>{children}</div>
    </details>
  )
}

export default Disclosure
