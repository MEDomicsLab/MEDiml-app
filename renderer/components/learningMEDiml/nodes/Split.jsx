import { Dropdown } from 'primereact/dropdown';
import { InputNumber } from 'primereact/inputnumber';
import { InputSwitch } from 'primereact/inputswitch';
import { InputText } from 'primereact/inputtext';
import { useContext, useEffect, useState } from 'react';
import { Col, Form, Row } from "react-bootstrap";
import Node, { updateHasWarning } from "../../flow/node";
import { DataContext } from "../../workspace/dataContext";
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
const Split = ({ id, data, type }) => {  
  const [selectedCSVFile, setSelectedCSVFile] = useState(data.internal.settings.path_outcome_file || "") // Selected CSV file
  const [selectedSaveFolder, setSelectedSaveFolder] = useState("") // Selected save folder
  const [selectedWSFolder, setSelectedWSFolder] = useState(data.internal.settings.path_ws_experiments || "") // Selected workspace folder
  const [listCSVFiles, setListCSVFiles] = useState([]) // List of csv files in the workspace
  const [listWSFolders, setListWSFolders] = useState([]) // List of folders in the workspace
  const [reload, setReload] = useState(false)
  const { globalData } = useContext(DataContext) // We get the global data from the context
  const sectionStyle = {
    marginBottom: "16px",
    paddingBottom: "12px",
    borderBottom: "1px solid rgba(0, 0, 0, 0.08)"
  }
  const lastSectionStyle = { marginBottom: "16px" }

  useEffect(() => {
    if (!data.setupParam.possibleSettings.defaultSettings.outcome_name){
      data.setupParam.possibleSettings.defaultSettings.outcome_name = data.internal.settings.outcome_name
    }
    if (data.internal.settings.method != data.setupParam.possibleSettings.defaultSettings.method){
      data.setupParam.possibleSettings.defaultSettings.method = data.internal.settings.method
    }
    if (!data.setupParam.possibleSettings.defaultSettings.path_outcome_file){
      data.setupParam.possibleSettings.defaultSettings.path_outcome_file = data.internal.settings.path_outcome_file
      setSelectedCSVFile(data.internal.settings.path_outcome_file)
    }
    if (!data.setupParam.possibleSettings.defaultSettings.path_save_experiments){
      data.setupParam.possibleSettings.defaultSettings.path_save_experiments = data.internal.settings.path_save_experiments
      setSelectedSaveFolder(data.internal.settings.path_save_experiments)
    }
    updateWSfolder()
    updateCSVFilesList()
    setReload(!reload)
  }, [])
  
  useEffect(() => {
    updateWSfolder()
    updateCSVFilesList()
  }, [globalData])

  const updateWSfolder = () => {
    if (globalData !== undefined) {
      let keys = Object.keys(globalData)
      let wsFolders = []
      keys.forEach((key) => {
        if (globalData[key].type === "directory" && !globalData[key]?.path?.includes(".medomics") && !globalData[key]?.path?.includes(".mediml")) {
          wsFolders.push({ name: globalData[key].name, value: globalData[key].path })
        }
      })
      setListWSFolders(wsFolders)
    }
  }

  const updateCSVFilesList = () => {
    if (globalData !== undefined) {
      let keys = Object.keys(globalData)
      let csvFiles = []
      keys.forEach((key) => {
        if (globalData[key].type === "csv") {
          csvFiles.push({ name: globalData[key].name, value: globalData[key].path })
        }
      })
      setListCSVFiles(csvFiles)
    }
  }

  const handleCSVFileChange = (event) => {
    var fileList = event.target.files
    if (fileList.length > 0) {
      fileList = fileList[0].path
      data.setupParam.possibleSettings.defaultSettings.path_outcome_file = fileList
    }
    else {
      data.setupParam.possibleSettings.defaultSettings.path_outcome_file = event.target.files.path
    }
    // Update node warnings
    updateHasWarning(data)
    setReload(!reload)
  }

  const handleSaveFolderChange = (event) => {
    var fileList = event.target.files
    if (fileList.length > 0) {
      fileList = fileList[0].path
      // The path of the image needs to be the path of the common folder of all the files
      // If the directory is constructed according to standard DICOM format, the path
      // of the image is the one containning the folders image and mask
      if (fileList.indexOf("\\") >= 0) {
        fileList = fileList.split("\\").slice(0, -1).join("\\")
      } else if (fileList.indexOf("/") >= 0) {
        fileList = fileList.split("/").slice(0, -1).join("/")
      } else {
        fileList = fileList.split("/").slice(0, -1).join("/")
      }
      data.setupParam.possibleSettings.defaultSettings.path_save_experiments = fileList
      data.internal.settings.path_save_experiments = fileList
    }
    else {
      data.setupParam.possibleSettings.defaultSettings.path_save_experiments = event.target.files.path
      data.internal.settings.path_save_experiments = event.target.files.path
    }
    // Update node warnings
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
        color={"#ffd36b"}
        nodeSpecific={
          <>
            <Row 
              className={sectionCardClass} 
              style={{ maxHeight: "400px", textAlign: "center", alignItems: "center", justifyContent: "center", overflowY: "auto", overflowX: "hidden" }}
            >
              {/* Outcome Name */}
              <Form.Group controlId="outcomeName" style={sectionStyle}>
                <Form.Label className="outcomeName">Outcome Name</Form.Label>
                <Caption>A reference name to describe the problem studied.</Caption>
                <InputText
                  style={{ maxWidth: "100%", height: "auto", width: "auto", display: "block", margin: "0 auto" }}
                  value={data.setupParam.possibleSettings.defaultSettings.outcome_name}
                  placeholder="Ex: RCC_Subtype"
                  onChange={(event) => {
                    data.setupParam.possibleSettings.defaultSettings.outcome_name = event.target.value
                    data.internal.settings.outcome_name = event.target.value
                    // Update node warnings
                    updateHasWarning(data)
                    setReload(!reload)
                  }}
                />
              </Form.Group>

              {/* Split Method */}
              <Form.Group controlId="splitMethod" style={sectionStyle}>
              <Form.Label className="splitMethod">Create Holdout Set</Form.Label>
              <Caption>If activated a holdout set will be created. If not, all the data will be used for learning.</Caption>
                <InputSwitch 
                    checked={data.setupParam.possibleSettings.defaultSettings.method == 'random' ? true : false} 
                    onChange={(event) => {
                      data.setupParam.possibleSettings.defaultSettings.method = event.value ? 'random' : 'all_learn'
                      data.internal.settings.method = event.value ? 'random' : 'all_learn'
                      // Update node warnings
                      updateHasWarning(data)
                      setReload(!reload)
                    }}
                />
              </Form.Group>

              {/* Workspace Folder */}
              <Form.Group controlId="workspaceFolder" style={sectionStyle}>
                <Form.Label className="workspaceFolder">Experiment's Workspace Folder</Form.Label>
                <Caption>
                  Folder containing the experiments' resources (features, outcome file, etc.).
                </Caption>
                <Col style={{ width: "300px", margin: "0 auto", display: "block", textAlign: "center" }}>
                  <Dropdown
                    style={{ maxWidth: "100%", height: "auto", width: "auto" }}
                    filter
                    value={selectedWSFolder}
                    onChange={(e) => {
                      data.setupParam.possibleSettings.defaultSettings.path_ws_experiments = e.value
                      data.internal.settings.path_ws_experiments = e.value
                      setSelectedWSFolder(e.value)
                      // Update node warnings
                      updateHasWarning(data)
                      setReload(!reload)
                    }}
                    options={listWSFolders}
                    optionLabel="name"
                    display="chip"
                    placeholder="Select a folder"
                  />
                </Col>
              </Form.Group>

              {/* Path Outcome */}
              <Form.Group controlId="outcomeFile" style={sectionStyle}>
              <Form.Label className="outcomeFile">Outcomes CSV</Form.Label>
              <Caption>CSV file of the outcomes.</Caption>
              <Col style={{ width: "300px", margin: "0 auto", display: "block", textAlign: "center" }}>
                <Dropdown
                  style={{ maxWidth: "100%", height: "auto", width: "auto" }}
                  filter
                  value={selectedCSVFile}
                  onChange={(e) => {
                    data.setupParam.possibleSettings.defaultSettings.path_outcome_file = e.value
                    data.internal.settings.path_outcome_file = e.value
                    setSelectedCSVFile(e.value)
                    // Update node warnings
                    updateHasWarning(data)
                    setReload(!reload)
                  }}
                  options={listCSVFiles}
                  optionLabel="name"
                  display="chip"
                  placeholder="Select a CSV file"
                />
              </Col>
              </Form.Group>

              {/* Save Folder */}
              <Form.Group controlId="experimentSaveFolder" style={lastSectionStyle}>
                <Form.Label className="experimentSaveFolder">Save Folder</Form.Label>
                <Caption>
                  Folder where the results will be saved. The folder should not be empty.
                </Caption>
                <Col style={{ width: "300px", margin: "0 auto", display: "block", textAlign: "center" }}>
                  <Dropdown
                    style={{ maxWidth: "100%", height: "auto", width: "auto" }}
                    filter
                    value={selectedSaveFolder}
                    onChange={(e) => {
                      data.setupParam.possibleSettings.defaultSettings.path_save_experiments = e.value
                      data.internal.settings.path_save_experiments = e.value
                      setSelectedSaveFolder(e.value)
                      // Update node warnings
                      updateHasWarning(data)
                      setReload(!reload)
                    }}
                    options={listWSFolders}
                    optionLabel="name"
                    display="chip"
                    placeholder="Select a folder"
                  />
                </Col>
              </Form.Group>

              {/* Split Type */}
              <Form.Group controlId="splitType" style={sectionStyle}>
              <Form.Label 
                  className="splitType">
                      Split Type
              </Form.Label>
              <Caption>Choose method for splitting data into sets.</Caption>
              <Dropdown 
                  style={{width: "300px"}}
                  value={data.setupParam.possibleSettings.defaultSettings.active_method[0]}
                  options={[{ name: 'Random' }, { name: 'Institution' }, { name: 'Cross-Validation' }]}
                  optionLabel="name" 
                  placeholder={data.setupParam.possibleSettings.defaultSettings.active_method[0]}
                  onChange={(event) => {
                    if (event.target.value.name === "Cross-Validation") {
                      data.setupParam.possibleSettings.defaultSettings.active_method = ['cv'];
                      data.internal.settings.active_method = ['cv'];
                    } else {
                      data.setupParam.possibleSettings.defaultSettings.active_method = [event.target.value.name];
                      data.internal.settings.active_method = [event.target.value.name];
                    }
                    updateHasWarning(data);
                    setReload(!reload);
                  }} 
              />
              </Form.Group>

              {/* OTHER PARAMS IF SPLIT TYPE IS RANDOM */}
              {data.setupParam.possibleSettings.defaultSettings.active_method?.[0]?.toLowerCase() === "random" &&
              <>
              {/* Split Method */}
              <Form.Group controlId="splitMethod" style={sectionStyle}>
              <Form.Label 
                  className="splitMethod">
                      Split Method
              </Form.Label>
              <Caption>Algorithm for distributing samples into train/test sets.</Caption>
                <Dropdown 
                    style={{width: "300px", display: "block", margin: "0 auto"}}
                    value={data.setupParam.possibleSettings.defaultSettings.Random.method}
                    options={[{ name: 'SubSampling' }]}
                    optionLabel="name" 
                    placeholder={data.setupParam.possibleSettings.defaultSettings.Random.method}
                    onChange={(event) => {
                      data.setupParam.possibleSettings.defaultSettings.Random.method = event.target.value.name;
                      data.internal.settings.Random.method = event.target.value.name;
                      updateHasWarning(data);
                      setReload(!reload);
                    }} 
                        />
              </Form.Group>

              {/* Number of splits */}
              <Form.Group controlId="nSplits" style={sectionStyle}>
              <Form.Label 
                  className="nSplits">
                      Splits Number
              </Form.Label>
              <Caption>Total number of data partitions to create.</Caption>
                <InputNumber
                    style={{width: "300px", display: "block", margin: "0 auto"}}
                    buttonLayout="horizontal"
                    value={data.setupParam.possibleSettings.defaultSettings.Random.nSplits}
                    onValueChange={(event) => {
                      data.setupParam.possibleSettings.defaultSettings.Random.nSplits = event.target.value;
                      data.internal.settings.Random.nSplits = event.target.value;
                      updateHasWarning(data);
                      setReload(!reload);
                    }}
                    mode="decimal"
                    showButtons
                    min={1}
                    incrementButtonClassName="p-button-info"
                    decrementButtonClassName='p-button-info' 
                />

              </Form.Group>

              {/* Flag by institution or not */}
              <Form.Group controlId="stratifyInstitutions" style={sectionStyle}>
              <Form.Label 
                  className="stratifyInstitutions">
                      Flag by Institution
              </Form.Label>
              <Caption>Maintain institution representation in train/test.</Caption>
              <br></br>
                <InputSwitch 
                    checked={data.setupParam.possibleSettings.defaultSettings.Random.stratifyInstitutions} 
                    onChange={(event) => {
                        data.setupParam.possibleSettings.defaultSettings.Random.stratifyInstitutions = event.target.value;
                        data.internal.settings.Random.stratifyInstitutions = event.target.value;
                        updateHasWarning(data);
                        setReload(!reload);
                    }}
                />
              </Form.Group>

              {/* Test proportion */}
              <Form.Group controlId="testProportion" style={sectionStyle}>
              <Form.Label 
                  className="testProportion">
                      Train/Test Proportion
              </Form.Label>
              <Caption>Percentage of data allocated for testing.</Caption>
                <InputNumber
                    style={{width: "300px", display: "block", margin: "0 auto"}}
                    buttonLayout="horizontal"
                    value={data.setupParam.possibleSettings.defaultSettings.Random.testProportion}
                    onValueChange={(event) => {
                        data.setupParam.possibleSettings.defaultSettings.Random.testProportion = event.target.value;
                        data.internal.settings.Random.testProportion = event.target.value;
                        updateHasWarning(data);
                        setReload(!reload);
                    } }
                    mode="decimal"
                    showButtons
                    min={0.01}
                    max={0.99}
                    step={0.01}
                    incrementButtonClassName="p-button-info"
                    decrementButtonClassName='p-button-info' 
                />

              </Form.Group>

              {/* Seed */}
              <Form.Group controlId="seed" style={lastSectionStyle}>
                <Form.Label className="seed">Random Seed</Form.Label>
                <Caption>Ensures reproducible random data splitting.</Caption>
                <InputNumber
                    style={{width: "300px", display: "block", margin: "0 auto"}}
                    buttonLayout="horizontal"
                    value={data.setupParam.possibleSettings.defaultSettings.Random.seed}
                    onValueChange={(event) => {
                        data.setupParam.possibleSettings.defaultSettings.Random.seed = event.target.value;
                        data.internal.settings.Random.seed = event.target.value;
                        updateHasWarning(data);
                        setReload(!reload);
                    } }
                    mode="decimal"
                    min={1}
                />
              </Form.Group>
            </>
            }

            {/* OTHER PARAMS IF SPLIT TYPE IS CV */}
            {data.setupParam.possibleSettings.defaultSettings.active_method?.[0]?.toLowerCase() === "cv" &&
              <>

              {/* Number of splits */}
              <Form.Group controlId="nSplits" style={sectionStyle}>
                <Form.Label className="nSplits">Number of folds</Form.Label>
                <Caption>K value for cross-validation folds (K).</Caption>
                <InputNumber
                    style={{width: "300px"}}
                    buttonLayout="horizontal"
                    value={data.setupParam.possibleSettings.defaultSettings.cv.nFolds}
                    onValueChange={(event) => {
                      data.setupParam.possibleSettings.defaultSettings.cv.nFolds = event.target.value;
                      data.internal.settings.cv.nFolds = event.target.value;
                      updateHasWarning(data);
                      setReload(!reload);
                    }}
                    mode="decimal"
                    showButtons
                    min={1}
                    incrementButtonClassName="p-button-info"
                    decrementButtonClassName='p-button-info' 
                />

              </Form.Group>
              {/* Seed */}
              <Form.Group controlId="seed" style={lastSectionStyle}>
                <Form.Label className="seed">Random Seed
                </Form.Label>
                <Caption>Ensures reproducible random data splitting.</Caption>
                <InputNumber
                    style={{width: "300px", display: "block", margin: "0 auto"}}
                    buttonLayout="horizontal"
                    value={data.setupParam.possibleSettings.defaultSettings.cv.seed}
                    onValueChange={(event) => {
                        data.setupParam.possibleSettings.defaultSettings.cv.seed = event.target.value;
                        data.internal.settings.cv.seed = event.target.value;
                        updateHasWarning(data);
                        setReload(!reload);
                    } }
                    mode="decimal"
                    min={1}
                />
              </Form.Group>
              </>
            }
            </Row>
          </>
        }
      />
    </>
  )
}

export default Split
