import csv
import hashlib
import io
import os
import shutil
import sys
import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path

import requests

sys.path.append(str(Path(os.path.dirname(os.path.abspath(__file__))).parent.parent))
from med_libs.GoExecutionScript import GoExecutionScript, get_response_from_error, parse_arguments
from med_libs.server_utils import go_print

json_params_dict, id_ = parse_arguments()
go_print("running download_sts_poc.py:" + id_)

ZENODO_RECORD_URL = "https://zenodo.org/records/23103630"
OUTCOMES_URL = ZENODO_RECORD_URL + "/files/STS_PoC_Outcomes.csv?download=1"
POC_FOLDER = "STS_POC"
OUTCOMES_FILE = "sts_poc_outcomes.csv"
# Shared by both versions, saved under DATA/STS_POC as is (the clinical sheet is converted to CSV, as the app does not read xlsx)
CLINICAL_URL = ZENODO_RECORD_URL + "/files/INFOclinical_STS.xlsx?download=1"
CLINICAL_FILE = "INFOclinical_STS.csv"
ROI_NAMES_URL = ZENODO_RECORD_URL + "/files/roiNames_stsGTV.csv?download=1"
ROI_NAMES_FILE = "roiNames_stsGTV.csv"
XLSX_NS = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
XLSX_REL_NS = "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id"
MODALITIES = ["CT", "PET", "T1", "T2FS"]
# Each archive holds <root>/<PatientID>/<modality>/*.dcm, already organized with MEDiml's process_dataset.py.
# The light patients are a subset of the full ones, chosen so the lung-metastasis outcome is balanced (5 positive, 5 negative).
POC_ARCHIVES = {
    "lite": {
        "name": "Light Version",
        "url": ZENODO_RECORD_URL + "/files/MEDiml-app-STS-PoC-DATA-10-PATIENTS.zip?download=1",
        "md5": "d05977995c81baf4daae5030b737c6c0",
        "size": 651393289,
        "patients": [f"STS-McGill-{i:03d}" for i in (2, 3, 4, 5, 6, 8, 9, 14, 17, 18)],
    },
    "full": {
        "name": "Full Version",
        "url": ZENODO_RECORD_URL + "/files/MEDiml-app-STS-PoC-DATA.zip?download=1",
        "md5": "b4ca248fdb0d3bbc7b14435ba317a1ef",
        "size": 3154977231,
        "patients": [f"STS-McGill-{i:03d}" for i in range(1, 52)],
    },
}


def is_patient_present(patient_dir: Path) -> bool:
    """A patient is present when each of its modality folders holds at least one file."""
    return all((patient_dir / m).is_dir() and any((patient_dir / m).iterdir()) for m in MODALITIES)


def download_archive(archive: dict, dest: Path, on_progress) -> None:
    """Streams the archive to `dest`, checking its md5 against the Zenodo record."""
    md5 = hashlib.md5()
    done = 0
    with requests.get(archive["url"], stream=True, timeout=60) as response:
        response.raise_for_status()
        total = int(response.headers.get("Content-Length", archive["size"]))
        with open(dest, "wb") as f:
            for chunk in response.iter_content(chunk_size=1 << 20):
                f.write(chunk)
                md5.update(chunk)
                done += len(chunk)
                if done % (10 << 20) < len(chunk):  # every ~10 MB
                    on_progress(done, total)
    if md5.hexdigest() != archive["md5"]:
        raise ValueError(f"Checksum mismatch for {dest.name}")


def extract_patients(zip_path: Path, patients: list, staging_root: Path, on_progress) -> list:
    """Extracts the DICOM files of `patients` to staging_root/<PatientID>/<modality>/. Returns the patients found."""
    found = set()
    with zipfile.ZipFile(zip_path) as archive:
        # Only <root>/<PatientID>/<modality>/<file>.dcm entries, which leaves out stray archives like <root>/<PatientID>.zip
        members = []
        for info in archive.infolist():
            parts = info.filename.split("/")
            if len(parts) == 4 and parts[1] in patients and parts[2] in MODALITIES and parts[3].endswith(".dcm"):
                members.append((info, parts))
        for i, (info, (_, patient, modality, file_name)) in enumerate(members):
            if i % 200 == 0:
                on_progress(i, len(members))
            dest = staging_root / patient / modality / file_name
            dest.parent.mkdir(parents=True, exist_ok=True)
            with archive.open(info) as src, open(dest, "wb") as dst:
                shutil.copyfileobj(src, dst)
            found.add(patient)
    return sorted(found)


