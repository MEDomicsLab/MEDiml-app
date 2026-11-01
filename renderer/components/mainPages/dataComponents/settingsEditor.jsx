import { ExternalLink } from 'lucide-react';
import { Button } from 'primereact/button';
import { Dropdown } from 'primereact/dropdown';
import { InputNumber } from 'primereact/inputnumber';
import { InputSwitch } from 'primereact/inputswitch';
import { InputText } from 'primereact/inputtext';
import { TabPanel, TabView } from 'primereact/tabview';
import { useEffect, useState } from 'react';
import { DEFAULT_EXTRACTION_SETTINGS, sameSettings } from '../../../utilities/medimlDefaultSettings';
import MEDIML_DOCS from '../../../utilities/medimlDocs';
import Caption from '../../primitives/Caption';
import Disclosure from '../../primitives/Disclosure';
import Field from '../../primitives/Field';
import hintStyles from '../../primitives/Hint.module.css';
import openDocs from '../../primitives/openDocs';
import SectionCard from '../../primitives/SectionCard';
import SidePanel from '../../primitives/SidePanel';
import styles from './settingsEditor.module.css';

/*
 * Extraction settings editor, in a side panel.
 *
 * One visual rule everywhere: each parameter is a <Param> -- label, a short
 * muted description of what it changes, and the control in a fixed-width
 * column -- inside a <SectionCard>. No tooltips: the explanation is always
 * on screen, which is what a first-time user needs.
 *
 * The editor works on its own copy of the settings and hands it back on Apply;
 * Cancel drops it.
 */

// Editor tabs, in the order they were always shown.
const MODALITY_TABS = [
    { key: "imParamMR", header: "MR", label: "MR" },
    { key: "imParamCT", header: "CT", label: "CT" },
    { key: "imParamPET", header: "PET", label: "PET" },
];

const FEATURE_FAMILIES = [
    { key: "Morph", label: "Morphology", help: "Shape and size of the ROI." },
    { key: "LocalIntensity", label: "Local intensity", help: "Intensity peaks in and around the ROI." },
    { key: "Stats", label: "Intensity statistics", help: "Mean, variance, skewness and other first-order statistics." },
    { key: "IntensityHistogram", label: "Intensity histogram", help: "Statistics of the discretised intensity histogram." },
    { key: "IntensityVolumeHistogram", label: "Intensity-volume histogram", help: "Volume fraction of the ROI above each intensity." },
    { key: "GLCM", label: "GLCM", help: "Co-occurrence: how often pairs of intensities sit side by side." },
    { key: "GLRLM", label: "GLRLM", help: "Run length: lines of voxels with the same intensity." },
    { key: "GLSZM", label: "GLSZM", help: "Size zone: connected zones with the same intensity." },
    { key: "GLDZM", label: "GLDZM", help: "Distance zone: zones by their distance to the ROI edge." },
    { key: "NGTDM", label: "NGTDM", help: "Neighbourhood difference: contrast with surrounding voxels." },
    { key: "NGLDM", label: "NGLDM", help: "Neighbourhood dependence: neighbours of similar intensity." },
    { key: "Dose", label: "Dose", help: "Dosimetric features from dose maps; needs prescribed doses." },
];

const options = (...values) => values.map((value) => ({ label: String(value), value }));

const DISCRETISATION_TYPES = options("FBS", "FBN", "FBSequal", "FBNequal");
const IVH_TYPES = [{ label: "None", value: "none" }, ...options("FBS", "FBN")];
const FILTER_TYPES = [{ label: "None (original image)", value: "" }, ...options("mean", "log", "laws", "gabor", "wavelet")];
const INTENSITY_TYPES = [{ label: "Not set", value: "" }, ...options("arbitrary", "definite", "filtered")];
const VOL_INTERP = options("linear", "spline", "cubic");
const ROI_INTERP = options("nearest", "linear", "cubic");
const DIMENSIONS = options(2, 3);
const PADDINGS = options("constant", "edge", "linear_ramp", "maximum", "mean", "median", "minimum", "reflect", "symmetric", "wrap", "empty");
const LAWS_KERNELS = options("L3", "L5", "E3", "E5", "S3", "S5", "W5", "R5");
const SUBBANDS = options("L", "H");
const DEFAULT_DOSE_VX_THRESHOLDS = [2, 4, 8, 10, 12, 15, 20, 25, 30];

