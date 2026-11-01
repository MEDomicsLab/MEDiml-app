/**
 * Built-in MEDiml extraction settings, used by the Batch Extractor when the
 * user has not loaded or pasted their own.
 *
 * Based on MEDiml's reference settings file, made generic:
 * - no `pre_radiomics_checks` (extraction never reads it);
 * - no `n_batch`: MEDiml lets the file's value override the page's "Cores"
 *   field, so the page writes it into the run snapshot instead;
 * - MEDiml's own default ROI names (BatchExtractor DEFAULT_ROI_TYPE*);
 * - an open MR re-segmentation range, since MR intensities have no fixed unit.
 *
 * The object is frozen. Use getDefaultExtractionSettings() for an editable copy.
 */

const EXTRACT_ALL = {
  Morph: true,
  LocalIntensity: true,
  Stats: true,
  IntensityHistogram: true,
  IntensityVolumeHistogram: true,
  GLCM: true,
  GLRLM: true,
  GLSZM: true,
  GLDZM: true,
  NGTDM: true,
  NGLDM: true,
  Dose: false
}

const DOSE_VX_THRESHOLDS = [2, 4, 8, 10, 12, 15, 20, 25, 30]

const DEFAULTS = {
  categorize_features: true,
  roi_type_labels: ["ROI"],
  roi_types: ["all"],
  imParamMR: {
    box_string: "box10",
    interp: {
      scale_non_text: [2, 2, 3],
      scale_text: [[2, 2, 3]],
      vol_interp: "linear",
      gl_round: 1,
      roi_interp: "linear",
      roi_pv: 0.5
    },
    reSeg: { range: ["-inf", "inf"], outliers: "" },
    discretisation: {
      IH: { type: "FBS", val: 25 },
      IVH: {},
      texture: { type: ["FBS"], val: [[25]] }
    },
    glcm: { dist_correction: "Chebyshev", merge_method: "vol_merge" },
    glrlm: { dist_correction: false, merge_method: "vol_merge" },
    ngtdm: { dist_correction: false },
    extract: { ...EXTRACT_ALL },
    dose_vx_thresholds: [...DOSE_VX_THRESHOLDS],
    dose_mask_extension: 0,
    filter_type: "",
    intensity_type: ""
  },
  imParamCT: {
    box_string: "box10",
    interp: {
      scale_non_text: [2, 2, 2],
      scale_text: [[2, 2, 2]],
      vol_interp: "linear",
      gl_round: 1,
      roi_interp: "linear",
      roi_pv: 0.5
    },
    reSeg: { range: [-100, 300], outliers: "" },
    discretisation: {
      IH: { type: "FBS", val: 25 },
      IVH: { type: "FBS", val: 2.5 },
      texture: { type: ["FBS"], val: [[25]] }
    },
    glcm: { dist_correction: false, merge_method: "vol_merge" },
    glrlm: { dist_correction: false, merge_method: "vol_merge" },
    ngtdm: { dist_correction: false },
    extract: { ...EXTRACT_ALL },
    dose_vx_thresholds: [...DOSE_VX_THRESHOLDS],
    dose_mask_extension: 0,
    filter_type: "",
    intensity_type: ""
  },
  imParamPET: {
    box_string: "box10",
    compute_suv_map: true,
    interp: {
      scale_non_text: [4, 4, 4],
      scale_text: [[3, 3, 3], [4, 4, 4]],
      vol_interp: "linear",
      gl_round: [],
      roi_interp: "linear",
      roi_pv: 0.5
    },
    reSeg: { range: [0, "inf"], outliers: "" },
    discretisation: {
      IH: { type: "FBN", val: 64 },
      IVH: { type: "FBS", val: 0.1 },
      texture: { type: ["FBS", "FBSequal"], val: [[0.5, 1], [0.5, 1]] }
    },
    glcm: { dist_correction: "Chebyshev", merge_method: "vol_merge" },
    glrlm: { dist_correction: false, merge_method: "vol_merge" },
    ngtdm: { dist_correction: false },
    extract: { ...EXTRACT_ALL },
    dose_vx_thresholds: [...DOSE_VX_THRESHOLDS],
    dose_mask_extension: 0,
    filter_type: "",
    intensity_type: ""
  },
  imParamFilter: {
    mean: { ndims: 3, size: 5, padding: "symmetric", orthogonal_rot: false, name_save: "" },
    log: { ndims: 3, sigma: 1.5, orthogonal_rot: false, padding: "symmetric", name_save: "" },
    laws: {
      config: ["L5", "E5", "E5"],
      energy_distance: 7,
      rot_invariance: true,
      orthogonal_rot: false,
      energy_image: true,
      padding: "symmetric",
      name_save: ""
    },
    gabor: {
      sigma: 5,
      lambda: 2,
      gamma: 1.5,
      theta: "Pi/8",
      rot_invariance: true,
      orthogonal_rot: true,
      padding: "symmetric",
      name_save: ""
    },
    wavelet: {
      ndims: 3,
      basis_function: "db3",
      subband: "LLH",
      level: 1,
      rot_invariance: true,
      padding: "symmetric",
      name_save: "Wavelet_db3_LLH"
    },
    textural: {
      family: "glcm",
      discretization: { type: "FBS", bn: null, bw: 1, adapted: false },
      size: 3,
      local: false,
      name_save: "glcm_global_fbs_1"
    }
  }
}

