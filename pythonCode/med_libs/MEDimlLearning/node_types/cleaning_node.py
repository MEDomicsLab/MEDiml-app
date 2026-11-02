from __future__ import annotations

from copy import deepcopy
from typing import Any

import MEDiml

from ..context import LearningContext
from ..node import LearningNode


class CleaningNode(LearningNode):
    node_type = "cleaning"

    def run(self, context: LearningContext) -> None:
        context.cleaning_settings = dict(self.params)
        if not context.loaded_data:
            raise ValueError("Cleaning: Data must be loaded first. Use the Data node.")
        if context.path_study is None:
            raise ValueError("Cleaning: Path to study is not given.")
        if context.experiment_label is None:
            raise ValueError("Cleaning: Experiment label is not given.")

        context.rad_tables_learning = []
        context.rad_tables_final = []

        data_cln_method = next(iter(context.cleaning_settings.keys()))
        cleaning_dict = context.cleaning_settings[data_cln_method]["feature"]["continuous"]
        # The settings are keyword arguments of the cleaner (cutoffs, imputation), as in MEDiml's RadiomicsLearner
        data_cleaner = MEDiml.learning.DataCleaner(**cleaning_dict)

        for item in context.rad_var_struct["path"].values():
            path_radiomics_csv = item["csv"]
            path_radiomics_txt = item["txt"]
            image_type = item["type"]

            rad_table_learning = MEDiml.learning.ml_utils.get_radiomics_table(
                path_radiomics_csv,
                path_radiomics_txt,
                image_type,
                context.patient_ids,
            )

            if type(rad_table_learning.Properties["Description"]) not in [str, type(path_radiomics_csv)]:
                rad_table_learning.Properties["Description"] = str(rad_table_learning.Properties["Description"])

            temp_properties = deepcopy(rad_table_learning.Properties)
            rad_table_learning = data_cleaner.fit_transform(rad_table_learning)
            if rad_table_learning is None:
                continue

            rad_table_learning.Properties = temp_properties
            context.rad_tables_learning.append(rad_table_learning)

        context.cleaned_data = True

    def generate_code(self, file_obj, settings: dict[str, Any]) -> None:
        self._write_lines(
            file_obj,
            [
                "# Cleaning",
                f"cleaning_settings = {settings!r}",
                "if not rad_var_struct.get('path'):",
                "    raise ValueError('Cleaning: Data must be loaded first. Use the Data node.')",
                "if path_study is None:",
                "    raise ValueError('Cleaning: Path to study is not given.')",
                "if experiment_label is None:",
                "    raise ValueError('Cleaning: Experiment label is not given.')",
                "rad_tables_learning = []",
                "rad_tables_final = []",
                "data_cln_method = list(cleaning_settings.keys())[0]",
                "cleaning_dict = cleaning_settings[data_cln_method]['feature']['continuous']",
                "data_cleaner = MEDiml.learning.DataCleaner(**cleaning_dict)",
                "for item in rad_var_struct['path'].values():",
                "    path_radiomics_csv = item['csv']",
                "    path_radiomics_txt = item['txt']",
                "    image_type = item['type']",
                "    rad_table_learning = MEDiml.learning.ml_utils.get_radiomics_table(path_radiomics_csv, path_radiomics_txt, image_type, patient_ids)",
                "    if type(rad_table_learning.Properties['Description']) not in [str, type(path_radiomics_csv)]:",
                "        rad_table_learning.Properties['Description'] = str(rad_table_learning.Properties['Description'])",
                "    temp_properties = deepcopy(rad_table_learning.Properties)",
                "    rad_table_learning = data_cleaner.fit_transform(rad_table_learning)",
                "    if rad_table_learning is None:",
                "        continue",
                "    rad_table_learning.Properties = temp_properties",
                "    rad_tables_learning.append(rad_table_learning)",
                "cleaned_data = True",
            ],
        )
