import React, { useEffect, useId, useRef, useState } from "react"

/**
 * In-app documentation: the input data formats MEDiml reads (DICOM, NIfTI,
 * NPY), and how a dataset must be named and organized before any analysis.
 * Opened in a <DocPanel>, usually through the `doc` option of <SectionCard> /
 * <Field>; it has no styles of its own (DocPanel styles the markup).
 *
 * Summarizes https://mediml.readthedocs.io/en/dev/input_data.html. The NPY
 * section, which that page does not cover, follows the names MEDiml's
 * DataManager gives the files it saves. Keep this in step with both.
 */

export const INPUT_DATA_DOC_TITLE = "MEDiml input data formats"

const DICOM_TREE = `dataset_folder
├── STS-McGill-001
│   ├── MRI
│   │   ├── T1
│   │   │   ├── images/*.dcm
│   │   │   └── masks/*.dcm
│   │   └── T2FS
│   │       ├── images/*.dcm
│   │       └── masks/*.dcm
│   └── PET
│       ├── images/*.dcm
│       └── masks/*.dcm
└── STS-McGill-002
    └── CT
        ├── images/*.dcm
        └── masks/*.dcm`

const NIFTI_TREE = `dataset_folder
├── STS-McGill-001__T1(GTV).MRscan.nii.gz
├── STS-McGill-001__T1(GTV_Mass).ROI.nii.gz
├── STS-McGill-002__CT(GTV).CTscan.nii.gz
└── STS-McGill-002__CT(GTV_Mass).ROI.nii.gz`

const DicomSection = () => (
  <>
    <p>
      Each DICOM file holds a header of metadata and, for images, the pixels of one slice. MEDiml identifies scans and regions of
      interest from these header fields:
    </p>
    <dl>
      <dt>
        Patient ID <small>(0010,0020)</small>
      </dt>
      <dd>No underscores. Also fills the PatientID column of the ROI definitions CSV.</dd>
      <dt>
        Series Description <small>(0008,103E)</small>
      </dt>
      <dd>
        The ImagingScanName. Use the same name for the same kind of scan in every patient, e.g. <code>T1</code> for all T1-weighted MRI.
      </dd>
      <dt>
        ROI Name <small>(3006,0026)</small>
      </dt>
      <dd>In the RTstruct. Any name works, but keep them short and distinct; they are what you select ROIs by.</dd>
    </dl>
    <p>
      An RTstruct (or SEG) file is linked to its image through the Series Instance UID <code>(0020,000E)</code> or the Frame of Reference
      UID <code>(0020,0052)</code>, and uses the same Patient ID and Series Description as the image.
    </p>
    <p>
      Organize the folder as <code>PatientID / Modality / ImagingScanName / images, masks</code>, with modality folders named MRI, CT, PET
      or ADC:
    </p>
    <pre>
      <code>{DICOM_TREE}</code>
    </pre>
    <ul>
      <li>
        <code>images</code> holds one DICOM file per slice; <code>masks</code> holds the RTstruct or SEG files.
      </li>
      <li>
        <b>No series description:</b> put the files directly in the modality folder; the ImagingScanName is then the modality (e.g.{" "}
        <code>PET</code>). With several such scans of one modality, give each its own folder (<code>PET</code>, <code>PET-2</code>, ...).
      </li>
      <li>
        <b>Images and masks mixed together:</b> put all the files directly in the scan folder. Other DICOM files, such as RTdose, go there
        too.
      </li>
    </ul>
    <aside>
      <p>
        MEDiml can build this layout for you. The script in the MEDiml repository copies the files into{" "}
        <code>&lt;dataset&gt;_organized</code> (or <code>--path-save</code>) and updates Patient ID and Series Description to match the
        folder names, without modifying the original dataset:
      </p>
      <pre>
        <code>python scripts/organize_dataset.py --path-dataset path/to/dataset</code>
      </pre>
    </aside>
  </>
)

const NiftiSection = () => (
  <>
    <p>
      A NIfTI file holds an image only, so every region of interest is a separate binary mask file. All the files go in one folder, and
      the file names carry the information that DICOM headers would:
    </p>
    <dl>
      <dt>Image</dt>
      <dd>
        <code>PatientID__ImagingScanName(ROIname).Modality.nii.gz</code>
        <br />
        e.g. <code>STS-McGill-001__T1(GTV).MRscan.nii.gz</code>
      </dd>
      <dt>ROI mask</dt>
      <dd>
        <code>PatientID__ImagingScanName(ROIname).ROI.nii.gz</code>
        <br />
        e.g. <code>STS-McGill-001__T1(GTV_Mass).ROI.nii.gz</code>
      </dd>
    </dl>
    <pre>
      <code>{NIFTI_TREE}</code>
    </pre>
    <ul>
      <li>
        Two underscores (<code>__</code>) separate the PatientID from the ImagingScanName, so the PatientID itself must not contain any.
      </li>
      <li>
        The modality tag is one of <code>MRscan</code>, <code>CTscan</code>, <code>PTscan</code> or <code>ADCscan</code>; the literal{" "}
        <code>ROI</code> in its place marks a mask.
      </li>
      <li>A mask is paired with its image by the shared <code>PatientID__ImagingScanName</code> prefix.</li>
      <li>
        Use the <code>.nii.gz</code> extension, as in the examples.
      </li>
    </ul>
  </>
)

