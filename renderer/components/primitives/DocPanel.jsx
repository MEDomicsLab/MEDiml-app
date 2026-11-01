import { ExternalLink } from "lucide-react"
import styles from "./DocPanel.module.css"
import hintStyles from "./Hint.module.css"
import openDocs from "./openDocs"
import SidePanel from "./SidePanel"

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
 * The frame (docking, header, Escape, focus return) is <SidePanel>, shared with
 * the in-app editors so both look and behave the same.
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
const DocPanel = ({ open, onClose, title, children, docHref, docLabel = "Read the full documentation" }) => (
  <SidePanel open={open} onClose={onClose} title={title} closeLabel="Close documentation" bodyClassName={styles.content}>
    {children}
    {docHref && (
      <p>
        <a className={hintStyles.docLink} href={docHref} onClick={(event) => openDocs(event, docHref)}>
          {docLabel}
          <ExternalLink size={12} aria-hidden="true" />
        </a>
      </p>
    )}
  </SidePanel>
)

export default DocPanel
