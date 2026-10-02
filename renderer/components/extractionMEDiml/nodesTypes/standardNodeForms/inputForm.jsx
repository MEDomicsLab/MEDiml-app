import { Button } from "primereact/button"
import { Dropdown } from "primereact/dropdown"
import { useContext, useEffect, useState } from "react"
import { Card, Col, Form, Row } from "react-bootstrap"
import { toast } from "react-toastify"
import { requestBackend } from "../../../../utilities/requests"
import { ErrorRequestContext } from "../../../generalPurpose/errorRequestContext"
import { useMEDDataStore } from "../../../workspace/useMEDData"
import { WorkspaceContext } from "../../../workspace/workspaceContext"
import DocLink from "../../docLink"

/**
 * @param {Object} nodeForm form associated to the discretization node
 * @param {Function} changeNodeForm function to change the node form
 * @param {Function} enableView function to enable the view button of the node
 * @returns {JSX.Element} A InputForm to display in the modal of an input node
 *
 * @description
 * This component is used to display a InputForm.
 */
const InputForm = ({ nodeForm, changeNodeForm, enableView }) => {
  // Hook to keep the path of the selected file before upload
  const [selectedFile, setSelectedFile] = useState("")
  const [selectedDicomFolder, setSelectedDicomFolder] = useState("")
  const [listNpyFiles, setListNpyFiles] = useState([])
  const [listDicomFolders, setListDicomFolders] = useState([])
  const [loading, setLoading] = useState(false)
  const { workspace, port } = useContext(WorkspaceContext)
  const { setError, setShowError } = useContext(ErrorRequestContext)
  const medDataStore = useMEDDataStore() // stable handle - read fresh on demand, not subscribed to
  const pageId = "extractionMEDiml" // pageId is used to identify the page in the backend

  const areListsIdentical = (listA, listB) => {
    return listA.length === listB.length && listA.every((value, index) => value === listB[index]);
  }

  useEffect(() => {
    const globalData = medDataStore.snapshot()
    if (globalData !== undefined) {
      let keys = Object.keys(globalData)
      let npyFiles = []
      let dcmFolders = []
      keys.forEach((key) => {
        if (globalData[key].type === "npy" && globalData[key].path) {
          npyFiles.push({ name: globalData[key].name, value: globalData[key].path })
        } else if (globalData[key].type === "directory" && globalData[key].path) {
          dcmFolders.push({ name: globalData[key].name, value: globalData[key].path })
        }
      })
      const uniqueNpyFiles = Array.from(new Set(npyFiles.map((file) => file.value))).map((value) => {
        return npyFiles.find((file) => file.value === value)
      })
      const uniqueDcmFolders = Array.from(new Set(dcmFolders.map((folder) => folder.value))).map((value) => {
        return dcmFolders.find((folder) => folder.value === value)
      })
      if (!areListsIdentical(uniqueNpyFiles, listNpyFiles)) {
        setListNpyFiles(uniqueNpyFiles)
      }
      if (!areListsIdentical(uniqueDcmFolders, listDicomFolders)) {
        setListDicomFolders(uniqueDcmFolders)
      }
    }
    if (nodeForm.input_path && nodeForm.input_type === "npy") {
      setSelectedFile(nodeForm.input_path)
    } else if (nodeForm.input_path && nodeForm.input_type === "dicom") {
      setSelectedDicomFolder(nodeForm.input_path)
    }
  }, [])

  const handleNPYFileChange = (event) => {
    var fileList = event.target.files
    if (fileList.length > 0) {
      fileList = fileList[0].path
      setSelectedFile(fileList)
      changeNodeForm({
        ...nodeForm,
        target: {name: "input_path", value: fileList}
      })
      changeNodeForm({
        ...nodeForm,
        target: {name: "input_type", value: "npy"}
      })
    }
    else {
      setSelectedFile(event.target.files.path)
      changeNodeForm({
        ...nodeForm,
        target: {name: "input_path", value: event.target.files.path}
      })
      changeNodeForm({
        ...nodeForm,
        target: {name: "input_type", value: "npy"}
      })
    }
  };

  /**
   * @param {String} fileType type of the file to upload (file or folder)
   *
   * @description
   * This function is used to send a POST request to /extraction_MEDiml/upload when the user
   * clicks on the upload button.
   */
  const handleUpload = (fileType) => {
      // TODO : Check if the upload button clicked corresponds to the filetype
      // Check if the filename is not empty
      let formData = null
      if (fileType == "file" && selectedFile) {
        // Create a new form with the path to the file to upload
        formData = { file: selectedFile, type: fileType }
      } else if (fileType == "folder" && selectedDicomFolder) {
        // Create a new form with the path to the folder to upload
        formData = { file: selectedDicomFolder, type: fileType }
      }
      else {
        // Show error message
        toast.error("Please select a file or a folder to upload")
        return
      }

      formData.workspace = workspace.workingDirectory.path

      // POST request to /extraction_MEDiml/upload/ for current node by sending form data of node
      setLoading(true)
      requestBackend(
        port, 
        "/extraction_MEDiml/upload/" + pageId,
        formData, 
        (response) => {
          console.log("response", response)
          setLoading(false)
          if (response.error) {
            // show error message
            toast.error(response.error)
            console.error("error", response.error)

            // check if error has message or not
            if (response.error.message){
              console.error("error message", response.error.message)
              setError(response.error)
            } else {
              console.error("error no message", response.error)
              setError({
                "message": response.error
              })
            }
            setShowError(true)
          } else {
            // The response of the request should be the filename of the uploaded file, and
            // the rois list for the image. Since the nodeForm was already updated with the user
            // we only need to update the rois list
            // Modify the event object
            console.log("response", response)
            changeNodeForm({
              target: { name: "rois", value: response.rois_list }
            })
            changeNodeForm({
              target: { name: "filepath", value: response.name }
            })

            // Enable the view button
            enableView(true)

            // Toast success message
            toast.success("File uploaded successfully")
          }
        },
        (error) => {
          setLoading(false)
          // show error message
          toast.error("An error occurred while uploading the file")
          console.error("error", error)
          setError({"message": error})
          setShowError(true)
        }
      )
    }

  return (
    <div className="inputFile">
      <DocLink
        linkString={"https://mediml.readthedocs.io/en/latest/tutorials.html#medscan-class"}
        name={"What is a MEDscan object?"}
        image={"https://www.svgrepo.com/show/521262/warning-circle.svg"}
      />
      {listNpyFiles && listNpyFiles.length > 0 && (
        <Row className="form-group-box flex-column align-items-start">
          <Form.Label htmlFor="file">MEDscan Object (.npy)</Form.Label>
          <Col className="w-100">
            <Dropdown
              filter
              style={{ maxWidth: "300px" }}
              value={selectedFile}
              onChange={(e) => setSelectedFile(e.value)}
              options={listNpyFiles}
              optionLabel="name"
              className="w-full md:w-14rem margintop8px"
              display="chip"
              placeholder="Select a npy file"
            />
        </Col>
        <Col className="w-100" style={{marginBottom: "10px", marginTop: "10px"}}>
          <Button 
            label="Upload" 
            severity="info" 
            outlined 
            onClick={() => handleUpload("file")} 
            disabled={!selectedFile}
            loading={loading}
          />
        </Col>
      </Row>)}
      <Row className="form-group-box flex-column align-items-start">
        <Form.Label htmlFor="file">MEDscan Object (.npy)</Form.Label>
        <Col className="w-100">
          <Form.Group controlId="enterFile">
            <Form.Control
              name="pathNpyFile"
              type="file"
              onChange={handleNPYFileChange}
            />
          </Form.Group>
        </Col>
        <Col className="w-100" style={{marginBottom: "10px", marginTop: "10px"}}>
          <Button 
            label="Upload" 
            severity="info" 
            outlined 
            onClick={() => handleUpload("file")} 
            disabled={!selectedFile}
            loading={loading}
          />
        </Col>
      </Row>
      <Row className="form-group-box flex-column align-items-start">
        <Form.Label htmlFor="file">DICOM image (folder)</Form.Label>
        <Col className="w-100">
          <Dropdown
              filter
              style={{ maxWidth: "300px" }}
              value={selectedDicomFolder}
              onChange={(e) => {
                setSelectedDicomFolder(e.value)
                changeNodeForm({
                  ...nodeForm,
                  target: {name: "input_path", value: e.value}
                })
                changeNodeForm({
                  ...nodeForm,
                  target: {name: "input_type", value: "dicom"}
                })
              }}
              options={listDicomFolders}
              optionLabel="name"
              className="w-full md:w-14rem margintop8px"
              display="chip"
              placeholder="Select a DICOM folder"
            />
        </Col>
        <Col className="w-100" style={{marginBottom: "10px", marginTop: "10px"}}>
          <Button 
            label="Upload" 
            severity="info" 
            outlined onClick={() => handleUpload("folder")} 
            disabled={!selectedDicomFolder} 
            loading={loading}
          />
        </Col>
      </Row>
      {nodeForm.filepath && nodeForm.filepath !== "" && (
        <Card className="cute-box">
          <Card.Body>
            <Card.Text>
              <strong>Uploaded image:</strong> {nodeForm.filepath.slice(0, -4)}
            </Card.Text>
          </Card.Body>
        </Card>
      )}
    </div>
  )
}

export default InputForm