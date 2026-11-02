import { watch } from "chokidar"

const DEBOUNCE_MS = 300

let watcher = null
let debounceTimer = null
let pendingChange = false

/**
 * @description Watches `rootPath` for filesystem changes made outside the app (an external
 * editor, a script, a sync tool, a git checkout, ...) and calls `onChange` once per debounced
 * batch of events. Any previously running watcher is stopped first, so this is safe to call
 * again whenever the workspace changes.
 *
 * Changes the app itself makes (fs.rename/fs.move/fs.rm, still issued directly from the renderer
 * today) are also seen by this watcher, since there is no "self vs. external" distinction yet.
 * That is a minor, safe redundancy rather than a correctness problem: `onChange` is wired to the
 * same bulk sync used on workspace open (see WorkspaceSync.syncWorkspaceTree), which is now a
 * handful of Mongo round trips instead of the old per-file O(n^2) walk, so an extra sync
 * triggered by the app's own write is cheap.
 *
 * @param {String} rootPath absolute path to the workspace root
 * @param {Function} onChange called with no arguments once per debounced batch of changes
 * @param {Array<RegExp>} exclude paths never to watch (pass the same list used for the directory scan)
 * @returns {import("chokidar").FSWatcher}
 */
export function startWorkspaceWatcher(rootPath, onChange, exclude = []) {
  stopWorkspaceWatcher()

  watcher = watch(rootPath, {
    ignored: exclude,
    ignoreInitial: true,
    persistent: true,
    // Wait for a file to stop changing before reporting it - avoids firing repeatedly while a
    // large file is still being written.
    awaitWriteFinish: { stabilityThreshold: 300, pollInterval: 100 }
  })

  const scheduleNotify = () => {
    pendingChange = true
    clearTimeout(debounceTimer)
    debounceTimer = setTimeout(() => {
      if (!pendingChange) return
      pendingChange = false
      try {
        onChange()
      } catch (err) {
        console.error("workspaceWatcher onChange handler failed:", err)
      }
    }, DEBOUNCE_MS)
  }

  watcher.on("all", scheduleNotify)
  watcher.on("error", (err) => console.error("workspaceWatcher error:", err))

  return watcher
}

/**
 * @description Stops the current watcher (if any) and clears any pending debounced notification.
 * Must be called before starting a new one for a different workspace, and on app quit.
 */
export async function stopWorkspaceWatcher() {
  clearTimeout(debounceTimer)
  debounceTimer = null
  pendingChange = false

  if (watcher) {
    const toClose = watcher
    watcher = null
    try {
      await toClose.close()
    } catch (err) {
      console.warn("Failed to close the previous workspace watcher:", err)
    }
  }
}
