import { app } from "electron"
import fs from "fs"
import { getMongoDBPath, mainWindow } from "../background"
import { checkPythonRequirements, execCallbacksForChildWithNotifications, getBundledPythonEnvironment, isAppleSilicon, runInstallationStep } from "../utils/pythonEnv"

//**** LOG ****// This is used to send the console.log messages to the main window
const originalConsoleLog = console.log
/**
 * @description Sends the console.log messages to the main window
 * @param {*} message The message to send
 * @summary We redefine the console.log function to send the messages to the main window
 */
console.log = function () {
  try {
    originalConsoleLog(...arguments)
    if (mainWindow !== undefined) {
      mainWindow.webContents.send("log", ...arguments)
    }
  } catch (error) {
    console.error(error)
  }
}


var path = require("path")
const os = require("os")
const util = require("util")
const exec = util.promisify(require("child_process").exec)

export const checkRequirements = async () => {
  // Check if .mediml directory exists
  let medomicsDirExists = fs.existsSync(path.join(app.getPath("home"), ".mediml"))
  if (!medomicsDirExists) {
    fs.mkdirSync(path.join(app.getPath("home"), ".mediml"))
  }
  let mongoDBInstalled = getMongoDBPath()
  let pythonInstalled = getBundledPythonEnvironment()

  // An installed Python is not enough, the app needs its packages (they are missing when their installation failed)
  let pythonRequirementsMet = pythonInstalled !== null && checkPythonRequirements(pythonInstalled)

  console.log("MongoDB installed: " + mongoDBInstalled)
  console.log("Python installed: " + pythonInstalled)
  console.log("Python requirements met: " + pythonRequirementsMet)
  return { pythonInstalled: pythonInstalled, mongoDBInstalled: mongoDBInstalled, pythonRequirementsMet: pythonRequirementsMet }
}

