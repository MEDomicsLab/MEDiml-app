import { app, dialog } from "electron"
const fs = require("fs")
const os = require("os")
var path = require("path")
const util = require("util")
const { execSync, execFileSync, spawn } = require("child_process")
const exec = util.promisify(require("child_process").exec)

// Output buffer of the installation commands (pip, tar, curl), large enough for their verbose output
const INSTALLATION_MAX_BUFFER = 100 * 1024 * 1024

export function getPythonEnvironment(medCondaEnv = "med_conda_env") {
  // Returns the python environment
  let pythonEnvironment = process.env.MED_ENV

  // Retrieve the path to the conda environment from the settings file
  let userDataPath = app.getPath("userData")
  let settingsFilePath = path.join(userDataPath, "settings.json")
  let settingsFound = fs.existsSync(settingsFilePath)
  let settings = {}
  if (settingsFound) {
    let settings = JSON.parse(fs.readFileSync(settingsFilePath, "utf8"))
    // Check if the conda environment is defined in the settings file
    if (settings.condaPath !== undefined) {
      pythonEnvironment = settings.condaPath
    }
  }

  if (pythonEnvironment === undefined) {
    if (pythonEnvironment === undefined || pythonEnvironment === null) {
      let userPath = process.env.HOME
      let anacondaPath = getCondaPath(userPath)
      if (anacondaPath !== null) {
        // If a python environment is found, the path to the python executable is returned
        if (checkCondaEnvs(anacondaPath).includes(medCondaEnv)) {
          pythonEnvironment = getThePythonExecutablePath(anacondaPath, medCondaEnv)
        }
      }
    }
  }
  // If the python environment is found, the conda path is saved in the settings file if it is not already defined
  if (pythonEnvironment !== undefined && pythonEnvironment !== null) {
    if (settingsFound && settings.condaPath === undefined) {
      settings.condaPath = pythonEnvironment
      fs.writeFileSync(settingsFilePath, JSON.stringify(settings))
    }
  }
  return pythonEnvironment
}

/**
 * @description Returns the path to the conda directory
 * @param {String} parentPath The path to the parent directory
 * @returns {String} The path to the conda directory
 */
function getCondaPath(parentPath) {
  let condaPath = null
  const possibleCondaPaths = ["anaconda3", "miniconda3", "anaconda", "miniconda", "Anaconda3", "Miniconda3", "Anaconda", "Miniconda"]
  condaPath = checkDirectories(parentPath, possibleCondaPaths)
  if (condaPath === null) {
    if (process.platform !== "win32") {
      let condaPathTemp = path.join(parentPath, "opt")
      condaPath = checkDirectories(condaPathTemp, possibleCondaPaths)
      if (condaPath === null) {
        condaPathTemp = path.join(parentPath, "bin")
        condaPath = checkDirectories(condaPathTemp, possibleCondaPaths)
      }
    } else {
      parentPath = "C:\\"
      let condaPathTemp = path.join(parentPath, "ProgramData")
      condaPath = checkDirectories(condaPathTemp, possibleCondaPaths)
      if (condaPath === null) {
        condaPathTemp = path.join(parentPath, "Program Files")
        condaPath = checkDirectories(condaPathTemp, possibleCondaPaths)
        if (condaPath === null) {
          condaPathTemp = path.join(parentPath, "Program Files (x86)")
          condaPath = checkDirectories(condaPathTemp, possibleCondaPaths)
        }
      }
    }
    if (process.platform == "darwin" && condaPath === null) {
      parentPath = "/opt/homebrew"
      condaPath = checkDirectories(parentPath, possibleCondaPaths)
    }
    if (condaPath === null && process.platform !== "darwin") {
      console.log("No conda environment found")
      dialog.showMessageBoxSync({
        type: "error",
        title: "No conda environment found",
        message: "No conda environment found. Please install anaconda or miniconda and try again."
      })
    }
  }
  return condaPath
}

/**
 * Checks if a list of directories exists from a parent directory
 * @param {String} parentPath The path to the parent directory
 * @param {Array} directories The list of directories to check
 * @returns {String} The path to the directory that exists
 */
function checkDirectories(parentPath, directories) {
  let directoryPath = null
  directories.forEach((directory) => {
    if (directoryPath === null) {
      let directoryPathTemp = path.join(parentPath, directory)
      console.log("directoryPathTemp: ", directoryPathTemp)
      if (fs.existsSync(directoryPathTemp)) {
        console.log("directoryPathTemp EXISTS: ", directoryPathTemp)
        directoryPath = directoryPathTemp
      }
    }
  })
  return directoryPath
}

