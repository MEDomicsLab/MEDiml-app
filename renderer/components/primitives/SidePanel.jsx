import { X } from "lucide-react"
import { useEffect, useId, useRef } from "react"
import { createPortal } from "react-dom"
import styles from "./SidePanel.module.css"

/**
 * A panel docked on the right edge of the window, above the page.
 *
 * The one frame for everything that opens beside a form: documentation
 * (DocPanel) and editors such as the extraction settings. Sharing it keeps the
 * header, width, motion and close behaviour identical everywhere.
 *
 * NON-MODAL: there is no backdrop, so the page stays readable while the panel
 * is open. The close button, and Escape unless disabled, call `onClose`; focus
 * returns to whatever opened the panel.
 *
 * @param {boolean} open Whether the panel is shown.
 * @param {Function} onClose Called by the close button (and Escape).
 * @param {string} title Panel heading.
 * @param {ReactNode} children Panel body; it scrolls, the header and footer do not.
 * @param {ReactNode} footer Optional actions pinned under the body (Cancel, Apply).
 * @param {"default"|"wide"} size `wide` for forms, which need room for a
 *   label, its description and a control on one line.
 * @param {boolean} closeOnEscape Turn off for editors, where Escape inside a
 *   dropdown would otherwise close the panel and drop the user's changes.
 * @param {string} closeLabel Accessible name of the close button.
 * @param {string} bodyClassName Extra class for the body, e.g. typography.
 */
const SidePanel = ({
  open,
  onClose,
  title,
  children,
  footer,
  size = "default",
  closeOnEscape = true,
  closeLabel = "Close panel",
  bodyClassName = ""
}) => {
  const titleId = `${useId()}-title`
  const closeRef = useRef(null)

  useEffect(() => {
    if (!open) return undefined
    const opener = document.activeElement
    closeRef.current?.focus()

    const onKeyDown = (event) => {
      if (closeOnEscape && event.key === "Escape") onClose()
    }
    document.addEventListener("keydown", onKeyDown)
    return () => {
      document.removeEventListener("keydown", onKeyDown)
      if (opener && typeof opener.focus === "function") opener.focus()
    }
  }, [open, onClose, closeOnEscape])

  if (!open || typeof document === "undefined") return null

  return createPortal(
    <aside
      className={`${styles.panel} ${size === "wide" ? styles.wide : ""}`.trim()}
      role="dialog"
      aria-modal="false"
      aria-labelledby={titleId}
    >
      <header className={styles.header}>
        <h2 id={titleId} className={styles.title}>
          {title}
        </h2>
        <button ref={closeRef} type="button" className={styles.close} onClick={onClose} aria-label={closeLabel}>
          <X size={16} aria-hidden="true" />
        </button>
      </header>
      <div className={`${styles.body} ${bodyClassName}`.trim()}>{children}</div>
      {footer && <footer className={styles.footer}>{footer}</footer>}
    </aside>,
    document.body
  )
}

export default SidePanel
