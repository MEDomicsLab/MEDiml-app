import { Button } from "primereact/button"
import { InputSwitch } from "primereact/inputswitch"
import { InputText } from 'primereact/inputtext'
import { MultiSelect } from 'primereact/multiselect'
import { ProgressSpinner } from 'primereact/progressspinner'
import { SelectButton } from 'primereact/selectbutton'
import React, { useContext, useEffect, useRef, useState } from 'react'
import { Alert, Card, Container, Form, Offcanvas, ProgressBar, Row } from 'react-bootstrap'
import Table from 'react-bootstrap/Table'
import { toast } from 'react-toastify'
import Lightbox from "yet-another-react-lightbox"
import Fullscreen from "yet-another-react-lightbox/plugins/fullscreen"
import Zoom from "yet-another-react-lightbox/plugins/zoom"
import "yet-another-react-lightbox/styles.css"
import MEDIML_DOCS from "../../utilities/medimlDocs"
import { requestBackend } from "../../utilities/requests"
import DocLink from "../extractionMEDiml/docLink"
import SourcePicker from "../extractionMEDiml/SourcePicker"
import { ErrorRequestContext } from "../generalPurpose/errorRequestContext"
import Caption from "../primitives/Caption"
import Field from "../primitives/Field"
import ParamGrid from "../primitives/ParamGrid"
import SectionCard from "../primitives/SectionCard"
import Toolbar from "../primitives/Toolbar"
import { DataContext } from "../workspace/dataContext"
import { WorkspaceContext } from "../workspace/workspaceContext"

/**
 * Label, hint and documentation link for the pre-checks dataset folder, by
 * on-disk format. Hoisted to module level because the same three-way lookup
 * used to be written out separately in the workspace and local branches, and
 * the two copies had already drifted apart.
 */
const PRECHECK_DATASET = {
  npy: {
    label: "NPY dataset folder",
    hint: "Folder containing the MEDscan objects (.npy) to check. These are produced by the data processing step above.",
    doc: MEDIML_DOCS.dataManager
  },
  nifti: {
    label: "NIfTI dataset folder",
    hint: "Folder containing the NIfTI files (.nii / .nii.gz) to check.",
    doc: MEDIML_DOCS.inputDataNifti
  },
  dicom: {
    label: "DICOM dataset folder",
    hint: "Folder containing the DICOM files (.dcm) to check.",
    doc: MEDIML_DOCS.inputDataDicom
  }
}

/**
 * @param {Object} nodeForm form associated to the discretization node
 * @param {object} data data of the node
 * @param {Function} changeNodeForm function to change the node form
 * @returns {JSX.Element} A InputForm to display in the modal of an input node
 *
 * @description
 * This component is used to display a InputForm.
 */
