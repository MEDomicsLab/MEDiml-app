from __future__ import annotations

from pathlib import Path
from typing import Any

import MEDiml
import numpy as np

from ..context import LearningContext
from ..node import LearningNode


class SplitNode(LearningNode):
    node_type = "split"
    splitted_data = False
    path_study: Path | str | None = None

    def run(self, context: LearningContext) -> None:
        context.split_settings = dict(self.params)
        context.design_settings = {"design": dict(self.params)}
        context.path_settings = self._resolve_settings_path()
        context.paths_splits = []
        context.split_counter = 0
        active_methods = self.params.get("active_method", [])
        active_method = active_methods[0].lower() if active_methods else ""
        if active_method == "cv":
            context.nb_split = self.params.get("cv", {}).get("nFolds", 5)
        elif active_method == "random":
            context.nb_split = self.params.get("random", {}).get("nSplits", 10)
        else:
            context.nb_split = 5
        context.designed_experiment = False
        context.path_outcome_file = Path(self.params["path_outcome_file"])
        context.path_ws_experiments = Path(self.params["path_ws_experiments"])
        context.path_save_experiments = Path(self.params["path_save_experiments"])
        context.outcome_name = self.params["outcome_name"]
        context.method = self.params["method"]
        context.holdout_test = context.method != "all_learn"

        # The final model is trained on the study created by a previous run
        if context.finalize_model:
            if context.path_study is None or not Path(context.path_study).exists():
                raise FileNotFoundError(f"Study folder {context.path_study} was not found. Run the experiment again before finalizing the model.")
            return

        if not self.splitted_data:
            # MEDiml's get_stratified_splits doesn't seed the random generator here: seed it so the
            # holdout set is reproducible
            np.random.seed(self.params.get("holdoutSeed", 1))
            path_study =MEDiml.learning.ml_utils.create_holdout_set(
                path_outcome_file=context.path_outcome_file,
                path_save_experiments=context.path_save_experiments,
                outcome_name=context.outcome_name,
                method=context.method,
                # Defaults of MEDiml's create_holdout_set
                percentage=self.params.get("holdoutPercentage", 0.2),
                seed=self.params.get("holdoutSeed", 1),
            )
            context.path_study = Path(path_study) if not isinstance(path_study, Path) else path_study
            self.path_study = context.path_study

            self.splitted_data = True

        elif self.path_study is not None:
            context.path_study = self.path_study

    def _resolve_settings_path(self) -> Path:
        return Path.cwd() / "baseFiles" / "ml_settings.yml"

    def generate_code(self, file_obj, settings: dict[str, Any]) -> None:
        self._write_lines(
            file_obj,
            [
                "# Split",
                f"split_settings = {settings!r}",
                "design_settings = {'design': dict(split_settings)}",
                "path_settings = Path.cwd() / 'baseFiles' / 'ml_settings.yml'",
                "paths_splits = []",
                "split_counter = 0",
                "active_methods = split_settings.get('active_method', [])",
                "active_method = active_methods[0].lower() if active_methods else ''",
                "if active_method == 'cv':",
                "    nb_split = split_settings.get('cv', {}).get('nFolds', 5)",
                "elif active_method == 'random':",
                "    nb_split = split_settings.get('random', {}).get('nSplits', 10)",
                "else:",
                "    nb_split = 5",
                "designed_experiment = False",
                "splitted_data = False",
            ],
        )
