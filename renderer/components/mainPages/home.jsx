import { ipcRenderer } from "electron"
import fs from "fs"
import { Check, CircleCheck, Database, FileText, FlaskConical, MonitorPlay, Play, TriangleAlert, Zap } from 'lucide-react'
import Image from "next/image"
import path from "path"
import { useContext, useEffect, useRef, useState } from "react"
import { Button, ProgressBar, Stack } from "react-bootstrap"
import { toast } from "react-toastify"
import myimage from "../../../resources/medomics_transparent_bg.png"
import { requestBackend } from "../../utilities/requests"
import FirstSetupModal from "../generalPurpose/installation/firstSetupModal"
import { SectionCard } from "../primitives"
import { MEDDataObject } from "../workspace/NewMedDataObject"
import { WorkspaceContext } from "../workspace/workspaceContext"

// TODO: replace with the real proof-of-concept link
const POC_URL = "https://medomicslab.gitbook.io/mediml-app-docs/"
const STS_COLLECTION_URL = "https://www.cancerimagingarchive.net/collection/soft-tissue-sarcoma/"
const POC_DOWNLOAD_ID = "sts_poc"
const POC_ZENODO_URL = "https://zenodo.org/records/23103630"
// Available POC variants, the key is sent to the backend as `pocSize`, which maps it to its Zenodo archive
const POC_VARIANTS = {
  lite: {
    title: "Light Version",
    tagline: "A light subset to explore the full workflow in minutes",
    specs: "10 patients · 4 modalities · ~650 MB",
    icon: Zap,
    variant: "primary",
    flex: "1 1 220px"
  },
  full: {
    title: "Full Version",
    tagline: "The complete cohort to reproduce the study results",
    specs: "51 patients · 4 modalities · ~3.15 GB",
    icon: Database,
    variant: "outline-primary",
    flex: "1.6 1 300px"
  }
}

// localStorage key of the POC variants already present, as { [workspacePath]: { [pocSize]: pocDataPath } }
const POC_PRESENT_KEY = "pocDataPresent"

const readPocPresentMap = () => {
  try {
    return JSON.parse(localStorage.getItem(POC_PRESENT_KEY)) || {}
  } catch {
    return {}
  }
}

/**
 * Gets the POC variants already present in a workspace, dropping those whose data folder was removed since
 * @param {string} workspacePath - path of the workspace
 * @returns {Object} the POC data path of each variant already present, by pocSize
 */
const loadPocPresent = (workspacePath) => {
  const present = {}
  Object.entries(readPocPresentMap()[workspacePath] || {}).forEach(([pocSize, pocPath]) => {
    if (fs.existsSync(pocPath)) present[pocSize] = pocPath
  })
  return present
}

const savePocPresent = (workspacePath, present) => {
  try {
    localStorage.setItem(POC_PRESENT_KEY, JSON.stringify({ ...readPocPresentMap(), [workspacePath]: present }))
  } catch (error) {
    console.error("Could not save the POC data state: ", error)
  }
}

/**
 *
 * @returns the home page component
 */
