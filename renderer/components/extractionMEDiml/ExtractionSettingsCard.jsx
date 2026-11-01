import { ipcRenderer } from "electron"
import { Button } from "primereact/button"
import { InputTextarea } from "primereact/inputtextarea"
import { SelectButton } from "primereact/selectbutton"
import React, { useRef, useState } from "react"
import { toast } from "react-toastify"
import MEDIML_DOCS from "../../utilities/medimlDocs"
import {
  getDefaultExtractionSettings,
  normalizeExtractionSettings,
  sameSettings
} from "../../utilities/medimlDefaultSettings"
import ExtractionSettingsDoc, { EXTRACTION_SETTINGS_DOC_TITLE } from "../docs/ExtractionSettingsDoc"
import Caption from "../primitives/Caption"
import ParamGrid from "../primitives/ParamGrid"
import SectionCard from "../primitives/SectionCard"
import { MEDDataObject } from "../workspace/NewMedDataObject"
import styles from "./ExtractionSettingsCard.module.css"
import SourcePicker from "./SourcePicker"

const SOURCE_OPTIONS = [
  { label: "Defaults", value: "default" },
  { label: "From file", value: "file" },
  { label: "Paste JSON", value: "pasted" }
]

/** @returns {Object} A settings source holding the MEDiml defaults */
export const defaultSettingsSource = () => ({ kind: "default", name: "", original: getDefaultExtractionSettings() })

/**
 * The Batch Extractor's extraction settings: MEDiml's defaults, a JSON file or
 * pasted JSON, all validated the same way before use. The page owns the
 * settings, since the editor and RUN need them; this card only fills them.
 *
 * @param {Object} settings - The settings in use
 * @param {{kind: string, name: string, original: Object}} source - Where they
 *   came from; `original` is the unedited copy, for "edited" and Reset
 * @param {Function} onChange - Receives (settings, source)
 * @param {Function} onEdit - Opens the settings editor
 * @param {boolean} useWorkspace - Pick files from the workspace instead of disk
 * @param {Array} workspaceFiles - Workspace JSON files, `{name, value}`
 */
const ExtractionSettingsCard = ({ settings, source, onChange, onEdit, useWorkspace, workspaceFiles }) => {
  const [mode, setMode] = useState(source.kind)
  const [filePath, setFilePath] = useState("")
  const [pasteText, setPasteText] = useState("")
  const [errors, setErrors] = useState([])
  const [warnings, setWarnings] = useState([])
  const fileInputRef = useRef(null)

  const edited = !sameSettings(settings, source.original)

  /**
   * Validates text or an object, then makes it the settings in use.
   * @param {string|Object} input - The settings to use
   * @param {Object} nextSource - kind and name of the new source
   * @returns {boolean} Whether the settings were accepted
   */
  const applySettings = (input, nextSource) => {
    const result = normalizeExtractionSettings(input)
    setErrors(result.errors)
    setWarnings(result.warnings)
    if (!result.settings) {
      return false
    }
    onChange(result.settings, { ...nextSource, original: structuredClone(result.settings) })
    return true
  }

  const handleModeChange = (value) => {
    if (!value) {
      return // the active option was clicked again
    }
    setMode(value)
    setErrors([])
    setWarnings([])
    if (value === "default" && source.kind !== "default") {
      onChange(getDefaultExtractionSettings(), defaultSettingsSource())
    }
  }

  const loadFile = (path) => {
    if (!path) {
      return
    }
    setFilePath(path)
    let text
    try {
      text = require("fs").readFileSync(path, "utf8")
    } catch (error) {
      setErrors([`Could not read the file: ${error.message}`])
      setWarnings([])
      return
    }
    applySettings(text, { kind: "file", name: require("path").basename(path) })
  }

  const handlePaste = () => {
    if (applySettings(pasteText, { kind: "pasted", name: "" })) {
      toast.success("Pasted settings are now in use")
    }
  }

  const handleSaveCopy = async () => {
    const { canceled, filePath: target } = await ipcRenderer.invoke("select-save-path", {
      title: "Save extraction settings",
      defaultPath: "extraction_settings.json",
      filters: [{ name: "JSON", extensions: ["json"] }]
    })
    if (canceled || !target) {
      return
    }
    try {
      await require("fs").promises.writeFile(target, JSON.stringify(settings, null, 4))
    } catch (error) {
      toast.error(`Could not save the settings: ${error.message}`)
      return
    }
    MEDDataObject.updateWorkspaceDataObject()
    setMode("file")
    setFilePath(target)
    onChange(settings, { kind: "file", name: require("path").basename(target), original: structuredClone(settings) })
    toast.success("Settings saved")
  }

  const sourceLabel = {
    default: "MEDiml defaults",
    file: `the file ${source.name}`,
    pasted: "pasted settings"
  }[source.kind]

  return (
    <SectionCard
      row
      title="Extraction settings"
      doc={{ title: EXTRACTION_SETTINGS_DOC_TITLE, content: <ExtractionSettingsDoc /> }}
      docHref={MEDIML_DOCS.featuresExtractionDev}
    >
      <ParamGrid.Full>
        <SelectButton
          value={mode}
          onChange={(e) => handleModeChange(e.value)}
          optionLabel="label"
          options={SOURCE_OPTIONS}
          aria-label="Settings source"
        />
      </ParamGrid.Full>

      {mode === "file" && (
        <ParamGrid.Full>
          <SourcePicker
            mode={useWorkspace ? "workspace" : "local"}
            kind="file"
            accept=".json"
            name="path_params"
            options={workspaceFiles}
            value={filePath}
            onPathChange={loadFile}
            onLocalChange={(event) => loadFile(event.target.files[0]?.path)}
            inputRef={fileInputRef}
            placeholder="Select a settings file"
          />
        </ParamGrid.Full>
      )}

      {mode === "pasted" && (
        <ParamGrid.Full>
          <InputTextarea
            className={styles.paste}
            rows={8}
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            placeholder='{ "imParamCT": { ... }, "imParamMR": { ... }, ... }'
            aria-label="Settings JSON"
          />
          <div className={styles.actions}>
            <Button
              type="button"
              label="Use these settings"
              icon="pi pi-check"
              severity="secondary"
              onClick={handlePaste}
              disabled={!pasteText.trim()}
              outlined
            />
          </div>
        </ParamGrid.Full>
      )}

      {(errors.length > 0 || warnings.length > 0) && (
        <ParamGrid.Full>
          <ul className={styles.messages} aria-live="polite">
            {errors.map((message) => (
              <li key={message}><Caption warn below><b>Error:</b> {message}</Caption></li>
            ))}
            {warnings.map((message) => (
              <li key={message}><Caption warn below><b>Note:</b> {message}</Caption></li>
            ))}
          </ul>
        </ParamGrid.Full>
      )}

      <ParamGrid.Full>
        <Caption below>
          Using {sourceLabel}{edited ? ", edited" : ""}.
        </Caption>
        <div className={styles.actions}>
          <Button
            type="button"
            label="Edit"
            name="EditSettingsButton"
            icon="pi pi-pencil"
            severity="info"
            onClick={onEdit}
            raised
            rounded
          />
          <Button
            type="button"
            label="Save a copy"
            icon="pi pi-save"
            severity="secondary"
            onClick={handleSaveCopy}
            text
          />
          {edited && (
            <Button
              type="button"
              label="Undo edits"
              icon="pi pi-undo"
              severity="secondary"
              onClick={() => onChange(structuredClone(source.original), source)}
              text
            />
          )}
        </div>
      </ParamGrid.Full>
    </SectionCard>
  )
}

export default ExtractionSettingsCard
