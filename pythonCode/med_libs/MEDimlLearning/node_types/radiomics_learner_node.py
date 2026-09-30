from __future__ import annotations

from pathlib import Path
from typing import Any

import MEDiml
import numpy as np
import pandas as pd
from numpyencoder import NumpyEncoder

from ..context import LearningContext
from ..node import LearningNode

# Model names used by older workflows, mapped to their PyCaret model IDs
LEGACY_MODEL_IDS = {"XGBoost": "xgboost"}


def resolve_learner_settings(settings: dict[str, Any]) -> tuple[str, dict[str, Any]]:
    """Returns the PyCaret model ID (or 'best') and its parameters.

    Older workflows nest the parameters under the model name (e.g. {"model": "XGBoost", "XGBoost": {...}}),
    newer ones store them flat next to "model".
    """
    model_name = settings["model"]
    nested_params = settings.get(model_name)
    model_settings = nested_params if isinstance(nested_params, dict) else settings
    return LEGACY_MODEL_IDS.get(model_name, model_name), model_settings


def build_ml_config(algorithm: str, model_settings: dict[str, Any]) -> dict[str, Any]:
    """Builds the MEDiml Estimator ml_config from the node parameters."""
    ml_config = {
        "n_features_to_select": model_settings["nFeaturesToSelect"],
        "optimize_threshold": model_settings.get("optimizeThreshold", True),
        "optimization_metric": model_settings["optimizationMetric"],
        # Uses the GPU by default like MEDiml's RadiomicsLearner (PyCaret falls back to the CPU if none is available)
        "use_gpu": model_settings.get("useGPU", model_settings.get("use_gpu", True)),
        "seed": model_settings["seed"],
    }
    if algorithm == "best":
        # PyCaret rejects include and exclude together, and treats an empty list differently from None
        ml_config["best_include"] = list(model_settings.get("bestInclude") or []) or None
        ml_config["best_exclude"] = None if ml_config["best_include"] else (list(model_settings.get("bestExclude") or []) or None)
    return ml_config


def _round_metrics(metrics: dict[str, Any], decimals: int = 2) -> dict[str, Any]:
    """Rounds the numeric metrics (NaN becomes None) and leaves the other values unchanged."""
    rounded = {}
    for name, value in metrics.items():
        if isinstance(value, (int, float, np.number)) and not isinstance(value, bool):
            rounded[name] = None if np.isnan(value) else round(float(value), decimals)
        else:
            rounded[name] = value
    return dict(sorted(rounded.items()))


