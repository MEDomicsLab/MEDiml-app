import { randomUUID } from "crypto"
import { BrainCircuit, Pickaxe } from 'lucide-react'
import { Button } from 'primereact/button'
import { InputText } from "primereact/inputtext"
import { useContext, useEffect, useState } from "react"
import { Card, Stack } from "react-bootstrap"
import { toast } from "react-toastify"
import { sceneDescription as extractionMEDimlSceneDescription } from "../../public/setupVariables/extractionMEDimlNodesParams"
import { sceneDescription as learningMEDimlDefaultSettings } from "../../public/setupVariables/learningMEDimlNodesParams"
import { LayoutModelContext } from "../layout/layoutContext"
import { insertMEDDataObjectIfNotExists } from "../mongoDB/mongoDBUtils"
import { useMEDDataObject, useMEDDataStore } from "../workspace/useMEDData"
import { MEDDataObject } from "../workspace/NewMedDataObject"
import ModuleLandingShell, { ModuleGuideText } from "./moduleBasics/ModuleLandingShell"

// Variable used to store some modularity information about the module
const typeInfo = {
  extractionMEDiml: {
    title: "MEDiml Extraction",
    ...extractionMEDimlSceneDescription
  },
  learningMEDiml: {
    title: "MEDiml Learning",
    ...learningMEDimlDefaultSettings
  }
}

