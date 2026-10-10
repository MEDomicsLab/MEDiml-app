import { ArrowBigLeft, Download, FileDown, FileUp, FolderDown, Import, Play, Save, Square, Trash2 } from "lucide-react"
import { Tooltip } from 'primereact/tooltip'
import { Button } from "react-bootstrap"


/**
 *
 * @param {List} buttonList List of buttons to display
 * @description This component is used to display a list of buttons
 * @example
 * <BtnDiv buttonsList={[{type: 'clear', onClick: () => {}, disabled: true}]}/>
 */
const BtnDiv = ({ buttonsList, op }) => {
  return (
    <>
      {buttonsList.map((button) => {
        return buttonType[button.type](button.onClick, button.disabled, op)
      })}
    </>
  )
}
export default BtnDiv

// This is the list of buttons that can be displayed
// Each button has a type and an onClick function
// You can add more buttons here
const buttonType = {
  clear: (onClear, disabled = false) => {
    return (
      <>
      <Tooltip key="clearTip" target=".clearBtn"/>
      <Button
        className="clearBtn"
        key="clear" 
        data-pr-tooltip="Clear the scene"
        data-pr-position="bottom"
        variant="outline margin-left-10 padding-5" 
        onClick={onClear}
        disabled={disabled}
        >
        <Trash2 size={25} />
      </Button>
      </>
    )
  },
  save: (onSave, disabled = false) => {
    return (
      <>
      <Tooltip key="saveTip" target=".saveBtn"/>
      <Button
        className="saveBtn"
        key="save" 
        data-pr-tooltip="Save the scene"
        data-pr-position="bottom"
        variant="outline margin-left-10 padding-5" 
        onClick={onSave}
        disabled={disabled}
        >
        <Save size={25} />
      </Button>
      </>
    )
  },
  // Exports the scene as a .json file that can be shared with other MEDiml users
  exportScene: (onExportScene, disabled = false) => {
    return (
      <>
      <Tooltip key="exportSceneTip" target=".exportSceneBtn"/>
      <Button
        className="exportSceneBtn"
        key="exportScene"
        data-pr-tooltip="Export the scene as a .json file"
        data-pr-position="bottom"
        variant="outline margin-left-10 padding-5"
        onClick={onExportScene}
        disabled={disabled}
        >
        <FileDown size={25} />
      </Button>
      </>
    )
  },
  // Replaces the scene with one imported from a local .json file
  importScene: (onImportScene, disabled = false) => {
    return (
      <>
      <Tooltip key="importSceneTip" target=".importSceneBtn"/>
      <Button
        className="importSceneBtn"
        key="importScene"
        data-pr-tooltip="Import a scene from a .json file"
        data-pr-position="left"
        variant="outline margin-left-10 padding-5"
        onClick={onImportScene}
        disabled={disabled}
        >
        <FileUp size={25} />
      </Button>
      </>
    )
  },
  download: (onDownload, disabled = false) => {
    return (
      <Button key="download" variant="outline margin-left-10 padding-5" onClick={onDownload} disabled={disabled}>
        <Download style={{ width: "30px", height: "auto" }} />
      </Button>
    )
  },
  load: (onLoad, disabled = false) => {
    return (
      <>
      <Tooltip key="loadTip" target=".loadBtn"/>
      <Button
        className="loadBtn"
        key="load" 
        data-pr-tooltip="Load a scene"
        data-pr-position="bottom"
        variant="outline margin-left-10 padding-5" 
        onClick={onLoad}
        disabled={disabled}
        >
        <Import size={25} />
      </Button>
      </>
    )
  },
  run: (onRun, disabled = false) => {
    return (
      <>
      <Tooltip key="runTip" target=".runBtn"/>
      <Button
        className="runBtn"
        key="run" 
        data-pr-tooltip="Run the workflow"
        data-pr-position="bottom"
        variant="outline margin-left-10 padding-5" 
        onClick={onRun}
        disabled={disabled}
        >
        <Play size={25} />
      </Button>
      </>
    )
  },
  // Replaces the run button while a workflow is running
  stop: (onStop, disabled = false) => {
    return (
      <>
      <Tooltip key="stopTip" target=".stopBtn"/>
      <Button
        className="stopBtn"
        key="stop"
        data-pr-tooltip="Stop the running experiment"
        data-pr-position="bottom"
        variant="outline margin-left-10 padding-5"
        onClick={onStop}
        disabled={disabled}
        >
        <Square size={25} color="red" />
      </Button>
      </>
    )
  },
  back: (onBack, disabled = false) => {
    return (
      <Button key="back" variant="outline margin-left-10 padding-5" onClick={onBack} disabled={disabled}>
        <ArrowBigLeft size={25} />
      </Button>
    )
  },
  export: (onExport, disabled = false, op) => {
    return (
      <>
      <Tooltip key="exportTip" target=".saveBtn"/>
      <Button 
        key="export" 
        className="saveBtn" 
        data-pr-tooltip="Export settings for batch extraction"
        data-pr-position="bottom"
        variant="outline margin-left-10 padding-5" 
        disabled={disabled}
        onClick={(e) =>
          {
            onExport;
            op.current.toggle(e)
          }}>
          <FolderDown size={25} />
      </Button>
      </>
    )
  },
  loadDeafult: (onLoadDeafult) => {
    return (
      <>
      <Tooltip key="loadDeafultTip" target=".loadDeafultBtn"/>
      <Button 
        key="loadDeafult"
        className="loadDeafultBtn"
        data-pr-tooltip="Load default learning workflow"
        data-pr-position="left"
        variant="outline-info uccess margin-left-10 padding-5" 
        onClick={onLoadDeafult}>
          <FolderDown size={25} />
      </Button>
      </>
    )
  },
}