class RadiomicsLearnerNode(LearningNode):
    node_type = "radiomics_learner"

    def run(self, context: LearningContext) -> None:
        context.learner_settings = dict(self.params)
        if not context.loaded_data:
            raise ValueError("Cleaning: Data must be loaded first. Use the Data node.")

        if not context.cleaned_data and not context.normalized_features and not context.reduced_features:
            context.rad_tables_learning = []
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
                context.rad_tables_learning.append(rad_table_learning)

        if not context.reduced_features:
            context.rad_tables_testing = list(context.rad_tables_learning)
            context.rad_tables_training = []
            for rad_tab in context.rad_tables_learning:
                patients_ids = MEDiml.learning.ml_utils.intersect(context.patients_train, list(rad_tab.index))
                context.rad_tables_training.append(rad_tab.loc[patients_ids].copy())

        if isinstance(context.rad_tables_training, list):
            context.rad_tables_training = MEDiml.learning.ml_utils.combine_rad_tables(context.rad_tables_training)
        if isinstance(context.rad_tables_testing, list):
            context.rad_tables_testing = MEDiml.learning.ml_utils.combine_rad_tables(context.rad_tables_testing)

        context.patient_ids = list(context.outcome_table_binary.index)
        context.patients_train = MEDiml.learning.ml_utils.intersect(
            MEDiml.learning.ml_utils.intersect(context.patient_ids, context.patients_train),
            context.rad_tables_training.index,
        )
        context.patients_test = MEDiml.learning.ml_utils.intersect(
            MEDiml.learning.ml_utils.intersect(context.patient_ids, context.patients_test),
            context.rad_tables_testing.index,
        )
        context.patients_holdout = MEDiml.learning.ml_utils.intersect(
            MEDiml.learning.ml_utils.intersect(context.patient_ids, context.patients_holdout),
            context.rad_tables_testing.index,
        ) if context.evaluate_holdout else None

        context.outcome_table_binary_train = context.outcome_table_binary.loc[context.patients_train, :]
        context.outcome_table_binary_test = context.outcome_table_binary.loc[context.patients_test, :]
        context.outcome_table_binary_holdout = context.outcome_table_binary.loc[context.patients_holdout, :] if context.evaluate_holdout else None

        algorithm, model_settings = resolve_learner_settings(context.learner_settings)
        if context.finalize_model:
            self._train_final_model(context, algorithm, model_settings)
            return

        var_table_train = context.rad_tables_training.loc[context.patients_train, :]

        estimator = MEDiml.learning.Estimator.Estimator(
            algorithm=algorithm,
            ml_config=build_ml_config(algorithm, model_settings),
        )
        estimator.fit(var_table_train, context.outcome_table_binary_train)

        name_save_model = model_settings["nameSave"]
        model_id = f"{name_save_model}_var1"
        path_model = Path(context.path_results).parent / f"{model_id}.pickle"
        estimator.save(str(path_model))

        var_table_test = MEDiml.learning.ml_utils.get_ml_test_table(estimator, context.rad_tables_testing)
        response_train = estimator.predict_proba(var_table_test.loc[context.patients_train, :])
        response_test = estimator.predict_proba(var_table_test.loc[context.patients_test, :])

        # The holdout patients are processed with the other patients (cleaning, normalization) and their
        # features are matched to the model's by name, like the testing patients and the final model
        response_holdout = None
        if context.holdout_test and context.patients_holdout:
            response_holdout = estimator.predict_proba(var_table_test.loc[context.patients_holdout, :])

        # Point metrics and bootstrap confidence intervals, as in MEDiml's RadiomicsLearner
        result = MEDiml.learning.Results(estimator.estimator_.model_info_, model_id)
        run_results = result.to_json(
            response_train=response_train,
            response_test=response_test,
            response_holdout=response_holdout,
            patients_train=context.patients_train,
            patients_test=context.patients_test,
            patients_holdout=context.patients_holdout if response_holdout is not None else None,
            outcome_table_binary_train=context.outcome_table_binary_train,
            outcome_table_binary_test=context.outcome_table_binary_test,
            outcome_table_binary_holdout=context.outcome_table_binary_holdout if response_holdout is not None else None,
        )

        MEDiml.utils.json_utils.save_json(context.path_results, run_results, cls=NumpyEncoder)

        context.current_model = estimator
        context.current_model_id = model_id
        context.current_result = result
        context.saved_results = True
        context.extras["run_results"] = run_results
        context.extras.setdefault("split_runs", []).append(
            {
                "split_index": context.current_split_index,
                "model": estimator,
                "model_id": model_id,
                "result": result,
                "run_results": run_results,
                "path_results": context.path_results,
            }
        )

    @staticmethod
    def _train_final_model(context: LearningContext, algorithm: str, model_settings: dict[str, Any]) -> None:
        """Trains a new model on the whole learning set (training patients) and evaluates it on the
        holdout set (testing patients), with the same settings as the splits."""
        path_learn = Path(context.path_results).parent
        var_table_train = context.rad_tables_training.loc[context.patients_train, :]

        estimator = MEDiml.learning.Estimator.Estimator(
            algorithm=algorithm,
            ml_config=build_ml_config(algorithm, model_settings),
        )
        estimator.fit(var_table_train, context.outcome_table_binary_train)

        model_id = f"{model_settings['nameSave']}_FINAL"
        path_model = path_learn / f"{model_id}.pickle"
        estimator.save(str(path_model))

        holdout_metrics = None
        result = MEDiml.learning.Results(estimator.estimator_.model_info_, model_id)
        if context.patients_test:
            var_table_holdout = MEDiml.learning.ml_utils.get_ml_test_table(estimator, context.rad_tables_testing)
            response_holdout = estimator.predict_proba(var_table_holdout.loc[context.patients_test, :])
            final_results = result.to_json(
                response_holdout=response_holdout,
                patients_holdout=context.patients_test,
                outcome_table_binary_holdout=context.outcome_table_binary_test,
            )
            holdout_metrics = _round_metrics(final_results[model_id]["holdout"].get("metrics") or {})
        else:
            final_results = result.to_json()
        MEDiml.utils.json_utils.save_json(context.path_results, final_results, cls=NumpyEncoder)

        context.current_model = estimator
        context.current_model_id = model_id
        context.current_result = result
        context.saved_results = True
        context.extras["final_model"] = {
            "model_id": model_id,
            "model_path": str(path_model).replace("\\", "/"),
            "results_path": str(context.path_results).replace("\\", "/"),
            "n_train": len(context.patients_train),
            "n_holdout": len(context.patients_test),
            "holdout": holdout_metrics,
        }

    def generate_code(self, file_obj, settings: dict[str, Any]) -> None:
        algorithm, model_settings = resolve_learner_settings(settings)
        ml_config = build_ml_config(algorithm, model_settings)
        self._write_lines(
            file_obj,
            [
                "# Radiomics learner",
                f"learner_settings = {settings!r}",
                "if not rad_var_struct.get('path'):",
                "    raise ValueError('Cleaning: Data must be loaded first. Use the Data node.')",
                "if not cleaned_data and not normalized_features and not reduced_features:",
                "    rad_tables_learning = []",
                "    for item in rad_var_struct['path'].values():",
                "        path_radiomics_csv = item['csv']",
                "        path_radiomics_txt = item['txt']",
                "        image_type = item['type']",
                "        rad_table_learning = MEDiml.learning.ml_utils.get_radiomics_table(path_radiomics_csv, path_radiomics_txt, image_type, patient_ids)",
                "        rad_tables_learning.append(rad_table_learning)",
                "if not reduced_features:",
                "    rad_tables_testing = list(rad_tables_learning)",
                "    rad_tables_training = []",
                "    for rad_tab in rad_tables_learning:",
                "        patients_ids = MEDiml.learning.ml_utils.intersect(patients_train, list(rad_tab.index))",
                "        rad_tables_training.append(rad_tab.loc[patients_ids].copy())",
                "if isinstance(rad_tables_training, list):",
                "    rad_tables_training = MEDiml.learning.ml_utils.combine_rad_tables(rad_tables_training)",
                "if isinstance(rad_tables_testing, list):",
                "    rad_tables_testing = MEDiml.learning.ml_utils.combine_rad_tables(rad_tables_testing)",
                "patient_ids = list(outcome_table_binary.index)",
                "patients_train = MEDiml.learning.ml_utils.intersect(MEDiml.learning.ml_utils.intersect(patient_ids, patients_train), rad_tables_training.index)",
                "patients_test = MEDiml.learning.ml_utils.intersect(MEDiml.learning.ml_utils.intersect(patient_ids, patients_test), rad_tables_testing.index)",
                "patients_holdout = MEDiml.learning.ml_utils.intersect(MEDiml.learning.ml_utils.intersect(patient_ids, patients_holdout), rad_tables_testing.index) if evaluate_holdout else None",
                "outcome_table_binary_train = outcome_table_binary.loc[patients_train, :]",
                "outcome_table_binary_test = outcome_table_binary.loc[patients_test, :]",
                "outcome_table_binary_holdout = outcome_table_binary.loc[patients_holdout, :] if evaluate_holdout else None",
                f"model_settings = {model_settings!r}",
                "var_table_train = rad_tables_training.loc[patients_train, :]",
                f"estimator = MEDiml.learning.Estimator.Estimator(algorithm={algorithm!r}, ml_config={ml_config!r})",
                "estimator.fit(var_table_train, outcome_table_binary_train)",
                "name_save_model = model_settings['nameSave']",
                "model_id = f'{name_save_model}_var1'",
                "path_model = Path(path_results).parent / f'{model_id}.pickle'",
                "estimator.save(str(path_model))",
                "var_table_test = MEDiml.learning.ml_utils.get_ml_test_table(estimator, rad_tables_testing)",
                "response_train = estimator.predict_proba(var_table_test.loc[patients_train, :])",
                "response_test = estimator.predict_proba(var_table_test.loc[patients_test, :])",
                "response_holdout = None",
                "if holdout_test and patients_holdout:",
                "    response_holdout = estimator.predict_proba(var_table_test.loc[patients_holdout, :])",
                "result = MEDiml.learning.Results(estimator.estimator_.model_info_, model_id)",
                "run_results = result.to_json(response_train=response_train, response_test=response_test, response_holdout=response_holdout, patients_train=patients_train, patients_test=patients_test, patients_holdout=patients_holdout if response_holdout is not None else None, outcome_table_binary_train=outcome_table_binary_train, outcome_table_binary_test=outcome_table_binary_test, outcome_table_binary_holdout=outcome_table_binary_holdout if response_holdout is not None else None)",
                "MEDiml.utils.json_utils.save_json(path_results, run_results, cls=NumpyEncoder)",
                "# Preserve runtime-like references and metadata",
                "current_model = estimator",
                "current_model_id = model_id",
                "current_result = result",
                "saved_results = True",
                "extras = globals().get('extras', {}) if globals().get('extras', None) is not None else {}",
                "extras['run_results'] = run_results",
                "extras.setdefault('split_runs', []).append({",
                "    'split_index': split_counter,",
                "    'model': estimator,",
                "    'model_id': model_id,",
                "    'result': result,",
                "    'run_results': run_results,",
                "    'path_results': path_results,",
                "})",
                "# Save extras back to globals so downstream cells can access it",
                "globals()['extras'] = extras",
            ],
        )
