import { Dropdown } from 'primereact/dropdown';
import { InputNumber } from 'primereact/inputnumber';
import { InputSwitch } from 'primereact/inputswitch';
import { InputText } from 'primereact/inputtext';
import { MultiSelect } from 'primereact/multiselect';
import { useState } from 'react';
import { Form, Row } from "react-bootstrap";
import Node, { updateHasWarning } from "../../flow/node";
import Caption from '../../primitives/Caption';
import { sectionCardClass } from '../../primitives/SectionCard';

// PyCaret classification model library (ID - Name)
const PYCARET_MODELS = [
  { value: 'lr', label: 'Logistic Regression' },
  { value: 'knn', label: 'K Neighbors Classifier' },
  { value: 'nb', label: 'Naive Bayes' },
  { value: 'dt', label: 'Decision Tree Classifier' },
  { value: 'svm', label: 'SVM - Linear Kernel' },
  { value: 'rbfsvm', label: 'SVM - Radial Kernel' },
  { value: 'gpc', label: 'Gaussian Process Classifier' },
  { value: 'mlp', label: 'MLP Classifier' },
  { value: 'ridge', label: 'Ridge Classifier' },
  { value: 'rf', label: 'Random Forest Classifier' },
  { value: 'qda', label: 'Quadratic Discriminant Analysis' },
  { value: 'ada', label: 'Ada Boost Classifier' },
  { value: 'gbc', label: 'Gradient Boosting Classifier' },
  { value: 'lda', label: 'Linear Discriminant Analysis' },
  { value: 'et', label: 'Extra Trees Classifier' },
  { value: 'xgboost', label: 'Extreme Gradient Boosting' },
  { value: 'lightgbm', label: 'Light Gradient Boosting Machine' },
  { value: 'catboost', label: 'CatBoost Classifier' }
].map((model) => ({ ...model, label: `${model.label} (${model.value})` }))

const BEST_MODEL_OPTION = { value: 'best', label: 'Best model (auto-select)' }

// Model names used by older workflows, mapped to their PyCaret model IDs
const LEGACY_MODEL_IDS = { XGBoost: 'xgboost' }

/**
 * @param {object} settings learner settings to migrate in place
 *
 * @description
 * Older workflows nest the learner parameters under the model name (e.g. {model: "XGBoost", XGBoost: {...}}).
 * This moves them next to "model" and maps the model name to its PyCaret ID.
 */
const migrateLearnerSettings = (settings) => {
  if (!settings) return
  const nestedParams = settings[settings.model]
  if (nestedParams && typeof nestedParams === 'object' && !Array.isArray(nestedParams)) {
    Object.assign(settings, nestedParams)
    delete settings[settings.model]
  }
  settings.model = LEGACY_MODEL_IDS[settings.model] ?? settings.model
  settings.bestInclude = settings.bestInclude ?? []
  settings.bestExclude = settings.bestExclude ?? []
  settings.useGPU = settings.useGPU ?? true // default of MEDiml's RadiomicsLearner
}


/**
 * @param {string} id id of the node
 * @param {object} data data of the node
 * @param {string} type type of the node
 * @returns {JSX.Element} A RadiomicsLearner node
 *
 * @description
 * This component is used to display a RadiomicsLearner node.
 * it handles the display of the node and the modal
 */
