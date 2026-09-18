import React from "react"
import styles from "./Caption.module.css"

/**
 * Secondary help text under a form label.
 *
 * Replaces this object, which appeared **70 times** across 11 files, identical
 * in 69 of them:
 *
 *   <p style={{fontSize: "13px", fontStyle: "italic", fontWeight: "normal", margin: "0 0 8px 0"}}>
 *
 * The repetition was not carelessness, it was the absence of this component:
 * with no Caption to reach for, adding another explanatory paragraph cost
 * nothing and designing an alternative cost a lot. That is why a page with
 * roughly seven real decisions on it reads as a wall of prose.
 *
 * TWO DELIBERATE CHANGES from the original inline style:
 *
 *  - Colour is --med-text-secondary instead of inheriting body colour.
 *    De-emphasis now comes from contrast, which is what actually creates the
 *    hierarchy between a label and its explanation.
 *  - The italic is dropped. Italic is harder to read at 13px over several
 *    lines, and with the colour change it is redundant. Contrast still meets
 *    WCAG AA on --med-surface-card.
 *
 * Size (13px) and bottom spacing (8px) are unchanged, so line breaks and
 * vertical rhythm stay where they were.
 *
 * @param {ReactNode} children The help text.
 * @param {boolean} below Place under the control instead of above it.
 * @param {boolean} warn Warning rather than explanation. Always pair with an
 *   icon or an explicit word: roughly 8% of males have a red/green deficiency,
 *   and this is a clinical tool.
 * @param {string} id Set this and point the control's aria-describedby at it,
 *   so screen readers announce the explanation with the field.
 */
const Caption = ({ children, below = false, warn = false, className = "", ...rest }) => {
  const classes = [styles.caption, below ? styles.below : "", warn ? styles.warn : "", className]
    .filter(Boolean)
    .join(" ")

  return (
    <p className={classes} {...rest}>
      {children}
    </p>
  )
}

export default Caption
