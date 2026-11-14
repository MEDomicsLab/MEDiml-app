import { Button } from 'primereact/button'
import { Column } from 'primereact/column'
import { Dialog } from 'primereact/dialog'
import { InputSwitch } from 'primereact/inputswitch'
import { SelectButton } from 'primereact/selectbutton'
import { TreeTable } from 'primereact/treetable'
import React, { useContext, useEffect, useRef, useState } from 'react'
import { Alert, Card, Form, ProgressBar } from 'react-bootstrap'
import { toast } from 'react-toastify'
import { getDefaultExtractionSettings, sameSettings } from "../../utilities/medimlDefaultSettings"
import MEDIML_DOCS from '../../utilities/medimlDocs'
import { requestBackend } from "../../utilities/requests"
import DosiomicsDoc, { DOSIOMICS_DOC_TITLE } from "../docs/DosiomicsDoc"
import InputDataDoc, { INPUT_DATA_DOC_TITLE } from "../docs/InputDataDoc"
import RoiCsvDoc, { ROI_CSV_DOC_TITLE } from "../docs/RoiCsvDoc"
import DocLink from '../extractionMEDiml/docLink'
import ExtractionSettingsCard, { defaultSettingsSource } from '../extractionMEDiml/ExtractionSettingsCard'
import SourcePicker from '../extractionMEDiml/SourcePicker'
import { ErrorRequestContext } from '../generalPurpose/errorRequestContext'
import Disclosure from '../primitives/Disclosure'
import SectionCard from '../primitives/SectionCard'
import Toolbar from '../primitives/Toolbar'
import { MEDDataObject } from '../workspace/NewMedDataObject'
import { useMEDDataObjectsByType, useMEDDataStore } from '../workspace/useMEDData'
import { WorkspaceContext } from "../workspace/workspaceContext"
import SettingsEditor from "./dataComponents/settingsEditor"

/**
 * @param {Object} nodeForm form associated to the discretization node
 * @param {object} data data of the node
 * @param {Function} changeNodeForm function to change the node form
 * @returns {JSX.Element} A InputForm to display in the modal of an input node
 *
 * @description
 * This component is used to display a InputForm.
 */
/** Default core count. Named so the "n modified" badge on the Advanced section
 *  compares against a single source of truth rather than a repeated literal. */
/**
 * Label, hint and documentation link for the dataset folder, by on-disk format.
 * Hoisted so the three-way lookup lives in one place rather than being written
 * out inline beside the control.
 */
const EXTRACT_DATASET = {
  npy: {
    label: "NPY dataset folder",
    hint: "Folder containing the MEDscan objects (.npy) to extract features from. These are produced by the DataManager.",
    doc: MEDIML_DOCS.dataManager
  },
  nifti: {
    label: "NIfTI dataset folder",
    hint: "Folder containing the NIfTI files (.nii / .nii.gz) to extract features from.",
    doc: MEDIML_DOCS.inputDataNifti
  },
  dicom: {
    label: "DICOM dataset folder",
    hint: "Folder containing the DICOM files (.dcm) to extract features from.",
    doc: MEDIML_DOCS.inputDataDicom
  }
}

const DEFAULT_N_CORES = 12

/** Name of the copy of the run's settings written into the save folder. */
const SETTINGS_SNAPSHOT_NAME = "extraction_settings.json"