def write_outcomes(patients: list, dest_csv: Path) -> dict:
    """Writes PatientID,Outcome (1 = lung metastasis, else 0) for `patients` from the Zenodo outcomes. Returns the outcomes written."""
    if dest_csv.exists():
        with open(dest_csv, newline="") as f:
            existing = {row["PatientID"]: int(row["Outcome"]) for row in csv.DictReader(f)}
        if sorted(existing) == sorted(patients):
            go_print(f"Outcomes file {dest_csv} is up to date, skipping download")
            return existing
    response = requests.get(OUTCOMES_URL, timeout=60)
    response.raise_for_status()
    outcomes = {row["PatientID"]: int(row["Outcome"]) for row in csv.DictReader(io.StringIO(response.text))}
    missing = [p for p in patients if p not in outcomes]
    if missing:
        raise ValueError(f"No outcome for patients: {', '.join(missing)}")
    with open(dest_csv, "w", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(["PatientID", "Outcome"])
        writer.writerows([p, outcomes[p]] for p in patients)
    return {p: outcomes[p] for p in patients}


def xlsx_first_sheet_rows(content: bytes) -> list:
    """Reads the cell values of the first sheet of an xlsx, up to the first blank row (notes below the table are left out).
    Uses the standard library only, as openpyxl is not part of the app's Python environment."""
    with zipfile.ZipFile(io.BytesIO(content)) as xlsx:
        names = set(xlsx.namelist())
        shared = []
        if "xl/sharedStrings.xml" in names:
            for si in ET.fromstring(xlsx.read("xl/sharedStrings.xml")).findall("m:si", XLSX_NS):
                shared.append("".join(t.text or "" for t in si.iter(f"{{{XLSX_NS['m']}}}t")))
        first_sheet = ET.fromstring(xlsx.read("xl/workbook.xml")).find("m:sheets/m:sheet", XLSX_NS)
        rels = ET.fromstring(xlsx.read("xl/_rels/workbook.xml.rels"))
        target = next(r.get("Target") for r in rels if r.get("Id") == first_sheet.get(XLSX_REL_NS))
        sheet = ET.fromstring(xlsx.read(target.lstrip("/") if target.startswith("/xl/") else "xl/" + target))

    rows = []
    for row in sheet.findall("m:sheetData/m:row", XLSX_NS):
        values = {}
        for cell in row.findall("m:c", XLSX_NS):
            col = 0
            for letter in "".join(ch for ch in cell.get("r") if ch.isalpha()):
                col = col * 26 + ord(letter) - ord("A") + 1
            v = cell.find("m:v", XLSX_NS)
            if cell.get("t") == "inlineStr":
                value = "".join(t.text or "" for t in cell.iter(f"{{{XLSX_NS['m']}}}t"))
            elif v is None or v.text is None:
                value = ""
            elif cell.get("t") == "s":
                value = shared[int(v.text)]
            elif cell.get("t") in (None, "n"):
                number = float(v.text)
                value = str(int(number)) if number.is_integer() else v.text
            else:
                value = v.text
            values[col] = value.strip()
        # Blank rows are either missing from the xml (a gap in the row numbers) or hold only empty cells
        if rows and int(row.get("r")) != rows[-1][0] + 1:
            break
        if not any(values.values()):
            if rows:
                break
            continue
        rows.append((int(row.get("r")), values))

    if not rows:
        raise ValueError("The first sheet of the xlsx is empty")
    width = max(max(values) for _, values in rows)
    return [[values.get(c, "") for c in range(1, width + 1)] for _, values in rows]


def download_sts_file(url: str, dest: Path, xlsx_to_csv: bool = False) -> None:
    """Saves a file shared by both POC versions under DATA/STS_POC, skipped if already there."""
    if dest.exists():
        go_print(f"{dest} already exists, skipping download")
        return
    response = requests.get(url, timeout=60)
    response.raise_for_status()
    content = response.content
    if xlsx_to_csv:
        out = io.StringIO(newline="")
        csv.writer(out).writerows(xlsx_first_sheet_rows(content))
        content = out.getvalue().encode("utf-8")
    dest.write_bytes(content)


class GoExecScriptDownloadSTSPoc(GoExecutionScript):
    """Downloads the light or full POC archive of the Soft-Tissue-Sarcoma data from Zenodo into DATA/STS_POC
    and writes the binary lung-metastasis outcomes of the patients present."""

    def __init__(self, json_params: dict, _id: str = "default_id"):
        super().__init__(json_params, _id)

    def _custom_process(self, json_config: dict) -> dict:
        archive = POC_ARCHIVES.get(json_config.get("pocSize"))
        if archive is None:
            return get_response_from_error(toast=f"Unknown POC version: {json_config.get('pocSize')}")
        data_path = Path(json_config["dataPath"])
        target_root = data_path / POC_FOLDER
        # Everything is staged under .mediml, which the workspace watcher ignores, so the extraction
        # does not trigger a workspace resync per file.
        work_root = data_path.parent / ".mediml" / "tmp" / "sts_poc_download"

        # Both versions share DATA/STS_POC, so patients already there (e.g. from the light version) are kept as is
        patients = archive["patients"]
        missing = [p for p in patients if not is_patient_present(target_root / p)]
        skipped = len(patients) - len(missing)
        downloaded, failed = 0, 0

        if missing:
            shutil.rmtree(work_root, ignore_errors=True)
            work_root.mkdir(parents=True, exist_ok=True)
            # The archive and its extracted copy both live on disk until the patients are moved
            needed = archive["size"] * 2
            free = shutil.disk_usage(work_root).free
            if free < needed:
                shutil.rmtree(work_root, ignore_errors=True)
                return get_response_from_error(
                    toast=f"Not enough disk space for the {archive['name']}: {needed / 1e9:.1f} GB needed, {free / 1e9:.1f} GB free"
                )

            # Capped at 99: the renderer stops polling at 100, which send_response() sets when done.
            zip_path = work_root / "sts_poc.zip"
            try:
                self.set_progress(label=f"Downloading the {archive['name']} from Zenodo", now=0)
                download_archive(
                    archive,
                    zip_path,
                    lambda done, total: self.set_progress(
                        label=f"Downloading the {archive['name']} from Zenodo ({done / 1e6:.0f}/{total / 1e6:.0f} MB)",
                        now=done * 80 // total,
                    ),
                )
            except (requests.RequestException, ValueError) as e:
                go_print(f"Could not download {archive['url']}: {e}")
                shutil.rmtree(work_root, ignore_errors=True)
                return get_response_from_error(toast="Could not download the POC data from Zenodo. Check your internet connection and try again.")

            staging_root = work_root / POC_FOLDER
            try:
                found = extract_patients(
                    zip_path,
                    missing,
                    staging_root,
                    lambda i, total: self.set_progress(label=f"Extracting the DICOM files ({i}/{total})", now=80 + i * 15 // total),
                )
            except zipfile.BadZipFile as e:
                go_print(f"Corrupted archive {zip_path}: {e}")
                shutil.rmtree(work_root, ignore_errors=True)
                return get_response_from_error(toast="The downloaded POC archive is corrupted, please try again.")
            zip_path.unlink()

            # Patients are moved whole, so an interrupted run never leaves a half-filled patient in DATA/STS_POC
            self.set_progress(label="Moving the patients into the workspace", now=95)
            for patient in found:
                final_dir = target_root / patient
                shutil.rmtree(final_dir, ignore_errors=True)
                final_dir.parent.mkdir(parents=True, exist_ok=True)
                shutil.move(str(staging_root / patient), str(final_dir))
            shutil.rmtree(work_root, ignore_errors=True)
            downloaded = len(found)
            failed = len(missing) - len(found)
            if failed:
                go_print(f"Patients missing from {archive['url']}: {sorted(set(missing) - set(found))}")

        present_patients = [p for p in POC_ARCHIVES["full"]["patients"] if is_patient_present(target_root / p)]
        if not present_patients:
            return get_response_from_error(toast="Could not find any POC patient in the downloaded archive.")

        self.set_progress(label="Downloading the outcomes", now=97)
        try:
            outcomes = write_outcomes(present_patients, target_root / OUTCOMES_FILE)
        except (requests.RequestException, ValueError) as e:
            go_print(f"Could not write the outcomes: {e}")
            return get_response_from_error(toast="The POC images are ready, but the outcomes could not be downloaded from Zenodo. Click again to retry.")

        self.set_progress(label="Downloading the clinical data and ROI names", now=98)
        try:
            download_sts_file(CLINICAL_URL, target_root / CLINICAL_FILE, xlsx_to_csv=True)
            download_sts_file(ROI_NAMES_URL, target_root / ROI_NAMES_FILE)
        except (requests.RequestException, ValueError, KeyError, StopIteration, zipfile.BadZipFile, ET.ParseError) as e:
            go_print(f"Could not download the clinical data or ROI names: {e}")
            return get_response_from_error(
                toast="The POC images and outcomes are ready, but the clinical data or ROI names could not be downloaded from Zenodo. Click again to retry."
            )

        # Counts are for the requested version, the outcomes file covers every patient in DATA/STS_POC
        version_patients = [p for p in patients if p in outcomes]
        return {
            "downloaded": downloaded,
            "skipped": skipped,
            "failed": failed,
            "patients": len(version_patients),
            "positives": sum(outcomes[p] for p in version_patients),
            "path": str(target_root),
        }


script = GoExecScriptDownloadSTSPoc(json_params_dict, id_)
script.start()