const HomePage = () => {
  const { workspace, setWorkspace, recentWorkspaces, port } = useContext(WorkspaceContext)
  const [hasBeenSet, setHasBeenSet] = useState(workspace.hasBeenSet)
  const [appVersion, setAppVersion] = useState("")
  const [requirementsMet, setRequirementsMet] = useState(true)
  const [pocProgress, setPocProgress] = useState(null) // null when idle, else { now, label, pocSize }
  const [pocPresent, setPocPresent] = useState({}) // POC variants already present in the workspace, by pocSize
  const pocPollRef = useRef(null)
  const workspacePath = workspace.workingDirectory?.path

  async function handleWorkspaceChange() {
    ipcRenderer.send("messageFromNext", "requestDialogFolder")
  }

  const stopPocPolling = () => {
    clearInterval(pocPollRef.current)
    pocPollRef.current = null
  }

  useEffect(() => stopPocPolling, [])

  // Load the POC variants already present in the current workspace
  useEffect(() => {
    setPocPresent(workspace.hasBeenSet && workspacePath ? loadPocPresent(workspacePath) : {})
  }, [workspace.hasBeenSet, workspacePath])

  /**
   * Downloads the POC data into the workspace
   * @param {"lite"|"full"} pocSize - the POC variant to download
   */
  const handleDownloadPoc = (pocSize) => {
    setPocProgress({ now: 0, label: "Starting download", pocSize })
    pocPollRef.current = setInterval(() => {
      requestBackend(port, "/poc_data/progress/" + POC_DOWNLOAD_ID, {}, (progress) => {
        if (progress && progress.now !== undefined) {
          setPocProgress({ now: Number(progress.now), label: progress.currentLabel, pocSize })
        }
      })
    }, 1000)

    const finish = () => {
      stopPocPolling()
      setPocProgress(null)
      requestBackend(port, "removeId/" + POC_DOWNLOAD_ID, {}, () => {})
    }

    requestBackend(
      port,
      "/poc_data/download/" + POC_DOWNLOAD_ID,
      { dataPath: path.join(workspace.workingDirectory.path, "DATA"), pocSize },
      (response) => {
        finish()
        if (response.error) {
          toast.error(response.error.toast || response.error.message || "Failed to download the POC data")
          return
        }
        // Every series was already in the workspace: remember it to avoid duplicate downloads
        if (response.downloaded === 0 && response.failed === 0 && response.skipped > 0) {
          const present = { ...pocPresent, [pocSize]: response.path }
          setPocPresent(present)
          savePocPresent(workspacePath, present)
          toast.info(`The ${POC_VARIANTS[pocSize].title} POC data (${response.patients} patients) is already in your workspace under DATA/STS_POC`)
          return
        }
        MEDDataObject.updateWorkspaceDataObject()
        const failedNote = response.failed ? ` (${response.failed} patients missing, click again to retry)` : ""
        toast.success(
          `${POC_VARIANTS[pocSize].title} POC data ready in DATA/STS_POC: ${response.patients} patients (${response.positives} with lung metastases), ` +
            `${response.downloaded} downloaded, ${response.skipped} already present${failedNote}`
        )
      },
      (error) => {
        finish()
        toast.error("Failed to download the POC data: " + error)
      }
    )
  }

  // Check if the requirements are met
  useEffect(() => {
    ipcRenderer.invoke("checkRequirements").then((data) => {
      console.log("Requirements: ", data)
      if (data.pythonInstalled && data.mongoDBInstalled) {
        setRequirementsMet(true)
      } else {
        setRequirementsMet(false)
      }
    })
  }, [])

  // We set the workspace hasBeenSet state
  useEffect(() => {
    if (workspace.hasBeenSet == false) {
      setHasBeenSet(true)
    } else {
      setHasBeenSet(false)
    }
  }, [workspace])

  // Get app's version
  useEffect(() => {
    ipcRenderer.invoke("getAppVersion").then((data) => {
      setAppVersion(data.replace(/v/, ""))
    })
  }, [])

  // We set the recent workspaces -> We send a message to the main process to get the recent workspaces, the workspace context will be updated by the main process in _app.js
  useEffect(() => {
    ipcRenderer.send("messageFromNext", "getRecentWorkspaces")
  }, [])

  return (
    <>
      <div 
        className="container"
        style={{
          paddingTop: "1rem",
          display: "flex",
          flexDirection: "column",
          overflowY: "auto",
          scrollbarColor: "#b0b0b0 #f5f5f5"
        }}
      >
        <Stack direction="vertical" gap={1} style={{ alignContent: "center", flexGrow: 1 }}>
          <Stack direction="horizontal" gap={0} style={{ padding: "0 0 0 0", alignContent: "center" }}>
            <h1 style={{ fontSize: "5rem" }}>MEDiml</h1>
            <h2 style={{ fontSize: "2rem", marginTop: "2.5rem" }}>v{appVersion}</h2>
            <Image src={myimage} alt="" style={{ height: "175px", width: "175px" }} />
          </Stack>
          {hasBeenSet ? (
            <>
              <h5>Set up your workspace to get started</h5>
              <Button onClick={handleWorkspaceChange} style={{ margin: "1rem" }}>
                Set Workspace
              </Button>
              <h5>Or open a recent workspace</h5>
              <Stack direction="vertical" gap={0} style={{ padding: "0 0 0 0", alignContent: "center" }}>
                {recentWorkspaces.map((workspace, index) => {
                  if (index > 4) return
                  return (
                    <a
                      key={index}
                      onClick={() => {
                        ipcRenderer.invoke("setWorkingDirectory", workspace.path).then((data) => {
                          if (workspace !== data) {
                            let workspaceToSet = { ...data }
                            setWorkspace(workspaceToSet)
                          }
                        })
                      }}
                      style={{ margin: "0rem", color: "var(--blue-600)" }}
                    >
                      <h6>{workspace.path}</h6>
                    </a>
                  )
                })}
              </Stack>
            </>
          ) : (
            <h5
              style={{
                color: "#f7faff",
                backgroundColor: "#4475be",
                border: "1px solid #ebf6ff",
                borderLeft: "6px solid #4475be",
                padding: "12px 18px",
                borderRadius: "10px",
                marginTop: "1rem",
                width: "fit-content",
                boxShadow: "0 2px 8px rgba(0, 0, 0, 0.08)",
                margin: "0.5rem",
              }}
            >
              <Check size={20} className="mb-1 mr-4 inline-block" /> Workspace is set to {workspace.workingDirectory.path}
            </h5>
          )}
        </Stack>

        {/* Getting Started Section (Full Width) */}
        <div
          style={{
            marginTop: "2rem",
            padding: "0.75rem",
            borderRadius: "8px",
            boxShadow: "0px 2px 5px rgba(128, 117, 117, 0.1)",
            textAlign: "left",
            width: "100%",
          }}
        >
          <h3 style={{ marginBottom: "1rem", color: "#4991dfff" }}>
            {<Play size={24} className="ml-4 mb-1" />} Getting Started 
          </h3>
          
          <p>
            To effectively navigate MEDiml and its functionalities, we recommend consulting the official documentation and tutorial resources.
            These materials will help you understand how to analyze medical images using MEDiml, define and run experimentations, and evaluate machine learning models.
          </p>

          <p>We provide dedicated tutorials and documentation to guide you step by step:</p>

          <ul style={{ paddingLeft: "1.5rem", listStyleType: "none" }}>
            <li>
              <FileText size={20} strokeWidth={1} className="ml-4 mb-1" /> 
              <a 
                href="https://medomicslab.gitbook.io/mediml-app-docs/" 
                target="_blank" rel="noopener noreferrer" 
                style={{ color: "#4991dfff", textDecoration: "none", marginLeft: "5px" }}
              >
                MEDiml Documentation
              </a>
            </li>

            <li>
              <MonitorPlay size={20} strokeWidth={1} className="ml-4 mb-1" />
              <a href="https://youtube.com/playlist?list=PLEPy2VhC4-D5Eg-UxRyTtmUZRh-D5m_Ru&si=n9lX4lRYfDci3v5V" 
                  target="_blank" rel="noopener noreferrer" style={{ color: "#4991dfff", textDecoration: "none", marginLeft: "5px" }}>
                Video Tutorials
              </a>
            </li>
          </ul>

          <SectionCard
            title={<span style={{ color: "#4991dfff" }}>Try the proof of concept</span>}
            icon={<FlaskConical size={20} strokeWidth={1.5} />}
          >
            <p>
              New to MEDiml? Follow our <a href={POC_URL} target="_blank" rel="noopener noreferrer">proof of concept</a>, which
              walks through a full radiomics study for the early evaluation of lung metastasis risk, from feature extraction to model training and evaluation, on the{" "}
              <a href={STS_COLLECTION_URL} target="_blank" rel="noopener noreferrer">Soft-Tissue-Sarcoma collection</a> of The Cancer Imaging Archive (TCIA).
            </p>
            <p>
              Download its imaging data (PET, T1, T2FS and CT scans for each patient, also available on{" "}
              <a href={POC_ZENODO_URL} target="_blank" rel="noopener noreferrer">Zenodo</a>) directly into your workspace. It will be placed under{" "}
              <code>DATA/STS_POC</code>. Depending on resources available to you, pick the size of the dataset to use:
            </p>
            <div className="d-flex flex-wrap gap-3">
              {Object.entries(POC_VARIANTS).map(([pocSize, { title, tagline, specs, icon: Icon, variant, flex }]) => {
                const isPresent = Boolean(pocPresent[pocSize])
                return (
                <Button
                  key={pocSize}
                  variant={variant}
                  className="d-flex align-items-center gap-3 text-start"
                  style={{ flex, padding: "0.75rem 1rem" }}
                  onClick={() => handleDownloadPoc(pocSize)}
                  disabled={!workspace.hasBeenSet || pocProgress !== null || isPresent}
                  title={workspace.hasBeenSet ? undefined : "Set a workspace first"}
                >
                  {isPresent ? (
                    <CircleCheck size={pocSize === "full" ? 32 : 26} strokeWidth={1.5} style={{ flexShrink: 0 }} />
                  ) : (
                    <Icon size={pocSize === "full" ? 32 : 26} strokeWidth={1.5} style={{ flexShrink: 0 }} />
                  )}
                  <span className="d-flex flex-column">
                    <strong>
                      {pocProgress?.pocSize === pocSize ? "Downloading..." : isPresent ? `${title}: already in your workspace` : title}
                    </strong>
                    <small>{isPresent ? "This data was already fetched, find it under DATA/STS_POC" : tagline}</small>
                    <small style={{ opacity: 0.8 }}>{specs}</small>
                  </span>
                </Button>
                )
              })}
            </div>
            {pocProgress && (
              <>
                <ProgressBar className="mt-3" animated now={pocProgress.now} />
                <small className="text-muted d-block mt-1">
                  {POC_VARIANTS[pocProgress.pocSize].title}: {pocProgress.label}. Do not close this window.
                </small>
              </>
            )}
          </SectionCard>

            {/* Warning section */}
            <div 
              style={{
                marginTop: "1rem",
                padding: "1rem",
                backgroundColor: "rgb(219, 195, 123)",
                borderLeft: "4px solid #ffc107",
                borderRadius: "5px"
              }}
            >
              <TriangleAlert className="mr-2 mb-2 inline-block" size={20} strokeWidth={1.5} /> MEDiml is part of the MEDomics platform, and only supports medical image analysis. 
              To access other types of data analysis, please refer 
              <a 
                href="https://medomics.app/" 
                target="_blank" 
                rel="noopener noreferrer" 
                style={{ color: "#4991dfff", textDecoration: "none", marginLeft: "5px" }}
              >
                here
              </a>.
          </div>
        </div>
      </div>  
      {!requirementsMet && process.platform !=="darwin" && <FirstSetupModal visible={!requirementsMet} closable={false} setRequirementsMet={setRequirementsMet} />}
    </>
  )
}

export default HomePage
