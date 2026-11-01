import { ExternalLink, X } from "lucide-react"
import { useEffect, useId, useRef } from "react"
import { createPortal } from "react-dom"
import styles from "./DocPanel.module.css"
import hintStyles from "./Hint.module.css"
import openDocs from "./openDocs"

/**
 * A side panel of in-app documentation, for a concept that a one-paragraph hint
 * cannot explain (dose maps, dosiomics, ...).
 *
 * PORTABLE: the panel knows nothing about what it shows. The content is a plain
 * component (see renderer/components/docs/), so the same page of documentation
 * can be opened from any card, field or button that needs it. Content is styled
 * by the `.content` rules in DocPanel.module.css -- write semantic markup
 * (h3, p, ul, dl, table) and it will look right here.
 *
 * NON-MODAL on purpose: it docks on the right without a backdrop, so the form
 * stays usable while the user reads -- they can keep the feature list open
 * while filling in the parameters it describes. Escape or the close button
 * dismisses it, and focus returns to whatever opened it.
 *
 * Usually opened through useHint's `doc` option rather than rendered directly.
 *
 * @param {boolean} open Whether the panel is shown.
 * @param {Function} onClose Called on Escape or the close button.
 * @param {string} title Panel heading.
 * @param {ReactNode} children The documentation content.
 * @param {string} docHref Full documentation page, linked at the end of the panel.
 * @param {string} docLabel Link text.
 */
const DocPanel = ({ open, onClose, title, children, docHref, docLabel = "Read the full documentation" }) => {
  const titleId = `${useId()}-title`
  const closeRef = useRef(null)

  useEffect(() => {
    if (!open) return undefined
    const opener = document.activeElement
    closeRef.current?.focus()

    const onKeyDown = (event) => {
      if (event.key === "Escape") onClose()
    }
    document.addEventListener("keydown", onKeyDown)
    return () => {
      document.removeEventListener("keydown", onKeyDown)
      if (opener && typeof opener.focus === "function") opener.focus()
    }
  }, [open, onClose])

  if (!open || typeof document === "undefined") return null

  return createPortal(
    <aside className={styles.panel} role="dialog" aria-modal="false" aria-labelledby={titleId}>
      <header className={styles.header}>
        <h2 id={titleId} className={styles.title}>
          {title}
        </h2>
        <button ref={closeRef} type="button" className={styles.close} onClick={onClose} aria-label="Close documentation">
          <X size={16} aria-hidden="true" />
        </button>
      </header>
      <div className={styles.content}>
        {children}
        {docHref && (
          <p>
            <a className={hintStyles.docLink} href={docHref} onClick={(event) => openDocs(event, docHref)}>
              {docLabel}
              <ExternalLink size={12} aria-hidden="true" />
            </a>
          </p>
        )}
      </div>
    </aside>,
    document.body
  )
}

export default DocPanel
