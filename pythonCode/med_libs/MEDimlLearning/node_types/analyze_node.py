from __future__ import annotations

from pathlib import Path
from typing import Any

import MEDiml
import numpy as np
import shutil

from ..context import LearningContext
from ..node import LearningNode


class AnalyzeNode(LearningNode):
    node_type = "analyze"

    def run(self, context: LearningContext) -> None:
        context.analyze_settings = dict(self.params)
        context.analysis_dict = {}

        if context.finalize_model \
            or context.current_result is None \
            or context.path_study is None \
            or context.experiment_label is None\
            or len(context.paths_splits) != context.current_split_index + 1:
            return

        # Average results across splits
        MEDiml.learning.ml_utils.average_results(Path(context.path_study) / f'learn__{context.experiment_label}', save=True)

        # Analyze the features importance for all the runs
        MEDiml.learning.ml_utils.feature_importance_analysis(Path(context.path_study) / f'learn__{context.experiment_label}')

        if context.analyze_settings.get("histogram"):
            hist_params = context.analyze_settings.get("histParams")
            if hist_params is None or hist_params.get("sortOption") is None:
                raise ValueError("Analyze: Histogram parameters were not provided.")

            context.current_result.plot_features_importance_histogram(
                Path(context.path_study),
                experiment=context.experiment_label.split("_")[0],
                level=context.experiment_label.split("_")[1],
                modalities=[context.experiment_label.split("_")[-1]],
                sort_option=hist_params["sortOption"],
                figsize=(20, 20),
                save=True,
            )

            level = context.experiment_label.split("_")[1]
            modality = context.experiment_label.split("_")[-1]
            sort_option = hist_params["sortOption"]
            path_image = Path(context.path_study) / f"features_importance_histogram_{level}_{modality}_{sort_option}.png"
            context.figures_dict.setdefault("histogram", {})["path"] = str(path_image).replace("\\", "/")

            # Update Analysis dict
            analysis_dict = {}
            analysis_dict[context.experiment_label] = {}
            analysis_dict[context.experiment_label]["histogram"] = {}
            analysis_dict[context.experiment_label]["histogram"]["path"] = str(path_image).replace('\\', '/')

            context.analysis_dict = analysis_dict

    def generate_code(self, file_obj, settings: dict[str, Any]) -> None:
        self._write_lines(
            file_obj,
            [
                "# Analysis",
                f"analyze_settings = {settings!r}",
                "analysis_dict = {}",
                "if current_result is not None and path_study is not None and experiment_label is not None:",
                "    MEDiml.learning.ml_utils.average_results(Path(path_study) / f'learn__{experiment_label}', save=True)",
                "    MEDiml.learning.ml_utils.feature_importance_analysis(Path(path_study) / f'learn__{experiment_label}')",
                "    if analyze_settings.get('histogram'):",
                "        hist_params = analyze_settings.get('histParams')",
                "        if hist_params is None or hist_params.get('sortOption') is None:",
                "            raise ValueError('Analyze: Histogram parameters were not provided.')",
                "        current_result.plot_features_importance_histogram(Path(path_study), experiment=experiment_label.split('_')[0], level=experiment_label.split('_')[1], modalities=[experiment_label.split('_')[-1]], sort_option=hist_params['sortOption'], figsize=(20, 20), save=True)",
                "        level = experiment_label.split('_')[1]",
                "        modality = experiment_label.split('_')[-1]",
                "        sort_option = hist_params['sortOption']",
                "        path_image = Path(path_study) / f'features_importance_histogram_{level}_{modality}_{sort_option}.png'",
                "        analysis_dict[experiment_label] = {'histogram': {'path': str(path_image).replace('\\\\', '/')}}",
            ],
        )
