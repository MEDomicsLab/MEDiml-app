import { ExternalLink, Info } from "lucide-react"
import { useCallback, useId, useState } from "react"
import DocPanel from "./DocPanel"
import styles from "./Hint.module.css"
import openDocs from "./openDocs"

/**
 * The togglable "What is this?" pill and the panel it opens.
 *
 * A hook rather than a component, because the two pieces do not live together:
 * the pill belongs in the label/title row, while the panel renders full width
 * further down the DOM so a long paragraph is not squeezed into a 16rem column.
 * Only the layout owner knows where each goes, so it places them.
 *
 * Deliberately NOT a tooltip. A tooltip cannot be read on a touch device,
 * disappears while you are still reading it, cannot be copied from, and cannot
 * contain a link -- and every hint here carries a link into the MEDiml
 * documentation. In a tool where the parameter descriptions ARE the
 * documentation, a tooltip trades clutter for lost information.
 *
 * WHERE TO PUT THE HINT: on the CARD when the card holds one control, on the
 * FIELD when it holds several. Two pill levels on one card is the failure mode.
 *
 * @param {ReactNode} hint The help text. No hint => nothing is rendered.
 * @param {string} docHref Link into the MEDiml docs, opened in the system browser.
 * @param {string} docLabel Link text.
 * @param {boolean} showHint Caller renders the hint itself, always visible; the
 *   hook then reports `collapsible: false` and returns no toggle.
 * @param {{title: string, content: ReactNode}} doc For a concept a paragraph
 *   cannot explain: the pill opens this documentation in a <DocPanel> instead
 *   of the inline hint. The caller must render the returned `docPanel`.
 *   `docHref` / `docLabel`, when given, become the panel's closing link.
 * @returns {{collapsible: boolean, open: boolean, hintId: string,
 *            toggle: ReactNode, panel: ReactNode, docPanel: ReactNode}}
 */
export default function useHint({ hint, docHref, docLabel = "Read the documentation", showHint = false, label, doc } = {}) {
  const reactId = useId()
  const hintId = `${reactId}-hint`
  const [open, setOpen] = useState(false)
  const closeDoc = useCallback(() => setOpen(false), [])
  const collapsible = (Boolean(hint) || Boolean(doc)) && !showHint

  if (doc && collapsible) {
    return {
      collapsible,
      open,
      hintId,
      toggle: (
        <button
          type="button"
          className={styles.infoToggle}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-label={label ? `Learn about ${label}` : "Learn more"}
          onClick={() => setOpen((v) => !v)}
        >
          <span className={styles.infoIcon} aria-hidden="true">
            <Info size={14} />
          </span>
        </button>
      ),
      panel: null,
      docPanel: (
        <DocPanel open={open} onClose={closeDoc} title={doc.title} docHref={docHref} docLabel={docLabel}>
          {doc.content}
        </DocPanel>
      )
    }
  }

  const toggle = collapsible ? (
    <button
      type="button"
      className={styles.infoToggle}
      aria-expanded={open}
      aria-controls={hintId}
      onClick={() => setOpen((v) => !v)}
    >
      <span className={styles.infoIcon} aria-hidden="true">
        <Info size={14} />
      </span>
      {open && "Hide info"}
    </button>
  ) : null

  const panel =
    collapsible && open ? (
      <div className={styles.infoPanel} id={hintId} role="note" aria-label={label ? `About ${label}` : undefined}>
        {hint}
        {docHref && (
          <div>
            <a className={styles.docLink} href={docHref} onClick={(event) => openDocs(event, docHref)}>
              {docLabel}
              <ExternalLink size={12} aria-hidden="true" />
            </a>
          </div>
        )}
      </div>
    ) : null

  return { collapsible, open, hintId, toggle, panel, docPanel: null }
}

export { styles as hintStyles }
