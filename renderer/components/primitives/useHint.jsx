import { shell } from "electron"
import { ExternalLink, Info } from "lucide-react"
import { useId, useState } from "react"
import styles from "./Hint.module.css"

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
 * @returns {{collapsible: boolean, open: boolean, hintId: string,
 *            toggle: ReactNode, panel: ReactNode}}
 */
export default function useHint({ hint, docHref, docLabel = "Read the documentation", showHint = false, label } = {}) {
  const reactId = useId()
  const hintId = `${reactId}-hint`
  const [open, setOpen] = useState(false)
  const collapsible = Boolean(hint) && !showHint

  const openDocs = (event) => {
    event.preventDefault()
    try {
      shell.openExternal(docHref)
    } catch {
      // Outside Electron (tests, storybook) fall back to normal navigation.
      window.open(docHref, "_blank", "noopener")
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
            <a className={styles.docLink} href={docHref} onClick={openDocs}>
              {docLabel}
              <ExternalLink size={12} aria-hidden="true" />
            </a>
          </div>
        )}
      </div>
    ) : null

  return { collapsible, open, hintId, toggle, panel }
}

export { styles as hintStyles }
