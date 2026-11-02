
/**
 * In-app documentation: what the extraction settings are, which of them change
 * the features most, and how the Batch Extractor handles them. Opened in a
 * <DocPanel>, usually through the `doc` option of <SectionCard> / <Field>; it
 * has no styles of its own (DocPanel styles the markup).
 *
 * Summarizes https://mediml.readthedocs.io/en/dev/configurations_file.html#features-extraction.
 * Keep the defaults quoted here in step with utilities/medimlDefaultSettings.js.
 */

export const EXTRACTION_SETTINGS_DOC_TITLE = "Extraction settings"

const ExtractionSettingsDoc = () => (
  <>
    <p>
      The settings tell MEDiml how to prepare each image before measuring it,
      and which features to compute. They change the feature values, so keep
      them identical for every patient in a study.
    </p>
    <aside>
      <p>
        MEDiml's defaults are loaded and ready to use. Change them only if your
        study protocol calls for it.
      </p>
    </aside>

    <h3>One set of settings, three modalities</h3>
    <p>
      The settings hold a CT, an MR and a PET section. MEDiml applies the
      section that matches each scan's modality, so one file covers a mixed
      dataset. The filter settings are shared by all three.
    </p>

    <h3>The settings that matter most</h3>
    <dl>
      <dt>Voxel size</dt>
      <dd>
        Images are resampled to this spacing (mm) before measuring, so features
        are comparable across scanners. Finer spacing keeps more detail but is
        slower. Texture features are computed once per texture voxel size.
      </dd>
      <dt>Re-segmentation range</dt>
      <dd>
        Only voxels inside this intensity range are kept in the ROI. The CT
        default (-100 to 300 HU) drops dense bone and metal; PET keeps all
        SUV above 0; MR is left open because its intensities have no fixed unit.
      </dd>
      <dt>Discretisation (FBS or FBN)</dt>
      <dd>
        Intensities are grouped into bins before histogram and texture features
        are computed, and texture values depend strongly on this choice. A fixed
        bin size (FBS) keeps bins in physical units, which suits CT (HU) and PET
        (SUV). A fixed bin number (FBN) adapts to each ROI&apos;s range and is
        often used when intensities have no fixed unit, as in MR.
      </dd>
      <dt>Feature families</dt>
      <dd>
        Shape (Morph), intensity (Stats, histograms) and texture (GLCM, GLRLM,
        GLSZM, GLDZM, NGTDM, NGLDM). Turn off families you do not need to speed
        up the extraction.
      </dd>
      <dt>Filter</dt>
      <dd>
        Empty means features come from the original image. Choose mean, LoG,
        Laws, Gabor or wavelet to extract from a filtered image instead; one
        filter per run, and its name is added to the result file names.
      </dd>
    </dl>
    <p>
      Everything else (interpolation method, bounding box, outlier removal,
      dose features) is under Advanced in the editor. The defaults are a sound
      starting point.
    </p>

    <h3>ROI type and label</h3>
    <p>
      These name the saved results, e.g. <code>features(all)</code>. Leave
      them as they are unless your study analyzes several ROI lists.
    </p>

    <h3>Using your own settings</h3>
    <ul>
      <li><b>Edit</b> the current settings, essentials first, one tab per modality.</li>
      <li><b>From file</b> loads a settings JSON from the workspace or your disk.</li>
      <li><b>Paste JSON</b> accepts JSON or a Python dict copied from a notebook.</li>
      <li><b>Save a copy</b> keeps the current settings as a file for later studies.</li>
    </ul>

    <h3>Reproducibility</h3>
    <p>
      Every run saves the exact settings it used as{" "}
      <code>extraction_settings.json</code> in the save folder. Keep it with the
      results and report it in your methods.
    </p>
  </>
)

export default ExtractionSettingsDoc
