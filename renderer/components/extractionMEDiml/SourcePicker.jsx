import { Dropdown } from "primereact/dropdown"
import { useId } from "react"
import { Form } from "react-bootstrap"

/**
 * Picks a folder or file either from the workspace or from disk.
 *
 * Replaces the `useWorkspace ? <Dropdown> : <Form.Control type="file">` branch
 * that appeared eight times across DataManager and BatchExtractor, each copy
 * carrying the same inline `{maxWidth, height, width}` object and -- a real
 * defect -- `controlId="enterFile"`, the SAME DOM id at eight sites on one page.
 * The id is generated per instance here.
 *
 * It renders no <form>. Both pages already wrap cards in a <Form>, and a nested
 * form is silently dropped by the HTML parser.
 *
 * It sets no width either: the enclosing ParamGrid track owns that.
 *
 * NOTE ON THE TWO CALLBACKS: `onLocalChange` receives the raw DOM event and is
 * passed straight to the page's existing handler, because the path-derivation
 * logic those handlers contain is Windows-specific and is being consolidated
 * separately -- moving layout and path parsing in one change would make a
 * regression in either hard to bisect.
 *
 * @param {"workspace"|"local"} mode Which input to render.
 * @param {"folder"|"file"} kind Folder picker (webkitdirectory) or file picker.
 * @param {string} accept File-type filter, local + kind="file" only.
 * @param {string} name Form control name, kept for the existing handlers.
 * @param {Array} options Workspace entries, `{name, value}`.
 * @param {string} value Current value (workspace mode).
 * @param {Function} onWorkspaceChange Receives the selected path string.
 * @param {Function} onLocalChange Receives the raw change event.
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
  onWorkspaceChange,
  onLocalChange,
  placeholder = "Select a folder",
  showClear = false,
  inputRef,
  action,
  caption,
  ...rest
}) => {
  const controlId = useId()

  if (mode === "workspace") {
    return (
      <>
        <Dropdown
          filter
          showClear={showClear}
          value={value}
          onChange={(e) => onWorkspaceChange(e.value || "")}
          options={options}
          optionLabel="name"
          display="chip"
          placeholder={placeholder}
          {...rest}
        />
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
          {...(kind === "folder" ? { webkitdirectory: "true", directory: "true" } : {})}
        />
      </Form.Group>
      {action}
    </>
  )
}

export default SourcePicker
