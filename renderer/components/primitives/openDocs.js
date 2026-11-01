import { shell } from "electron"

/**
 * Click handler body for a documentation link: opens `href` in the system
 * browser rather than inside the Electron window.
 *
 * @param {Event} event The click event, whose default navigation is cancelled.
 * @param {string} href The documentation URL.
 */
export default function openDocs(event, href) {
  event.preventDefault()
  try {
    shell.openExternal(href)
  } catch {
    // Outside Electron (tests, storybook) fall back to normal navigation.
    window.open(href, "_blank", "noopener")
  }
}
