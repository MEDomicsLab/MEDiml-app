from __future__ import annotations

import shutil
from pathlib import Path
from typing import Any

import MEDiml
import numpy as np

from ..context import LearningContext
from ..node import LearningNode


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
        )

        # MEDiml's get_stratified_splits only seeds the random generator when stratifying by institution:
        # seed it here so the splits are reproducible and identical for every pipeline of the run
        design = context.design_settings.get("design", {})
        active_methods = design.get("active_method") or []
        split_seed = design.get(active_methods[0], {}).get("seed") if active_methods else None
        if split_seed is not None:
            np.random.seed(split_seed)

        experiment_dict = experiment.create_experiment(context.design_settings)

        context.paths_splits = [experiment_dict[run] for run in experiment_dict.keys()]
        context.split_counter = 0
        context.designed_experiment = True

    @staticmethod
    def _separate_shared_experiment(context: LearningContext) -> None:
        """Moves the pipeline to its own study sub-folder if its experiment folder is already used in the run.

        This happens when pipelines share a design node or an experiment name. The experiment folder keeps
        its name (learn__<label>), which MEDiml's analysis relies on, and the sub-folder holds a copy of the
        study's patients and outcomes, so the pipeline learns on the same patients.
        """
        used_folders = context.extras.get("used_learn_folders")
        if used_folders is None:
            return

        path_learn = (Path(context.path_study) / f"learn__{context.experiment_label}").resolve()
        if path_learn in used_folders:
            path_sub_study = Path(context.path_study) / f"pipeline{context.pipeline_index}"
            path_sub_study.mkdir(parents=True, exist_ok=True)
            for file_name in ("patientsLearn.json", "patientsHoldOut.json", "outcomes.csv"):
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
                "experiment = MEDiml.learning.DesignExperiment(path_study, path_ws_experiments, path_settings, experiment_label)",
                "experiment_dict = experiment.create_experiment(design_settings)",
                "paths_splits = [experiment_dict[run] for run in experiment_dict.keys()]",
                "split_counter = 0",
                "designed_experiment = True",
            ],
        )
     