// Settings under "Advanced", as paths into a modality block. Counted against
// the built-in defaults so a collapsed change stays visible.
const ADVANCED_PATHS = [
    ["box_string"],
    ["compute_suv_map"],
    ["interp", "vol_interp"],
    ["interp", "roi_interp"],
    ["interp", "roi_pv"],
    ["interp", "gl_round"],
    ["discretisation", "IVH"],
    ["dose_mask_extension"],
    ["dose_vx_thresholds"],
];

const getIn = (obj, path) => path.reduce((value, key) => (value == null ? value : value[key]), obj);

const setIn = (obj, path, value) => {
    let node = obj;
    path.slice(0, -1).forEach((key) => {
        if (node[key] == null || typeof node[key] !== "object") node[key] = {};
        node = node[key];
    });
    node[path[path.length - 1]] = value;
};

/** @returns {number} how many Advanced settings of a modality differ from the defaults */
const countAdvancedChanges = (block, defaults) =>
    defaults ? ADVANCED_PATHS.filter((path) => !sameSettings(getIn(block, path), getIn(defaults, path))).length : 0;

// MEDiml takes "-inf" or "inf" as an open lower bound, "inf" as an open upper one.
const isInfinite = (value) => value === "inf" || value === "-inf";

// Older settings files hold booleans and numbers as strings ("true", "3").
const asBool = (value) => value === true || value === "true";
const asNumber = (value) => (value === "" || value == null || Number.isNaN(Number(value)) ? null : Number(value));

/* ---- Building blocks ---------------------------------------------------- */

/** One parameter: label and description on the left, control on the right. */
const Param = ({ label, help, children }) => (
    <Field inline label={label} hint={help} showHint>
        <div className={styles.control}>{children}</div>
    </Field>
);

/** A titled group of parameters. Every group in the panel is one of these. */
const Group = ({ title, children }) => (
    <SectionCard title={title}>
        <div className={styles.rows}>{children}</div>
    </SectionCard>
);

const Num = ({ value, onChange, label, ...rest }) => (
    <InputNumber
        value={asNumber(value)}
        onValueChange={(event) => onChange(event.value)}
        mode="decimal"
        maxFractionDigits={5}
        useGrouping={false}
        aria-label={label}
        {...rest}
    />
);

const Select = ({ value, onChange, label, items, ...rest }) => (
    <Dropdown value={value} options={items} onChange={(event) => onChange(event.value)} aria-label={label} {...rest} />
);

const Switch = ({ value, onChange, label }) => (
    <InputSwitch checked={asBool(value)} onChange={(event) => onChange(event.value)} aria-label={label} />
);

const Text = ({ value, onChange, label, ...rest }) => (
    <InputText value={value ?? ""} onChange={(event) => onChange(event.target.value)} aria-label={label} {...rest} />
);

/** Comma-separated numbers, committed when the field loses focus. */
const NumberList = ({ value, onChange, label, placeholder }) => {
    const toText = (list) => (Array.isArray(list) ? list.join(", ") : "");
    const [text, setText] = useState(toText(value));
    const [invalid, setInvalid] = useState(false);
    const valueKey = JSON.stringify(value);

    useEffect(() => {
        setText(toText(value));
        setInvalid(false);
    }, [valueKey]);

    const commit = () => {
        const parts = text.split(",").map((part) => part.trim()).filter(Boolean);
        const numbers = parts.map(Number);
        if (parts.length === 0 || numbers.some((n) => !Number.isFinite(n))) {
            setInvalid(true);
            return;
        }
        setInvalid(false);
        onChange(numbers);
    };

    return (
        <InputText
            value={text}
            onChange={(event) => setText(event.target.value)}
            onBlur={commit}
            onKeyDown={(event) => event.key === "Enter" && commit()}
            className={invalid ? "p-invalid" : ""}
            aria-invalid={invalid}
            aria-label={label}
            placeholder={placeholder}
        />
    );
};

