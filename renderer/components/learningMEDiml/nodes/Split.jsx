import { Dropdown } from 'primereact/dropdown';
import { InputNumber } from 'primereact/inputnumber';
import { InputSwitch } from 'primereact/inputswitch';
import { InputText } from 'primereact/inputtext';
import { useEffect, useState } from 'react';
import { Col, Form, Row } from "react-bootstrap";
import Node, { updateHasWarning } from "../../flow/node";
import Caption from '../../primitives/Caption';
import { sectionCardClass } from '../../primitives/SectionCard';
import { useMEDDataObjectsByType, useMEDDataStore } from "../../workspace/useMEDData";


// The split types, the values are those of the active_method setting (see split_node.py)
const SPLIT_TYPE_OPTIONS = [
  { name: "Random", value: "Random" },
  { name: "Institution", value: "Institution" },
  { name: "Cross-Validation", value: "cv" }
]
const RANDOM_METHOD_OPTIONS = [{ name: "SubSampling", value: "SubSampling" }]

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
  const [selectedSaveFolder, setSelectedSaveFolder] = useState(data.internal.settings.path_save_experiments || "") // Selected save folder
  const [selectedWSFolder, setSelectedWSFolder] = useState(data.internal.settings.path_ws_experiments || "") // Selected workspace folder
  const [listCSVFiles, setListCSVFiles] = useState([]) // List of csv files in the workspace
  const [listWSFolders, setListWSFolders] = useState([]) // List of folders in the workspace
  const [listsLoaded, setListsLoaded] = useState(false) // False until the workspace data is available
  const [reload, setReload] = useState(false)
  const medDataStore = useMEDDataStore() // stable handle - read fresh on demand, not subscribed to
  // Re-run the folder/csv list updates only when the set of directories/csv files actually
  // changes, instead of on every unrelated workspace change.
  const relevantIds = useMEDDataObjectsByType(["directory", "csv"])
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
    if (data.internal.settings.active_method?.[0]?.toLowerCase() !== "cv"){
      console.log("debug 0")
      data.setupParam.possibleSettings.defaultSettings.active_method = data.internal.settings.active_method
    }
    if (data.setupParam.possibleSettings.defaultSettings.active_method?.[0]?.toLowerCase() === "cv" &&
      data.setupParam.possibleSettings.defaultSettings.cv.nFolds &&
      data.setupParam.possibleSettings.defaultSettings.cv.nFolds !== data.internal.settings.cv.nFolds
    ){
      console.log("debug 1")
      data.setupParam.possibleSettings.defaultSettings.cv.nFolds = data.internal.settings.cv.nFolds
    } else if (data.setupParam.possibleSettings.defaultSettings.active_method?.[0]?.toLowerCase() === "random" &&
      data.setupParam.possibleSettings.defaultSettings.Random.nSplits &&
      data.setupParam.possibleSettings.defaultSettings.Random.nSplits !== data.internal.settings.Random.nSplits
    ){
      console.log("debug 2")
      data.setupParam.possibleSettings.defaultSettings.Random.nSplits = data.internal.settings.Random.nSplits
    }
    updateLists()
    setReload(!reload)
  }, [])

  useEffect(() => {
    updateLists()
  }, [relevantIds])

  /**
   * @description Updates the lists of folders and csv files of the workspace, then the warnings of the node
   */
  const updateLists = () => {
    const globalData = medDataStore.snapshot()
    if (globalData === undefined) return
    let wsFolders = []
    let csvFiles = []
    Object.values(globalData).forEach((object) => {
      if (object.type === "directory" && !object?.path?.includes(".medomics") && !object?.path?.includes(".mediml")) {
        wsFolders.push({ name: object.name, value: object.path })
      } else if (object.type === "csv") {
        csvFiles.push({ name: object.name, value: object.path })
      }
    })
    // The paths can only be checked once the workspace data is available
    const loaded = Object.keys(globalData).length > 0
    setListWSFolders(wsFolders)
    setListCSVFiles(csvFiles)
    setListsLoaded(loaded)
    updateWarnings(wsFolders, csvFiles, loaded)
  }

  /**
   * @param {String} path path saved in the settings
   * @param {Array} options options of its dropdown
   * @param {Boolean} loaded whether the workspace data is available
   * @returns {Boolean} True if the path is set but is not in the workspace (e.g. it was moved, renamed or deleted, or
   * the scene comes from another computer). Its dropdown can't display it, so it looks empty.
   */
  const isMissingFromWorkspace = (path, options = [], loaded = listsLoaded) => loaded && !!path && !options.some((option) => option.value === path)

  /**
   * @description Updates the warning of the node: the mandatory fields (see updateHasWarning), then the saved paths
   * that are not in the workspace, which would otherwise look empty without any warning
   */
  const updateWarnings = (wsFolders = listWSFolders, csvFiles = listCSVFiles, loaded = listsLoaded) => {
    updateHasWarning(data)
    if (data.internal.hasWarning?.state) return
    const settings = data.internal.settings
    let message = null
    if (isMissingFromWorkspace(settings.path_ws_experiments, wsFolders, loaded)) {
      message = "The experiment's workspace folder was not found in the workspace, please select it again!"
    } else if (isMissingFromWorkspace(settings.path_outcome_file, csvFiles, loaded)) {
      message = "The outcomes CSV file was not found in the workspace, please select it again!"
    } else if (isMissingFromWorkspace(settings.path_save_experiments, wsFolders, loaded)) {
      message = "The save folder was not found in the workspace, please select it again!"
    }
    if (message) {
      data.internal.hasWarning = { state: true, tooltip: <p>{message}</p> }
    }
  }

  /**
   * @param {String} path path saved in the settings
   * @param {Array} options options of its dropdown
   * @returns {JSX.Element|null} A note under the dropdown when the saved path is not in the workspace
   */
  const missingPathNote = (path, options) =>
    isMissingFromWorkspace(path, options) ? (
      <Caption below warn>
        Warning: not found in the workspace: {path}
      </Caption>
    ) : null

  // Matched without case, as the scenes saved by older versions may store "random" or "CV"
  const splitTypeValue = SPLIT_TYPE_OPTIONS.find(
    (option) => option.value.toLowerCase() === data.setupParam.possibleSettings.defaultSettings.active_method?.[0]?.toLowerCase()
  )?.value

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
                    updateWarnings()
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
                      updateWarnings()
                      setReload(!reload)
                    }}
                />
              </Form.Group>

              {/* Holdout set parameters (defaults of MEDiml's create_holdout_set) */}
              {data.internal.settings.method == 'random' && (
                <>
                  <Form.Group controlId="holdoutPercentage" style={sectionStyle}>
                    <Form.Label className="holdoutPercentage">Holdout Proportion</Form.Label>
                    <Caption>Proportion of the patients kept aside in the holdout set.</Caption>
                    <InputNumber
                        style={{width: "300px"}}
                        buttonLayout="horizontal"
                        value={data.internal.settings.holdoutPercentage ?? 0.2}
                        onValueChange={(event) => {
                          data.setupParam.possibleSettings.defaultSettings.holdoutPercentage = event.target.value
                          data.internal.settings.holdoutPercentage = event.target.value
                          updateWarnings()
                          setReload(!reload)
                        }}
                        mode="decimal"
                        showButtons
                        min={0.01}
                        max={0.99}
                        step={0.01}
                        incrementButtonClassName="p-button-info"
                        decrementButtonClassName='p-button-info'
                    />
                  </Form.Group>

                  <Form.Group controlId="holdoutSeed" style={sectionStyle}>
                    <Form.Label className="holdoutSeed">Holdout Random Seed</Form.Label>
                    <Caption>Ensures a reproducible holdout set.</Caption>
                    <InputNumber
                        style={{width: "300px", display: "block", margin: "0 auto"}}
                        buttonLayout="horizontal"
                        value={data.internal.settings.holdoutSeed ?? 1}
                        onValueChange={(event) => {
                          data.setupParam.possibleSettings.defaultSettings.holdoutSeed = event.target.value
                          data.internal.settings.holdoutSeed = event.target.value
                          updateWarnings()
                          setReload(!reload)
                        }}
                        mode="decimal"
                        min={0}
                    />
                  </Form.Group>
                </>
              )}

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
                      updateWarnings()
                      setReload(!reload)
                    }}
                    options={listWSFolders}
                    optionLabel="name"
                    display="chip"
                    placeholder="Select a folder"
                  />
                  {missingPathNote(selectedWSFolder, listWSFolders)}
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
                    updateWarnings()
                    setReload(!reload)
                  }}
                  options={listCSVFiles}
                  optionLabel="name"
                  display="chip"
                  placeholder="Select a CSV file"
                />
                {missingPathNote(selectedCSVFile, listCSVFiles)}
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
                      updateWarnings()
                      setReload(!reload)
                    }}
                    options={listWSFolders}
                    optionLabel="name"
                    display="chip"
                    placeholder="Select a folder"
                  />
                  {missingPathNote(selectedSaveFolder, listWSFolders)}
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
                  value={splitTypeValue}
                  options={SPLIT_TYPE_OPTIONS}
                  optionLabel="name" 
                  optionValue="value"
                  placeholder="Select a split type"
                  onChange={(event) => {
                    data.setupParam.possibleSettings.defaultSettings.active_method = [event.value];
                    data.internal.settings.active_method = [event.value];
                    updateWarnings();
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
                    style={{width: "300px", margin: "0 auto"}}
                    value={data.setupParam.possibleSettings.defaultSettings.Random.method}
                    options={RANDOM_METHOD_OPTIONS}
                    optionLabel="name" 
                    optionValue="value"
                    placeholder="Select a split method"
                    onChange={(event) => {
                      data.setupParam.possibleSettings.defaultSettings.Random.method = event.value;
                      data.internal.settings.Random.method = event.value;
                      updateWarnings();
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
                    style={{width: "300px", margin: "0 auto"}}
                    buttonLayout="horizontal"
                    value={data.setupParam.possibleSettings.defaultSettings.Random.nSplits}
                    onValueChange={(event) => {
                      data.setupParam.possibleSettings.defaultSettings.Random.nSplits = event.target.value;
                      data.internal.settings.Random.nSplits = event.target.value;
                      updateWarnings();
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
                        updateWarnings();
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
                    style={{width: "300px", margin: "0 auto"}}
                    buttonLayout="horizontal"
                    value={data.setupParam.possibleSettings.defaultSettings.Random.testProportion}
                    onValueChange={(event) => {
                        data.setupParam.possibleSettings.defaultSettings.Random.testProportion = event.target.value;
                        data.internal.settings.Random.testProportion = event.target.value;
                        updateWarnings();
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
                        updateWarnings();
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
                      updateWarnings();
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
                        updateWarnings();
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