/**
 * @description Returns the condas environments
 * @param {String} condaPath The path to the conda environment
 * @returns {Array} The condas environments
 */
function checkCondaEnvs(condaPath) {
  let envsPath = path.join(condaPath, "envs")
  let envs = []
  if (fs.existsSync(envsPath)) {
    envs = fs.readdirSync(envsPath)
  }
  return envs
}

/**
 * @description Returns the path to the python executable
 * @param {String} condaPath The path to the conda environment
 * @param {String} envName The name of the conda environment
 * @returns {String} The path to the python executable
 */
function getThePythonExecutablePath(condaPath, envName) {
  // Returns the path to the python executable
  let pythonExecutablePath = null
  if (process.platform == "win32") {
    pythonExecutablePath = path.join(condaPath, "envs", envName, "python.exe")
  } else {
    pythonExecutablePath = path.join(condaPath, "envs", envName, "bin", "python")
  }
  return pythonExecutablePath
}

export function getBundledPythonEnvironment() {
  let pythonEnvironment = null

  let bundledPythonPath = null

  // Check if the python path can be found in the .mediml directory
  let medomicsDirExists = fs.existsSync(path.join(app.getPath("home"), ".mediml", "python"))

  if (process.env.NODE_ENV === "production") {
    // Get the user path followed by .mediml
    let userPath = getHomePath()
    let medomicsPath = path.join(userPath, ".mediml")

    // Check if the .mediml directory exists
    if (fs.existsSync(medomicsPath)) {
      // Check if the python directory exists
      let pythonPath = path.join(medomicsPath, "python")
      if (fs.existsSync(pythonPath)) {
        bundledPythonPath = pythonPath
      }
    } else {
      // Create the .mediml directory
      fs.mkdirSync(medomicsPath)
    }

    bundledPythonPath = path.join(userPath, ".mediml", "python")
  } else {
    if (medomicsDirExists) {
      bundledPythonPath = path.join(getHomePath(), ".mediml", "python")
    } else {
      bundledPythonPath = path.join(process.cwd(), "python")
    }
  }

  pythonEnvironment = path.join(bundledPythonPath, "bin", "python")
  if (process.platform == "win32") {
    pythonEnvironment = path.join(bundledPythonPath, "python.exe")
  }
  if (!fs.existsSync(pythonEnvironment)) {
    pythonEnvironment = null
  }
  return pythonEnvironment
}

export function getRequirementsFilePath() {
  const requirementsFileName = process.platform === "darwin" ? "requirements_mac.txt" : "requirements.txt"
  const pythonEnvDir = process.env.NODE_ENV === "production" ? path.join(process.resourcesPath, "pythonEnv") : path.join(process.cwd(), "pythonEnv")
  return path.join(pythonEnvDir, requirementsFileName)
}

export async function installRequiredPythonPackages(mainWindow) {
  await installPythonPackage(mainWindow, getBundledPythonEnvironment(), null, getRequirementsFilePath())
}

// Runs inside the target Python so specifiers (>=, <, ~=, markers) are evaluated by pip's own
// packaging library, against the versions that interpreter actually sees.
const MISSING_REQUIREMENTS_SNIPPET = `
import json, sys
from importlib import metadata
try:
    from packaging.requirements import Requirement
except ImportError:
    from pip._vendor.packaging.requirements import Requirement
missing = []
for line in open(sys.argv[1], encoding="utf-8"):
    line = line.split("#")[0].strip()
    if not line or line.startswith("-"):
        continue
    req = Requirement(line)
    if req.marker is not None and not req.marker.evaluate():
        continue
    try:
        installed = metadata.version(req.name)
    except metadata.PackageNotFoundError:
        installed = None
    if installed is None or not req.specifier.contains(installed, prereleases=True):
        missing.append({"requirement": line, "name": req.name, "installed": installed})
print(json.dumps(missing))
`

/**
 * @description Lists the requirements of `requirementsFilePath` that `pythonPath` does not satisfy.
 * @returns {Array<{requirement: String, name: String, installed: String|null}>} `installed` is null when
 *   the package is absent, else the installed version that fails the specifier.
 */
export function getMissingPythonRequirements(pythonPath = null, requirementsFilePath = null) {
  pythonPath = pythonPath || getBundledPythonEnvironment()
  requirementsFilePath = requirementsFilePath || getRequirementsFilePath()
  const output = execFileSync(pythonPath, ["-c", MISSING_REQUIREMENTS_SNIPPET, requirementsFilePath], { encoding: "utf8" })
  return JSON.parse(output.trim().split("\n").pop())
}

