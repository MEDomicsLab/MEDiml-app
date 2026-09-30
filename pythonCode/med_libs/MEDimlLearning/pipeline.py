from __future__ import annotations

from pathlib import Path

import MEDiml
import numpy as np

from .context import LearningContext
from .node import LearningNode
import io


class Pipeline:
    """An ordered list of learning nodes."""

    def __init__(self, nodes: list[LearningNode], id: int, name: str, description: str) -> None:
        self.nodes = nodes
        self.id = id
        self.pipeline_name = name
        self.pipeline_description = description

    def __eq__(self, other: object) -> bool:
        return isinstance(other, Pipeline) and self.nodes == other.nodes

    def __round_dict(self, dict, decimals):
        for key, value in dict.items():
            if (type(value) is list):
                dict[key] = [round(x, decimals) for x in value]
            else:
                dict[key] = round(value, decimals)

        return dict

    def _to_str(self) -> str:
        return '➜'.join([str(node.name).title() for node in self.nodes])

    def contains_node(self, node_id: str) -> bool:
        return any(node.id == node_id for node in self.nodes)

    def update_pipeline(self, new_pipeline: "Pipeline") -> None:
        for index, node in enumerate(self.nodes):
            node.change_params(new_pipeline.nodes[index].params)

    def _partition_nodes(self) -> tuple[list[LearningNode], list[LearningNode]]:
        """Splits the nodes into the initial ones (split/design, run once) and the downstream ones (run per split)."""
        initial_nodes = []
        downstream_nodes = []
        for node in self.nodes:
            lower_name = node.name.lower()
            if lower_name in {"split", "design"} and not downstream_nodes:
                initial_nodes.append(node)
            else:
                downstream_nodes.append(node)
        return initial_nodes, downstream_nodes

    def run(self, set_progress, pipeline_number: int = 1, used_learn_folders: set | None = None) -> LearningContext:
        context = LearningContext(
            pipeline_index=pipeline_number,
            pipeline_name=self.pipeline_name,
            pipeline_description=self.pipeline_description
        )
        # Experiment folders already used by the other pipelines of the run (see DesignNode)
        if used_learn_folders is not None:
            context.extras["used_learn_folders"] = used_learn_folders

        set_progress(now=0, label=f"Starting pipeline : {self.pipeline_name}")

        initial_nodes, downstream_nodes = self._partition_nodes()

        total_initial = max(len(initial_nodes), 1)
        for index, node in enumerate(initial_nodes, start=1):
            progress = int(index * 20 / total_initial)
            set_progress(now=progress, label=f"Pipeline {pipeline_number} | Running node : {node.name.replace('_', ' ').title()}")
            node.run(context)

        if not context.paths_splits:
            context.paths_splits = [None]

        total_splits = max(len(context.paths_splits), 1)
        for split_index, path_ml in enumerate(context.paths_splits, start=1):
            context.current_split_index = split_index - 1
            context.current_split_path = path_ml
            context.split_counter = split_index - 1

            for node_index, node in enumerate(downstream_nodes, start=1):
                progress = int(20 + ((split_index - 1) / total_splits) * 70 + (node_index / max(len(downstream_nodes), 1)) * 70 / total_splits)
                set_progress(now=min(progress, 99), label=f"Pipeline {pipeline_number} | Split {split_index} | Running node : {node.name.replace('_', ' ').title()}")
                node.run(context)

        self._finalize_pipeline(context)

        set_progress(now=100, label=f"Pipeline {pipeline_number} finished")
        return context

    def finalize(self, set_progress, path_study: Path | str) -> LearningContext:
        """Trains the final model of the pipeline on the whole learning set of an existing study.

        The pipeline's nodes run once, with the learning set as training patients and the holdout set
        as testing patients, so the data is processed exactly as in the splits. The splits are not re-run.
        """
        context = LearningContext(
            pipeline_index=self.id,
            pipeline_name=self.pipeline_name,
            pipeline_description=self.pipeline_description,
            path_study=Path(path_study),
            finalize_model=True,
        )
        set_progress(now=0, label=f"Pipeline {self.id} | Finalizing model")

        initial_nodes, downstream_nodes = self._partition_nodes()
        for node in initial_nodes:
            node.run(context)

        context.current_split_index = 0
        context.current_split_path = None
        context.split_counter = 0
        for node_index, node in enumerate(downstream_nodes, start=1):
            progress = int(node_index / max(len(downstream_nodes), 1) * 99)
            set_progress(now=progress, label=f"Pipeline {self.id} | Final model | Running node : {node.name.replace('_', ' ').title()}")
            node.run(context)

        set_progress(now=100, label=f"Pipeline {self.id} final model trained")
        return context

    def _finalize_pipeline(self, context: LearningContext) -> None:
        if not context.extras.get("split_runs"):
            return

        # Average the results of the splits of this run, as MEDiml's RadiomicsLearner does after the splits
        # (the Analyze node is optional, and a results_avg.json file of a previous run would be outdated)
        path_learn = Path(context.path_study) / f'learn__{context.experiment_label}'
        MEDiml.learning.ml_utils.average_results(path_learn, save=True)
        final_results = MEDiml.utils.load_json(path_learn / 'results_avg.json')

        for split in ("train", "test"):
            if final_results.get(split):
                final_results[split] = self.__round_dict(
                    dict(sorted(final_results[split].items())),
                    2,
                )
        holdout = final_results.get("holdout")
        if holdout and not np.isnan(holdout.get("AUC_mean", np.nan)):
            final_results["holdout"] = self.__round_dict(
                dict(sorted(holdout.items())),
                2,
            )
        else:
            final_results.pop("holdout", None)

        context.final_results = final_results

    def generate_code(self, file_obj) -> None:
        file_obj.write(f"# Pipeline: {self._to_str()}\n")

        # Separate initial nodes (split/design) from downstream nodes as in run()
        initial_nodes, downstream_nodes = self._partition_nodes()

        # Emit initial nodes directly
        for node in initial_nodes:
            node.generate_code(file_obj, node.params)
            file_obj.write("\n")

        # Prepare split loop for downstream nodes
        file_obj.write("# Per-split execution\n")
        file_obj.write("if not paths_splits:\n")
        file_obj.write("    paths_splits = [None]\n")
        file_obj.write("for split_index, path_ml in enumerate(paths_splits, start=1):\n")
        file_obj.write("    current_split_index = split_index - 1\n")
        file_obj.write("    current_split_path = path_ml\n")
        file_obj.write("    split_counter = split_index - 1\n")

        # Emit downstream nodes indented inside the loop
        for node in downstream_nodes:
            buf = io.StringIO()
            node.generate_code(buf, node.params)
            code = buf.getvalue().splitlines()
            for line in code:
                file_obj.write(f"    {line}\n")
            file_obj.write("\n")