export const installMongoDB = async () => {
  if (process.platform === "win32") {
    // Download MongoDB installer
    const downloadUrl = "https://fastdl.mongodb.org/windows/mongodb-windows-x86_64-7.0.12-signed.msi"
    const downloadPath = path.join(app.getPath("downloads"), "mongodb-windows-x86_64-7.0.12-signed.msi")
    let downloadMongoDBPromise = exec(`curl -o ${downloadPath} ${downloadUrl}`)
    execCallbacksForChildWithNotifications(downloadMongoDBPromise.child, "Downloading MongoDB installer", mainWindow)
    await downloadMongoDBPromise
    // Install MongoDB
    // msiexec.exe /l*v mdbinstall.log /qb /i mongodb-windows-x86_64-7.0.12-signed.msi ADDLOCAL="ServerNoService" SHOULD_INSTALL_COMPASS="0"
    let installMongoDBPromise = exec(`msiexec.exe /l*v mdbinstall.log /qb /i ${downloadPath} ADDLOCAL="ServerNoService" SHOULD_INSTALL_COMPASS="0"`)
    execCallbacksForChildWithNotifications(installMongoDBPromise.child, "Installing MongoDB", mainWindow)
    await installMongoDBPromise

    let removeMongoDBInstallerPromise = exec(`rm ${downloadPath}`, { shell: "powershell" })
    execCallbacksForChildWithNotifications(removeMongoDBInstallerPromise.child, "Removing MongoDB installer", mainWindow)
    await removeMongoDBInstallerPromise

    return getMongoDBPath() !== null
  } else if (process.platform === "darwin") {
    // The official MongoDB archive is installed in ~/.mediml/mongodb, where getMongoDBPath looks for it.
    // Homebrew is not used: installing it requires an interactive terminal and an administrator password.
    const mongoDBVersion = "7.0.15"
    const architecture = isAppleSilicon() ? "arm64" : "x86_64"
    const archiveName = `mongodb-macos-${architecture}-${mongoDBVersion}.tgz`
    const downloadUrl = `https://fastdl.mongodb.org/osx/${archiveName}`
    // Absolute temporary path: the working directory of a packaged app is "/", which is not writable
    const archivePath = path.join(os.tmpdir(), archiveName)
    const mongoDBFolder = path.join(app.getPath("home"), ".mediml", "mongodb")
    fs.mkdirSync(mongoDBFolder, { recursive: true })

    await runInstallationStep(`curl -fSL --retry 3 -o "${archivePath}" "${downloadUrl}"`, "Downloading MongoDB installer", mainWindow)
    // The archive holds a single versioned folder (its name differs from the archive's), so it is stripped
    await runInstallationStep(`tar -xzf "${archivePath}" -C "${mongoDBFolder}" --strip-components 1`, "Installing MongoDB", mainWindow)
    await runInstallationStep(`rm -f "${archivePath}"`, "Removing MongoDB installer", mainWindow)

    return getMongoDBPath() !== null
  } else if (process.platform === "linux") {
    const linuxURLDict = {
      "Ubuntu 24.04 aarch64": "https://fastdl.mongodb.org/linux/mongodb-linux-aarch64-ubuntu2404-8.0.9.tgz",
      "Ubuntu 24.04 x86_64": "https://fastdl.mongodb.org/linux/mongodb-linux-x86_64-ubuntu2404-8.0.9.tgz",
      "Ubuntu 22.04 aarch64": "https://fastdl.mongodb.org/linux/mongodb-linux-aarch64-ubuntu2204-7.0.15.tgz",
      "Ubuntu 22.04 x86_64": "https://fastdl.mongodb.org/linux/mongodb-linux-x86_64-ubuntu2204-7.0.15.tgz",
      "Ubuntu 20.04 aarch64": "https://fastdl.mongodb.org/linux/mongodb-linux-aarch64-ubuntu2004-7.0.15.tgz",
      "Ubuntu 20.04 x86_64": "https://fastdl.mongodb.org/linux/mongodb-linux-x86_64-ubuntu2004-7.0.15.tgz",
      "Debian 10 x86_64": "https://fastdl.mongodb.org/linux/mongodb-linux-x86_64-debian10-7.0.15.tgz",
      "Debian 11 x86_64": "https://fastdl.mongodb.org/linux/mongodb-linux-x86_64-debian11-7.0.15.tgz",
    }
    // Check if MongoDB is installed
    if (getMongoDBPath() !== null) {
      return true
    }
    // Check which Linux distribution is being used
    let { stdout, stderr } = await exec(`cat /etc/os-release`)
    let osRelease = stdout
    let isUbuntu = osRelease.includes("Ubuntu")
    if (!isUbuntu) {
      return false
    } else {
      // osRelease is a string with the contents of /etc/os-release
      // Get the version of Ubuntu
      let ubuntuVersion = osRelease.match(/VERSION_ID="(.*)"/)[1]
      // Get the architecture of the system
      let architecture = "x86_64"
      if (process.arch === "arm64") {
        architecture = "aarch64"
      }
      // Get the download URL
      let downloadUrl = linuxURLDict[`Ubuntu ${ubuntuVersion} ${architecture}`]
      // Download MongoDB installer
      let mongoDBVersion = "7.0.15"
      if (ubuntuVersion === "24.04") {
        mongoDBVersion = "8.0.9"
      }
      const downloadPath = path.join(app.getPath("downloads"), `mongodb-linux-${architecture}-ubuntu${ubuntuVersion}-${mongoDBVersion}.tgz`)
      let downloadMongoDBPromise = exec(`curl -o ${downloadPath} ${downloadUrl}`)
      execCallbacksForChildWithNotifications(downloadMongoDBPromise.child, "Downloading MongoDB installer", mainWindow)
      await downloadMongoDBPromise
      // Install MongoDB in the .mediml directory in the user's home directory
      ubuntuVersion = ubuntuVersion.replace(".", "")
      let command = `tar -xvzf ${downloadPath} -C ${process.env.HOME}/.mediml/ && mv ${process.env.HOME}/.mediml/mongodb-linux-${architecture}-ubuntu${ubuntuVersion}-${mongoDBVersion} ${process.env.HOME}/.mediml/mongodb`
      let installMongoDBPromise = exec(command)

      // let installMongoDBPromise = exec(`tar -xvzf ${downloadPath} && mv mongodb-linux-${architecture}-ubuntu${ubuntuVersion}-7.0.15 ${process.env.HOME}/.mediml/mongodb`)
      execCallbacksForChildWithNotifications(installMongoDBPromise.child, "Installing MongoDB", mainWindow)
      await installMongoDBPromise

      const test = getMongoDBPath()

      return getMongoDBPath() !== null
    }
  }
}
