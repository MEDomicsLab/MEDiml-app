from __future__ import annotations

from pathlib import Path
from typing import Any

import MEDiml
import pandas as pd
from numpyencoder import NumpyEncoder

from ..context import LearningContext
from ..node import LearningNode


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
        context.patients_holdout = MEDiml.learning.ml_utils.intersect(context.patient_ids, context.patients_holdout) if context.evaluate_holdout else None

        context.outcome_table_binary_train = context.outcome_table_binary.loc[context.patients_train, :]
        context.outcome_table_binary_test = context.outcome_table_binary.loc[context.patients_test, :]
        context.outcome_table_binary_holdout = context.outcome_table_binary.loc[context.patients_holdout, :] if context.evaluate_holdout else None

        model_name = context.learner_settings["model"]
        model_settings = context.learner_settings[model_name]
        n_features_to_select = model_settings["nFeaturesToSelect"]
        optimize_threshold = model_settings.get("optimizeThreshold", True)
        finalize_model = model_settings.get("finalizeModel", True)
        optimization_metric = model_settings["optimizationMetric"]
        use_gpu = model_settings.get("use_gpu", False)
        seed = model_settings["seed"]

        context.finalize_model = finalize_model
        var_table_train = context.rad_tables_training.loc[context.patients_train, :]

        estimator = MEDiml.learning.Estimator.Estimator(
            algorithm="xgboost",
            ml_config={
                "n_features_to_select": n_features_to_select,
                "optimize_threshold": optimize_threshold,
                "optimization_metric": optimization_metric,
                "use_gpu": use_gpu,
                "seed": seed,
            },
        )
        estimator.fit(var_table_train, context.outcome_table_binary_train)

        name_save_model = model_settings["nameSave"]
        model_id = f"{name_save_model}_var1"
        path_model = Path(context.path_results).parent / f"{model_id}.pickle"
        estimator.save(str(path_model))

        var_table_test = MEDiml.learning.ml_utils.get_ml_test_table(estimator, context.rad_tables_testing)
        response_train = estimator.predict_proba(var_table_test.loc[context.patients_train, :])
        response_test = estimator.predict_proba(var_table_test.loc[context.patients_test, :])

        response_holdout = None
        if context.holdout_test and context.patients_holdout:
            rad_tables_holdout = []
            for item in context.rad_var_struct["path"].values():
                path_radiomics_csv = item["csv"]
                path_radiomics_txt = item["txt"]
                image_type = item["type"]
                rad_table_holdout = MEDiml.learning.ml_utils.get_radiomics_table(
                    path_radiomics_csv,
                    path_radiomics_txt,
                    image_type,
                    context.patients_holdout,
                )
                rad_tables_holdout.append(rad_table_holdout)
            var_table_all_holdout = MEDiml.learning.ml_utils.combine_rad_tables(rad_tables_holdout)
            patients_ids = MEDiml.learning.ml_utils.intersect(context.patients_holdout, list(var_table_all_holdout.index))
            response_holdout = estimator.predict_proba(var_table_all_holdout.loc[patients_ids, :])

        result = MEDiml.learning.Results(estimator.estimator_.model_info_, model_id)
        run_results = result.to_json(
            response_train=response_train,
            response_test=response_test,
            response_holdout=response_holdout,
            patients_train=context.patients_train,
            patients_test=context.patients_test,
            patients_holdout=context.patients_holdout,
        )

        run_results[model_id]["train"]["metrics"] = result.get_model_performance(response_train, context.outcome_table_binary_train)
        run_results[model_id]["test"]["metrics"] = result.get_model_performance(response_test, context.outcome_table_binary_test)
        if context.holdout_test and response_holdout is not None:
            run_results[model_id]["holdout"]["metrics"] = result.get_model_performance(response_holdout, context.outcome_table_binary_holdout)

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

    def generate_code(self, file_obj, settings: dict[str, Any]) -> None:
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
                "patients_holdout = MEDiml.learning.ml_utils.intersect(patient_ids, patients_holdout) if evaluate_holdout else None",
                "outcome_table_binary_train = outcome_table_binary.loc[patients_train, :]",
                "outcome_table_binary_test = outcome_table_binary.loc[patients_test, :]",
                "outcome_table_binary_holdout = outcome_table_binary.loc[patients_holdout, :] if evaluate_holdout else None",
                "model_name = learner_settings['model']",
                "model_settings = learner_settings[model_name]",
                "n_features_to_select = learner_settings[model_name]['nFeaturesToSelect']",
                "optimize_threshold = model_settings.get('optimizeThreshold', True)",
                "finalize_model = model_settings.get('finalizeModel', True)",
                "optimization_metric = learner_settings[model_name]['optimizationMetric']",
                "use_gpu = model_settings.get('use_gpu', False)",
                "seed = learner_settings[model_name]['seed']",
                "var_table_train = rad_tables_training.loc[patients_train, :]",
                "estimator = MEDiml.learning.Estimator.Estimator(algorithm='xgboost', ml_config={'n_features_to_select': n_features_to_select, 'optimize_threshold': optimize_threshold, 'optimization_metric': optimization_metric, 'use_gpu': use_gpu, 'seed': seed})",
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
                "    rad_tables_holdout = []",
                "    for item in rad_var_struct['path'].values():",
                "        path_radiomics_csv = item['csv']",
                "        path_radiomics_txt = item['txt']",
                "        image_type = item['type']",
                "        rad_table_holdout = MEDiml.learning.ml_utils.get_radiomics_table(path_radiomics_csv, path_radiomics_txt, image_type, patients_holdout)",
                "        rad_tables_holdout.append(rad_table_holdout)",
                "    var_table_all_holdout = MEDiml.learning.ml_utils.combine_rad_tables(rad_tables_holdout)",
                "    patients_ids = MEDiml.learning.ml_utils.intersect(patients_holdout, list(var_table_all_holdout.index))",
                "    response_holdout = estimator.predict_proba(var_table_all_holdout.loc[patients_ids, :])",
                "result = MEDiml.learning.Results(estimator.estimator_.model_info_, model_id)",
                "run_results = result.to_json(response_train=response_train, response_test=response_test, response_holdout=response_holdout, patients_train=patients_train, patients_test=patients_test, patients_holdout=patients_holdout)",
                "run_results[model_id]['train']['metrics'] = result.get_model_performance(response_train, outcome_table_binary_train)",
                "run_results[model_id]['test']['metrics'] = result.get_model_performance(response_test, outcome_table_binary_test)",
                "if holdout_test and response_holdout is not None:",
                "    run_results[model_id]['holdout']['metrics'] = result.get_model_performance(response_holdout, outcome_table_binary_holdout)",
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
