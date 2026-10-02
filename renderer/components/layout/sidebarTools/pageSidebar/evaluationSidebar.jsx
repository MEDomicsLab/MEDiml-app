import React from "react"
import { Stack } from "react-bootstrap"
import SidebarDirectoryTreeControlled from "../directoryTree/sidebarDirectoryTreeControlled"
import { Accordion } from "react-bootstrap"
import { useMEDDataStore } from "../../../workspace/useMEDData"
import FileCreationBtn from "../fileCreationBtn"
import { insertMEDDataObjectIfNotExists } from "../../../mongoDB/mongoDBUtils"
import { MEDDataObject } from "../../../workspace/NewMedDataObject"
import { randomUUID } from "crypto"

// Variable used to store some modularity information about the module
const typeInfo = {
  title: "Evaluation",
  extension: "medeval",
  internalFolders: []
}

/**
 * @description - This component is the sidebar tools component that will be used in the sidebar component as the learning page
 * @summary - It contains the dropzone component and the workspace directory tree filtered to only show the models and experiment folder and the model files
 * @returns {JSX.Element} - This component is the sidebar tools component that will be used in the sidebar component as the learning page
 */
const EvaluationSidebar = () => {
  const medDataStore = useMEDDataStore() // stable handle - read fresh on demand, not subscribed to

  // Computed fresh from the store on every call (instead of a useEffect-derived, potentially
  // stale state), since this is only ever needed synchronously inside checkIsNameValid below.
  const getExperimentList = () => {
    const experimentsNode = medDataStore.get("EXPERIMENTS")
    if (!experimentsNode) return []
    return experimentsNode.childrenIDs.map((experimentId) => medDataStore.get(experimentId)?.name)
  }

  const checkIsNameValid = (name) => {
    const experimentList = getExperimentList()
    return name != "" && !experimentList.includes(name + "." + typeInfo.extension) && !name.includes(" ")
  }

  /**
   * @param {String} name The name of the scene
   * @description - This function is used to create an empty scene
   */
  const createEmptyScene = async (name, useMedStandard = null) => {
    await createSceneContent("EXPERIMENTS", name, typeInfo.extension, useMedStandard)
  }

  /**
   *
   * @param {String} parentId The id of the folder where the scene will be created
   * @param {String} sceneName The name of the scene
   * @param {String} extension The extension of the scene
   */
  const createSceneContent = async (parentId, sceneName, extension, useMedStandard) => {
    // Create custom zip file
    let sceneObject = new MEDDataObject({
      id: randomUUID(),
      name: sceneName + "." + extension,
      type: extension,
      parentID: parentId,
      childrenIDs: [],
      inWorkspace: false
    })
    let sceneObjectId = await insertMEDDataObjectIfNotExists(sceneObject)

    // Create hidden metadata file
    const emptyScene = [{ useMedStandard: useMedStandard }]
    let metadataObject = new MEDDataObject({
      id: randomUUID(),
      name: "metadata.json",
      type: "json",
      parentID: sceneObjectId,
      childrenIDs: [],
      inWorkspace: false
    })
    await insertMEDDataObjectIfNotExists(metadataObject, null, emptyScene)

    // Create internal folders
    for (const folder of typeInfo.internalFolders) {
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
  }

  return (
    <>
      <Stack direction="vertical" gap={0}>
        <p
          style={{
            color: "#a3a3a3",
            font: "Arial",
            fontSize: "12px",
            padding: "0.75rem 0.25rem 0.75rem 0.75rem",
            margin: "0 0 0 0"
          }}
        >
          {typeInfo.title} Module
        </p>
        <FileCreationBtn hasMedStandrad label="Create evaluation page" piIcon="pi-plus" createEmptyFile={createEmptyScene} checkIsNameValid={checkIsNameValid} />

        <Accordion defaultActiveKey={["dirTree"]} alwaysOpen>
          <SidebarDirectoryTreeControlled />
        </Accordion>
      </Stack>
    </>
  )
}

export default EvaluationSidebar