const RadiomicsLearner = ({ id, data, type }) => {
  const [reload, setReload] = useState(false);
  const sectionStyle = {
    marginBottom: "16px",
    paddingBottom: "12px",
    borderBottom: "1px solid rgba(0, 0, 0, 0.08)"
  }
  const lastSectionStyle = { marginBottom: "16px" }

  const defaultSettings = data.setupParam.possibleSettings.defaultSettings
  migrateLearnerSettings(defaultSettings)
  migrateLearnerSettings(data.internal.settings)

  const updateSetting = (key, value) => {
    defaultSettings[key] = value
    data.internal.settings[key] = value
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
        nodeSpecific={
          <>
            <Row className={sectionCardClass} style={{ maxHeight: "400px", overflowY: "auto", overflowX: "hidden", paddingRight: "8px" }}>
              {/* Model type */}
              <Form.Group controlId="algo" style={sectionStyle}>
                <Form.Label className="algo">Algorithm</Form.Label>
                <Caption>Learning algorithm for model training, or let PyCaret pick the best one.</Caption>
                <Dropdown
                    style={{width: "300px"}}
                    value={defaultSettings.model}
                    options={[BEST_MODEL_OPTION, ...PYCARET_MODELS]}
                    optionLabel="label"
                    optionValue="value"
                    filter
                    placeholder="Select an algorithm"
                    onChange={(event) => updateSetting("model", event.value)}
                />
              </Form.Group>

              {/* Models compared when auto-selecting the best one */}
              {defaultSettings.model === "best" && (
                <>
                  <Form.Group controlId="bestInclude" style={sectionStyle}>
                    <Form.Label className="bestInclude">Models to Compare</Form.Label>
                    <Caption>
                      Only these models are compared. Leave empty to compare all models (Radial SVM, Gaussian Process and MLP are skipped unless selected here, as they are slow).
                    </Caption>
                    <MultiSelect
                        style={{width: "300px"}}
                        value={defaultSettings.bestInclude}
                        options={PYCARET_MODELS}
                        optionLabel="label"
                        optionValue="value"
                        filter
                        display="chip"
                        placeholder="All models"
                        disabled={defaultSettings.bestExclude.length > 0}
                        onChange={(event) => updateSetting("bestInclude", event.value)}
                    />
                  </Form.Group>

                  <Form.Group controlId="bestExclude" style={sectionStyle}>
                    <Form.Label className="bestExclude">Models to Exclude</Form.Label>
                    <Caption>Models skipped during the comparison. Cannot be combined with models to compare.</Caption>
                    <MultiSelect
                        style={{width: "300px"}}
                        value={defaultSettings.bestExclude}
                        options={PYCARET_MODELS}
                        optionLabel="label"
                        optionValue="value"
                        filter
                        display="chip"
                        placeholder="None"
                        disabled={defaultSettings.bestInclude.length > 0}
                        onChange={(event) => updateSetting("bestExclude", event.value)}
                    />
                  </Form.Group>
                </>
              )}

              {/* nFeaturesToSelect */}
              <Form.Group controlId="nFeaturesToSelect" style={sectionStyle}>
              <Form.Label className="nFeaturesToSelect">Variable Importance Threshold</Form.Label>
              <Caption>Higher threshold keeps fewer important variables in the model.</Caption>
                <InputNumber
                    style={{width: "300px"}}
                    buttonLayout="horizontal"
                    value={defaultSettings.nFeaturesToSelect}
                    onValueChange={(event) => updateSetting("nFeaturesToSelect", event.target.value)}
                    mode="decimal"
                    showButtons
                    min={0.01}
                    max={0.99}
                    step={0.01}
                    maxFractionDigits={2}
                    incrementButtonClassName="p-button-info"
                    decrementButtonClassName='p-button-info'
                />
              </Form.Group>

              {/* optimizeThreshold */}
              <Form.Group controlId="optimizeThreshold" style={sectionStyle}>
                <Form.Label className="optimizeThreshold">Model's Optimize Threshold</Form.Label>
                <Caption>
                  Identify the best probability cutoff.
                </Caption>
                <InputSwitch
                  checked={defaultSettings.optimizeThreshold}
                  onChange={(event) => updateSetting("optimizeThreshold", event.target.value)}
                />
              </Form.Group>

              {/* useGPU */}
              <Form.Group controlId="useGPU" style={sectionStyle}>
                <Form.Label className="useGPU">Use GPU</Form.Label>
                <Caption>
                  Train on the GPU when available (falls back to the CPU otherwise).
                </Caption>
                <InputSwitch
                  checked={defaultSettings.useGPU}
                  onChange={(event) => updateSetting("useGPU", event.target.value)}
                />
              </Form.Group>

              {/* optimizationMetric */}
              <Form.Group controlId="optimizationMetric" style={sectionStyle}>
              <Form.Label className="optimizationMetric">Optimization Metric</Form.Label>
              <Caption>
                {defaultSettings.model === "best"
                  ? "Performance metric used to rank the compared models and tune the best one with PyCaret."
                  : "Performance metric used when tuning with PyCaret."}
              </Caption>
              <InputText
                    key="optimizationMetric"
                    style={{width: "300px"}}
                    value={defaultSettings.optimizationMetric}
                    placeholder={defaultSettings.optimizationMetric}
                    onChange={(event) => updateSetting("optimizationMetric", event.target.value)}
                />
              </Form.Group>

              {/* Seed */}
              <Form.Group controlId="seed" style={sectionStyle}>
              <Form.Label className="seed">Random Seed</Form.Label>
              <Caption>Seed value for reproducible random number generation.</Caption>
                <InputNumber
                    style={{width: "300px"}}
                    buttonLayout="horizontal"
                    value={defaultSettings.seed}
                    onValueChange={(event) => updateSetting("seed", event.target.value)}
                    mode="decimal"
                    min={1}
                />
              </Form.Group>

              {/* nameSave */}
              <Form.Group controlId="nameSave" style={lastSectionStyle}>
              <Form.Label className="nameSave">Model's Save Name</Form.Label>
              <Caption>Name for saving the trained model.</Caption>
                <InputText
                    key="nameSaveModel"
                    style={{width: "300px"}}
                    value={defaultSettings.nameSave}
                    placeholder={defaultSettings.nameSave}
                    onChange={(event) => updateSetting("nameSave", event.target.value)}
                />
              </Form.Group>
            </Row>
          </>
        }
      />
    </>
  )
}

export default RadiomicsLearner
