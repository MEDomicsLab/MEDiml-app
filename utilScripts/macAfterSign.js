/**
 * electron-builder "afterSign" hook for macOS.
 *
 * Without a valid signature, macOS refuses to open the downloaded app with the message
 * "MEDiml-app.app is damaged and can't be opened" (users had to run `xattr -cr` to bypass it).
 *
 * - With an Apple "Developer ID Application" certificate (CSC_LINK / CSC_KEY_PASSWORD), electron-builder
 *   signs the app itself. It is then notarized here when APPLE_ID, APPLE_APP_SPECIFIC_PASSWORD and
 *   APPLE_TEAM_ID are set, so it opens without any warning.
 * - Without a certificate, electron-builder skips the signing and the app is ad-hoc signed here. macOS then
 *   no longer reports it as damaged: users open it once from System Settings > Privacy & Security > "Open Anyway".
 */
const { execFileSync, spawnSync } = require("child_process")
const fs = require("fs")
const path = require("path")

/**
 * @param {String} command
 * @param {Array<String>} args
 * @returns {String} The output (stdout and stderr) of the command
 */
function run(command, args) {
  console.log(`  • ${command} ${args.join(" ")}`)
  return execFileSync(command, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], maxBuffer: 100 * 1024 * 1024 })
}

/**
 * @param {String} appPath Path to the .app bundle
 * @returns {Boolean} True if the app is signed with a Developer ID certificate
 */
function isSignedWithDeveloperId(appPath) {
  const verification = spawnSync("codesign", ["--verify", "--deep", "--strict", appPath])
  if (verification.status !== 0) return false
  // codesign writes the signature details to stderr
  const details = spawnSync("codesign", ["-dv", "--verbose=2", appPath], { encoding: "utf8" })
  return `${details.stdout}${details.stderr}`.includes("Authority=Developer ID Application")
}

exports.default = async function macAfterSign(context) {
  if (context.electronPlatformName !== "darwin") return

  const appPath = path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`)

  if (!isSignedWithDeveloperId(appPath)) {
    console.log("  • No Developer ID signature found, ad-hoc signing the app")
    // --deep only signs the code in the standard bundle folders, the Go server in Resources is signed first
    const goServerPath = path.join(appPath, "Contents", "Resources", "go_executables", "server_go_mac")
    if (fs.existsSync(goServerPath)) {
      run("codesign", ["--force", "--sign", "-", goServerPath])
    }
    run("codesign", ["--force", "--deep", "--sign", "-", appPath])
    run("codesign", ["--verify", "--deep", "--strict", appPath])
    return
  }

  const { APPLE_ID, APPLE_APP_SPECIFIC_PASSWORD, APPLE_TEAM_ID } = process.env
  if (!APPLE_ID || !APPLE_APP_SPECIFIC_PASSWORD || !APPLE_TEAM_ID) {
    console.log("  • APPLE_ID, APPLE_APP_SPECIFIC_PASSWORD or APPLE_TEAM_ID is not set, skipping the notarization")
    return
  }

  // notarytool only accepts archives, the app is zipped (keeping its parent folder) and submitted
  const zipPath = path.join(context.appOutDir, `${context.packager.appInfo.productFilename}-notarization.zip`)
  run("ditto", ["-c", "-k", "--keepParent", appPath, zipPath])
  console.log("  • Notarizing the app, this can take several minutes")
  console.log(run("xcrun", ["notarytool", "submit", zipPath, "--apple-id", APPLE_ID, "--password", APPLE_APP_SPECIFIC_PASSWORD, "--team-id", APPLE_TEAM_ID, "--wait"]))
  run("rm", ["-f", zipPath])
  // Stapling attaches the notarization ticket, so the app also opens offline
  run("xcrun", ["stapler", "staple", appPath])
}
