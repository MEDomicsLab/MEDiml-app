import React from "react"
import styles from "./PathOption.module.css"

/**
 * @param {string} fullPath Full path of a workspace folder or file
 * @param {string} workspacePath Full path of the workspace
 * @returns {string} The path relative to the workspace (e.g. /DATA/STS_POC/Features/CT), or the
 *   full path if it is outside the workspace
 */
export const getPathLocation = (fullPath, workspacePath) => {
  const location = (fullPath || "").replace(/\\/g, "/")
  const root = (workspacePath || "").replace(/\\/g, "/").replace(/\/+$/, "")
  return root && location.toLowerCase().startsWith(root.toLowerCase() + "/") ? location.slice(root.length) : location
}

/**
 * Dropdown option showing a folder or file name with its location underneath, so entries sharing
 * a name (e.g. two "CT" folders) can be told apart. Use it as both the itemTemplate and the
 * valueTemplate of a PrimeReact Dropdown whose options are `{name, value, location}`.
 *
 * @param {{name: string, location: string}} option The dropdown option
 */
const PathOption = (option) => (
  <div className={styles.pathOption}>
    <span>{option.name}</span>
    <span className={styles.pathLocation}>{option.location}</span>
  </div>
)

export default PathOption
