import { Dropdown } from "primereact/dropdown"
import { MultiSelect } from 'primereact/multiselect'
import React, { useContext, useEffect, useState } from "react"
import { Alert, Col, Form, Row } from "react-bootstrap"
import { toast } from 'react-toastify'
import Node, { updateHasWarning } from "../../flow/node"
import { DataContext } from "../../workspace/dataContext"
import { set } from "lodash"
import Caption from '../../primitives/Caption'
import { sectionCardClass } from '../../primitives/SectionCard'

/**
 * @param {string} id id of the node
 * @param {object} data data of the node
 * @param {string} type type of the node
 * @returns {JSX.Element} A SegmentationNode node
 *
 * @description
 * This component is used to display a SegmentationNode node.
 * it handles the display of the node and the modal
 */
const Data = ({ id, data, type }) => {  
  const [reload, setReload] = useState(false)
  const [featuresFiles, setFeaturesFiles] = useState([])
  const [selectedFolder, setSelectedFolder] = useState("") // Selected folder
  const [listWSFolders, setListWSFolders] = useState([]) // List of folders in the workspace
  const [listCSVFiles, setListCSVFiles] = useState([]) // List of csv files in the workspace
  const { globalData } = useContext(DataContext) // We get the global data from the context
  const sectionStyle = {
    marginBottom: "16px",
    paddingBottom: "12px",
    borderBottom: "1px solid rgba(0, 0, 0, 0.08)"
  }
  const lastSectionStyle = { marginBottom: "16px" }

  useEffect(() => {
    if (!data.setupParam.possibleSettings.defaultSettings.featuresFiles.length){
      data.setupParam.possibleSettings.defaultSettings.featuresFiles = data.internal.settings.featuresFiles
      setFeaturesFiles(data.internal.settings.featuresFiles)
    }
    if (!data.setupParam.possibleSettings.defaultSettings.path) {
      data.setupParam.possibleSettings.defaultSettings.path = data.internal.settings.path
      setSelectedFolder(data.internal.settings.path)
    }
    if (data.setupParam.csv_files && data.setupParam.csv_files.length > 0) {
      setListCSVFiles(data.setupParam.csv_files)
    }
    updateWSfolder()
  }, [])
  
  useEffect(() => {
    updateWSfolder()
  }, [globalData])

  const updateWSfolder = () => {
    if (globalData !== undefined) {
      let keys = Object.keys(globalData)
      let wsFolders = []
      keys.forEach((key) => {
        if (globalData[key].type === "directory" && !globalData[key].name.startsWith(".")) {
          wsFolders.push({ name: globalData[key].name, value: globalData[key].path })
        }
      })
      setListWSFolders(wsFolders)
      if (selectedFolder) {
        handleSaveFolderChange(selectedFolder)
      } else if (data.internal.settings.path) {
        handleSaveFolderChange(data.internal.settings.path)
      }
    }
  }

  const handleSaveFolderChange = (directoryPath) => {
    setSelectedFolder(directoryPath)
    let csvFiles = []
    let keys = Object.keys(globalData)
    let folderID = keys.filter(key => globalData[key].path === directoryPath)
    if (folderID.length > 1) {
      console.error("Error: multiple folders with the same path")
      toast.error("Error: multiple folders with the same path")
      return 
    }
    folderID = folderID[0]
    keys.forEach((key) => {
      if (globalData[key].type === "csv" && globalData[key].parentID === folderID) {
        csvFiles.push({name: globalData[key].name, value: globalData[key].path})
      }
    })
    setListCSVFiles(csvFiles)
    data.setupParam.possibleSettings.defaultSettings.path = directoryPath
    data.internal.settings.path = directoryPath
    data.setupParam.csv_files = csvFiles
    updateHasWarning(data)
    setReload(!reload)
  }

  return (
    <>
      <Node
        key={id}
        id={id}
        data={data}
        type={type}
        setupParam={data.setupParam}
        nodeSpecific={
          <>
            <Row className={sectionCardClass} style={{ alignItems: "center", justifyContent: "center" }}>
            <Col>
            {/* nameType */}
            {/*<Form.Group controlId="nameType">
              <Tooltip target=".nameType"/>
              <Form.Label 
                  className="nameType" 
                  data-pr-tooltip="Type of the experiment. For Radiomics studies, must start with Radiomics. For example: RadiomicsMorph"
                  data-pr-position="bottom">
                      Name Type
              </Form.Label>
                <InputText
                    style={{width: "300px"}}
                    value={data.setupParam.possibleSettings.defaultSettings.nameType}
                    placeholder="Ex: RadiomicsMorph"
                    onChange={(event) => {
                      data.setupParam.possibleSettings.defaultSettings.nameType = event.target.value
                      data.internal.settings.nameType = event.target.value
                      setReload(!reload)
                    }}
                />
            </Form.Group>*/}

            {/* path features */}
            <Form.Group controlId="FeaturePath" style={sectionStyle}>
              <Form.Label className="FeaturePath">Features Folder Name</Form.Label>
              <Caption>Select the folder containing feature files for training.</Caption>
              <Col style={{ width: "300px", margin: "0 auto", display: "block", textAlign: "center" }}>
                <Dropdown
                  style={{ maxWidth: "100%", height: "auto", width: "auto" }}
                  filter
                  value={selectedFolder}
                  onChange={(e) => handleSaveFolderChange(e.value)}
                  options={listWSFolders}
                  optionLabel="name"
                  display="chip"
                  placeholder="Select a folder"
                />
              </Col>
            </Form.Group>

            {/* select features files */}
            {(listCSVFiles.length === 0 && selectedFolder !== "") && (
                <Alert variant="warning" style={{ marginTop: "10px" }}>
                  No features files found in the selected folder.
                </Alert>
            )}
            {(listCSVFiles.length > 0) && (
            <Form.Group controlId="selectFeaturesFiles" style={lastSectionStyle}>
              <Form.Label className="selectFiles" style={{ marginTop: "10px" }}>Select Features Files</Form.Label>
              <Caption>Choose which feature files to use for model training.</Caption>
              <MultiSelect
                style={{ maxWidth: "100%", height: "auto", width: "auto" }}
                value={featuresFiles} 
                onChange={(e) => {
                  setFeaturesFiles(e.value)
                  data.setupParam.possibleSettings.defaultSettings.featuresFiles = e.value
                  data.internal.settings.featuresFiles = e.value
                  updateHasWarning(data)
                  setReload(!reload)
                }} 
                options={listCSVFiles} 
                optionLabel="name" 
                filter 
                placeholder="Select features files"
              />
            </Form.Group>
            )}
            </Col>
            </Row>
          </>
        }
      />
    </>
  )
}

export default Data
