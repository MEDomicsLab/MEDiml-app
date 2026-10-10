from __future__ import annotations

from pathlib import Path
from typing import Any

import MEDiml
import pandas as pd

from ..context import LearningContext
from ..node import LearningNode


def _radiomics_table_name(feature_file: str) -> str:
    """Returns the "<scan>(<roi>)__<space>" part of a "radiomics__<scan>(<roi>)__<space>.csv" file name."""
    name = feature_file.rsplit(".", 1)[0]
    return name[len("radiomics__"):] if name.startswith("radiomics__") else name


def _radiomics_table_sort_key(feature_file: str) -> tuple[str, str, str]:
    """Sorts the radiomics tables by scan, then ROI, then image space."""
    table_name = _radiomics_table_name(feature_file)
    scan_roi, _, space = table_name.partition("__")
    scan, _, roi = scan_roi.partition("(")
    return scan, roi.rstrip(")"), space


class DataNode(LearningNode):
    node_type = "data"

    def run(self, context: LearningContext) -> None:
        context.data_settings = dict(self.params)

        if context.finalize_model:
            path_outcomes, path_results = self._load_final_model_patients(context)
        else:
            if context.current_split_path is None:
                raise ValueError("Data node requires a split path. Run split/design nodes first.")

            context.ml_dict_paths = MEDiml.utils.load_json(context.current_split_path)
            context.patients_train = MEDiml.utils.load_json(context.ml_dict_paths["patientsTrain"])
            context.patients_test = MEDiml.utils.load_json(context.ml_dict_paths["patientsTest"])
            path_outcomes = context.ml_dict_paths["outcomes"]
            path_results = context.ml_dict_paths["results"]

        outcome_table = pd.read_csv(path_outcomes, index_col=0)
        context.outcome_table_binary = outcome_table.iloc[:, [0]]
        if outcome_table.shape[1] == 2:
            context.extras["outcome_table_time"] = outcome_table.iloc[:, [1]]

        context.path_results = Path(path_results)
        context.patient_ids = list(context.outcome_table_binary.index)
        if context.finalize_model:
            context.patients_train = MEDiml.learning.ml_utils.intersect(context.patients_train, context.patient_ids)
        context.outcome_table_binary_training = context.outcome_table_binary.loc[context.patients_train]

        # When finalizing, the holdout set is evaluated as the testing set of the final model
        context.patients_holdout = None
        if context.holdout_test and not context.finalize_model:
            holdout_path = context.path_study / "patientsHoldOut.json" if context.path_study is not None else None
            if holdout_path and holdout_path.exists():
                context.patients_holdout = MEDiml.utils.load_json(holdout_path)
                # Each split's model is also evaluated on the holdout set, as in MEDiml's RadiomicsLearner
                context.evaluate_holdout = True
            else:
                context.evaluate_holdout = False

        context.rad_var_struct = {"path": {}}
        name_type = self.params.get("nameType", "radiomics") or "radiomics"
        if "radiomics" not in name_type.lower():
            raise TypeError("Data node: Only Radiomics variables are supported!")

        path_features = Path(self.params["path"])
        features_files = self.params["featuresFiles"]
        for file_name in features_files:
            if not file_name.endswith(".csv"):
                raise TypeError("Data node: Only csv files are supported!")

        # Tables are combined (and their features numbered) in load order: load them sorted by scan, ROI
        # and image space like MEDiml's RadiomicsLearner, whatever the order of selection in the node
        for index, feature_file in enumerate(sorted(features_files, key=_radiomics_table_sort_key), start=1):
            rad_tab_x = {
                "csv": path_features / feature_file,
                "txt": path_features / (feature_file.split(".")[0] + ".txt"),
                # Same table description as MEDiml's RadiomicsLearner: <path>/<scan>(<roi>)__<space>
                "type": str(path_features / _radiomics_table_name(feature_file)),
            }
            if not rad_tab_x["csv"].exists():
                raise FileNotFoundError(f"File {rad_tab_x['csv']} does not exist.")
            if not rad_tab_x["txt"].exists():
                raise FileNotFoundError(f"File {rad_tab_x['txt']} does not exist.")
            context.rad_var_struct["path"][f"radTab{index}"] = rad_tab_x

        context.loaded_data = True

    @staticmethod
    def _load_final_model_patients(context: LearningContext) -> tuple[Path, Path]:
        """Uses the whole learning set as training patients and the holdout set as testing patients.

        Returns:
            The paths of the outcomes table and of the final model results.
        """
        path_learn = Path(context.path_study) / f"learn__{context.experiment_label}"
        if not path_learn.exists():
            raise FileNotFoundError(f"Experiment folder {path_learn} was not found. Run the experiment again before finalizing the model.")

        path_patients_learn = Path(context.path_study) / "patientsLearn.json"
        if not path_patients_learn.exists():
            raise FileNotFoundError(f"patientsLearn.json was not found in {context.path_study}.")
        context.patients_train = MEDiml.utils.load_json(path_patients_learn)

        path_patients_holdout = Path(context.path_study) / "patientsHoldOut.json"
        context.patients_test = MEDiml.utils.load_json(path_patients_holdout) if path_patients_holdout.exists() else []

        return context.path_ws_experiments / "outcomes.csv", path_learn / "final_model_results.json"

    def generate_code(self, file_obj, settings: dict[str, Any]) -> None:
        self._write_lines(
            file_obj,
            [
                "# Data",
                f"data_settings = {settings!r}",
                "if path_ml is None:",
                "    raise ValueError('Data node requires a split path. Run split/design nodes first.')",
                "ml_dict_paths = MEDiml.utils.load_json(path_ml)",
                "patients_train = MEDiml.utils.load_json(ml_dict_paths['patientsTrain'])",
                "patients_test = MEDiml.utils.load_json(ml_dict_paths['patientsTest'])",
                "outcome_table = pd.read_csv(ml_dict_paths['outcomes'], index_col=0)",
                "outcome_table_binary = outcome_table.iloc[:, [0]]",
                "if outcome_table.shape[1] == 2:",
                "    outcome_table_time = outcome_table.iloc[:, [1]]",
                "path_results = ml_dict_paths['results']",
                "patient_ids = list(outcome_table_binary.index)",
                "outcome_table_binary_training = outcome_table_binary.loc[patients_train]",
                "patients_holdout = None",
                "if holdout_test:",
                "    holdout_path = path_study / 'patientsHoldOut.json' if path_study is not None else None",
                "    if holdout_path and holdout_path.exists():",
                "        patients_holdout = MEDiml.utils.load_json(holdout_path)",
                "    else:",
                "        evaluate_holdout = False",
                "rad_var_struct = {'path': {}}",
                "name_type = data_settings.get('nameType', 'radiomics') or 'radiomics'",
                "if 'radiomics' not in name_type.lower():",
                "    raise TypeError('Data node: Only Radiomics variables are supported!')",
                "path_features = Path(data_settings['path'])",
                "features_files = data_settings['featuresFiles']",
                "for file_name in features_files:",
                "    if not file_name.endswith('.csv'):",
                "        raise TypeError('Data node: Only csv files are supported!')",
                "def radiomics_table_name(feature_file):",
                "    name = feature_file.rsplit('.', 1)[0]",
                "    return name[len('radiomics__'):] if name.startswith('radiomics__') else name",
                "def radiomics_table_sort_key(feature_file):",
                "    scan_roi, _, space = radiomics_table_name(feature_file).partition('__')",
                "    scan, _, roi = scan_roi.partition('(')",
                "    return scan, roi.rstrip(')'), space",
                "for index, feature_file in enumerate(sorted(features_files, key=radiomics_table_sort_key), start=1):",
                "    rad_tab_x = {",
                "        'csv': path_features / feature_file,",
                "        'txt': path_features / (feature_file.split('.')[0] + '.txt'),",
                "        'type': str(path_features / radiomics_table_name(feature_file)),",
                "    }",
                "    if not rad_tab_x['csv'].exists():",
                "        raise FileNotFoundError(f\"File {rad_tab_x['csv']} does not exist.\")",
                "    if not rad_tab_x['txt'].exists():",
                "        raise FileNotFoundError(f\"File {rad_tab_x['txt']} does not exist.\")",
                "    rad_var_struct['path'][f'radTab{index}'] = rad_tab_x",
                "loaded_data = True",
            ],
        )
