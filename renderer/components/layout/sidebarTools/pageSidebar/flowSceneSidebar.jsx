import { randomUUID } from "crypto"
import Path from "path"
import { useContext } from "react"
import { toast } from "react-toastify"
import { sceneDescription as extractionMEDimlSceneDescription } from "../../../../public/setupVariables/extractionMEDimlNodesParams"
import { sceneDescription as learningMEDimlDefaultSettings } from "../../../../public/setupVariables/learningMEDimlNodesParams"
import { loadJsonPath } from "../../../../utilities/fileManagementUtils"
import { insertMEDDataObjectIfNotExists } from "../../../mongoDB/mongoDBUtils"
import { MEDDataObject } from "../../../workspace/NewMedDataObject"
import { useMEDDataStore } from "../../../workspace/useMEDData"
import FileCreationBtn from "../fileCreationBtn"
import { LayoutModelContext } from "../../layoutContext"
import { fromJSONtoTree } from "../directoryTree/utils"

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

/**
 * @description - This component is the sidebar tools component that will be used in the sidebar component as the learning page
 * @summary - It contains the dropzone component and the workspace directory tree filtered to only show the models and experiment folder and the model files
 * @returns {JSX.Element} - This component is the sidebar tools component that will be used in the sidebar component as the learning page
 */
const FlowSceneSidebar = ({ type }) => {
  const medDataStore = useMEDDataStore() // stable handle - read fresh on demand, not subscribed to
  const { dispatchLayout } = useContext(LayoutModelContext)
  const isProd = process.env.NODE_ENV === "production"

  // Computed fresh from the store on every call (instead of a useEffect-derived, potentially
  // stale state), since this is only ever needed synchronously inside checkIsNameValid below.
  const getExperimentList = () => {
    const experimentsNode = medDataStore.get("EXPERIMENTS")
    let localExperimentList = []
    if (!experimentsNode) return localExperimentList
    for (const experimentId of experimentsNode.childrenIDs) {
      const experimentNode = medDataStore.get(experimentId)
      if (!experimentNode) continue
      if (experimentNode.name === "EXTRACTION" && type === "extractionMEDiml") {
        for (const sceneId of experimentNode.childrenIDs) {
          localExperimentList.push(medDataStore.get(sceneId)?.name)
        }
      } else if (experimentNode.name === "LEARNING" && type === "learningMEDiml") {
        for (const sceneId of experimentNode.childrenIDs) {
          localExperimentList.push(medDataStore.get(sceneId)?.name)
        }
      } else {
        localExperimentList.push(experimentNode.name)
      }
    }
    return localExperimentList
  }

  const checkIsNameValid = (name) => {
    const experimentList = getExperimentList()
    return name != "" && !experimentList.includes(name) && !name.includes(" ")
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

  /**
   * @param {String} path The path of the folder where the scene will be created
   * @param {String} name The name of the scene
   * @description - This function is used to create an empty scene
   */
  const createEmptyScene = async (name) => {
    createSceneContent("EXPERIMENTS", name, typeInfo[type].extension)
  }

  /**
   *
   * @param {String} parentId The id of the folder where the scene will be created
   * @param {String} sceneName The name of the scene
   * @param {String} extension The extension of the scene
   */
  const createSceneContent = async (parentId, sceneName, extension) => {
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
        name: sceneName,
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
        name: sceneName,
        type: "directory",
        parentID: extractionFolder.id,
        childrenIDs: [],
        inWorkspace: true
      })
    } else {
      sceneFolder = new MEDDataObject({
        id: randomUUID(),
        name: sceneName,
        type: "directory",
        parentID: parentId,
        childrenIDs: [],
        inWorkspace: false
      })
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
      name: sceneName + "." + extension,
      type: extension,
      parentID: sceneFolderId,
      childrenIDs: [],
      inWorkspace: false
    })
    let sceneObjectId = await insertMEDDataObjectIfNotExists(sceneObject)
    // Create hidden metadata file
    const emptyScene = [loadJsonPath(isProd ? Path.join(process.resourcesPath, "baseFiles", "emptyScene.json") : "./baseFiles/emptyScene.json")]
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

    // Success toast
    toast.success("Scene created successfully")

    /*
    // workspace tree
    let item = fromJSONtoTree({ 'new': sceneObject })
    item = Object.values(item)[0]

    // Open scenes
    if (extension == "medext") {
      dispatchLayout({ type: "openInExtractionMEDimlModule", payload: item })
    }
    else if (extension == "mediml") {
      dispatchLayout({ type: "openInLearningMEDimlModule", payload: item })
    }
    */
  }

  return (
    <>
      <FileCreationBtn label="Create scene" piIcon="pi-plus" createEmptyFile={createEmptyScene} checkIsNameValid={checkIsNameValid} />
    </>
  )
}

export default FlowSceneSidebar
