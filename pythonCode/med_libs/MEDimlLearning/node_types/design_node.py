from __future__ import annotations

import shutil
from pathlib import Path
from typing import Any

import MEDiml
import numpy as np
import pandas as pd

from ..context import LearningContext
from ..node import LearningNode
from .data_node import DEFAULT_OUTCOMES_FILENAME


class DesignNode(LearningNode):
    node_type = "design"

    def run(self, context: LearningContext) -> None:
        context.experiment_label = self.params["expName"]

        # The final model reuses the experiment designed by a previous run
        if context.finalize_model:
            context.paths_splits = []
            context.split_counter = 0
            context.designed_experiment = True
            return

        # Pipelines of a run must not share (and overwrite) the same experiment folder
        self._separate_shared_experiment(context)

        experiment =MEDiml.learning.DesignExperiment(
            context.path_study,
            context.path_ws_experiments,
            context.path_settings,
            context.experiment_label,
            # MEDiml falls back to <path_ws_experiments>/outcomes.csv when no outcomes file is given
            path_outcomes=context.path_outcome_file,
        )

        # MEDiml's get_stratified_splits only seeds the random generator when stratifying by institution:
        # seed it here so the splits are reproducible and identical for every pipeline of the run
        design = context.design_settings.get("design", {})
        active_methods = design.get("active_method") or []
        split_seed = design.get(active_methods[0], {}).get("seed") if active_methods else None
        if split_seed is not None:
            np.random.seed(split_seed)

        if active_methods and active_methods[0].lower() == "cv":
            self._check_cv_folds(context, int(design.get("cv", {}).get("nFolds", 5)))

        experiment_dict = experiment.create_experiment(context.design_settings)

        context.paths_splits = [experiment_dict[run] for run in experiment_dict.keys()]
        context.split_counter = 0
        context.designed_experiment = True

    @staticmethod
    def _check_cv_folds(context: LearningContext, n_folds: int) -> None:
        """Checks that each outcome class of the learning set has at least one patient per fold.

        MEDiml's cross-validation is stratified (scikit-learn's StratifiedKFold), which fails with an unclear
        error when a class has fewer patients than folds, e.g. on small datasets with the default 10 folds.
        """
        path_outcomes = context.path_outcome_file or context.path_ws_experiments / DEFAULT_OUTCOMES_FILENAME
        path_patients_learn = Path(context.path_study) / "patientsLearn.json"
        if not Path(path_outcomes).exists() or not path_patients_learn.exists():
            return  # Left to MEDiml, which reports the missing file

        # Same outcome column as MEDiml when none is specified: the first one after the patient IDs
        outcomes = pd.read_csv(path_outcomes, index_col=0).iloc[:, 0]
        patients_learn = set(MEDiml.utils.load_json(path_patients_learn))
        class_counts = outcomes[outcomes.index.isin(patients_learn)].dropna().value_counts()
        if class_counts.empty:
            return
        max_folds = int(class_counts.min())
        if n_folds > max_folds:
            counts = ", ".join(f"{count} with outcome {value}" for value, count in class_counts.sort_index().items())
            fix = (f"Set the number of folds of the Split node between 2 and {max_folds}." if max_folds >= 2
                   else "Add patients to the smallest outcome class to use cross-validation.")
            raise ValueError(
                f"Cross-validation with {n_folds} folds needs at least {n_folds} patients in each outcome class, "
                f"but the learning set has {counts}. {fix}"
            )

    @staticmethod
    def _separate_shared_experiment(context: LearningContext) -> None:
        """Moves the pipeline to its own study sub-folder if its experiment folder is already used in the run.

        This happens when pipelines share a design node or an experiment name. The experiment folder keeps
        its name (learn__<label>), which MEDiml's analysis relies on, and the sub-folder holds a copy of the
        study's patients, so the pipeline learns on the same patients. The outcomes are read from the
        outcomes file given to the split node, so they are not copied.
        """
        used_folders = context.extras.get("used_learn_folders")
        if used_folders is None:
            return

        path_learn = (Path(context.path_study) / f"learn__{context.experiment_label}").resolve()
        if path_learn in used_folders:
            path_sub_study = Path(context.path_study) / f"pipeline{context.pipeline_index}"
            path_sub_study.mkdir(parents=True, exist_ok=True)
            for file_name in ("patientsLearn.json", "patientsHoldOut.json"):
                if (Path(context.path_study) / file_name).exists():
                    shutil.copy2(Path(context.path_study) / file_name, path_sub_study / file_name)
            context.path_study = path_sub_study
            path_learn = (path_sub_study / f"learn__{context.experiment_label}").resolve()
        used_folders.add(path_learn)

    def generate_code(self, file_obj, settings: dict[str, Any]) -> None:
        self._write_lines(
            file_obj,
            [
                "# Design",
                f"design_settings.update({settings!r})",
                "path_outcome_file = Path(design_settings['path_outcome_file'])",
                "path_ws_experiments = Path(design_settings['path_ws_experiments'])",
                "path_save_experiments = Path(design_settings['path_save_experiments'])",
                "outcome_name = design_settings['outcome_name']",
                "method = design_settings['method']",
                "holdout_test = method != 'all_learn'",
                "evaluate_holdout = holdout_test",
                "path_study = MEDiml.learning.ml_utils.create_holdout_set(",
                "    path_outcome_file=path_outcome_file,",
                "    path_save_experiments=path_save_experiments,",
                "    outcome_name=outcome_name,",
                "    method=method",
                ")",
                "path_study = Path(path_study) if not isinstance(path_study, Path) else path_study",
                "experiment = MEDiml.learning.DesignExperiment(path_study, path_ws_experiments, path_settings, experiment_label, path_outcomes=path_outcome_file)",
                "experiment_dict = experiment.create_experiment(design_settings)",
                "paths_splits = [experiment_dict[run] for run in experiment_dict.keys()]",
                "split_counter = 0",
                "designed_experiment = True",
            ],
        )
     