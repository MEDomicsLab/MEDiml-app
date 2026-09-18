/**
 * Deep links into the MEDiml documentation.
 *
 * Kept in one place so a parameter's help text and the page it points at cannot
 * drift apart, and so a docs restructure is one edit rather than a search across
 * every form. Anchors were taken from the live documentation, not guessed.
 *
 * https://mediml.readthedocs.io/en/latest/index.html
 */
const BASE = "https://mediml.readthedocs.io/en/latest"

export const MEDIML_DOCS = {
  // Data in
  inputData: `${BASE}/input_data.html`,
  inputDataDicom: `${BASE}/input_data.html#dicom`,
  inputDataNifti: `${BASE}/input_data.html#nifti`,
  roiCsv: `${BASE}/csv_file.html`,

  // Configuration file, by section
  configuration: `${BASE}/configurations_file.html`,
  featuresExtraction: `${BASE}/configurations_file.html#features-extraction`,
  generalAnalysisParams: `${BASE}/configurations_file.html#general-analysis-parameters`,
  preChecksParams: `${BASE}/configurations_file.html#pre-checks-parameters`,
  processingParams: `${BASE}/configurations_file.html#processing-parameters`,
  extractionParams: `${BASE}/configurations_file.html#extraction-parameters`,
  filteringParams: `${BASE}/configurations_file.html#filtering-parameters`,

  // Tutorials
  dataManager: `${BASE}/tutorials.html#datamanager`,
  batchExtractor: `${BASE}/tutorials.html#batchextractor`,
  installation: `${BASE}/Installation.html`
}

export default MEDIML_DOCS