export function checkPythonRequirements(pythonPath = null, requirementsFilePath = null) {
  try {
    const missing = getMissingPythonRequirements(pythonPath, requirementsFilePath)
    console.log("Missing python requirements: " + JSON.stringify(missing))
    return missing.length === 0
  } catch (error) {
    console.warn("Could not check python requirements:", error)
    return false
  }
}

/**
 * @description pip-installs `requirements` (specifier strings such as "pydantic<2") into `pythonPath`,
 * streaming pip's output to the notification area.
 * @returns {Promise<{success: Boolean, code: Number}>}
 */
export function installPythonRequirements(mainWindow, pythonPath, requirements) {
  return new Promise((resolve) => {
    // spawn, not exec: no shell, so "<"/">" in specifiers are not parsed as redirections.
    const child = spawn(pythonPath, ["-m", "pip", "install", ...requirements])
    execCallbacksForChildWithNotifications(child, "Python Package Installation", mainWindow)
    child.on("error", (error) => {
      console.error("pip install failed to start:", error)
      resolve({ success: false, code: -1 })
    })
    child.on("close", (code) => resolve({ success: code === 0, code }))
  })
}

export function getInstalledPythonPackages(pythonPath = null) {
  let pythonPackages = []
  if (pythonPath === null) {
    pythonPath = getPythonEnvironment()
  }

  let pythonPackagesOutput = ""
  try {
    pythonPackagesOutput = execSync(`${pythonPath} -m pip list --format=json`).toString()
  } catch (error) {
    console.warn("Error retrieving python packages:", error)
  }
  try {
    pythonPackages = JSON.parse(pythonPackagesOutput)
  } catch (error) {
    console.warn(error)
  }
  return pythonPackages
}

export async function installPythonPackage(mainWindow, pythonPath, packageName = null, requirementsFilePath = null) {
  console.log("Installing python package: ", packageName, requirementsFilePath, " with pythonPath: ", pythonPath)
  await runInstallationStep(`"${pythonPath}" -m pip install --upgrade pip`, "Python pip Upgrade", mainWindow)
  if (requirementsFilePath !== null) {
    await runInstallationStep(`"${pythonPath}" -m pip install -r "${requirementsFilePath}"`, "Python Package Installation from requirements", mainWindow)
  } else {
    await runInstallationStep(`"${pythonPath}" -m pip install ${packageName}`, "Python Package Installation", mainWindow)
  }
}

export function execCallbacksForChildWithNotifications(child, id, mainWindow) {
  mainWindow.webContents.send("notification", { id: id, message: `Starting...`, header: `${id} in progress` })
  child.stdout.on("data", (data) => {
    mainWindow.webContents.send("notification", { id: id, message: `stdout: ${data}`, header: `${id} in progress` })
  })
  child.stderr.on("data", (data) => {
    mainWindow.webContents.send("notification", { id: id, message: `stderr: ${data}`, header: `${id} Error` })
  })
  child.on("close", (code) => {
    mainWindow.webContents.send("notification", { id: id, message: `${id} exited with code ${code}`, header: `${id} Finished` })
  })
}

function getHomePath() {
  let homePath = null
  if (process.platform === "win32") {
    homePath = process.env.USERPROFILE
  } else {
    homePath = process.env.HOME
  }
  return homePath
}