export default function ModulesLandingPage() {
  const [nameExt, setNameExt] = useState("")
  const [nameML, setNameML] = useState("")
  const [nameExtError, setNameExtError] = useState("")
  const [nameMlError, setNameMLError] = useState("")
  const [isExtDisabled, setIsExtDisabled] = useState(true)
  const [isMLDisabled, setIsMLDisabled] = useState(true)
  const [loading, setLoading] = useState(false)
  const [pendingOpenId, setPendingOpenId] = useState(null)
  const { dispatchLayout, setLayoutRequestQueue } = useContext(LayoutModelContext)
  const medDataStore = useMEDDataStore() // stable handle - read fresh on demand, not subscribed to
  // Re-renders only when the pending object itself appears/changes - not on every workspace change.
  const pendingOpenObject = useMEDDataObject(pendingOpenId)

  useEffect(() => {
    if (!pendingOpenId || !pendingOpenObject) return

    // Update loading state
    setLoading(false)

    const medObject = pendingOpenObject
    const openItem = {
      index: pendingOpenId,
      canMove: true,
      isFolder: false,
      children: medObject.childrenIDs || [],
      data: medObject.name,
      canRename: true,
      type: medObject.type || "medext",
      inWorkspace: medObject.inWorkspace ?? false,
      path: medObject.path ?? null,
      isLocked: medObject.isLocked ?? null,
      usedIn: medObject.usedIn ?? null
    }
    const type = openItem.type === "mediml" ? "openInLearningMEDimlModule" : openItem.type === "medext" ? "openInExtractionMEDimlModule" : null
    if (type === null) {
      toast.error("Cannot open this type of file: " + openItem.type)
      return
    }
    dispatchLayout({ type: type, payload: openItem })
    if (setLayoutRequestQueue) {
      setLayoutRequestQueue((prev) => [...prev, { type: "DELETE_TAB", payload: { id: "modulesLandingPage" } }])
    } else {
      dispatchLayout({ type: "remove", payload: { name: "MEDiml Modules" } })
    }
    
    setPendingOpenId(null)
  }, [dispatchLayout, pendingOpenObject, pendingOpenId, setLayoutRequestQueue])

  // Computed fresh from the store on every call (instead of a useEffect-derived, potentially
  // stale state), since these are only ever needed synchronously inside event handlers.
  const getExperimentNames = (folderName) => {
    const globalData = medDataStore.snapshot()
    const experimentsNode = globalData["EXPERIMENTS"]
    if (!experimentsNode) return []
    const folderId = experimentsNode.childrenIDs.find((id) => globalData[id]?.name === folderName)
    const folder = folderId && globalData[folderId]
    if (!folder) return []
    return folder.childrenIDs.map((id) => globalData[id]?.name)
  }

  const checkExistingFolders = () => {
    let extractionExists = false
    let extractionFolder = null
    let learningExists = false
    let learningFolder = null
    const globalData = medDataStore.snapshot()
    let keys = Object.keys(globalData)
    keys.forEach((key) => {
      if (globalData[key].type === "directory" && globalData[key].parentID === "EXPERIMENTS" && globalData[key].name === "EXTRACTION") {
        extractionExists = true
        extractionFolder = globalData[key]
      }
      if (globalData[key].type === "directory" && globalData[key].parentID === "EXPERIMENTS" && globalData[key].name === "LEARNING") {
        learningExists = true
        learningFolder = globalData[key]
      }
    })
    return { extractionExists, learningExists, extractionFolder, learningFolder }
  }

  const createSceneContent = async (sceneName, extension, type) => {
    // Update loading state
    setLoading(true)
    const trimmedSceneName = sceneName.trim()
  
    // Create a unique id for the scene
    const sceneId = randomUUID()

    // Check if EXTRACTION and LEARNING folders exist
    let { extractionExists, learningExists, extractionFolder, learningFolder } = checkExistingFolders()

    let sceneFolder = null
    if (extension == "mediml"){
      // Create LEARNING folder if it does not exist
      if (!learningExists) {
        learningFolder = new MEDDataObject({
          id: randomUUID(),
          name: "LEARNING",
          type: "directory",
          parentID: "EXPERIMENTS",
          childrenIDs: [],
          inWorkspace: true
        })
        await insertMEDDataObjectIfNotExists(learningFolder)
      }
      sceneFolder = new MEDDataObject({
        id: randomUUID(),
        name: trimmedSceneName,
        type: "directory",
        parentID: learningFolder.id,
        childrenIDs: [],
        inWorkspace: true
      })
    } else if (extension == "medext"){
      // Create EXTRACTION folder if it does not exist
      if (!extractionExists) {
        extractionFolder = new MEDDataObject({
          id: randomUUID(),
          name: "EXTRACTION",
          type: "directory",
          parentID: "EXPERIMENTS",
          childrenIDs: [],
          inWorkspace: true
        })
        await insertMEDDataObjectIfNotExists(extractionFolder)
      }
      sceneFolder = new MEDDataObject({
        id: randomUUID(),
        name: trimmedSceneName,
        type: "directory",
        parentID: extractionFolder.id,
        childrenIDs: [],
        inWorkspace: true
      })
    } else {
      toast.error("Invalid extension")
      return
    }
    if (sceneFolder === null){
      console.error("Scene folder is null", sceneFolder, learningFolder, extractionFolder)
      toast.error("Error occurred while creating scene")
      return
    }
    let sceneFolderId = await insertMEDDataObjectIfNotExists(sceneFolder)

    // Create folder models and notebooks in the scene folder
    for (const folder of typeInfo[type].externalFolders) {
      let medObject = new MEDDataObject({
        id: randomUUID(),
        name: folder,
        type: "directory",
        parentID: sceneFolderId,
        childrenIDs: [],
        inWorkspace: false
      })
      await insertMEDDataObjectIfNotExists(medObject)
    }

    // Create custom zip file
    let sceneObject = new MEDDataObject({
      id: randomUUID(),
      name: trimmedSceneName + "." + extension,
      type: extension,
      parentID: sceneFolderId,
      childrenIDs: [],
      inWorkspace: false
    })
    let sceneObjectId = await insertMEDDataObjectIfNotExists(sceneObject)
    // Create hidden metadata file
    const emptyScene = [{
      "nodes": [],
      "edges": [],
      "viewport": {
        "x": 235.01823373389306,
        "y": 186.91830088750686,
        "zoom": 1.0
      },
      "MLType": "classification",
      "intersections": []
    }]
    let metadataObject = new MEDDataObject({
      id: randomUUID(),
      name: "metadata.json",
      type: "json",
      parentID: sceneObjectId,
      childrenIDs: [],
      inWorkspace: false
    })
    await insertMEDDataObjectIfNotExists(metadataObject, null, emptyScene)
    // Create hidden metadata file for backend
    let backendMetadataObject = new MEDDataObject({
      id: randomUUID(),
      name: "backend_metadata.json",
      type: "json",
      parentID: sceneObjectId,
      childrenIDs: [],
      inWorkspace: false
    })
    await insertMEDDataObjectIfNotExists(backendMetadataObject, null, emptyScene)
    // Create hidden folders
    for (const folder of typeInfo[type].internalFolders) {
      let medObject = new MEDDataObject({
        id: randomUUID(),
        name: folder,
        type: "directory",
        parentID: sceneObjectId,
        childrenIDs: [],
        inWorkspace: false
      })
      await insertMEDDataObjectIfNotExists(medObject)
    }

    // Load everything in globalData
    MEDDataObject.updateWorkspaceDataObject()

    setPendingOpenId(sceneObjectId || sceneId)
  }

  function choosePage(event, name) {
    event.stopPropagation()
    console.log(`Double clicked ${name}`, event, `open${name}Module`)
    dispatchLayout({ type: `open${name}Module`, payload: { pageId: name } })
  }

  const onNameExtChange = (e) => {
      setNameExt(e)
    const trimmedName = e.trim()
    const isValidName = /^[A-Za-z0-9_-]+$/.test(trimmedName)
    const existingNames = new Set(getExperimentNames("EXTRACTION"))
    const hasConflict =
      trimmedName !== "" && (existingNames.has(trimmedName) || existingNames.has(`${trimmedName}.medext`))
    const nameError = trimmedName === ""
      ? ""
      : !isValidName
        ? "Use only letters, numbers, hyphens, or underscores."
        : hasConflict
          ? "This scene name already exists."
          : ""
    setNameExtError(nameError)
    const isStartDisabled = loading || trimmedName === "" || !isValidName || hasConflict
    setIsExtDisabled(isStartDisabled)
  }

  const onNameMLChange = (e) => {
    setNameML(e)
    const trimmedName = e.trim()
    const isValidName = /^[A-Za-z0-9_-]+$/.test(trimmedName)
    const existingNames = new Set(getExperimentNames("LEARNING"))
    const hasConflict =
      trimmedName !== "" && (existingNames.has(trimmedName) || existingNames.has(`${trimmedName}.mediml`))
    const nameError = trimmedName === ""
      ? ""
      : !isValidName
        ? "Use only letters, numbers, hyphens, or underscores."
        : hasConflict
          ? "This scene name already exists."
          : ""
    setNameMLError(nameError)
    const isStartDisabled = loading || trimmedName === "" || !isValidName || hasConflict
    setIsMLDisabled(isStartDisabled)
  }

  return (
    <ModuleLandingShell
      title="MEDiml Modules"
      description="Extract handcrafted radiomics features from medical images and train and evaluate machine learning models."
      infoContent={
        <ModuleGuideText>
          <p className="mb-0">
            MEDiml offers two central modules: one for radiomic features extraction and another for machine learning. 
            The Extraction Module allows you to easily extract radiomic features from your medical images, 
            while the Learning Module enables model training, testing, and explanation of your model's predictions. 
            Create a new scene to get started!
          </p>
        </ModuleGuideText>
      }
      documentation={{
        url: "https://medomicslab.gitbook.io/mediml-app-docs/radiomics/",
        label: "MEDiml Modules documentation",
      }}
    >
      <Stack
        direction="horizontal"
        gap={4}
        className="flex-wrap align-items-stretch justify-content-center module-landing-tool-grid w-100"
        style={{ justifyContent: "center" }}
      >
        {/* Extraction Module Card */}
        <Card
          className="shadow-sm border-primary hover-border-primary"
          style={{ cursor: "pointer", flex: "1 1 320px", minWidth: "280px" }}
        >
          <Card.Header className="bg-primary text-white d-flex align-items-center">
            <h5 className="text-white mb-0">Extraction Module</h5>
          </Card.Header>
          <Card.Body className="d-flex flex-column justify-content-center align-items-center p-4">
            <Pickaxe width={120} height={120} color="#3269ce"/>
            <Card.Text className="mt-3 text-center">
              Extract radiomics features from your medical images and create comprehensive 
              datasets for your machine learning projects.
            </Card.Text>
            <div 
              className="p-inputgroup w-full my-3"
              style={{ margin: "5px", fontSize: "1rem", marginTop: "20px", maxWidth: "300px" }}
            >
              <InputText placeholder="Scene Name" value={nameExt} onChange={(e) => onNameExtChange(e.target.value)} />
              <span className="p-inputgroup-addon">.medext</span>
            </div>
            {nameExtError && (
              <div className="text-danger small mb-4">{nameExtError}</div>
            )}
            <Button 
              loading={loading} 
              severity="info" 
              onClick={() => createSceneContent(nameExt, "medext", "extractionMEDiml")} disabled={isExtDisabled}
              label='Start Extraction'
            />
          </Card.Body>
        </Card>

        {/* Learning Module Card */}
        <Card
          className="shadow-sm border-success"
          style={{ cursor: "pointer", flex: "1 1 320px", minWidth: "280px" }}
        >
          <Card.Header className="bg-success text-white d-flex align-items-center">
            <h5 className="text-white mb-0">Learning Module</h5>
          </Card.Header>
          <Card.Body className="d-flex flex-column justify-content-center align-items-center p-4">
            <BrainCircuit width={120} height={120} color="#12771b"/>
            <Card.Text className="mt-3 text-center">
              In the Learning Module, you will be able to train and test machine learning models using the datasets 
              created in the Extraction Module.
            </Card.Text>
            <div 
              className="p-inputgroup w-full my-3"
              style={{ margin: "5px", fontSize: "1rem", marginTop: "20px", maxWidth: "300px" }}
            >
              <InputText placeholder="Scene Name" value={nameML} onChange={(e) => onNameMLChange(e.target.value)} />
              <span className="p-inputgroup-addon">.mediml</span>
            </div>
            {nameMlError && (
              <div className="text-danger small mb-4">{nameMlError}</div>
            )}
            <Button 
              label='Start Learning'
              loading={loading} 
              severity="success" 
              onClick={(e) => createSceneContent(nameML, "mediml", "learningMEDiml")} 
              disabled={isMLDisabled}
            />
          </Card.Body>
        </Card>
      </Stack>
    </ModuleLandingShell>
  )
}
