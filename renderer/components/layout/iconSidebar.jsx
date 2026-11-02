/* eslint-disable no-unused-vars */
import { ipcRenderer } from "electron"
import { Briefcase, House, Layers, Settings, Target } from "lucide-react"
import { Tooltip } from "primereact/tooltip"
import { useCallback, useContext, useEffect, useState } from "react"
import { NavDropdown } from "react-bootstrap"
import Nav from "react-bootstrap/Nav"
import { requestBackend } from "../../utilities/requests"
import { SETTINGS_HEALTH_EVENT } from "../../utilities/settingsHealth"
import { WorkspaceContext } from "../workspace/workspaceContext"
import { LayoutModelContext } from "./layoutContext"


/**
 * @description Sidebar component containing icons for each page
 * @param {function} onSidebarItemSelect - function to handle sidebar item selection
 * @returns Returns the sidebar component with icons for each page
 */
const IconSidebar = ({ onSidebarItemSelect }) => {
  // eslint-disable-next-line no-unused-vars
  const { dispatchLayout, developerMode, setDeveloperMode } = useContext(LayoutModelContext)
  const { workspace, port } = useContext(WorkspaceContext)
  const [appVersion, setAppVersion] = useState("")
  const [activeKey, setActiveKey] = useState("home") // activeKey is the name of the page
  const [disabledIcon, setDisabledIcon] = useState("disabled") // disabled is the state of the page
  const [developerModeNav, setDeveloperModeNav] = useState(true)
  const [extractionBtnstate, setExtractionBtnstate] = useState(false)
  const [buttonClass, setButtonClass] = useState("")

  // Health of the app's dependencies, null until checked (no alert is shown for unknown states)
  const [health, setHealth] = useState({ serverIsRunning: null, mongoServerIsRunning: null, pythonPath: null, missingRequirements: null })

  const delayOptions = { showDelay: 750, hideDelay: 0 }

  const updateHealth = useCallback((partial) => {
    setHealth((prev) => (Object.keys(partial).every((key) => prev[key] === partial[key]) ? prev : { ...prev, ...partial }))
  }, [])

  const checkServices = useCallback(() => {
    ipcRenderer.invoke("checkMongoIsRunning").then((status) => updateHealth({ mongoServerIsRunning: !!status }))
    requestBackend(
      port,
      "get_server_health",
      { pageId: "settings" },
      (data) => updateHealth({ serverIsRunning: !!data }),
      () => updateHealth({ serverIsRunning: false })
    )
  }, [port, updateHealth])

  // The Python checks spawn a process, so they run once here and are then kept up to date by the Settings page
  useEffect(() => {
    if (!workspace.hasBeenSet) return
    Promise.all([ipcRenderer.invoke("getBundledPythonEnvironment"), ipcRenderer.invoke("get-settings")]).then(([bundledPythonPath, settings]) => {
      updateHealth({ pythonPath: bundledPythonPath || settings?.condaPath || "" })
      if (!bundledPythonPath) return
      ipcRenderer
        .invoke("getMissingPythonRequirements", bundledPythonPath)
        .then((missing) => updateHealth({ missingRequirements: missing.length }))
        .catch(() => {})
    })
  }, [workspace.hasBeenSet, updateHealth])

  useEffect(() => {
    if (!workspace.hasBeenSet) return
    checkServices()
    const interval = setInterval(checkServices, 10000)
    return () => clearInterval(interval)
  }, [workspace.hasBeenSet, checkServices])

  // The Settings page shares the results of its own checks
  useEffect(() => {
    const onSettingsHealth = (event) => updateHealth(event.detail)
    window.addEventListener(SETTINGS_HEALTH_EVENT, onSettingsHealth)
    return () => window.removeEventListener(SETTINGS_HEALTH_EVENT, onSettingsHealth)
  }, [updateHealth])

  const settingsIssues = []
  if (health.serverIsRunning === false) settingsIssues.push("Go server is down")
  if (health.mongoServerIsRunning === false) settingsIssues.push("MongoDB server is down")
  if (health.pythonPath === "") settingsIssues.push("Python path is missing")
  if (health.missingRequirements > 0) settingsIssues.push(`${health.missingRequirements} Python package${health.missingRequirements > 1 ? "s are" : " is"} missing`)
  const showSettingsAlert = workspace.hasBeenSet && settingsIssues.length > 0

  // default action to set developer mode to true
  useEffect(() => {
    setDeveloperMode(true)
    setDeveloperModeNav(true)

    // Get app's version
    ipcRenderer.invoke("getAppVersion").then((data) => {
      setAppVersion(data.replace(/v/, ""))
    })
  }, [])

  /**
   * @description Toggles the developer mode
   */
  function handleToggleDeveloperMode() {
    console.log("handleToggleDeveloperMode")
    setDeveloperMode(!developerMode)
    setDeveloperModeNav(!developerModeNav)
  }

  /**
   *
   * @param {Event} event
   * @param {string} name
   */
  function handleDoubleClick(event, name) {
    event.stopPropagation()
    console.log(`Double clicked ${name}`, event, `open${name}Module`)
    dispatchLayout({ type: `open${name}Module`, payload: { pageId: name } })
  }

  /**
   *
   * @param {Event} event
   * @param {string} name
   */
  function handleDoubleClickLanding(event, name) {
    event.stopPropagation()
    console.log(`Double clicked ${name}`, event, `open${name}LandingPage`)
    dispatchLayout({ type: `open${name}LandingPage`, payload: { pageId: name } })
  }

  /**
   * @description Sets the active key and disabled state of the sidebar icons
   */
  useEffect(() => {
    if (!workspace.hasBeenSet) {
      setActiveKey("home")
      setDisabledIcon(true)
    } else {
      setDisabledIcon(false)
    }
  }, [workspace])

  useEffect(() => {}, [extractionBtnstate])

  /**
   *
   * @param {Event} event The event that triggered the click
   * @param {string} name The name of the page
   */
  function handleClick(event, name) {
    onSidebarItemSelect(name)
    console.log(`clicked ${name}`, event)
    setActiveKey(name)
  }

  /**
   * @description Handles the click on the settings button
   */
  const handleNavClick = () => {
    setButtonClass(buttonClass === "" ? "show" : "")
  }

  return (
    <>
      <div className="icon-sidebar">
        {/* ------------------------------------------- Tooltips ----------------------------------------- */}
        <Tooltip target=".homeNavIcon" {...delayOptions} className="tooltip-icon-sidebar" />
        <Tooltip target=".ExtMEDimgNav" {...delayOptions} className="tooltip-icon-sidebar" />
        <Tooltip target=".BatchExtractorNav" {...delayOptions} className="tooltip-icon-sidebar" />
        <Tooltip target=".DataManagerNav" {...delayOptions} className="tooltip-icon-sidebar" />
        <Tooltip target=".settingsNav" {...delayOptions} className="tooltip-icon-sidebar" />
        {/* ------------------------------------------- END Tooltips ----------------------------------------- */}

        {/* ------------------------------------------- ICON NAVBAR ----------------------------------------- */}

        <Nav defaultActiveKey="/home" className="flex-column" style={{ width: "100%", height: "100%" }}>
          <Nav.Link
            className={`homeNavIcon btnSidebar`}
            data-pr-at="right center"
            data-pr-tooltip="Home"
            data-pr-my="left center"
            href="#home"
            eventKey="home"
            data-tooltip-id="tooltip-home"
            onClick={(event) => handleClick(event, "home")}
            onDoubleClick={(event) => handleDoubleClick(event, "Home")}
          >
            <House style={{ height: "1.5rem", width: "auto" }} />
          </Nav.Link>
          
          <NavDropdown.Divider style={{ height: "3rem" }} />

          <div className="medomics-layer">
            <div className="sidebar-icons">
                {/* MEDiml Extraction Module */}
                <Nav.Link
                  className={`ExtMEDimgNav btnSidebar align-center`}
                  data-pr-at="right center"
                  data-pr-my="left center"
                  data-pr-tooltip="MEDiml Modules"
                  data-is-ext-btn
                  onClick={(event) => {
                    event.stopPropagation()
                    event.preventDefault()
                    handleDoubleClickLanding(event, "Modules")
                    setExtractionBtnstate(!extractionBtnstate)
                  }}
                  onDoubleClick={(event) => handleDoubleClickLanding(event, "Modules")}
                >
                  <Target style={{ height: "1.5rem", width: "auto" }} />
                </Nav.Link>
            </div>
          </div>
          <div className="medomics-layer">
            <div className="sidebar-icons">
              {/* DataManager */}
              <Nav.Link
                className={`DataManagerNav btnSidebar align-center`}
                data-pr-at="right center"
                data-pr-my="left center"
                data-pr-tooltip="DataManager"
                data-is-ext-btn
                onClick={(event) => {
                  event.stopPropagation()
                  event.preventDefault()
                  handleDoubleClick(event, "DataManager")
                  // handleClick(event, "extractionMEDiml")
                  setExtractionBtnstate(!extractionBtnstate)
                }}
                onDoubleClick={(event) => handleDoubleClick(event, "DataManager")}
              >
                <Briefcase style={{ height: "1.5rem", width: "auto" }} />
              </Nav.Link>
            </div>
          </div>
          <div className="medomics-layer">
            <div className="sidebar-icons">
              {/* BatchExtractor */}
              <Nav.Link
                className={`BatchExtractorNav btnSidebar align-center`}
                data-pr-at="right center"
                data-pr-my="left center"
                data-pr-tooltip="BatchExtractor"
                data-is-ext-btn
                onClick={(event) => {
                  event.stopPropagation()
                  event.preventDefault()
                  handleDoubleClick(event, "BatchExtractor")
                  setExtractionBtnstate(!extractionBtnstate)
                }}
                onDoubleClick={(event) => handleDoubleClick(event, "BatchExtractor")}
              >
                <Layers style={{ height: "1.5rem", width: "auto" }} />
              </Nav.Link>
            </div>
          </div>
          <NavDropdown.Divider style={{ height: "3rem" }} />

          {/* div that puts the buttons to the bottom of the sidebar*/}
          <div className="d-flex icon-sidebar-divider" style={{ flexGrow: "1" }}></div>

          <div className="sidebar-version">v{appVersion}</div>

          <Nav.Link
            className={`settingsNav btnSidebar`}
            data-pr-at="right center"
            data-pr-my="left center"
            data-pr-tooltip={showSettingsAlert ? `Settings\n• ${settingsIssues.join("\n• ")}` : "Settings"}
            eventKey="settings"
            data-tooltip-id="tooltip-settings"
            onClick={() => dispatchLayout({ type: `openSettings`, payload: { pageId: "Settings" } })}
            disabled={disabledIcon}
          >
            <span className="settings-icon-wrapper">
              <Settings size={"1.25rem"} width={"100%"} height={"100%"} />
              {showSettingsAlert && <span className="settings-alert-dot" />}
            </span>
          </Nav.Link>
        </Nav>
        {/* ------------------------------------------- END ICON NAVBAR ----------------------------------------- */}
      </div>
    </>
  )
}

export default IconSidebar