const deepFreeze = (value) => {
  if (value && typeof value === "object") {
    Object.values(value).forEach(deepFreeze)
    Object.freeze(value)
  }
  return value
}

export const DEFAULT_EXTRACTION_SETTINGS = deepFreeze(DEFAULTS)

/** @returns {Object} An editable deep copy of the built-in settings. */
export const getDefaultExtractionSettings = () => structuredClone(DEFAULT_EXTRACTION_SETTINGS)

/** Settings key, display name and MEDiml scan type of each modality block. */
export const MODALITY_BLOCKS = [
  { key: "imParamCT", label: "CT" },
  { key: "imParamMR", label: "MR" },
  { key: "imParamPET", label: "PET" }
]

// Keys MEDscan reads from a modality block without a fallback (MEDscan.init_params).
const REQUIRED_MODALITY_KEYS = ["interp", "reSeg", "discretisation"]

/** @returns {boolean} true when the two JSON-like values hold the same data. */
export const sameSettings = (a, b) => JSON.stringify(a) === JSON.stringify(b)

/**
 * Parses text as JSON, falling back to a Python dict literal (True / False /
 * None, single quotes, trailing commas), which is what users often copy from a
 * notebook.
 * @param {string} text - The pasted text
 * @returns {Object} The parsed value
 * @throws {SyntaxError} With the strict JSON error when both attempts fail
 */
const parseSettingsText = (text) => {
  try {
    return JSON.parse(text)
  } catch (jsonError) {
    let converted = text
      .replace(/\bTrue\b/g, "true")
      .replace(/\bFalse\b/g, "false")
      .replace(/\bNone\b/g, "null")
      .replace(/,(\s*[}\]])/g, "$1")
    // Only swap quotes when the text uses no double quotes at all, so an
    // apostrophe inside a JSON string is never touched.
    if (!converted.includes('"')) {
      converted = converted.replace(/'/g, '"')
    }
    try {
      return JSON.parse(converted)
    } catch {
      throw jsonError
    }
  }
}

/**
 * Checks extraction settings before they are used, so mistakes surface here
 * rather than halfway through an extraction.
 * @param {string|Object} input - Pasted or file text, or an already parsed object
 * @returns {{settings: Object|null, errors: string[], warnings: string[]}}
 *   `settings` is a normalized copy, or null when there are errors.
 */
export const normalizeExtractionSettings = (input) => {
  const errors = []
  const warnings = []
  let parsed = input

  if (typeof input === "string") {
    if (!input.trim()) {
      return { settings: null, errors: ["The settings are empty."], warnings }
    }
    try {
      parsed = parseSettingsText(input)
    } catch (error) {
      return { settings: null, errors: [`Not valid JSON: ${error.message}`], warnings }
    }
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { settings: null, errors: ["The settings must be a JSON object ({ ... })."], warnings }
  }

  const settings = structuredClone(parsed)
  const present = MODALITY_BLOCKS.filter(({ key }) => settings[key] && typeof settings[key] === "object")

  if (present.length === 0) {
    errors.push("No modality settings found: add at least one of imParamCT, imParamMR or imParamPET.")
  }
  present.forEach(({ key }) => {
    const missing = REQUIRED_MODALITY_KEYS.filter((k) => !(k in settings[key]))
    if (missing.length > 0) {
      errors.push(`${key} is missing ${missing.join(", ")}.`)
    }
  })
  if (present.length > 0) {
    MODALITY_BLOCKS.filter((block) => !present.includes(block)).forEach(({ key, label }) => {
      warnings.push(`No ${label} settings (${key}): ${label} scans in the dataset will fail.`)
    })
  }

  const roiTypes = settings.roi_types ?? [...DEFAULT_EXTRACTION_SETTINGS.roi_types]
  const roiLabels = settings.roi_type_labels ?? [...DEFAULT_EXTRACTION_SETTINGS.roi_type_labels]
  if (!Array.isArray(roiTypes) || !Array.isArray(roiLabels)) {
    errors.push("roi_types and roi_type_labels must be lists, e.g. [\"all\"].")
  } else {
    if (roiTypes.length !== roiLabels.length) {
      errors.push(`roi_types has ${roiTypes.length} entries but roi_type_labels has ${roiLabels.length}; they must match.`)
    }
    if (roiLabels.some((label) => /[()]/.test(String(label)))) {
      errors.push("ROI type labels must not contain parentheses.")
    }
    settings.roi_types = roiTypes
    settings.roi_type_labels = roiLabels
  }

  // MEDscan reads imParamFilter even when no filter is applied.
  if (!settings.imParamFilter || typeof settings.imParamFilter !== "object") {
    settings.imParamFilter = structuredClone(DEFAULT_EXTRACTION_SETTINGS.imParamFilter)
  }

  return { settings: errors.length > 0 ? null : settings, errors, warnings }
}
