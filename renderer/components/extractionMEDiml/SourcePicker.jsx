import { ipcRenderer } from "electron"
import { Dropdown } from "primereact/dropdown"
import { useContext, useId, useMemo } from "react"
import { Button, Form, InputGroup } from "react-bootstrap"
import PathOption, { getPathLocation } from "../primitives/PathOption"
import { WorkspaceContext } from "../workspace/workspaceContext"

/**
 * Picks a folder or file either from the workspace or from disk.
 *
 * @param {"workspace"|"local"} mode Which input to render.
 * @param {"folder"|"file"} kind Folder picker (native dialog) or file picker.
 * @param {string} accept File-type filter, local + kind="file" only.
 * @param {string} name Form control name, kept for the existing handlers.
 * @param {Array} options Workspace entries, `{name, value}`. Each is shown with its location in the
 *   workspace under its name, so entries sharing a name (e.g. two "CT" folders) can be told apart.
 * @param {string} value Current path (workspace mode, and local folders).
 * @param {Function} onPathChange Receives the selected path string: workspace
 *   entries, and local folders.
 * @param {Function} onLocalChange Receives the raw change event of a local file.
 * @param {string} placeholder Dropdown placeholder.
 * @param {boolean} showClear Allow clearing the dropdown (optional values).
 * @param {object} inputRef Ref to the local file input, so a Clear button can
 *   reset it.
 * @param {ReactNode} action Button that belongs to this control (Clear, Edit).
 * @param {ReactNode} caption Extra note, e.g. a local-mode-only warning.
 */
const SourcePicker = ({
  mode,
  kind = "folder",
  accept,
  name,
  options = [],
  value,
  onPathChange,
  onLocalChange,
  placeholder = "Select a folder",
  showClear = false,
  inputRef,
  action,
  caption,
  ...rest
}) => {
  const controlId = useId()
  const { workspace } = useContext(WorkspaceContext)
  const workspacePath = workspace?.workingDirectory?.path

  // The location of each entry, sorted by it so entries sharing a name are listed by where they are
  const optionsWithLocation = useMemo(
    () =>
      options
        .map((option) => ({ ...option, location: getPathLocation(option.value, workspacePath) }))
        .sort((a, b) => a.location.localeCompare(b.location)),
    [options, workspacePath]
  )

  if (mode === "workspace") {
    return (
      <>
        <Dropdown
          filter
          // The filter also matches the location, to find an entry by its folder
          filterBy="name,location"
          showClear={showClear}
          value={value}
          onChange={(e) => onPathChange(e.value || "")}
          options={optionsWithLocation}
          optionLabel="name"
          itemTemplate={PathOption}
          valueTemplate={(option, props) => (option ? PathOption(option) : props.placeholder)}
          placeholder={placeholder}
          {...rest}
        />
        {action}
      </>
    )
  }

  if (kind === "folder") {
    const pickFolder = async () => {
      const { canceled, filePaths } = await ipcRenderer.invoke("select-folder-path")
      if (!canceled && filePaths.length > 0) {
        onPathChange(filePaths[0])
      }
    }

    return (
      <>
        {caption}
        <InputGroup>
          <Button variant="outline-secondary" onClick={pickFolder}>
            Browse...
          </Button>
          <Form.Control
            id={controlId}
            name={name}
            readOnly
            value={value || ""}
            placeholder="No folder selected"
            title={value || ""}
            onClick={pickFolder}
          />
        </InputGroup>
        {action}
      </>
    )
  }

  return (
    <>
      {caption}
      <Form.Group controlId={controlId}>
        <Form.Control
          name={name}
          type="file"
          accept={accept}
          ref={inputRef}
          onChange={onLocalChange}
        />
      </Form.Group>
      {action}
    </>
  )
}

export default SourcePicker