/** X / Y / Z voxel spacing. */
const Spacing = ({ value = [], onChange, label }) => (
    <div className={styles.triple}>
        {["X", "Y", "Z"].map((axis, i) => (
            <Num
                key={axis}
                value={value[i]}
                min={0.01}
                placeholder={axis}
                label={`${label} ${axis}`}
                onChange={(n) => {
                    const next = [...value];
                    next[i] = n;
                    onChange(next);
                }}
            />
        ))}
    </div>
);

/** A re-segmentation bound with a "No limit" switch. */
const Bound = ({ value, onChange, label, infinity, fallback }) => {
    const open = isInfinite(value);
    return (
        <div className={styles.pair}>
            <Num value={open ? null : value} disabled={open} label={label} onChange={(n) => onChange(n ?? fallback)} />
            <label className={styles.switchLabel}>
                <InputSwitch checked={open} onChange={(event) => onChange(event.value ? infinity : fallback)} aria-label={`${label}: no limit`} />
                No limit
            </label>
        </div>
    );
};

const RemoveButton = ({ label, onClick, disabled }) => (
    <Button type="button" icon="pi pi-times" severity="secondary" text rounded aria-label={label} onClick={onClick} disabled={disabled} />
);

const AddButton = ({ label, onClick }) => (
    <div className={styles.addRow}>
        <Button type="button" icon="pi pi-plus" label={label} severity="secondary" text onClick={onClick} />
    </div>
);

const DocAnchor = ({ href, children }) => (
    <p className={styles.docLink}>
        <a className={hintStyles.docLink} href={href} onClick={(event) => openDocs(event, href)}>
            {children}
            <ExternalLink size={12} aria-hidden="true" />
        </a>
    </p>
);

/* ---- One modality ------------------------------------------------------- */