const BatchExtractor = ({ pageId, configPath = "" }) => {
  const { port } = useContext(WorkspaceContext) // Get the port of the backend
  const medDataStore = useMEDDataStore() // stable handle - read fresh on demand, not subscribed to
  // Re-run the folder/csv/settings list updates only when the set of relevant files actually
  // changes, instead of on every unrelated workspace change.
  const relevantIds = useMEDDataObjectsByType(["directory", "csv", "json"])
  const { setError } = useContext(ErrorRequestContext) // Get the function to set the error request
  const [progress, setProgress] = useState(0)
  const [refreshEnabled, setRefreshEnabled] = useState(false) // A boolean variable to control refresh
  const [selectedReadFolder, setSelectedReadFolder] = useState('')
  const [selectedSaveFolder, setSelectedSaveFolder] = useState('')
  const [selectedNBatch, setSelectedNBatch] = useState(DEFAULT_N_CORES)
  const [selectedCSVFile, setSelectedCSVFile] = useState('')
  const [listWSFolders, setListWSFolders] = useState([]) // List of folders in the workspace
  const [listCSVFiles, setListCSVFiles] = useState([]) // List of csv files in the workspace
  const [listSettingsFiles, setListSettingsFiles] = useState([]) // List of settings files in the workspace
  const [settings, setSettings] = useState(getDefaultExtractionSettings) // Extraction settings in use
  const [settingsSource, setSettingsSource] = useState(defaultSettingsSource) // Where the settings come from, see ExtractionSettingsCard
  const [nscans, setNscans] = useState(0) // Number of scans to be processed
  const [skipExisting, setSkipExisting] = useState(false) // Skip existing extractions
  const [activeIndex, setActiveIndex] = useState(false)
  const [saveFolder, setSaveFolder] = useState('') // Path of the folder where the results are saved
  const [showRadiomicsResults, setShowRadiomicsResults] = useState(false) // used to display the extraction results
  const [showEdit, setShowEdit] = useState(false) // used to display the extraction results
  const [useDatasetType, setUseDatasetType] = useState("dicom") // A boolean variable to control the use of NIfTI dataset instead of NPY dataset
  const [nodes, setNodes] = useState([])
  const [useWorkspace, setUseWorkspace] = useState(false) // A boolean variable to control the use of the workspace
  const [analyzeDoseMaps, setAnalyzeDoseMaps] = useState(false) // A boolean variable to control the analysis of dose maps
  const [selectedPredDosesCSV, setSelectedPredDosesCSV] = useState('') // Path to CSV file containing prescribed doses per patient
  const [prescDoseColumn, setPrescDoseColumn] = useState('') // Column name for prescribed dose values in pred_doses_csv
  const csvFileInputRef = useRef(null) // Used to reset the local ROI CSV file input, since the file is optional

  useEffect(() => {
    updateWSfolder()
    updateCSVFilesList()
    updateSettingsFilesList()
  }, [])

  useEffect(() => {
    updateWSfolder()
    updateCSVFilesList()
    updateSettingsFilesList()
  }, [relevantIds])

  const updateWSfolder = () => {
    const globalData = medDataStore.snapshot()
    if (globalData !== undefined) {
      let keys = Object.keys(globalData)
      let wsFolders = []
      keys.forEach((key) => {
        if (globalData[key].type === "directory" && !globalData[key].name.startsWith(".")) {
          wsFolders.push({ name: globalData[key].name, value: globalData[key].path })
        }
      })
      setListWSFolders(wsFolders)
    }
  }

  const updateCSVFilesList = () => {
    const globalData = medDataStore.snapshot()
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

  const updateSettingsFilesList = () => {
    const globalData = medDataStore.snapshot()
    if (globalData !== undefined) {
      let keys = Object.keys(globalData)
      let settingsFiles = []
      keys.forEach((key) => {
        if (globalData[key].type === "json" && !globalData[key].name.includes("metadata")) {
          settingsFiles.push({ name: globalData[key].name, value: globalData[key].path })
        }
      })
      setListSettingsFiles(settingsFiles)
    }
  }

  const fs = require('fs');

  const handleNBatchChange = (event) => {
    const n_batch = event.target.value;
    setSelectedNBatch(parseInt(n_batch));
  };

  const handleCSVFileChange = (event) => {
    var fileList = event.target.files
    if (fileList.length > 0) {
      fileList = fileList[0].path
      setSelectedCSVFile(fileList)
    }
    else {
      setSelectedCSVFile(event.target.files.path)
    }
  };

  /**
   * @description Clears the selected local ROI CSV file, since it is optional.
   */
  const handleClearCSVFile = () => {
    setSelectedCSVFile('')
    if (csvFileInputRef.current) {
      csvFileInputRef.current.value = ''
    }
  };

  const handlePredDosesCSVChange = (event) => {
    var fileList = event.target.files
    if (fileList.length > 0) {
      fileList = fileList[0].path
      setSelectedPredDosesCSV(fileList)
    }
    else {
      setSelectedPredDosesCSV(event.target.files.path)
    }
  };

  const handleShowResultsClick = () => {
    if (nodes.length === 0 && saveFolder !== '') {
      fillNodesData(saveFolder);
    }
    setShowRadiomicsResults(true)
  }

  function countFoldersInPath(path) {
    try {
      // check is folder exists
      if (!fs.existsSync(path)) {
        return 0;
      }
      let fileCount = 0;
      const files = fs.readdirSync(path);
  
      for (const file of files) {
        const fullPath = `${path}/${file}`;
        const isDirectory = fs.statSync(fullPath).isDirectory();
  
        if (!isDirectory && fullPath.endsWith('.json')) {
          fileCount++; // Increment the count for the immediate subfolder
          }
      }
  
      return fileCount;
    } catch (error) {
      console.error('Error counting subfolders:', error);
      return 0; // Return 0 in case of an error
    }
  }

  /**
   * Find the csv files in a folder and fill nodes data.
   * @param {string} folderPath - The path of the csv data
   */
  function fillNodesData(folderPath) {
    try {
      let results = []
      const files = fs.readdirSync(folderPath);
      for (const file of files) {
        if (file.split('.').pop() === 'csv') {
          let modality = file.substring(file.indexOf('__') + 2, file.indexOf('(') );
          let roi = file.substring(file.indexOf('(') + 1, file.indexOf(')') );
          let space = file.substring(file.indexOf(')') + 3, file.indexOf('.csv') );
          results.push({
            data: {
              modality: modality,
              roi: roi,
              space: space
            },
          });
        }
      }
      setNodes(results)
    } catch (error) {
      console.error('Error filling nodes data:', error);
      return 0;
    }
  }

  /**
   * @description Opens the settings editor. It edits a copy, so the settings in use only change on Apply.
   */
  const handleEditClick = () => {
    setShowEdit(true)
  }

  /**
   * @description Uses the settings chosen in the settings card.
   * @param {Object} nextSettings - The settings to use
   * @param {Object} nextSource - Where they come from
   */
  const handleSettingsChange = (nextSettings, nextSource) => {
    setSettings(nextSettings)
    setSettingsSource(nextSource)
  }

  /**
   * @description Writes the settings of this run into the save folder and returns their path.
   * MEDiml reads the settings from a file, and the copy records how the results were made.
   * The Cores field is written as n_batch, since a n_batch in the file would override it.
   * @returns {Promise<string>} Path of the written settings file
   */
  const writeSettingsSnapshot = async () => {
    const snapshotPath = require('path').join(selectedSaveFolder, SETTINGS_SNAPSHOT_NAME)
    const nBatch = Number.isInteger(selectedNBatch) && selectedNBatch > 0 ? selectedNBatch : DEFAULT_N_CORES
    await fs.promises.writeFile(snapshotPath, JSON.stringify({ ...settings, n_batch: nBatch }, null, 4))
    return snapshotPath
  }

  const handleOpenFolderClick = () => {
    const { shell } = require('electron');
    shell.openPath(saveFolder);
  }

  const handleRunClick = async () => {

    let pathParams
    try {
      pathParams = await writeSettingsSnapshot()
    } catch (error) {
      console.error('Error:', error)
      toast.error('Could not write the extraction settings to the save folder: ' + error.message)
      return
    }

    // Create an object with the input values
    const requestData = {
      path_read: selectedReadFolder,
      path_params: pathParams,
      path_csv: selectedCSVFile,
      path_save: selectedSaveFolder,
      n_batch: parseInt(selectedNBatch),
      skip_existing: skipExisting,
      use_format: useDatasetType
    }

    if (analyzeDoseMaps) {
      requestData.pred_doses_csv = selectedPredDosesCSV
      requestData.presc_dose_column = prescDoseColumn
    }

    console.log("requestData", requestData);

    // Simulate page refresh
    setRefreshEnabled(true)
    setProgress(0)
    // Forget the scan count of the previous run until the new one is received
    setNscans(0)

    // Make a POST request to the backend API
    requestBackend(
      port, 
      '/extraction_MEDiml/run_all/be_count', 
      requestData, 
      (response) => {
        console.log("response", response)
        if (response.error) {
          console.error('Error:', response.error)
          toast.error('Error: ' + response.error)
          setError(response.error)
          setRefreshEnabled(false)
          setProgress(0)
          return
        } else {
          // Handle the response from the backend if needed
          setNscans(response.n_scans);
          setSaveFolder(response.folder_save_path);
          console.log('Response from backend:', response);
        }
      },
      (error) => {
        console.error('Error:', error)
        toast.error('Error: ' + error)
        setRefreshEnabled(false)
        setProgress(0)
        return
      }
    )

    // Make a POST request to the backend API to run BatchExtractor
    requestBackend(
      port, 
      '/extraction_MEDiml/run_all/be', 
      requestData, 
      (response) => {
        setRefreshEnabled(false)
        setProgress(0)
        console.log("response", response)
        MEDDataObject.updateWorkspaceDataObject()
        if (response.error) {
          console.error('Error:', response.error)
          toast.error('Error: ' + response.error)
          // eslint-disable-next-line no-prototype-builtins
          if (!response.error.hasOwnProperty('message')) {
            setError({"message": response.error})
          } else {
            setError(response.error)
          }
        } else {
          // Handle the response from the backend if needed
          console.log('Response from backend:', response)
          toast.success('Finished extraction!')
          // fill nodes data
          if (saveFolder !== '') {
            fillNodesData(saveFolder)
          }
        }
      },
      (error) => {
        console.error('Error:', error)
        toast.error('Error: ' + error)
        setRefreshEnabled(false)
        setProgress(0)
      }
    )
  }

  // Function to fetch and update data (your front-end function)
  const fetchData = () => {

    // Simulate counting files
    var totalFiles = 0;
    if (saveFolder != '') {
      totalFiles = countFoldersInPath(saveFolder); // Replace with the actual total number of files
    }

    // Calculate the progress, the number of scans is unknown (0) until the count request answers
    // and old feature files from a previous run can outnumber the scans, so the progress is capped
    var newData = nscans > 0 ? Math.min(Math.round((totalFiles / nscans) * 100), 100) : 0;
    if (totalFiles === 0 || nscans <= 0) {
      setProgress(0);
      // setProgress({now: number, currentLabel: string})
    }
    else {
      setProgress(newData);
    }

    if (newData === 100) {
      setRefreshEnabled(false);
    }
  };

  useEffect(() => {
    if (refreshEnabled && progress !== 100) {
      // Call fetchData immediately when the component mounts
      fetchData();

      // Set up an interval to refresh the data every second (1000 milliseconds)
      const intervalId = setInterval(() => {
        fetchData();
      }, 1000);

      // Clean up the interval when the component unmounts
      return () => {
        clearInterval(intervalId);
    };
  }
  }, [refreshEnabled, nscans, saveFolder]); // The empty dependency array ensures this effect runs only once when the component mounts

  /**
   * @description Uses the edited settings and tells the user whether anything changed.
   * @param {Object} edited - The settings returned by the editor
   */
  const handleApplySettings = (edited) => {
    setShowEdit(false)
    if (sameSettings(edited, settings)) {
      toast.info('No changes to apply')
      return
    }
    setSettings(edited)
    toast.success('Extraction settings applied. They will be used for the next run.')
  }

  /**
   * @returns {JSX.Element} The side panel to edit the extraction settings
   * @description Mounted only while open, so each opening starts from the settings in use.
   */
  const renderEdit = () => {
    if (showEdit) {
      return (
        <SettingsEditor
          visible={showEdit}
          settings={settings}
          onHide={() => setShowEdit(false)}
          onApply={handleApplySettings}
        />
      )
    }
  }

  /**
   * @returns {JSX.Element} A dialog of extraction results
   *
   * @description
   * This function is used to render the tree menu of the extraction node.
   */
  const renderResults = () => {
    // Check if data.internal.settings.results is available
    if (showRadiomicsResults){
      if (saveFolder){
        return (  
        <Dialog 
          header="Radiomics extraction results (CSV files)" 
          visible={showRadiomicsResults} 
          style={{ width: '50vw' }}
          position={'right'}
          onHide={() => setShowRadiomicsResults(false)}
        >
          <div className="card">
              <TreeTable value={nodes} className="mt-4" tableStyle={{ minWidth: '25rem' }}>
                  <Column field="modality" header="Modality" ></Column>
                  <Column field="roi" header="ROI"></Column>
                  <Column field="space" header="space"></Column>
              </TreeTable>
          </div>
          <br></br>
          <div className="flex justify-content-start">
            <Button icon="pi pi-folder-open" label="Open folder" severity="info" onClick={handleOpenFolderClick}/>
          </div>
        </Dialog>
        )
      } else {
        return (
        <Dialog 
          header="Radiomics extraction results (CSV files)" 
          visible={showRadiomicsResults} 
          style={{ width: '50vw' }}
          position={'right'}
          onHide={() => setShowRadiomicsResults(false)}
        >
          <Alert variant="danger" className="warning-message">
            <b>No results available</b>
          </Alert>
        </Dialog>
        )
      }
    }
  }

  return (
    <>
    {renderResults()}
    {renderEdit()}
    <div>
    <Card>
      <Card.Body>
        <Card.Header>
          <h4>Batch Extractor - Radiomics</h4>
          <DocLink
            linkString={"https://medomicslab.gitbook.io/mediml-app-docs/radiomics/feature-extraction/batch-extraction"}
            name={"What is BatchExtractor?"}
            image={"https://www.svgrepo.com/show/521262/warning-circle.svg"}
          />
        </Card.Header>

      {/* Check whether to use the workspace or not*/}
      <SectionCard
        row
        align="center"
        title="Use current workspace data"
        hint="Read the dataset, ROI CSV and settings file from the current workspace instead of picking them from disk."
      >
        <InputSwitch
          checked={useWorkspace}
          onChange={(e) => setUseWorkspace(e.value)}
        />
      </SectionCard>

      {/* DATASET FORMAT */}
      <SectionCard
        row
        align="center"
        title="Dataset format"
        doc={{ title: INPUT_DATA_DOC_TITLE, content: <InputDataDoc formats={["dicom", "nifti", "npy"]} selected={useDatasetType} /> }}
        docHref={MEDIML_DOCS.inputDataDev}
      >
        <SelectButton
          value={useDatasetType}
          onChange={(e) => { if (e.value) setUseDatasetType(e.value) }}
          optionLabel="label"
          options={[
            { label: 'DICOM', value: "dicom" },
            { label: 'NIfTI', value: "nifti" },
            { label: 'NPY', value: "npy" }
            
          ]}
        />
      </SectionCard>

      {/* UPLOAD DATASET FOLDER */}
      <SectionCard
        row
        title={EXTRACT_DATASET[useDatasetType].label}
        hint={EXTRACT_DATASET[useDatasetType].hint}
        docHref={EXTRACT_DATASET[useDatasetType].doc}
      >
        <SourcePicker
          mode={useWorkspace ? "workspace" : "local"}
          kind="folder"
          name="path_read"
          options={listWSFolders}
          value={selectedReadFolder}
          onPathChange={setSelectedReadFolder}
        />
      </SectionCard>

      {/* EXTRACTION SETTINGS */}
      <ExtractionSettingsCard
        settings={settings}
        source={settingsSource}
        onChange={handleSettingsChange}
        onEdit={handleEditClick}
        useWorkspace={useWorkspace}
        workspaceFiles={listSettingsFiles}
      />


        {/* UPLOAD CSV FILE*/}
        <SectionCard
          row
          title="Custom List of ROIs to Analyze"
          badge="optional"
          doc={{ title: ROI_CSV_DOC_TITLE, content: <RoiCsvDoc /> }}
          docHref={MEDIML_DOCS.roiCsvDev}
        >
          <SourcePicker
            mode={useWorkspace ? "workspace" : "local"}
            kind="file"
            accept=".csv"
            name="path_csv"
            options={listCSVFiles}
            value={selectedCSVFile}
            onPathChange={setSelectedCSVFile}
            onLocalChange={handleCSVFileChange}
            inputRef={csvFileInputRef}
            showClear
            placeholder="Union of all ROIs"
            action={
              selectedCSVFile && !useWorkspace ? (
                <Button
                  type="button"
                  severity="secondary"
                  label="Clear"
                  name="ClearCSVButton"
                  onClick={handleClearCSVFile}
                  icon="pi pi-times"
                  iconPos="left"
                  text
                />
              ) : null
            }
          />
        </SectionCard>

        {/* UPLOAD SAVING FOLDER*/}
        <SectionCard
          row
          title="Save folder"
          hint="Where the extracted feature tables and JSON files are written. A sub-folder is created per ROI type."
        >
          <SourcePicker
            mode={useWorkspace ? "workspace" : "local"}
            kind="folder"
            name="path_save"
            options={listWSFolders}
            value={selectedSaveFolder}
            onPathChange={setSelectedSaveFolder}
          />
        </SectionCard>

      {/* NUMBER OF BATCH + SKIP EXISTING + DOSE MAPS */}
      <Disclosure
        title="Advanced"
        modifiedCount={(selectedNBatch !== DEFAULT_N_CORES ? 1 : 0) + (skipExisting ? 1 : 0) + (analyzeDoseMaps ? 1 : 0)}
      >
        <SectionCard
          row
          align="center"
          title="Cores"
          hint="Number of CPU cores used for the parallel extraction of features."
          docHref={MEDIML_DOCS.generalAnalysisParams}
        >
          <Form.Control
            name="n_cores"
            type="number"
            defaultValue={DEFAULT_N_CORES}
            placeholder={"Default: " + DEFAULT_N_CORES}
            onChange={handleNBatchChange}
            aria-label="Number of cores"
          />
        </SectionCard>

        <SectionCard
          row
          align="center"
          title="Skip existing extractions"
          hint="Skip any scan whose features are already present in the save folder."
        >
          <InputSwitch
            checked={skipExisting}
            onChange={(e) => {
              setSkipExisting(e.value)
              setActiveIndex(!activeIndex)
            }}
          />
        </SectionCard>

        {/* Ask user if he is analyzing dose metrics*/}
        <SectionCard
          row
          align="center"
          title="Analyze dose maps"
          doc={{ title: DOSIOMICS_DOC_TITLE, content: <DosiomicsDoc /> }}
        >
          <InputSwitch
            checked={analyzeDoseMaps}
            onChange={(e) => setAnalyzeDoseMaps(e.value)}
          />
        </SectionCard>

        {analyzeDoseMaps && (
          <>
            <SectionCard
              row
              title="Prescribed doses CSV"
              hint="CSV file giving the prescribed dose per patient. It must include a PatientID column, plus the dose column named below."
            >
              <SourcePicker
                mode={useWorkspace ? "workspace" : "local"}
                kind="file"
                accept=".csv"
                name="pred_doses_csv"
                options={listCSVFiles}
                value={selectedPredDosesCSV}
                onPathChange={setSelectedPredDosesCSV}
                onLocalChange={handlePredDosesCSVChange}
                placeholder="Select a file"
              />
            </SectionCard>

            <SectionCard
              row
              align="center"
              title="Dose column name"
              hint="Name of the column in the prescribed doses CSV holding the prescription dose for each patient."
            >
              <Form.Control
                name="presc_dose_column"
                type="text"
                value={prescDoseColumn}
                placeholder="e.g. PrescriptionDose"
                onChange={(event) => setPrescDoseColumn(event.target.value)}
                aria-label="Prescribed dose column name"
              />
            </SectionCard>
          </>
        )}
      </Disclosure>

      {/* PROGRESS BAR*/}
      {(refreshEnabled || progress === 100 || progress !== 0) && (
          <React.Fragment>
            <br />
            <br />
          </React.Fragment>
          )}
      {(progress === 0) && (refreshEnabled) &&(
          <div className="progress-bar-requests">
            <label>Processing</label>
              <ProgressBar animated striped variant="danger" now={100} label={'Preparing data...'} />
          </div>
        )}
      {progress !== 0 && progress !== 100 && (
          <div className="progress-bar-requests">
            <label>Extracting features</label>
              <ProgressBar animated striped variant="info" now={progress} label={`${progress}%`} />
          </div>
        )}
      {progress === 100 && (
          <div className="progress-bar-requests">
            <label>Done!</label>
              <ProgressBar animated striped variant="success" now={progress} label={`${progress}%`} />
          </div>
      )}

      {/* PROCESS BUTTON*/}
      <Toolbar>
        <Button
          severity="success"
          label="RUN"
          name="ProcessButton"
          onClick={handleRunClick}
          disabled={(
            !selectedReadFolder ||
            !selectedSaveFolder ||
            refreshEnabled ||
            (analyzeDoseMaps && (!selectedPredDosesCSV || !prescDoseColumn.trim()))
          )}
          icon="pi pi-play"
          raised
          rounded
        />
        <Button
          severity="secondary"
          label="Show Results"
          name="ShowResultsButton"
          icon="pi pi-list"
          onClick={handleShowResultsClick}
          raised
          rounded
        />
      </Toolbar>
      </Card.Body>
    </Card>
  </div>
  </>
  );
}

export default BatchExtractor;
