import React from "react"

/**
 * In-app documentation: the optional CSV that lists the scans to analyze and
 * the ROI to use for each. Opened in a <DocPanel>, usually through the `doc`
 * option of <SectionCard> / <Field>; it has no styles of its own (DocPanel
 * styles the markup).
 *
 * Summarizes https://mediml.readthedocs.io/en/dev/csv_file.html, checked
 * against the columns BatchExtractor reads. Keep this in step with both.
 * generate_roi_csv.py ships in the MEDiml repository, not in the pip package.
 */

export const ROI_CSV_DOC_TITLE = "Custom list of ROIs to analyze"

const EXAMPLE_CSV = `PatientID,ImagingScanName,ImagingModality,ROIname
STS-McGill-001,T1,MRscan,{GTV_Mass}
STS-McGill-002,CT,CTscan,{GTV_Mass}`

// On one line, so it pastes into any terminal (Windows has no "\" continuation).
const GENERATE_COMMAND = `python scripts/generate_roi_csv.py --dataset-path /path/to/dataset --dicom-or-nifti dicom --output-dir /path/to/output`

const RoiCsvDoc = () => (
  <>
    <p>
      Optional. A CSV file that tells MEDiml which scans to analyze and which
      ROI to use in each. Without it, every scan is analyzed, with all of its
      ROIs merged into one.
    </p>

    <h3>Columns</h3>
    <p>One row per scan. Column names must be spelled exactly as below.</p>
    <dl>
      <dt><code>PatientID</code></dt>
      <dd>As it appears in the dataset folder, e.g. <code>STS-McGill-001</code>.</dd>
      <dt><code>ImagingScanName</code></dt>
      <dd>The scan, e.g. <code>CT</code>, <code>PET</code>, <code>T1</code>.</dd>
      <dt><code>ImagingModality</code></dt>
      <dd><code>CTscan</code>, <code>MRscan</code> or <code>PTscan</code>.</dd>
      <dt><code>ROIname</code></dt>
      <dd>The ROI to analyze, in curly braces, e.g. <code>{"{GTV_Mass}"}</code>.</dd>
    </dl>
    <pre><code>{EXAMPLE_CSV}</code></pre>

    <h3>Combining ROIs</h3>
    <ul>
      <li><code>{"{GTV_Mass}+{GTV_Edema}"}</code> analyzes both regions together.</li>
      <li><code>{"{GTV_Edema}-{GTV_Mass}"}</code> keeps the edema outside the mass.</li>
    </ul>

    <h3>Generate it automatically</h3>
    <p>
      The <code>generate_roi_csv.py</code> script, in the <code>scripts</code>{" "}
      folder of the MEDiml repository, reads the ROI names from your DICOM
      RTstructs or NIfTI masks and writes the CSV for you. It needs Python with{" "}
      <code>pydicom</code>, <code>pandas</code> and <code>tqdm</code>.
    </p>
    <pre><code>{GENERATE_COMMAND}</code></pre>
    <p>
      Use <code>nifti</code> instead of <code>dicom</code> for a NIfTI dataset.
      The script lists the ROIs it found and asks which CSVs to save:
    </p>
    <dl>
      <dt>A. Single ROI</dt>
      <dd>The same ROI for every scan. The usual choice.</dd>
      <dt>B. All combinations</dt>
      <dd>One CSV per ROI selection, to compare models. Only offered with fewer than 10 ROIs.</dd>
      <dt>C. All ROIs combined</dt>
      <dd>Each scan's ROIs joined with <code>+</code>.</dd>
      <dt>D. Subtractions</dt>
      <dd>One CSV per pair, e.g. <code>{"{GTV_Edema}-{GTV_Mass}"}</code>.</dd>
    </dl>
    <p>
      Pick the file you need (e.g. <code>roiNames_ROI.csv</code>) from the
      output folder.
    </p>

    <h3>Before you run</h3>
    <ul>
      <li>ROI names match the names in your contours exactly, including case.</li>
      <li>Every row uses the same ROI definition, so results are comparable.</li>
      <li>No row says <code>UnknownModality</code>; replace it with the real modality.</li>
      <li>Rows whose scan is not in the dataset folder are skipped.</li>
    </ul>
  </>
)

export default RoiCsvDoc