const ModalityTab = ({ blockKey, block, defaults, put, change }) => {
    const at = (...path) => [blockKey, ...path];
    const interp = block.interp ?? {};
    const reSeg = block.reSeg ?? {};
    const range = Array.isArray(reSeg.range) ? reSeg.range : ["-inf", "inf"];
    const disc = block.discretisation ?? {};
    const texture = disc.texture ?? { type: [], val: [] };
    const ivh = disc.IVH ?? {};
    const scaleText = Array.isArray(interp.scale_text) ? interp.scale_text : [];
    const extract = block.extract ?? {};
    const doseOn = extract.Dose === true;
    const defaultRange = defaults?.reSeg?.range ?? [];

    const setTexture = (types, vals) => put(at("discretisation", "texture"), { type: types, val: vals });

    return (
        <>
            <Group title="Voxel size">
                <Param label="Shape and intensity features (mm)" help="Images are resampled to this spacing before measuring. Keep it the same for every patient.">
                    <Spacing value={interp.scale_non_text} label="Spacing" onChange={(v) => put(at("interp", "scale_non_text"), v)} />
                </Param>
                {scaleText.map((spacing, i) => (
                    <Param
                        key={i}
                        label={scaleText.length > 1 ? `Texture features ${i + 1} (mm)` : "Texture features (mm)"}
                        help={i === 0 ? "Spacing for texture features. Each entry adds one set of texture features." : "Another set of texture features."}
                    >
                        <div className={styles.pairRemovable}>
                            <Spacing
                                value={spacing}
                                label={`Texture spacing ${i + 1}`}
                                onChange={(v) => change((d) => { getIn(d, at("interp", "scale_text"))[i] = v; })}
                            />
                            <RemoveButton
                                label={`Remove texture spacing ${i + 1}`}
                                disabled={scaleText.length <= 1}
                                onClick={() => change((d) => { getIn(d, at("interp", "scale_text")).splice(i, 1); })}
                            />
                        </div>
                    </Param>
                ))}
                <AddButton
                    label="Add texture voxel size"
                    onClick={() => put(at("interp", "scale_text"), [...scaleText, [...(scaleText[scaleText.length - 1] ?? interp.scale_non_text ?? [1, 1, 1])]])}
                />
            </Group>

            <Group title="Re-segmentation">
                <Param label="Lowest intensity" help="Voxels below this value are removed from the ROI.">
                    <Bound
                        value={range[0]}
                        label="Lowest intensity"
                        infinity="-inf"
                        fallback={typeof defaultRange[0] === "number" ? defaultRange[0] : 0}
                        onChange={(v) => put(at("reSeg", "range"), [v, range[1]])}
                    />
                </Param>
                <Param label="Highest intensity" help="Voxels above this value are removed from the ROI.">
                    <Bound
                        value={range[1]}
                        label="Highest intensity"
                        infinity="inf"
                        fallback={typeof defaultRange[1] === "number" ? defaultRange[1] : 1000}
                        onChange={(v) => put(at("reSeg", "range"), [range[0], v])}
                    />
                </Param>
                <Param label="Outlier removal" help="Also remove intensities beyond 3 standard deviations (Collewet).">
                    <Switch
                        value={reSeg.outliers === "Collewet"}
                        label="Outlier removal"
                        onChange={(on) => put(at("reSeg", "outliers"), on ? "Collewet" : "")}
                    />
                </Param>
            </Group>

            <Group title="Discretisation">
                <Param label="Intensity histogram" help="Bin algorithm and size (FBS) or number of bins (FBN) for histogram features.">
                    <div className={styles.pair}>
                        <Select value={disc.IH?.type} items={DISCRETISATION_TYPES} label="Histogram algorithm" onChange={(v) => put(at("discretisation", "IH", "type"), v)} />
                        <Num value={disc.IH?.val} min={0} label="Histogram bin value" onChange={(n) => put(at("discretisation", "IH", "val"), n)} />
                    </div>
                </Param>
                {texture.type.map((type, i) => (
                    <Param
                        key={i}
                        label={texture.type.length > 1 ? `Texture ${i + 1}` : "Texture"}
                        help={i === 0 ? "Texture values depend strongly on this. Several values give one set each." : "Another texture binning."}
                    >
                        <div className={styles.pairRemovable}>
                            <Select
                                value={type}
                                items={DISCRETISATION_TYPES}
                                label={`Texture algorithm ${i + 1}`}
                                onChange={(v) => {
                                    const types = [...texture.type];
                                    types[i] = v;
                                    setTexture(types, texture.val);
                                }}
                            />
                            <NumberList
                                value={texture.val[i]}
                                label={`Texture bin values ${i + 1}`}
                                placeholder="e.g. 25"
                                onChange={(list) => {
                                    const vals = [...texture.val];
                                    vals[i] = list;
                                    setTexture(texture.type, vals);
                                }}
                            />
                            <RemoveButton
                                label={`Remove texture binning ${i + 1}`}
                                disabled={texture.type.length <= 1}
                                onClick={() => setTexture(texture.type.filter((_, j) => j !== i), texture.val.filter((_, j) => j !== i))}
                            />
                        </div>
                    </Param>
                ))}
                <AddButton label="Add texture binning" onClick={() => setTexture([...texture.type, "FBS"], [...texture.val, [25]])} />
            </Group>

            <Group title="Filter">
                <Param label="Image filter" help="Features are computed on the filtered image. Set the filter itself in the Filtering tab.">
                    <Select value={block.filter_type ?? ""} items={FILTER_TYPES} label="Image filter" onChange={(v) => put(at("filter_type"), v)} />
                </Param>
                <Param label="Intensity type" help="arbitrary for MR (no physical unit), definite for CT and PET, filtered with a filter.">
                    <Select value={block.intensity_type ?? ""} items={INTENSITY_TYPES} label="Intensity type" onChange={(v) => put(at("intensity_type"), v)} />
                </Param>
            </Group>

            <Group title="Feature families">
                {FEATURE_FAMILIES.map(({ key, label: familyLabel, help }) => (
                    <Param key={key} label={familyLabel} help={help}>
                        <Switch
                            value={extract[key] ?? key !== "Dose"}
                            label={familyLabel}
                            onChange={(on) => change((d) => {
                                setIn(d, at("extract", key), on);
                                const target = getIn(d, at());
                                if (key === "Dose" && on) {
                                    if (target.dose_vx_thresholds === undefined) target.dose_vx_thresholds = [...DEFAULT_DOSE_VX_THRESHOLDS];
                                    if (target.dose_mask_extension === undefined) target.dose_mask_extension = 0;
                                }
                            })}
                        />
                    </Param>
                ))}
            </Group>

            <Disclosure title="Advanced" modifiedCount={countAdvancedChanges(block, defaults)}>
                <h4 className={styles.groupTitle}>Region</h4>
                <div className={styles.rows}>
                    <Param label="Bounding box" help="Crop around the ROI first: full, box, box10 (10-voxel margin) or 2box (twice the size).">
                        <Text value={block.box_string} label="Bounding box" placeholder="box10" onChange={(v) => put(at("box_string"), v)} />
                    </Param>
                    {(blockKey === "imParamPET" || "compute_suv_map" in block) && (
                        <Param label="Compute SUV map" help="Convert PET to SUV. DICOM only; NIfTI PET must already be in SUV.">
                            <Switch value={block.compute_suv_map} label="Compute SUV map" onChange={(on) => put(at("compute_suv_map"), on)} />
                        </Param>
                    )}
                </div>

                <h4 className={styles.groupTitle}>Interpolation</h4>
                <div className={styles.rows}>
                    <Param label="Image interpolation" help="Method used to resample the image to the voxel size.">
                        <Select value={interp.vol_interp} items={VOL_INTERP} label="Image interpolation" onChange={(v) => put(at("interp", "vol_interp"), v)} />
                    </Param>
                    <Param label="ROI interpolation" help="Method used to resample the ROI mask.">
                        <Select value={interp.roi_interp} items={ROI_INTERP} label="ROI interpolation" onChange={(v) => put(at("interp", "roi_interp"), v)} />
                    </Param>
                    <Param label="ROI partial volume" help="Share of a resampled voxel (0 to 1) that must be in the ROI to keep it.">
                        <Num value={interp.roi_pv} min={0} max={1} label="ROI partial volume" onChange={(n) => put(at("interp", "roi_pv"), n ?? 0.5)} />
                    </Param>
                    <Param label="Grey level rounding" help="Round intensities to this power of 10 after resampling (CT). Empty to skip.">
                        <Num value={Array.isArray(interp.gl_round) ? null : interp.gl_round} min={0} label="Grey level rounding" onChange={(n) => put(at("interp", "gl_round"), n ?? [])} />
                    </Param>
                </div>

                <h4 className={styles.groupTitle}>Intensity-volume histogram</h4>
                <div className={styles.rows}>
                    <Param label="Discretisation" help="Binning for intensity-volume histogram features. None keeps the raw intensities.">
                        <div className={styles.pair}>
                            <Select
                                value={ivh.type ?? "none"}
                                items={IVH_TYPES}
                                label="Intensity-volume histogram algorithm"
                                onChange={(v) => put(at("discretisation", "IVH"), v === "none" ? {} : { type: v, val: ivh.val ?? 1 })}
                            />
                            <Num value={ivh.val} min={0} disabled={!ivh.type} label="Intensity-volume histogram bin value" onChange={(n) => put(at("discretisation", "IVH", "val"), n)} />
                        </div>
                    </Param>
                </div>

                <h4 className={styles.groupTitle}>Dose features</h4>
                {doseOn ? (
                    <div className={styles.rows}>
                        <Param label="Dose mask extension" help="Margin around the ROI box: a number of voxels, or a fraction between 0 and 1.">
                            <Num value={block.dose_mask_extension} min={0} label="Dose mask extension" onChange={(n) => put(at("dose_mask_extension"), n ?? 0)} />
                        </Param>
                        <Param label="Vx thresholds (Gy)" help="Doses for the Vx volume features, comma separated.">
                            <NumberList value={block.dose_vx_thresholds} label="Vx thresholds" placeholder="2, 4, 8" onChange={(list) => put(at("dose_vx_thresholds"), list)} />
                        </Param>
                    </div>
                ) : (
                    <Caption>Turn on Dose under Feature families to set these.</Caption>
                )}
            </Disclosure>
        </>
    );
};