const NpySection = () => (
  <>
    <p>
      NPY files are not an imaging format you bring: they are MEDscan objects that the DataManager (<b>Process data</b>) creates from a
      DICOM or NIfTI dataset. Each holds one scan with its ROIs and metadata, ready for pre-checks and extraction, and loads much faster
      than the original files.
    </p>
    <dl>
      <dt>File name</dt>
      <dd>
        <code>PatientID__ImagingScanName.Modality.npy</code>, e.g. <code>STS-McGill-001__T1.MRscan.npy</code>
      </dd>
    </dl>
    <p>Do not rename these files: MEDiml finds scans by their names.</p>
  </>
)

/** One tab per format: its label, its section, and its line of the pre-run checklist. */
const FORMATS = {
  dicom: {
    label: "DICOM",
    Section: DicomSection,
    check: "One folder per patient, then per modality, then per scan."
  },
  nifti: {
    label: "NIfTI",
    Section: NiftiSection,
    check: "Every image has its ROI masks, named with the same PatientID__ImagingScanName."
  },
  npy: {
    label: "NPY",
    Section: NpySection,
    check: "The files come from Process data and keep the names it gave them."
  }
}

/**
 * @param {string[]} formats The formats the page offers, in the order it lists
 *   them; each gets a tab.
 * @param {string} selected The format selected on the page. The panel opens on
 *   its tab and follows it when the page selection changes; the user can still
 *   switch tabs to read about another format.
 */
const InputDataDoc = ({ formats = ["dicom", "nifti", "npy"], selected = "dicom" }) => {
  const tabs = formats.filter((format) => FORMATS[format])
  const initial = tabs.includes(selected) ? selected : tabs[0]
  const [active, setActive] = useState(initial)
  const tabRefs = useRef({})
  const baseId = useId()

  useEffect(() => {
    setActive(initial)
  }, [initial])

  // Arrow keys move between tabs (WAI-ARIA tabs pattern); only the active tab
  // is in the Tab order, so the keyboard reaches the panel content in one press.
  const onKeyDown = (event) => {
    const step = { ArrowRight: 1, ArrowLeft: -1 }[event.key]
    let next
    if (step) next = tabs[(tabs.indexOf(active) + step + tabs.length) % tabs.length]
    else if (event.key === "Home") next = tabs[0]
    else if (event.key === "End") next = tabs[tabs.length - 1]
    if (!next) return
    event.preventDefault()
    setActive(next)
    tabRefs.current[next]?.focus()
  }

  const { Section, check } = FORMATS[active]

  return (
    <>
      <p>
        Check that your dataset follows these conventions before running any analysis: MEDiml finds scans, regions of interest and their
        modality from names, so a dataset that does not follow them fails, or silently skips scans.
      </p>

      <h3>Shared conventions</h3>
      <dl>
        <dt>PatientID</dt>
        <dd>
          Recommended form <code>study-institution-number</code>, e.g. <code>STS-McGill-001</code>. No underscores. The pre-checks filter
          scans by the study and institution parts.
        </dd>
        <dt>ImagingScanName</dt>
        <dd>
          The name of a scan, e.g. <code>T1</code>, <code>T2FS</code> or <code>CT</code>. Keep it identical across patients for the same
          kind of scan.
        </dd>
        <dt>ROI definitions CSV</dt>
        <dd>Lists scans by the same PatientID and ImagingScanName, so the values must match the dataset exactly.</dd>
      </dl>

      <div role="tablist" aria-label="Dataset format" onKeyDown={onKeyDown}>
        {tabs.map((format) => (
          <button
            key={format}
            ref={(el) => (tabRefs.current[format] = el)}
            type="button"
            role="tab"
            id={`${baseId}-tab-${format}`}
            aria-selected={format === active}
            aria-controls={`${baseId}-panel`}
            tabIndex={format === active ? 0 : -1}
            onClick={() => setActive(format)}
          >
            {FORMATS[format].label}
          </button>
        ))}
      </div>

      <div role="tabpanel" id={`${baseId}-panel`} aria-labelledby={`${baseId}-tab-${active}`}>
        <Section />

        <h3>Before you run</h3>
        <ul>
          <li>PatientIDs contain no underscores and follow one pattern across the dataset.</li>
          <li>Each kind of scan has the same ImagingScanName in every patient.</li>
          <li>{check}</li>
          <li>The ROI definitions CSV, if you use one, matches these names exactly.</li>
        </ul>
      </div>
    </>
  )
}

export default InputDataDoc