const DataManager = ({ pageId, configPath = "" }) => {
  const { port } = useContext(WorkspaceContext)
  const { setError, setShowError } = useContext(ErrorRequestContext)
  const { globalData } = useContext(DataContext) // Get the workspace data
  const [progress, setProgress] = useState(0)
  const [open, setOpen] = useState(false)
  const [refreshEnabled, setRefreshEnabled] = useState(false) // A boolean variable to control refresh
  const [refreshEnabledPreChecks, setRefreshEnabledPreChecks] = useState(false) // A boolean variable to control refresh for preChecks
  const [selectedDcmFolder, setSelectedDcmFolder] = useState('')
  const [listWSFolders, setListWSFolders] = useState([])
  const [listCSVFiles, setListCSVFiles] = useState([])
  const [selectedDatasetFolder, setSelectedDatasetFolder] = useState('')
  const [selectedNiftiFolder, setSelectedNiftiFolder] = useState('')
  const [selectedSaveFolder, setSelectedSaveFolder] = useState('')
  const [selectedSavePreChecksFolder, setSelectedSavePreChecksFolder] = useState('')
  const [selectedNpyFolder, setSelectedNpyFolder] = useState('')
  const [selectedNBatch, setSelectedNBatch] = useState(12)
  const [selectedCSVFile, setSelectedCSVFile] = useState('')
  const [selectedPreChecksOptions, setSelectedPreChecksOptions] = useState(null)
  const [selectedInstitutions, setSelectedInstitutions] = useState([])
  const [selectedStudies, setSelectedStudies] = useState([])
  const [selectedModalities, setSelectedModalities] = useState([])
  const [customWildCard, setCustomWildCard] = useState(null) // A boolean variable to control refresh
  const [summary, setSummary] = useState('') // A string variable to store the summary of the node
  const [showOffCanvas, setShowOffCanvas] = useState(false) // used to display the offcanvas
  const [showPreChecksImages, setShowPreChecksImages] = useState(false) // used to display the offcanvas
  const handleOffCanvasClose = () => setShowOffCanvas(false) // used to close the offcanvas
  const handleOffCanvasShow = () => setShowOffCanvas(true) // used to show the offcanvas
  const [preChecksImages, setPreChecksImages] = useState([]) // used to display the offcanvas
  const [preChecksImagesUrls, setPreChecksImagesUrls] = useState([]) // used to display the offcanvas
  const [useWorkspace, setUseWorkspace] = useState(false) // A boolean variable to control the use of the workspace
  const [useWorkspacePC, setUseWorkspacePC] = useState(false) // A boolean variable to control the use of the workspace for pre-checks
  const [runVoxelChecks, setRunVoxelChecks] = useState(true) // Voxel (dimensions) pre-checks
  const [runWindowChecks, setRunWindowChecks] = useState(true) // Window (intensity) pre-checks
  const [useDatasetType, setUseDatasetType] = useState("npy") // Dataset format for pre-checks: npy, nifti, or dicom
  const [isScanningNpyFolder, setIsScanningNpyFolder] = useState(false)
  const csvFileInputRef = useRef(null) // Used to reset the local ROI CSV file input, since the file is optional

  useEffect(() => {
    updateWSfolder()
    updateCSVFilesList()
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

  const handleDcmFolderChange = (event) => {
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
      setSelectedDcmFolder(fileList)
    }
    else {
      setSelectedDcmFolder(event.target.files.path)
    }
  };


  const handleDatasetFolderChange = (event) => {
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
      setSelectedDatasetFolder(fileList)
    }
    else {
      setSelectedDatasetFolder(event.target.files.path)
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
  }

  const handleChecksSaveFolderChange = (event) => {
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
      setSelectedSavePreChecksFolder(fileList)
    }
    else {
      setSelectedSavePreChecksFolder(event.target.files.path)
    }
  }

  const handleNBatchChange = (event) => {
    const nBatch = event.target.value;
    setSelectedNBatch(parseInt(nBatch));
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

  const fs = require('fs');

  /**
   * @param {string} path Folder path chosen from the workspace.
   *
   * Takes a path string rather than a PrimeReact event, so the workspace and
   * local branches can share one <SourcePicker>.
   *
   * It also sets selectedDatasetFolder, which it previously did not. That was a
   * bug: handlePreChecksRunClick guards on selectedDatasetFolder and sends it as
   * `pathData`, but in workspace mode only selectedNpyFolder was ever written --
   * so choosing a folder from the workspace and pressing RUN aborted with
   * "Please select a dataset folder". The local branch set it correctly, which
   * is why this only ever failed in workspace mode.
   */
  const handleNpyFolderChange = (path) => {
    setSelectedNpyFolder(path)
    setSelectedDatasetFolder(path)

    // Clear previous pre-checks options
    setSelectedPreChecksOptions({
      studies: [],
      institutions: [],
      modalities: []
    });
    setSelectedStudies([]);
    setSelectedInstitutions([]);
    setSelectedModalities([]);

    processNpyFiles(path) // Search for new Pre-checks options
  };

  const processNpyFiles = async (path) => {
    const spinnerTimeout = setTimeout(() => setIsScanningNpyFolder(true), 250); // Progress Spinner

    try {
      const dir = await fs.promises.opendir(path);

      const studies = new Set();
      const institutions = new Set();
      const modalities = new Set();
      
      const BATCH_SIZE = 500;
      let processedCount = 0;
      let hasNewUniqueData = false;
      
      // Helper function to format the values
      const formatOptions = (set) => Array.from(set).map(value => ({ label: value }));

      for await (const dirent of dir) {
          if (!dirent.isFile()) continue; 

          const parsed = parseNpyFileName(dirent.name);
          if (parsed) {
            const { study, institution, modality } = parsed;
            
            if (!studies.has(study)) {
              studies.add(study);
              hasNewUniqueData = true;
            }
            if (!institutions.has(institution)) {
              institutions.add(institution);
              hasNewUniqueData = true;
            }
            if (modality && !modalities.has(modality)) {
              modalities.add(modality);
              hasNewUniqueData = true;
            }
          }

          processedCount++;

          if (processedCount % BATCH_SIZE === 0) {
            if (hasNewUniqueData) { // Update States with new data
              setSelectedPreChecksOptions({
                studies: formatOptions(studies),
                institutions: formatOptions(institutions),
                modalities: formatOptions(modalities)
              })
              
              hasNewUniqueData = false; 
            }
            
            // Pause this async function to yield the main thread and
            // let user interactions process before resuming the loop.
            await new Promise(resolve => setTimeout(resolve, 0));
          }
        }
        
        // Final flush
        if (hasNewUniqueData) {
          setSelectedPreChecksOptions({
            studies: formatOptions(studies),
            institutions: formatOptions(institutions),
            modalities: formatOptions(modalities)
          })
        }
    } catch (error) {
      console.error("Failed to process NPY files:", error);
    } finally {
      clearTimeout(spinnerTimeout);
      setIsScanningNpyFolder(false);
    }
  }

  const parseNpyFileName = (filename) => {
    if (!filename.endsWith('.npy')) return null

    const parts = filename.split('.')

    const prefix = parts[0].split('-')
    if (prefix.length < 3) return null; // Ensure study and institution are present
    const study = prefix[0];
    const institution = prefix[1];

    let modality = null;
    if (parts.length === 3) {
      modality = parts[1];
    }

    if (!study || !institution) return null; // Sanity Check
    return {study, institution, modality}
  }

  function countFoldersInPath(path) {
    try {
      let folderCount = 0;
  
      const files = fs.readdirSync(path);
  
      for (const file of files) {
        const fullPath = `${path}/${file}`;
        const isDirectory = fs.statSync(fullPath).isDirectory();
  
        if (isDirectory) {
          if (fullPath.split('/').at(-1).split('-').length <= 1) {
            folderCount++; // Increment the count for the immediate subfolder
          }
  
          // Recursively count subfolders within this subfolder
          folderCount += countFoldersInPath(fullPath);
        }
      }
  
      return folderCount;
    } catch (error) {
      console.error('Error counting subfolders:', error);
      return 0; // Return 0 in case of an error
    }
  }

  /**
   * Count the number of .npy files in a folder.
   * @param {string} folderPath - The path of the folder to search for .npy files.
   * @returns {number} - The number of .npy files found.
   */
  function countNpyFilesInFolder(folderPath) {
    try {
      let npyFiles = 0;
      const files = fs.readdirSync(folderPath);
      for (const file of files) {
        if (file.split('.').pop() === 'npy') {
          npyFiles++;
        }
      }
      return npyFiles;
    } catch (error) {
      console.error('Error counting .npy files:', error);
      return 0;
    }
  }


  /**
   * @returns {JSX.Element} A tree menu or a warning message
   * @param {Object} JsonData - The data to display in the tree menu
   * @description This function is used to render the tree menu of the extraction node.
  */
  const getFinalWildCards = () => {
    let finalWildCards = new Array();
    if (selectedStudies === null && selectedInstitutions === null && selectedModalities === null) {
      toast.error('Please select at least a study, an institution or a modality');
      return;
    }
    else {
      let studies = selectedStudies;
      let institutions = selectedInstitutions;
      let modalities = selectedModalities;
      
      if (studies === null || studies.length === 0) {
        studies = [{label: ''}];
      }
      if (institutions === null || institutions.length === 0) {
        institutions = [{label: ''}];
      }
      if (modalities === null || modalities.length === 0) {
        modalities = [{label: ''}];
      }

      for (let i = 0; i < studies.length; i++) {
        for (let j = 0; j < institutions.length; j++) {
          for (let k = 0; k < modalities.length; k++) {
            if (institutions[j].label === '' && modalities[k].label === '') {
              finalWildCards.push(studies[i].label + '*');
            }
            else if (studies[i].label === '' && modalities[k].label === '') {
              finalWildCards.push('*' + institutions[j].label + '*');
            }
            else if (studies[i].label === '' && institutions[j].label === '') {
              finalWildCards.push('*' + modalities[k].label + '*');
            }
            else if (studies[i].label === '') {
              finalWildCards.push('*' + institutions[j].label + '*' + modalities[k].label + '*');
            }
            else if (institutions[j].label === '') {
              finalWildCards.push(studies[i].label + '*' + '*' + modalities[k].label + '*');
            }
            else if (modalities[k].label === '') {
              finalWildCards.push(studies[i].label + '*' + institutions[j].label + '*');
            }
            else{
              finalWildCards.push(studies[i].label + '-' + institutions[j].label + '*' + modalities[k].label + '*');
            }
          }
        }
      }
    }
    return finalWildCards;
  }

  /**
   * @returns {JSX.Element} A tree menu or a warning message
   * @param {Object} JsonData - The data to display in the tree menu
   * @description This function is used to render the tree menu of the extraction node.
  */
  const updateWildCards = (JsonData) => {
    // Initialization
    let studies = new Set();
    let institutions = new Set();
    let modalities = new Set();

    try {
      JsonData.map((value, key) => {
        if (value.study) studies.add(value.study);
        if (value.institution) institutions.add(value.institution);
        if (value.scan_type) modalities.add(value.scan_type);
      })
    } 
    catch (error) {
      console.error('Error parsing JsonData to update studies, institutions, and modalities', error);
    }

    // Helper function to format values
    const formatOptions = (set) => Array.from(set).map(value => ({ label: value }));

    setSelectedPreChecksOptions({
      studies: formatOptions(studies),
      institutions: formatOptions(institutions),
      modalities: formatOptions(modalities)
    });
  }

  /**
   * @description Handles the click on the process button of the DICOM or NIfTI data.
  */
  const handleProcessClick = () => {
    // Create an object with the input values
    let requestData = {
      pathDicoms: selectedDcmFolder,
      pathNiftis: selectedNiftiFolder,
      pathSave: selectedSaveFolder,
      nBatch: parseInt(selectedNBatch),
    }

    // Simulate page refresh
    setRefreshEnabled(true)
    setProgress(0)

    // Make a POST request to the backend API
    requestBackend(
      port, 
      '/extraction_MEDiml/run_all/dm',
      requestData, 
      (response) => {
        console.log("response", response)
        setRefreshEnabled(false)
        if (response.error) {   
          if (response.error.message) {
            toast.error(response.error.message)
          } else {
            toast.error(response.error)
          }
          setProgress(0)
          setError(response.error)
          console.error("error", response.error)
          setShowError(true)

        } else {
          // Handle the response from the backend if needed
          console.log('Response from backend:', response)
          setProgress(100)

          // Update summary
          setSummary(response);

          // Update wildcards
          updateWildCards(response);

          // Update npy folder
          setSelectedNpyFolder(selectedSaveFolder);

          toast.success('Data processed!')
        }
      },
      (error) => {
        toast.error("Error processing data : ", error)
        // Update progress
        setRefreshEnabled(false)
        setProgress(0)
      }
    )
  };

  /**
   * @description Handles the click on the run button for the pre-checks
  */
  const handlePreChecksRunClick = () => {

    // Get the final wildcards
    let finalwildcard = null;
    if (!customWildCard) {
      finalwildcard = getFinalWildCards();
    } else {
      finalwildcard = customWildCard;
    }

    //Check if dataset folder is defined
    if (!selectedDatasetFolder) {
      toast.error('Please select a dataset folder');
      return;
    }

    if (!runVoxelChecks && !runWindowChecks) {
      toast.error('Please enable at least one check type (voxel or window).');
      return;
    }

    // refresh
    setRefreshEnabledPreChecks(true);
    
    // Create an object with the input values
    let requestData = {
      pathData: selectedDatasetFolder,
      pathSave: selectedSavePreChecksFolder,
      pathCSV: selectedCSVFile,
      wildcards_dimensions: finalwildcard,
      wildcards_window: finalwildcard,
      nBatch: parseInt(selectedNBatch),
      dimensions_only: runVoxelChecks && !runWindowChecks,
      intensity_only: !runVoxelChecks && runWindowChecks,
      use_niftis: useDatasetType === "nifti",
      use_dicoms: useDatasetType === "dicom",
    };
    console.log("requestData: ", requestData);
    
    // Make a POST request to the backend API
    requestBackend(
      port, 
      '/extraction_MEDiml/run_all/prechecks', 
      requestData, (response) => {
        console.log("response", response)
        if (response.error) {
          // Handle errors if the request fails
          console.log("Error on response pre checks")
          setRefreshEnabledPreChecks(false)
          toast.error('Error: ' + response.error)
        } else {
          // Handle the response from the backend if needed
          console.log('Response from backend:', response);
          toast.success('Pre-checks done!')
          // refresh
          setRefreshEnabledPreChecks(false);
          // set images
          let imagesPreCheck = new Array();
          response["url_list"].map((value, key) => (imagesPreCheck.push({itemImageSrc: value, alt: response["list_titles"][key]})));
          setPreChecksImages(imagesPreCheck);
        }
      })
  };

  // Function to fetch and update data (your front-end function)
  const fetchData = () => {
    // Call your front-end function to fetch data
    var npyFiles = countNpyFilesInFolder(selectedSaveFolder);

    // Simulate counting files
    var totalFiles = 0;
    if (selectedDcmFolder != '') {
      totalFiles = countFoldersInPath(selectedDcmFolder); // Replace with the actual total number of files
    } else if (!selectedNiftiFolder) {
      totalFiles = countFoldersInPath(selectedNiftiFolder); // Replace with the actual total number of files
    }

    // Calculate the progress
    const newData = Math.round((npyFiles / totalFiles) * 100);
    
    // Update the component's state with the new data
    setProgress(newData);

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
  }, [refreshEnabled]); // The empty dependency array ensures this effect runs only once when the component mounts

  useEffect(() => {
    if (!refreshEnabledPreChecks ) {
      setRefreshEnabledPreChecks(false);
    };
  }, [refreshEnabledPreChecks]); // The empty dependency array ensures this effect runs only once when the component mounts

  useEffect(() => {
    const fetchImages = async () => {
      const imagePromises = preChecksImages.map((filePath, modelName) => {
        if (filePath.itemImageSrc) {
          return new Promise((resolve) => {
            const nativeImage = require("electron").nativeImage
            const image = nativeImage.createFromPath(filePath.itemImageSrc)
            const dataUrl = image.resize({ width: 2000 }).toDataURL()
            const thumbnail = image.resize({ width: 100 }).toDataURL() // Create a thumbnail with a width of 100px
            resolve({
              itemImageSrc: dataUrl,
              thumbnailImageSrc: thumbnail,
              alt: filePath.alt,
            })
          })
        }
      })
      const results = await Promise.all(imagePromises)
      setPreChecksImagesUrls(results)
    }
    
    preChecksImages.length > 0 && fetchImages() // Call but don't try to assign to variable
  }, [preChecksImages])

  /**
   * @returns {JSX.Element} A tree menu or a warning message
   * @param {Object} JsonData - The data to display in the tree menu
   * @description This function is used to render the tree menu of the extraction node.
  */
  function JsonDataDisplay(JsonData){
    const DisplayData = [JsonData].map(
        info=>{
            return(
              info.map((infos, index)=>{
                return(
                <tr key={index}>
                    <td>{infos.study}</td>
                    <td>{infos.institution}</td>
                    <td>{infos.scan_type}</td>
                    <td>{infos.roi_type}</td>
                    <td>{infos.count}</td>
                </tr>
                )
              }
              )
            )
        }
    )
 
    return(
      <div className="tree-menu-container">
        <Table striped hover size="sm">
          <thead>
              <tr>
              <th>Study</th>
              <th>Insitution</th>
              <th>Scan type</th>
              <th>ROI type</th>
              <th>Count</th>
              </tr>
          </thead>
          <tbody> 
              {DisplayData}
          </tbody>
        </Table>
      </div>
    )
 }

  /**
   * @returns {JSX.Element} A tree menu or a warning message
   *
   * @description
   * This function is used to render the tree menu of the extraction node.
   */
  const renderTree = () => {
    // Check if data.internal.settings.results is available
    if (summary) {
      let summaryTable = null
      try{
        summaryTable = JsonDataDisplay(summary)
      } catch (error) {
        console.error('Error displaying summary:', error)
        summaryTable = <Alert variant="danger" className="warning-message">
          <b>No summary available</b>
        </Alert>
      }
      return summaryTable
    } else {
      // Show the warning message if data.internal.settings.results is undefined or empty
      return (
        <Alert variant="danger" className="warning-message">
          <b>No summary available</b>
        </Alert>
      )
    }
  }

  return (
    <>
    <div>
    <Card>
      <Card.Body>
        <Card.Header>
            <h4>Data Manager - Process data</h4>
            <DocLink
              linkString={"https://mediml.readthedocs.io/en/latest/tutorials.html#datamanager"}
              name={"What is DataManager?"}
              image={"https://www.svgrepo.com/show/521262/warning-circle.svg"}
            />
        </Card.Header>
      <Form className="inputFile">
      {/* Check if workspace is gonna be used or not */}
      <SectionCard
        row
        align="center"
        title="Use workspace data"
        hint="Read the input data from the current workspace instead of picking folders from disk. Workspace folders are the ones listed in the explorer on the left."
      >
        <InputSwitch
          checked={useWorkspace}
          onChange={(e) => setUseWorkspace(e.value)}
        />
      </SectionCard>

      {/* UPLOAD DICOM DATASET FOLDER*/}
        <SectionCard
          row
          title="DICOM dataset folder"
          hint="Folder holding the DICOM study you want to convert into MEDscan objects. MEDiml expects the standard layout, one folder per patient and one sub-folder per imaging scan."
          docHref={MEDIML_DOCS.inputDataDicom}
        >
          <SourcePicker
            mode={useWorkspace ? "workspace" : "local"}
            kind="folder"
            name="pathDicoms"
            options={listWSFolders}
            value={selectedDcmFolder}
            onWorkspaceChange={setSelectedDcmFolder}
            onLocalChange={handleDcmFolderChange}
          />
        </SectionCard>

        {/* UPLOAD NIfTI DATASET FOLDER*/}
        <SectionCard
          row
          title="NIfTI dataset folder"
          hint="Folder holding the NIfTI files to convert. File names must follow the MEDiml convention, PatientID__ImagingScanName(ROIname).Modality.nii.gz, so scans and their masks can be paired."
          docHref={MEDIML_DOCS.inputDataNifti}
        >
          <SourcePicker
            mode={useWorkspace ? "workspace" : "local"}
            kind="folder"
            name="pathNiftis"
            options={listWSFolders}
            value={selectedNiftiFolder}
            onWorkspaceChange={setSelectedNiftiFolder}
            onLocalChange={handleDatasetFolderChange}
          />
        </SectionCard>

        {/* SAVE FOLDER */}
        <SectionCard
          row
          title="Save folder"
          hint="Where the processed MEDscan objects (.npy) are written."
        >
          <SourcePicker
            mode={useWorkspace ? "workspace" : "local"}
            kind="folder"
            name="pathSave"
            options={listWSFolders}
            value={selectedSaveFolder}
            onWorkspaceChange={setSelectedSaveFolder}
            onLocalChange={handleSaveFolderChange}
            placeholder="Select a folder"
          />
        </SectionCard>

        {/* NUMBER OF BATCH*/}
        <SectionCard
          row
          align="center"
          title="Cores"
          hint="Number of CPU cores used for the parallel conversion."
        >
          <Form.Control
            name="nBatch"
            type="number"
            defaultValue={12}
            placeholder={"Default: " + 12}
            onChange={handleNBatchChange}
          />
        </SectionCard>
      </Form>

      {/* PROCESS BUTTON*/}
      <Toolbar>
        <Button
          severity="success"
          label="Process"
          name="ProcessButton"
          onClick={handleProcessClick}
          disabled={(!selectedDcmFolder || !selectedSaveFolder || refreshEnabled) && (!selectedNiftiFolder || !selectedSaveFolder)}
          icon="pi pi-wrench"
          raised
          rounded
          loading={refreshEnabled}
        />
        <Button
          severity="secondary"
          label="Show Summary"
          name="ShowSummaryButton"
          onClick={handleOffCanvasShow}
          icon="pi pi-list"
          raised
          rounded
        />
      </Toolbar>

        {/* PROGRESS BAR*/}
        {(refreshEnabled || progress === 100 || progress !== 0) && (
        <React.Fragment>
          <br />
          <br />
          <br />
          <br />
        </React.Fragment>
        )}
        <Row className="text-center">
          {(progress === 0) && (refreshEnabled) &&(
            <div className="progress-bar-requests">
                <ProgressBar animated striped variant="danger" now={100} label="Reading data and associating mask objects to imaging volumes"/>
            </div>)}
          {progress !== 0 && progress !== 100 &&(<div className="progress-bar-requests">
                <label>Processing</label>
                <ProgressBar animated striped variant="info" now={progress} label={`${progress}%`} />
            </div>)}
          {progress === 100 &&(<div className="progress-bar-requests">
              <label>Done!</label>
              <ProgressBar animated striped variant="success" now={progress} label={`${progress}%`} />
          </div>)}
        </Row>
      </Card.Body>
    </Card>
  
    {/* offcanvas of the node (panel coming from right when a node is clicked )*/}
    <Container>
      <Offcanvas
        show={showOffCanvas}
        onHide={handleOffCanvasClose}
        placement="end"
        scroll
        backdrop
      >
        <Offcanvas.Header closeButton>
          <Offcanvas.Title>Data processing summary</Offcanvas.Title>
        </Offcanvas.Header>
        <Offcanvas.Body>{renderTree()}</Offcanvas.Body>
      </Offcanvas>
    </Container>

    {/* RADIOMICS PRE-CHECKS*/}
    <Card>
      <Card.Body>
        <Card.Header>
            <h4>Data Manager - Radiomics Pre-checks</h4>
            <DocLink 
              linkString={"https://medomicslab.gitbook.io/MEDiml-app-docs/radiomics/data-processing/radiomics-pre-checks"} 
              name={"What are Radiomics Pre-Checks?"} 
              image={"https://www.svgrepo.com/show/521262/warning-circle.svg"} 
            />
        </Card.Header>

        {/* Check if workspace is gonna be used or not*/}
        <SectionCard
          row
          align="center"
          title="Use workspace data"
          hint="Read the dataset and the ROI CSV from the current workspace instead of picking them from disk."
        >
          <InputSwitch
            checked={useWorkspacePC}
            onChange={(e) => setUseWorkspacePC(e.value)}
          />
        </SectionCard>

        {/* This selector had no label at all. */}
        <SectionCard
          row
          align="center"
          title="Dataset format"
          hint="Which on-disk format the scans to check are in. NPY means MEDscan objects produced by the data processing step above."
          docHref={MEDIML_DOCS.inputData}
        >
          <SelectButton
            value={useDatasetType}
            onChange={(e) => setUseDatasetType(e.value)}
            optionLabel="label"
            options={[
              { label: 'NPY', value: "npy" },
              { label: 'NIfTI', value: "nifti" },
              { label: 'DICOM', value: "dicom" }
            ]}
          />
        </SectionCard>

        {/* UPLOAD CSV FILE*/}
        <SectionCard
          row
          title="ROI definitions"
          badge="optional"
          hint="CSV file listing the scans to check and their associated ROIs (Region of Interest). Without it, every scan matching the pre-checks options below is analyzed, using the union of all the ROIs of each scan."
          docHref={MEDIML_DOCS.roiCsv}
        >
          <SourcePicker
            mode={useWorkspacePC ? "workspace" : "local"}
            kind="file"
            accept=".csv"
            name="pathCSV"
            options={listCSVFiles}
            value={selectedCSVFile}
            onWorkspaceChange={setSelectedCSVFile}
            onLocalChange={handleCSVFileChange}
            inputRef={csvFileInputRef}
            showClear
            placeholder="Union of all ROIs"
            action={
              selectedCSVFile && !useWorkspacePC ? (
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

        {/* DATASET FOLDER*/}
        <SectionCard
          row
          title={PRECHECK_DATASET[useDatasetType].label}
          hint={PRECHECK_DATASET[useDatasetType].hint}
          docHref={PRECHECK_DATASET[useDatasetType].doc}
        >
          <SourcePicker
            mode={useWorkspacePC ? "workspace" : "local"}
            kind="folder"
            name="pathNpy"
            options={listWSFolders}
            value={selectedNpyFolder}
            onWorkspaceChange={handleNpyFolderChange}
            onLocalChange={handleDatasetFolderChange}
          />
        </SectionCard>

        {/* UPLOAD SAVING FOLDER*/}
        <SectionCard
          row
          title="Save results to"
          hint="Folder where the pre-checks plots and JSON summaries are written."
        >
          <SourcePicker
            mode={useWorkspacePC ? "workspace" : "local"}
            kind="folder"
            name="pathSave"
            options={listWSFolders}
            value={selectedSavePreChecksFolder}
            onWorkspaceChange={setSelectedSavePreChecksFolder}
            onLocalChange={handleChecksSaveFolderChange}
          />
        </SectionCard>

      
          <SectionCard
            row
            title="Pre-checks options"
            hint="Which scans to check, selected by study, institution and modality. If none are chosen, give a custom wildcard instead (for example STS*CECT*.npy)."
            docHref={MEDIML_DOCS.preChecksParams}
            headerEnd={
              isScanningNpyFolder ? (
                <ProgressSpinner
                  style={{ width: "1rem", height: "1rem", margin: 0 }}
                  strokeWidth="6"
                  animationDuration=".5s"
                  aria-label="Scanning the dataset folder"
                />
              ) : null
            }
          >
            <MultiSelect
              value={selectedStudies}
              onChange={(e) => setSelectedStudies(e.value)}
              options={selectedPreChecksOptions === null ? [] : selectedPreChecksOptions.studies}
              optionLabel="label"
              display="chip"
              placeholder="Select studies"
              aria-label="Studies"
            />
            <MultiSelect
              value={selectedInstitutions}
              onChange={(e) => setSelectedInstitutions(e.value)}
              options={selectedPreChecksOptions === null ? [] : selectedPreChecksOptions.institutions}
              optionLabel="label"
              display="chip"
              placeholder="Select institutions"
              aria-label="Institutions"
            />
            <MultiSelect
              value={selectedModalities}
              onChange={(e) => setSelectedModalities(e.value)}
              options={selectedPreChecksOptions === null ? [] : selectedPreChecksOptions.modalities}
              optionLabel="label"
              display="chip"
              placeholder="Select Modalities"
              aria-label="Modalities"
            />
            <InputText
              placeholder="Custom wildcard"
              onChange={(e) => setCustomWildCard(e.target.value)}
              aria-label="Custom wildcard"
            />
          </SectionCard>

          <SectionCard
            row
            title="Check types"
            hint="Which pre-checks to run. Voxel checks report the dimension ranges in the dataset; window checks report the intensity ranges. Both are on by default."
          >
            <Field inline label="Voxel checks (dimensions)">
              <InputSwitch
                checked={runVoxelChecks}
                onChange={(e) => setRunVoxelChecks(e.value)}
              />
            </Field>
            <Field inline label="Window checks (intensity)">
              <InputSwitch
                checked={runWindowChecks}
                onChange={(e) => setRunWindowChecks(e.value)}
              />
            </Field>
            {!runWindowChecks && !runVoxelChecks && (
              <ParamGrid.Full>
                <Caption warn>
                  <b>Warning:</b> No checks selected. Please enable at least one check type (voxel or window).
                </Caption>
              </ParamGrid.Full>
            )}
          </SectionCard>

      {/* RUN PRE-CHECKS BUTTON*/}
      <Toolbar>
        <Button
          severity="success"
          label="RUN"
          name="RunButton"
          onClick={handlePreChecksRunClick}
          disabled={
            refreshEnabledPreChecks ||
            (selectedModalities.length === 0 && selectedInstitutions.length === 0 && selectedStudies.length === 0 && !customWildCard) ||
            (!runVoxelChecks && !runWindowChecks)}
          icon="pi pi-play"
          raised
          rounded
          loading={refreshEnabledPreChecks}
        />
        <Button
          severity="secondary"
          label="Show results"
          name="ShowResultsButton"
          onClick={() => {
            setShowPreChecksImages(true)
            setOpen(true)
          }}
          icon="pi pi-images"
          raised
          rounded
        />
      </Toolbar>
      </Card.Body>
    </Card>
    
    {/*PreChecks images dialog*/}
    {(preChecksImagesUrls.length !== 0 && open) &&
      (
        <>
        <Lightbox
            open={open}
            plugins={[Zoom, Fullscreen]}
            close={() => setOpen(false)}
            slides={preChecksImagesUrls.map((image) => ({
              src: image.itemImageSrc,
              alt: image.alt,
              thumbnail: image.thumbnailImageSrc, // Use the thumbnail for the gallery view
            }))}
          />
        </>
      )
    }

  </div>
  </>
  );
}

export default DataManager;