/* ---- Filters (shared by all modalities) --------------------------------- */

const PADDING_HELP = "How the image is extended beyond its border.";
const NAME_SAVE_HELP = "Tag added to the result file names.";

const FilterCard = ({ title, filterKey, filters, put, docAnchor, children }) => {
    if (!filters[filterKey]) {
        return (
            <Group title={title}>
                <Caption>Not defined in these settings.</Caption>
                <AddButton
                    label="Add with the default values"
                    onClick={() => put(["imParamFilter", filterKey], structuredClone(DEFAULT_EXTRACTION_SETTINGS.imParamFilter[filterKey]))}
                />
            </Group>
        );
    }
    return (
        <SectionCard title={title}>
            <div className={styles.rows}>{children}</div>
            <DocAnchor href={`${MEDIML_DOCS.configuration}#${docAnchor}`}>{title} documentation</DocAnchor>
        </SectionCard>
    );
};

const FiltersTab = ({ filters, put }) => {
    const f = (key, param) => ["imParamFilter", key, param];
    const common = (key, { dims = true, orthogonal = true, rotation = false } = {}) => ({
        dims: dims && (
            <Param label="Dimension" help="2 filters each slice, 3 filters the volume.">
                <Select value={asNumber(filters[key].ndims)} items={DIMENSIONS} label="Dimension" onChange={(v) => put(f(key, "ndims"), v)} />
            </Param>
        ),
        rotation: rotation && (
            <Param label="Rotation invariance" help="Combine responses over rotations so orientation does not matter.">
                <Switch value={filters[key].rot_invariance} label="Rotation invariance" onChange={(on) => put(f(key, "rot_invariance"), on)} />
            </Param>
        ),
        orthogonal: orthogonal && (
            <Param label="Orthogonal rotation" help="Also apply over the orthogonal planes and average.">
                <Switch value={filters[key].orthogonal_rot} label="Orthogonal rotation" onChange={(on) => put(f(key, "orthogonal_rot"), on)} />
            </Param>
        ),
        padding: (
            <Param label="Padding" help={PADDING_HELP}>
                <Select value={filters[key].padding} items={PADDINGS} label="Padding" onChange={(v) => put(f(key, "padding"), v)} />
            </Param>
        ),
        nameSave: (
            <Param label="Result name" help={NAME_SAVE_HELP}>
                <Text value={filters[key].name_save} label="Result name" onChange={(v) => put(f(key, "name_save"), v)} />
            </Param>
        ),
    });

    const mean = filters.mean && common("mean");
    const log = filters.log && common("log");
    const laws = filters.laws && common("laws", { dims: false, rotation: true });
    const gabor = filters.gabor && common("gabor", { dims: false, rotation: true });
    const wavelet = filters.wavelet && common("wavelet", { orthogonal: false, rotation: true });
    const lawsConfig = filters.laws?.config ?? [];
    const subband = String(filters.wavelet?.subband ?? "LLL").padEnd(3, "L");

    return (
        <>
            <Caption className={styles.intro}>
                One set of filters for all modalities. A filter is only applied where a modality tab selects it under Filter.
            </Caption>

            <FilterCard title="Mean" filterKey="mean" filters={filters} put={put} docAnchor="mean">
                {mean && (
                    <>
                        {mean.dims}
                        <Param label="Kernel size" help="Width of the averaging window, in voxels.">
                            <Num value={filters.mean.size} min={1} label="Kernel size" onChange={(n) => put(f("mean", "size"), n)} />
                        </Param>
                        {mean.orthogonal}
                        {mean.padding}
                        {mean.nameSave}
                    </>
                )}
            </FilterCard>

            <FilterCard title="Laplacian of Gaussian" filterKey="log" filters={filters} put={put} docAnchor="log">
                {log && (
                    <>
                        {log.dims}
                        <Param label="Sigma (mm)" help="Width of the Gaussian; sets the size of the blobs and edges enhanced.">
                            <Num value={filters.log.sigma} min={0} label="Sigma" onChange={(n) => put(f("log", "sigma"), n)} />
                        </Param>
                        {log.orthogonal}
                        {log.padding}
                        {log.nameSave}
                    </>
                )}
            </FilterCard>

            <FilterCard title="Laws" filterKey="laws" filters={filters} put={put} docAnchor="laws">
                {laws && (
                    <>
                        <Param label="Kernels" help="1D kernels combined in this order: L level, E edge, S spot, W wave, R ripple.">
                            <div className={styles.triple}>
                                {[0, 1, 2].map((i) => (
                                    <Select
                                        key={i}
                                        value={lawsConfig[i]}
                                        items={LAWS_KERNELS}
                                        label={`Kernel ${i + 1}`}
                                        onChange={(v) => {
                                            const config = [...lawsConfig];
                                            config[i] = v;
                                            put(f("laws", "config"), config);
                                        }}
                                    />
                                ))}
                            </div>
                        </Param>
                        <Param label="Energy distance" help="Chebyshev distance used to compute the texture energy image.">
                            <Num value={filters.laws.energy_distance} min={0} label="Energy distance" onChange={(n) => put(f("laws", "energy_distance"), n)} />
                        </Param>
                        <Param label="Energy image" help="Compute the texture energy image from the filter response.">
                            <Switch value={filters.laws.energy_image} label="Energy image" onChange={(on) => put(f("laws", "energy_image"), on)} />
                        </Param>
                        {laws.rotation}
                        {laws.orthogonal}
                        {laws.padding}
                        {laws.nameSave}
                    </>
                )}
            </FilterCard>

            <FilterCard title="Gabor" filterKey="gabor" filters={filters} put={put} docAnchor="gabor">
                {gabor && (
                    <>
                        <Param label="Sigma (mm)" help="Width of the Gaussian envelope.">
                            <Num value={filters.gabor.sigma} min={0} label="Sigma" onChange={(n) => put(f("gabor", "sigma"), n)} />
                        </Param>
                        <Param label="Wavelength (mm)" help="Period of the sinusoid; the size of the patterns enhanced.">
                            <Num value={filters.gabor.lambda} min={0} label="Wavelength" onChange={(n) => put(f("gabor", "lambda"), n)} />
                        </Param>
                        <Param label="Aspect ratio" help="Elongation of the filter (gamma).">
                            <Num value={filters.gabor.gamma} min={0} label="Aspect ratio" onChange={(n) => put(f("gabor", "gamma"), n)} />
                        </Param>
                        <Param label="Orientation" help="Angle in radians, e.g. Pi/8.">
                            <Text value={filters.gabor.theta} label="Orientation" placeholder="Pi/8" onChange={(v) => put(f("gabor", "theta"), v)} />
                        </Param>
                        {gabor.rotation}
                        {gabor.orthogonal}
                        {gabor.padding}
                        {gabor.nameSave}
                    </>
                )}
            </FilterCard>

            <FilterCard title="Wavelet" filterKey="wavelet" filters={filters} put={put} docAnchor="wavelet">
                {wavelet && (
                    <>
                        {wavelet.dims}
                        <Param label="Basis function" help="PyWavelets wavelet name, e.g. db3 or coif1.">
                            <Text value={filters.wavelet.basis_function} label="Basis function" placeholder="db3" onChange={(v) => put(f("wavelet", "basis_function"), v)} />
                        </Param>
                        <Param label="Sub-band" help="Low (L) or high (H) pass along X, Y and Z.">
                            <div className={styles.triple}>
                                {[0, 1, 2].map((i) => (
                                    <Select
                                        key={i}
                                        value={subband[i]}
                                        items={SUBBANDS}
                                        label={`Sub-band ${["X", "Y", "Z"][i]}`}
                                        onChange={(v) => put(f("wavelet", "subband"), subband.slice(0, i) + v + subband.slice(i + 1))}
                                    />
                                ))}
                            </div>
                        </Param>
                        <Param label="Level" help="Number of decomposition steps.">
                            <Num value={filters.wavelet.level} min={1} label="Level" onChange={(n) => put(f("wavelet", "level"), n)} />
                        </Param>
                        {wavelet.rotation}
                        {wavelet.padding}
                        {wavelet.nameSave}
                    </>
                )}
            </FilterCard>
        </>
    );
};

