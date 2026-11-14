import { ipcRenderer } from "electron"
import { Button } from 'primereact/button'
import { Dialog } from "primereact/dialog"
import { ProgressBar } from "primereact/progressbar"
import { useContext, useEffect, useRef, useState } from "react"
import { NotificationContext } from "../notificationContext"

/**
 *
 * @param {*} param0
 * @returns
 */
const FirstSetupModal = ({ visible, onHide, closable, setRequirementsMet }) => {
  const { notifications, setNotifications } = useContext(NotificationContext)
  const [pythonNotifications, setPythonNotifications] = useState({})
  const [mongoDBNotifications, setMongoDBNotifications] = useState({})
  const [pythonIsInstalled, setPythonIsInstalled] = useState(false)
  const [pythonIsInstalling, setPythonIsInstalling] = useState(false)
  const [pythonInstallationProgress, setPythonInstallationProgress] = useState(0)
  const [mongoDBIsInstalled, setMongoDBIsInstalled] = useState(false)
  const [mongoDBInstallationProgress, setMongoDBInstallationProgress] = useState(0)
  const [checkIsRunning, setCheckIsRunning] = useState(false)
  const [localRequirementsMet, setLocalRequirementsMet] = useState(false)
  const [clicked, setClicked] = useState(false)
  const [installErrors, setInstallErrors] = useState([]) // Errors of the installations that failed, the setup can be retried
  const pythonInstallPendingRef = useRef(false)

  /**
   * Checks the requirements, updating the progress bars of the installed ones
   */
  const checkRequirements = () => {
    setCheckIsRunning(true)
    ipcRenderer
      .invoke("checkRequirements")
      .then((data) => {
        console.log("Requirements: ", data)
        // Missing Python packages are not required here, they can be installed from the settings page
        const pythonInstalled = data.pythonInstalled && !pythonInstallPendingRef.current
        if (pythonInstalled) {
          setPythonIsInstalled(true)
          setPythonInstallationProgress(100)
        }
        if (data.mongoDBInstalled) {
          setMongoDBIsInstalled(true)
          setMongoDBInstallationProgress(100)
        }
        if (data.mongoDBInstalled && pythonInstalled) {
          console.log("REQUIREMENTS MET")
          setLocalRequirementsMet(true)
        }
      })
      .catch((error) => console.error("Could not check the requirements: ", error))
      .finally(() => setCheckIsRunning(false))
  }

  /**
   * @param {String} name Name of what failed to install
   * @param {Error} error Error of the installation
   */
  const reportInstallError = (name, error) => {
    console.error(`${name} installation failed: `, error)
    // Keep the end of the message, the start of an IPC error is always "Error invoking remote method ..."
    const message = String(error?.message || error).split("\n").filter(Boolean).slice(-3).join(" ")
    setInstallErrors((prev) => [...prev, `${name} installation failed: ${message}`])
  }

  const installPython = () => {
    pythonInstallPendingRef.current = true
    setPythonIsInstalling(true)
    setPythonInstallationProgress(0)
    return ipcRenderer
      .invoke("installBundledPythonExecutable")
      .then((data) => {
        console.log("Python installation: ", data)
        if (data === false) {
          reportInstallError("Python", "the Python executable was not found after the installation")
        } else {
          // Python and all its packages are installed: the check can now mark it installed
          pythonInstallPendingRef.current = false
          checkRequirements()
        }
      })
      .catch((error) => reportInstallError("Python", error))
      .finally(() => setPythonIsInstalling(false))
  }

  /**
   * Progress of the Python installation (0 to 100), sent by the main process at each step and each package
   */
  useEffect(() => {
    const onPythonInstallationProgress = (event, progress) => setPythonInstallationProgress(progress)
    ipcRenderer.on("pythonInstallationProgress", onPythonInstallationProgress)
    return () => ipcRenderer.removeListener("pythonInstallationProgress", onPythonInstallationProgress)
  }, [])

  const installMongoDB = () => {
    return ipcRenderer
      .invoke("installMongoDB")
      .then((data) => {
        console.log("MongoDB installation: ", data)
        if (data === false) reportInstallError("MongoDB", "MongoDB was not found after the installation")
      })
      .catch((error) => reportInstallError("MongoDB", error))
  }

  const startSetup = () => {
    setClicked(true)
    setInstallErrors([])
    // An installed Python is skipped: its missing packages, if any, are installed from the settings page
    const installations = []
    if (!pythonIsInstalled) installations.push(installPython())
    if (!mongoDBIsInstalled) installations.push(installMongoDB())
    // Allow the setup to be started again once every installation is over, to retry the failed ones
    Promise.all(installations).finally(() => setClicked(false))
  }

  const closeFirstSetupModal = () => {
    setNotifications([])
    // Check if setRequirementsMet is a function before calling it
    if (typeof setRequirementsMet === "function") {
      setRequirementsMet(true)
    }
    ipcRenderer.invoke("getBundledPythonEnvironment").then((pythonPath) => {
      console.log("Starting the go server with the bundled python environment: " + pythonPath)
      ipcRenderer.invoke("start-server", pythonPath).then((serverProcess) => {
        console.log("Server process: ", serverProcess)
      })
    })
    if (typeof onHide === "function") {
      onHide()
    }
  }

  useEffect(() => {
    console.log("FirstSetupModal pythonNotifications: ", pythonNotifications)
  }, [pythonNotifications])

  useEffect(() => {
    console.log("FirstSetupModal mongoDBNotifications: ", mongoDBNotifications)
  }, [mongoDBNotifications])

  useEffect(() => {
    console.log("FirstSetupModal notifications: ", notifications)

    // Count the MongoDB steps done to calculate its progress
    let accumulatedMongoDBProgress = 0

    let newPythonNotifications = { ...pythonNotifications }
    let newMongoDBNotifications = { ...mongoDBNotifications }

    for (let notification of notifications) {
      if (notification.header.includes("Python")) {
        // Check if the notification is already in the dictionary
        if (newPythonNotifications[notification.id] === undefined) {
          notification.messages = [notification.message]
          notification.messagesCount = 1
          notification.done = false
          newPythonNotifications[notification.id] = notification
        } else {
          // Update the notification
          let newPythonNotification = newPythonNotifications[notification.id]
          newPythonNotification.messages.push(notification.message)
          newPythonNotification.messagesCount = newPythonNotification.messagesCount + 1
          newPythonNotifications[notification.id] = newPythonNotification
        }

        if (notification.message.includes("exited with code 0")) {
          newPythonNotifications[notification.id].done = true
        }
      } else if (notification.header.toLowerCase().includes("mongodb")) {
        if (newMongoDBNotifications[notification.id] === undefined) {
          notification.messages = [notification.message]
          notification.messagesCount = 1
          notification.done = false
          newMongoDBNotifications[notification.id] = notification
        } else {
          // Update the notification
          let newMongoDBNotification = newMongoDBNotifications[notification.id]
          newMongoDBNotification.messages.push(notification.message)
          newMongoDBNotification.messagesCount = newMongoDBNotification.messagesCount + 1
          newMongoDBNotifications[notification.id] = newMongoDBNotification
        }

        if (notification.message.includes("exited with code 0")) {
          newMongoDBNotifications[notification.id].done = true
        }
      }
    }

    if (!mongoDBIsInstalled) {
      let numberOfSteps = 3
      for (let notification in newMongoDBNotifications) {
        let mongoDBNotification = newMongoDBNotifications[notification]
        if (mongoDBNotification.done) {
          accumulatedMongoDBProgress += 1
        }
      }
      if (accumulatedMongoDBProgress == numberOfSteps) {
        setMongoDBInstallationProgress(100)
      } else {
        setMongoDBInstallationProgress(((accumulatedMongoDBProgress / numberOfSteps) * 100).toFixed(1))
      }
    }

    // The Python progress is not estimated from its notifications: the main process sends it (pythonInstallationProgress)
    setPythonNotifications(newPythonNotifications)
    setMongoDBNotifications(newMongoDBNotifications)
  }, [notifications])

  /**
   * Timer to check the requirements
   * @summary Checks the requirements now and then every 5 seconds, while the modal is visible and until they are met.
   *          The check spawns Python, so it must not run while the modal is hidden (it stays mounted in the settings page)
   */
  useEffect(() => {
    if (!visible || localRequirementsMet) return
    checkRequirements()
    const interval = setInterval(checkRequirements, 5000)
    return () => clearInterval(interval)
  }, [visible, localRequirementsMet])

  /**
   * Opened because the requirements were not met (setRequirementsMet given, from the home page):
   * closed by itself once they are, after the setup is over
   */
  useEffect(() => {
    if (visible && localRequirementsMet && !clicked && typeof setRequirementsMet === "function") {
      closeFirstSetupModal()
    }
  }, [visible, localRequirementsMet, clicked])

  return (
    <Dialog header="Application first setup" visible={visible} onHide={onHide} style={{ width: "50vw" }} closable={closable}>
      <div className="p-grid p-fluid">
        <div className="p-col-12">
          <h4>Thank you for installing the MEDiml application!</h4>
          <p>Before you can start using it, we need to perform some initial setup.</p>
          <p>Ensure you are connected to the internet and click the button below to start the setup.</p>
          <p>Once the setup is complete, you will be able to start using the application.</p>
        </div>
        <div className="p-col-12 p-md-4">
          <Button
            style={{ display: "flex", alignContent: "center", marginBottom: "0.5rem" }}
            label="Start setup"
            disabled={clicked || localRequirementsMet}
            onClick={startSetup}
          />
        </div>
        <div className="p-col-12 p-md-4">
          <h4>MongoDB Installation</h4>
          {/* Progress bar */}
          <ProgressBar
            value={mongoDBInstallationProgress}
            displayValueTemplate={() => `${mongoDBInstallationProgress}%`}
            mode={checkIsRunning ? "indeterminate" : "determinate"}
            color={mongoDBIsInstalled ? "#22c55e" : ""}
          />
        </div>
        <div className="p-col-12 p-md-4">
          <h4>Python Installation</h4>
          {/* Progress bar */}
          <ProgressBar
            value={pythonInstallationProgress}
            displayValueTemplate={() => `${pythonInstallationProgress}%`}
            mode={checkIsRunning && !pythonIsInstalling ? "indeterminate" : "determinate"}
            color={pythonInstallationProgress == 100 && pythonIsInstalled ? "#22c55e" : ""}
          />
        </div>
        {installErrors.map((error, index) => (
          <p key={index} style={{ color: "#d55757", marginTop: "0.5rem" }}>
            {error}
          </p>
        ))}
        <div className="p-end p-row-12" style={{ display: "flex", flexDirection: "row-reverse" }}>
          {(
              <Button 
                style={{ display: "flex", alignContent: "right", marginBottom: "0.5rem", width: "100px" }}
                label="Close"
                severity="info" 
                onClick={closeFirstSetupModal} 
              />
          )}
        </div>
      </div>
      {/* Terminal Notification Panel */}
      {(clicked || installErrors.length > 0) && <div
        style={{
          backgroundColor: "#000",
          color: "#00ff00",
          padding: "1rem",
          borderRadius: "5px",
          marginTop: "1rem",
          marginBottom: "1rem",
          height: "200px",
          overflowY: "scroll",
          fontFamily: "monospace",
        }}
      >
        {notifications.map((notification, index) => (
          <div key={index}>
            <strong>{notification.header}:</strong> {notification.message}
          </div>
        ))}
      </div>}
    </Dialog>
  )
}

export default FirstSetupModal
