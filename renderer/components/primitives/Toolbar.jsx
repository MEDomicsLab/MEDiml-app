import React from "react"
import styles from "./Toolbar.module.css"

/**
 * The action row at the end of a page: primary action first, then secondary.
 *
 * Replaces `<Row className="form-group-box"><Col><Button/></Col><Col><Button/></Col></Row>`,
 * where each action sat in its own equal-width column. On a wide panel that put
 * the primary and secondary actions at opposite ends of the screen. Grouping
 * them keeps the pair together whatever the panel width.
 *
 * The group is centred: it is the page's terminal step, under a stack of
 * symmetric full-width cards, so centring marks it as the end of the form. That
 * makes `Toolbar.Spacer` a contradiction -- it would push the group left again.
 * It has no call sites; delete it rather than use it.
 *
 * @param {ReactNode} children Actions, primary first.
 */
const Toolbar = ({ children, className = "", ...rest }) => (
  <div className={`${styles.toolbar} ${className}`.trim()} role="group" {...rest}>
    {children}
  </div>
)

/** Pushes what follows to the far edge. */
const Spacer = () => <span className={styles.spacer} />

/** Run status text, tabular so digits do not jitter as a count updates. */
const Status = ({ children, className = "", ...rest }) => (
  <span className={`${styles.status} ${className}`.trim()} {...rest}>
    {children}
  </span>
)

Toolbar.Spacer = Spacer
Toolbar.Status = Status

export default Toolbar