/* ---- Editor ------------------------------------------------------------- */

/**
 * @param {boolean} visible whether the panel is shown
 * @param {Object} settings the settings in use; the editor works on a copy
 * @param {Function} onApply receives the edited copy
 * @param {Function} onHide closes without applying
 */
const SettingsEditor = ({ visible, settings, onApply, onHide }) => {
    const [draft, setDraft] = useState(() => structuredClone(settings));
    const [tab, setTab] = useState(0);

    const change = (mutate) => setDraft((previous) => {
        const next = structuredClone(previous);
        mutate(next);
        return next;
    });
    const put = (path, value) => change((d) => setIn(d, path, value));

    const footer = (
        <>
            <Button type="button" label="Cancel" icon="pi pi-times" severity="secondary" onClick={onHide} text />
            <Button type="button" label="Apply" icon="pi pi-check" severity="info" onClick={() => onApply(draft)} raised />
        </>
    );

    return (
        <SidePanel
            open={visible}
            onClose={onHide}
            title="Extraction settings"
            size="wide"
            closeOnEscape={false}
            closeLabel="Close without applying"
            footer={footer}
        >
            <Caption className={styles.intro}>
                Changes are used for the next run once you click Apply. Each modality has its own settings.
            </Caption>

            <Group title="General">
                <Param label="ROI type label" help="Label of the ROI list; must match the ROI CSV file (e.g. roiNames_GTV.csv is GTV).">
                    <Text value={draft.roi_type_labels?.[0]} label="ROI type label" onChange={(v) => put(["roi_type_labels", 0], v)} />
                </Param>
                <Param label="ROI type" help="Name given to the saved results, e.g. features(all).">
                    <Text value={draft.roi_types?.[0]} label="ROI type" onChange={(v) => put(["roi_types", 0], v)} />
                </Param>
                <Param label="Categorize features" help="Also save one table per feature category (shape, intensity, texture).">
                    <Switch value={draft.categorize_features !== false} label="Categorize features" onChange={(on) => put(["categorize_features"], on)} />
                </Param>
            </Group>

            <TabView className={styles.tabs} activeIndex={tab} onTabChange={(event) => setTab(event.index)}>
                {MODALITY_TABS.map(({ key, header, label }) => (
                    <TabPanel key={key} header={header}>
                        {draft[key] ? (
                            <ModalityTab
                                blockKey={key}
                                block={draft[key]}
                                defaults={DEFAULT_EXTRACTION_SETTINGS[key]}
                                put={put}
                                change={change}
                            />
                        ) : (
                            <Group title={`${label} settings`}>
                                <Caption warn>
                                    <b>Note:</b> These settings have no {label} section, so {label} scans in the dataset will fail.
                                </Caption>
                                <AddButton
                                    label={`Add ${label} settings with the default values`}
                                    onClick={() => put([key], structuredClone(DEFAULT_EXTRACTION_SETTINGS[key]))}
                                />
                            </Group>
                        )}
                    </TabPanel>
                ))}
                <TabPanel header="Filtering">
                    <FiltersTab filters={draft.imParamFilter ?? {}} put={put} />
                </TabPanel>
            </TabView>
        </SidePanel>
    );
};

export default SettingsEditor;
