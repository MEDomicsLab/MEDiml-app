import React from "react"

/**
 * In-app documentation: radiation dose maps, dosiomics, and the dose features
 * MEDiml extracts. Opened in a <DocPanel>, usually through the `doc` option of
 * <SectionCard> / <Field>; it has no styles of its own (DocPanel styles the
 * markup), so it can be reused from any page that touches dose features.
 *
 * Feature definitions follow MEDiml.biomarkers.dosiomics.extract_all. Keep this
 * list in step with it when MEDiml adds or renames a feature.
 */

export const DOSIOMICS_DOC_TITLE = "Dose maps and dosiomics"

/** One sentence per feature, in the order extract_all reports them. */
const DOSE_FEATURES = [
  {
    name: "Fdos_D2",
    unit: "Gy",
    text: "Near-maximum dose: the dose exceeded in only the hottest 2% of the ROI (98th percentile)."
  },
  {
    name: "Fdos_D98",
    unit: "Gy",
    text: "Near-minimum dose: the dose that 98% of the ROI receives or exceeds (2nd percentile)."
  },
  {
    name: "Fdos_D95",
    unit: "Gy",
    text: "The dose that 95% of the ROI receives or exceeds, the usual check that a target got its intended dose."
  },
  {
    name: "Fdos_PIV",
    unit: "cc",
    text: "Prescription isodose volume: how much of the dose map, inside or outside the ROI, receives at least the prescription dose."
  },
  {
    name: "Fdos_PIV_half",
    unit: "cc",
    text: "How much of the dose map receives at least half the prescription dose, which describes how far intermediate dose spreads."
  },
  {
    name: "Fdos_TV_PIV",
    unit: "cc",
    text: "Volume of the ROI (target volume) receiving at least the prescription dose."
  },
  {
    name: "Fdos_Coverage",
    unit: "%",
    text: "Percentage of the ROI receiving at least the prescription dose (TV_PIV / TV); 100% means the whole target is covered."
  },
  {
    name: "Fdos_Selectivity",
    unit: "ratio",
    text: "Fraction of the prescription isodose volume lying inside the ROI (TV_PIV / PIV); 1 means no surrounding tissue receives the full dose."
  },
  {
    name: "Fdos_CI",
    unit: "ratio",
    text: "Paddick conformity index, TV_PIV² / (TV × PIV), combining coverage and selectivity; 1 means the prescription dose fits the target exactly."
  },
  {
    name: "Fdos_GI",
    unit: "ratio",
    text: "Gradient index, PIV_half / PIV: how quickly dose falls off around the target, where lower means a steeper fall-off."
  },
  {
    name: "Fdos_HI_method_ICRU-83",
    unit: "ratio",
    text: "Heterogeneity index (D2 − D98) / D50: how uneven the dose is within the ROI, where 0 means perfectly uniform."
  },
  {
    name: "Fdos_HI_method_RTOG",
    unit: "ratio",
    text: "Maximum dose in the ROI divided by the prescription dose; values above 1 indicate hot spots."
  }
]

const DosiomicsDoc = () => (
  <>
    <h3>What is a radiation dose map?</h3>
    <p>
      Before radiotherapy, the treatment planning system calculates how much radiation every point of the patient will absorb. The result
      is a 3D image, the dose map (a DICOM <code>RTDOSE</code> file), in which each voxel holds an absorbed dose in gray (Gy) rather than a
      tissue intensity. Because it is aligned with the planning CT, the same regions of interest, such as the tumour or an organ at risk,
      can be outlined on it.
    </p>

    <h3>What is dosiomics?</h3>
    <p>
      Dosiomics applies the radiomics idea to dose maps. Radiomics describes what the tissue looks like; dosiomics describes how the
      radiation was delivered to an ROI: how much dose, how evenly it was spread, and how closely it was shaped around the target. These
      features are typically used, often alongside radiomics, to model treatment outcome and side effects.
    </p>

    <h3>When to turn this on</h3>
    <p>Only when the scans you are extracting from are dose maps and you want dose features in your results. Two things are needed:</p>
    <aside>
      <ol>
        <li>
          <b>Dose Features</b> enabled in the extraction settings file (Extraction settings → Edit). The dose Vx thresholds and the dose
          mask extension are also set there.
        </li>
        <li>
          A <b>prescribed doses CSV</b> with a <code>PatientID</code> column matching your scans and a column giving each patient's
          prescription dose in Gy, the dose the physician intended the target to receive.
        </li>
      </ol>
    </aside>
    <p>
      Without a prescription dose, only D2, D98, D95 and the ICRU-83 heterogeneity index can be computed; the other features are left
      empty.
    </p>

    <h3>Terms used below</h3>
    <dl>
      <dt>TV (target volume)</dt>
      <dd>The volume of the ROI.</dd>
      <dt>PIV (prescription isodose volume)</dt>
      <dd>Everything in the dose map that receives at least the prescription dose.</dd>
      <dt>Dx</dt>
      <dd>The dose that x% of the ROI receives or exceeds. D50 is the median dose.</dd>
    </dl>

    <h3>Features MEDiml extracts</h3>
    <dl>
      {DOSE_FEATURES.map(({ name, unit, text }) => (
        <React.Fragment key={name}>
          <dt>
            <code>{name}</code>
            <small>{unit}</small>
          </dt>
          <dd>{text}</dd>
        </React.Fragment>
      ))}
      <dt>
        <code>Fdos_Vx_cc</code>, <code>Fdos_Vx_p</code>
        <small>cc, %</small>
      </dt>
      <dd>
        Volume of the ROI receiving at least x Gy, in cc and as a percentage, with one pair per Vx threshold in the settings file (2, 4,
        8, 10, 12, 15, 20, 25 and 30 Gy by default).
      </dd>
    </dl>
  </>
)

export default DosiomicsDoc
