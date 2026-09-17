import { Button } from 'primereact/button'
import { Column } from 'primereact/column'
import { Dialog } from 'primereact/dialog'
import { Dropdown } from 'primereact/dropdown'
import { InputSwitch } from 'primereact/inputswitch'
import { SelectButton } from 'primereact/selectbutton'
import { TreeTable } from 'primereact/treetable'
import React, { useContext, useEffect, useRef, useState } from 'react'
import { Alert, Card, Col, Form, ProgressBar, Row } from 'react-bootstrap'
import { toast } from 'react-toastify'
import { requestBackend } from "../../utilities/requests"
import DocLink from '../extractionMEDiml/docLink'
import { ErrorRequestContext } from '../generalPurpose/errorRequestContext'
import { DataContext } from '../workspace/dataContext'
import { MEDDataObject } from '../workspace/NewMedDataObject'
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
const BatchExtractor = ({ pageId, configPath = "" }) => {
  const { port } = useContext(WorkspaceContext) // Get the port of the backend
  const { globalData } = useContext(DataContext) // Get the global data of the workspace
  const { setError } = useContext(ErrorRequestContext) // Get the function to set the error request
  const [progress, setProgress] = useState(0)
  const [loadingEdit, setLoadingEdit] = useState(false)
  const [refreshEnabled, setRefreshEnabled] = useState(false) // A boolean variable to control refresh
  const [selectedReadFolder, setSelectedReadFolder] = useState('')
  const [selectedSaveFolder, setSelectedSaveFolder] = useState('')
  const [selectedNBatch, setSelectedNBatch] = useState(12)
  const [selectedCSVFile, setSelectedCSVFile] = useState('')
  const [selectedSettingsFile, setSelectedSettingsFile] = useState('')
  const [listWSFolders, setListWSFolders] = useState([]) // List of folders in the workspace
  const [listCSVFiles, setListCSVFiles] = useState([]) // List of csv files in the workspace
  const [listSettingsFiles, setListSettingsFiles] = useState([]) // List of settings files in the workspace
  const [settings, setSettings] = useState({}) // Settings of the node
  const [nscans, setNscans] = useState(0) // Number of scans to be processed
  const [skipExisting, setSkipExisting] = useState(false) // Skip existing extractions
  const [activeIndex, setActiveIndex] = useState(false)
  const [saveFolder, setSaveFolder] = useState('') // Path of the folder where the results are saved
  const [showRadiomicsResults, setShowRadiomicsResults] = useState(false) // used to display the extraction results
  const [showEdit, setShowEdit] = useState(false) // used to display the extraction results
  const [useDatasetType, setUseDatasetType] = useState("npy") // A boolean variable to control the use of NIfTI dataset instead of NPY dataset
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

  const updateSettingsFilesList = () => {
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

  const handleReadFolderChange = (event) => {
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
      setSelectedReadFolder(fileList)
    }
    else {
      setSelectedReadFolder(event.target.files.path)
    }
  };

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
      setSelectedSaveFolder(fileList)
    }
    else {
      setSelectedSaveFolder(event.target.files.path)
    }
  };

  const handleNBatchChange = (event) => {
    const n_batch = event.target.value;
    setSelectedNBatch(parseInt(n_batch));
  };

  const handleSettingsFileChange = (event) => {
    var fileList = event.target.files
    if (fileList.length > 0) {
      fileList = fileList[0].path
      setSelectedSettingsFile(fileList)
    }
    else {
      setSelectedSettingsFile(event.target.files.path)
    }
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

  const handleEditClick = () => {
    setLoadingEdit(true)
    // Make a POST request to the backend API
    requestBackend(
      port, 
      '/extraction_MEDiml/run_all/be_json', 
      {selectedSettingsFile}, 
      (response) => {
        console.log("response", response)
        setLoadingEdit(false)
        if (response.error) {
          console.error('Error:', response.error)
          toast.error('Error: ' + response.error)
          setShowEdit(false)
          // eslint-disable-next-line no-prototype-builtins
          if (!response.error.hasOwnProperty('message')) {
            setError({"message": response.error})
          } else {
            setError(response.error)
          }
        } else {
          // Handle the response from the backend if needed
          console.log('Response from backend:', response)

          // set settings
          setSettings(response)

          // show edit dialog
          setShowEdit(true)

          // toast message
          toast.success('Settings loaded!')
        }
      },
      (error) => {
        setLoadingEdit(false)
        console.error('Error:', error)
        toast.error('Error: ' + error)
        setShowEdit(false)
      }
    )
  }

  const handleOpenFolderClick = () => {
    const { shell } = require('electron');
    shell.openPath(saveFolder);
  }

  const handleRunClick = async () => {

    // Create an object with the input values
    const requestData = {
      path_read: selectedReadFolder,
      path_params: selectedSettingsFile,
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

    // Calculate the progress
    var newData = Math.round((totalFiles / nscans) * 100);
    if (totalFiles === 0) {
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
   * @returns {JSX.Element} A dialog to edit extraction options
   * @description This function is used to render the dialog to edit extraction options.
   */
  const renderEdit = () => {
    if (selectedSettingsFile && showEdit) {
      return (
        <SettingsEditor showEdit={showEdit} setShowEdit={setShowEdit} settings={settings} pathSettings={selectedSettingsFile} onHideBE={setLoadingEdit}/>
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
    <Card className="text-center">
      <Card.Body>
        <Card.Header>
          <h4>Batch Extractor - Radiomics</h4>
          <DocLink 
            linkString={"https://mediml.readthedocs.io/en/latest/tutorials.html#batchextractor"} 
            name={"What is BatchExtractor?"} 
            image={"https://www.svgrepo.com/show/521262/warning-circle.svg"} 
          />
        </Card.Header>

      <Form method="post" encType="multipart/form-data" className="inputFile">

      {/* Check whether to use the workspace or not*/}
      <Row className="form-group-box">
        <Form.Label htmlFor="file">Use current workspace data</Form.Label>
        <p style={{fontSize: "13px", fontStyle: "italic", fontWeight: "normal", margin: "0 0 8px 0"}}>If this is checked, the data available in the workspace will be used instead of local data.</p>
        <Col style={{ width: "150px" }}>
          <InputSwitch
            checked={useWorkspace}
            onChange={(e) => setUseWorkspace(e.value)}
          />
        </Col>
      </Row>

      {/* Ask user if he is analyzing dose metrics*/}
      <Row className="form-group-box">
        <Form.Label htmlFor="file">Analyzing dose maps?</Form.Label>
        <p style={{fontSize: "13px", fontStyle: "italic", fontWeight: "normal", margin: "0 0 8px 0"}}>
          If this is checked, dose metrics will be extracted.
        </p>
        <Col style={{ width: "150px" }}>
          <InputSwitch
            checked={analyzeDoseMaps}
            onChange={(e) => setAnalyzeDoseMaps(e.value)}
          />
        </Col>
      </Row>

      {analyzeDoseMaps && (
        <>
          <Row className="form-group-box">
            <Col md={6}>
              <Form.Label className="pred-doses-csv" htmlFor="file">
                Prescribed doses CSV file
              </Form.Label>
              <p style={{fontSize: "13px", fontStyle: "italic", fontWeight: "normal", margin: "0 0 8px 0"}}>
                Path to the CSV file containing prescribed doses per patient. The file must include a PatientID column.
              </p>
              {useWorkspace ? (
                <Dropdown
                  style={{ maxWidth: "100%", height: "auto", width: "100%" }}
                  filter
                  value={selectedPredDosesCSV}
                  onChange={(e) => setSelectedPredDosesCSV(e.value)}
                  options={listCSVFiles}
                  optionLabel="name"
                  display="chip"
                  placeholder="Select a file"
                />
              ) : (
                <Form.Group controlId="enterPredDosesFile">
                  <Form.Control
                    name="pred_doses_csv"
                    accept='.csv'
                    type="file"
                    onChange={handlePredDosesCSVChange}
                  />
                </Form.Group>
              )}
            </Col>
            <Col md={6}>
              <Form.Label className="presc-dose-column" htmlFor="presc_dose_column">
                Prescribed dose column name
              </Form.Label>
              <p style={{fontSize: "13px", fontStyle: "italic", fontWeight: "normal", margin: "0 0 8px 0"}}>
                Name of the column in the prescribed doses CSV that contains the prescription dose value for each patient.
              </p>
              <Form.Group controlId="prescDoseColumn">
                <Form.Control
                  name="presc_dose_column"
                  type="text"
                  value={prescDoseColumn}
                  placeholder="e.g. PrescriptionDose"
                  onChange={(event) => setPrescDoseColumn(event.target.value)}
                />
              </Form.Group>
            </Col>
          </Row>
  
        </>
      )}

      <Row className="form-group-box">
        {/* UPLOAD DATASET FOLDER */}
        <SelectButton
          value={useDatasetType}
          onChange={(e) => setUseDatasetType(e.value)}
          optionLabel="label"
          options={[
            { label: 'Use NPY', value: "npy" },
            { label: 'Use NIfTI', value: "nifti" },
            { label: 'Use DICOM', value: "dicom" }
          ]}
          style={{ width: '100%', marginBottom: '10px' }}
        />
        <Col>
          <Form.Label className="npy-folder" htmlFor="file">
            {{
              npy: 'NPY dataset folder (MEDscan objects)',
              nifti: 'NIfTI dataset folder',
              dicom: 'DICOM dataset folder'
            }[useDatasetType]}
          </Form.Label>
          <p style={{fontSize: "13px", fontStyle: "italic", fontWeight: "normal", margin: "0 0 8px 0"}}>
            {{
              npy: 'Path to the folder containing the NPY dataset to use for radiomics features extraction',
              nifti: 'Path to the folder containing the NIfTI dataset to use for radiomics features extraction',
              dicom: 'Path to the folder containing the DICOM dataset to use for radiomics features extraction'
            }[useDatasetType]}
          </p>
          {useWorkspace ? (
            <Col>
              <Dropdown
                style={{ maxWidth: "100%", height: "auto", width: "auto" }}
                filter
                value={selectedReadFolder}
                onChange={(e) => setSelectedReadFolder(e.value)}
                options={listWSFolders}
                optionLabel="name"
                display="chip"
                placeholder="Select a folder"
              />
            </Col>
          ) : (
            <Col>
              <Form.Group controlId="enterFile">
                <Form.Control
                  name="path_read"
                  type="file"
                  webkitdirectory="true"
                  directory="true"
                  onChange={handleReadFolderChange}
                />
              </Form.Group>
            </Col>
          )}
        </Col>
      </Row>

        {/* UPLOAD SETTINGS FILE*/}
        <Row className="form-group-box">
          <Form.Label className="settings-file" htmlFor="file">
            Settings File
          </Form.Label>
          <p style={{fontSize: "13px", fontStyle: "italic", fontWeight: "normal", margin: "0 0 8px 0"}}>Path to the extraction settings file</p>
          {useWorkspace ? (
            <Col>
              <Dropdown
                style={{ maxWidth: "100%", height: "auto", width: "auto" }}
                filter
                value={selectedSettingsFile}
                onChange={(e) => setSelectedSettingsFile(e.value)}
                options={listSettingsFiles}
                optionLabel="name"
                display="chip"
                placeholder="Select a file"
              />
            </Col>
             ) : (
            <Col>
              <h6>Load a Local File</h6>
              <Form.Group controlId="enterFile">
                <Form.Control
                  accept='.json'
                  name="path_params"
                  type="file"
                  onChange={handleSettingsFileChange}
                />
              </Form.Group>
            </Col>
            
            )}
            <Col>
            <h6>Edit the selected file</h6>
              <Button
                type="button"
                severity="info"
                label="Edit"
                name="EditSettingsButton"
                onClick={handleEditClick}
                disabled={(!selectedSettingsFile)}
                loading={loadingEdit}
                icon="pi pi-pencil"
                iconPos="left"
                raised
                rounded
              />
            </Col>
        </Row>
      </Form>  

        {/* UPLOAD CSV FILE*/}
        <Row className="form-group-box">
          <Form.Label className="csv-file" htmlFor="file">
            Path to CSV File (optional)
          </Form.Label>
          <p style={{fontSize: "13px", fontStyle: "italic", fontWeight: "normal", margin: "0 0 8px 0"}}>
            Path to the CSV file containing the scans to use for radiomics features extraction with
            their corresponding Regions of Interest. If no file is given, all the scans found in the
            dataset folder are extracted, using the union of all the ROIs of each scan.
          </p>
          {useWorkspace ? (
          <Col>
            <Dropdown
              style={{ maxWidth: "100%", height: "auto", width: "auto" }}
              filter
              showClear
              value={selectedCSVFile}
              onChange={(e) => setSelectedCSVFile(e.value || '')}
              options={listCSVFiles}
              optionLabel="name"
              display="chip"
              placeholder="Select a file (optional)"
            />
          </Col> ) :(
          <Col>
            <Form.Group controlId="enterFile">
              <Form.Control
                name="path_csv"
                accept='.csv'
                type="file"
                ref={csvFileInputRef}
                onChange={handleCSVFileChange}
              />
            </Form.Group>
            {selectedCSVFile && (
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
            )}
          </Col>
          )}
        </Row>

        {/* UPLOAD SAVING FOLDER*/}
        <Row className="form-group-box">
          <Form.Label className="save" htmlFor="file">
            Save folder
          </Form.Label>
          <p style={{fontSize: "13px", fontStyle: "italic", fontWeight: "normal", margin: "0 0 8px 0"}}>Folder where the results of the extraction will be saved</p>
        {useWorkspace ? (
          <Col>
            <Dropdown
              style={{ maxWidth: "100%", height: "auto", width: "auto" }}
              filter
              value={selectedSaveFolder}
              onChange={(e) => setSelectedSaveFolder(e.value)}
              options={listWSFolders}
              optionLabel="name"
              display="chip"
              placeholder="Select a folder"
            />
          </Col> ) :(
          <Col>
            <p style={{fontSize: "13px", fontStyle: "italic", fontWeight: "normal", margin: "0 0 8px 0", color: "#F88379"}}>
              Warning: to select a folder, it must contain at least one file, even if it is empty.
            </p>
            <Form.Group controlId="enterFile">
              <Form.Control
                name="path_save"
                type="file"
                webkitdirectory="true"
                directory="true"
                onChange={handleSaveFolderChange}
              />
            </Form.Group>
          </Col>
          )}
        </Row>

      {/* NUMBER OF BATCH*/}
      <Row className="form-group-box">
        <Col>
        <Form.Group controlId="n_cores" style={{ paddingTop: "10px" }}>
            <Form.Label 
              className="ncores">
                Number of cores to use :
            </Form.Label>
            <p style={{fontSize: "13px", fontStyle: "italic", fontWeight: "normal", margin: "0 0 8px 0"}}>Number of cores to use for the parallel extraction of features</p>
            <Form.Control
              name="n_cores"
              type="number"
              defaultValue={12}
              placeholder={"Default: " + 12}
              onChange={handleNBatchChange}
            />
        </Form.Group>
        </Col>
        <Col style={{display: "flex", flexDirection:"column", justifyContent: "center", alignItems: "center"}}>
          <Form.Label 
            className="skip">
              Skip Existing Extractions :
          </Form.Label>
          <p style={{fontSize: "13px", fontStyle: "italic", fontWeight: "normal", margin: "0 0 8px 0", textAlign: "center"}}>Skip extractions if they are already present in the save folder</p>
          <InputSwitch
            checked={skipExisting}
            onChange={(e) => {
              setSkipExisting(e.value)
              setActiveIndex(!activeIndex)
            }}
          />
        </Col>
      </Row>

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
      <Row className="form-group-box">
        <Col>
            <div className="text-center"> {/* Center-align the button */}
                <Button
                  severity="success"
                  label="RUN"
                  name="ProcessButton"
                  onClick={handleRunClick}
                  disabled={(
                    !selectedReadFolder ||
                    !selectedSaveFolder ||
                    refreshEnabled ||
                    !selectedSettingsFile ||
                    (analyzeDoseMaps && (!selectedPredDosesCSV || !prescDoseColumn.trim()))
                  )}
                  icon="pi pi-play"
                  raised
                  rounded
                />
            </div>
          </Col>
        <Col>
          <Button
            severity="secondary"
            label="Show Results"
            name="ShowResultsButton"
            icon="pi pi-list"
            onClick={handleShowResultsClick}
            raised
            rounded 
          />
        </Col>
        </Row>
      </Card.Body>
    </Card>
  </div>
  </>
  );
}

export default BatchExtractor;
