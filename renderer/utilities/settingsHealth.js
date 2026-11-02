// Window event used by the Settings page to share the results of its checks with the sidebar,
// whose Settings icon shows a notification dot when something is not working
export const SETTINGS_HEALTH_EVENT = "settings-health"

/**
 * @description Shares the result of some Settings checks with the sidebar
 * @param {Object} partial - Any of { serverIsRunning, mongoServerIsRunning, pythonPath, missingRequirements (count) }
 */
export const shareSettingsHealth = (partial) => {
  window.dispatchEvent(new CustomEvent(SETTINGS_HEALTH_EVENT, { detail: partial }))
}