export async function installBundledPythonExecutable(mainWindow) {
  let bundledPythonPath = null

  let medomicsPath = null
  let pythonParentFolderExtractString = ""
  if (process.env.NODE_ENV === "production") {
    console.log("getHomePath(): ", getHomePath())
    let userPath = getHomePath()

    medomicsPath = path.join(userPath, ".mediml")
    pythonParentFolderExtractString = "-C " + medomicsPath
    let pythonPath = path.join(medomicsPath, "python")
    // Check if the .mediml directory exists
    if (fs.existsSync(medomicsPath)) {
      // Check if the python directory exists
      if (fs.existsSync(pythonPath)) {
        bundledPythonPath = pythonPath
      } else {
        fs.mkdirSync(pythonPath)
      }
    } else {
      // Create the .mediml directory
      fs.mkdirSync(medomicsPath)
      fs.mkdirSync(pythonPath)
    }
    bundledPythonPath = pythonPath
  } else {
    bundledPythonPath = path.join(process.cwd(), "python")
  }
  // Check if the python executable is already installed
  let pythonExecutablePath = null
  if (process.platform == "win32") {
    pythonExecutablePath = path.join(bundledPythonPath, "python.exe")
  } else {
    pythonExecutablePath = path.join(bundledPythonPath, "bin", "python")
  }
  if (!fs.existsSync(pythonExecutablePath)) {
    // If the python executable is not installed, download the python executable
    if (process.platform == "win32") {
      // Download the python executable
      let url = "https://github.com/indygreg/python-build-standalone/releases/download/20240224/cpython-3.9.18+20240224-x86_64-pc-windows-msvc-shared-install_only.tar.gz"
      let outputFileName = "cpython-3.9.18+20240224-x86_64-pc-windows-msvc-shared-install_only.tar.gz"

      let downloadPromise = exec(`wget ${url} -O ${outputFileName}`, { shell: "powershell.exe" })

      execCallbacksForChildWithNotifications(downloadPromise.child, "Python Downloading", mainWindow)

      const { stdout, stderr } = await downloadPromise
      let extractCommand = `tar -xvf ${outputFileName} ${pythonParentFolderExtractString}`
      let extractionPromise = exec(extractCommand, { shell: "powershell.exe" })
      execCallbacksForChildWithNotifications(extractionPromise.child, "Python Exec. Extracting", mainWindow)

      const { stdout: extrac, stderr: extracErr } = await extractionPromise

      // Install the required python packages
      await installPythonPackage(mainWindow, pythonExecutablePath, null, getRequirementsFilePath())
      let removeCommand = `rm ${outputFileName}`
      let removePromise = exec(removeCommand, { shell: "powershell.exe" })
      execCallbacksForChildWithNotifications(removePromise.child, "Python Exec. Removing", mainWindow)
      const { stdout: remove, stderr: removeErr } = await removePromise
    } else {
      // macOS and Linux: the archive extracts to a "python" folder, so it is extracted in the parent of bundledPythonPath
      let file = null
      if (process.platform == "darwin") {
        // Apple Silicon is detected from the hardware, as process.arch is x64 when the app runs under Rosetta
        file = isAppleSilicon() ? "cpython-3.9.18+20240224-aarch64-apple-darwin-install_only.tar.gz" : "cpython-3.9.18+20240224-x86_64-apple-darwin-install_only.tar.gz"
      } else {
        file = process.arch === "arm64" ? "cpython-3.9.18+20240224-aarch64-unknown-linux-gnu-install_only.tar.gz" : "cpython-3.9.18+20240224-x86_64_v3-unknown-linux-gnu-install_only.tar.gz"
      }
      const url = `https://github.com/indygreg/python-build-standalone/releases/download/20240224/${file}`
      // The archive is downloaded to an absolute temporary path: the working directory of a packaged app is not
      // writable (it is "/" on macOS), so a relative download fails and the extraction finds no archive
      const archivePath = path.join(os.tmpdir(), file)
      const extractFolder = path.dirname(bundledPythonPath)

      await runInstallationStep(`curl -fSL --retry 3 -o "${archivePath}" "${url}"`, "Python Downloading", mainWindow)
      await runInstallationStep(`tar -xzf "${archivePath}" -C "${extractFolder}"`, "Python Exec. Extracting", mainWindow)
      await runInstallationStep(`rm -f "${archivePath}"`, "Python Exec. Removing", mainWindow)

      if (!fs.existsSync(pythonExecutablePath)) {
        throw new Error(`Python was extracted but its executable was not found at ${pythonExecutablePath}`)
      }
      // Install the required python packages
      await installPythonPackage(mainWindow, pythonExecutablePath, null, getRequirementsFilePath())
    }
  }
  return getBundledPythonEnvironment() !== null
}

/**
 * @description Runs one step of an installation, streaming its output to the notification area
 * @param {String} command The shell command to run
 * @param {String} id The notification id, its header must name what is installed (e.g. "Python", "MongoDB")
 * @param {BrowserWindow} mainWindow The main window, receiving the notifications
 * @returns {Promise<{stdout: String, stderr: String}>} Rejects with the output of the command if it fails
 */
export async function runInstallationStep(command, id, mainWindow) {
  // pip and tar are verbose, the default 1 MB buffer would kill them before they finish
  const promise = exec(command, { maxBuffer: INSTALLATION_MAX_BUFFER })
  execCallbacksForChildWithNotifications(promise.child, id, mainWindow)
  return promise
}

/**
 * @returns {Boolean} True on an Apple Silicon Mac, even when the app runs under Rosetta
 */
export function isAppleSilicon() {
  if (process.arch === "arm64") return true
  try {
    return execSync("sysctl -n hw.optional.arm64", { encoding: "utf8" }).trim() === "1"
  } catch (error) {
    return false
  }
}
