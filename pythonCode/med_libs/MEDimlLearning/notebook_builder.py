from __future__ import annotations

import io
import json
import uuid
from pathlib import Path
from typing import Any

from .workflow import LearningWorkflow


class NotebookBuilder:
    """Generate notebook code from a drawflow scene using modular node classes."""

    def __init__(self, json_config: dict[str, Any]) -> None:
        self.json_config = json_config
        self.workflow = LearningWorkflow(json_config)

    def _cell_id(self) -> str:
        return uuid.uuid4().hex[:8]

    def _markdown_cell(self, lines: list[str]) -> dict[str, Any]:
        return {
            "cell_type": "markdown",
            "metadata": {"language": "markdown", "id": self._cell_id()},
            "source": lines,
        }

    def _code_cell(self, source: str) -> dict[str, Any]:
        return {
            "cell_type": "code",
            "metadata": {"language": "python", "id": self._cell_id()},
            "source": [line + "\n" for line in source.rstrip("\n").splitlines()],
            "outputs": [],
            "execution_count": None,
        }

    def _get_pipeline_metadata(self, pipelines) -> tuple[Path, str, list[str]]:
        path_save_experiments: Path | None = None
        outcome_name: str | None = None
        pipeline_names: list[str] = []

        for index, pipeline in enumerate(pipelines, start=1):
            for node in pipeline.nodes:
                # The experiment paths are set in the split node (in the design node in older scenes)
                if node.name.lower() in {"split", "design"} and "path_save_experiments" in node.params:
                    path_save_experiments = Path(node.params["path_save_experiments"])
                    outcome_name = node.params["outcome_name"]
                    break

            # Named after the pipeline's number in the scene, so notebooks of different pipelines don't overwrite each other
            pipeline_names.append(f"{outcome_name}_{pipeline.pipeline_description}")

        if path_save_experiments is None or outcome_name is None:
            raise ValueError("No design node found in the pipelines.")

        return path_save_experiments, outcome_name, pipeline_names

    def generate(self) -> dict[str, Any]:
        pipelines = self.workflow.build_pipelines()
        if not pipelines:
            return {"error": "No pipeline could be built!"}

        pipelines_to_generate = [pip.get("pipeline") for pip in self.json_config.get("pipelines", [])]
        pipelines_names = [name for name in self.json_config.get("pipeline_names", [])]
        if not pipelines_to_generate:
            return {"error": "No pipeline to generate!"}

        pipelines = [pipeline for pipeline in pipelines if pipeline.pipeline_name in pipelines_to_generate]
        if not pipelines:
            return {"error": "The selected pipeline no longer exists in the scene!"}

        _, outcome_name, pipeline_names = self._get_pipeline_metadata(pipelines)

        # Determine the notebook save path
        if not self.json_config.get("save_path"):
            raise ValueError("No save path specified in the configuration for the generated notebook.")
        notebook_path = Path(self.json_config.get("save_path")) / f"{'-AND-'.join(pipeline_names)}.ipynb"
        if not notebook_path.parent.exists():
            notebook_path.parent.mkdir(parents=True, exist_ok=True)

        cells: list[dict[str, Any]] = []
        cells.append(
            self._markdown_cell(
                [
                    "# MEDiml Learning Notebook",
                    "\nThis notebook was auto-generated from the selected learning pipeline graph.\n",
                    "\n**Instructions:**",
                    "\n1. In the top right, you can change your kernel to the one with MEDiml and the required dependencies installed.",
                    "\n2. If no kernel is available, you can install the required dependencies using `pip install MEDiml`.",
                    "\n3. Run the cells in order, and you can modify the parameters of each node in the pipeline.",
                    "\n4. If you encounter any issues, check the cell's output for error messages.",
                    "\n5. For more information, refer to the [MEDiml documentation](https://mediml.readthedocs.io/en/latest/).",
                ]
            )
        )
        cells.append(
            self._markdown_cell(
                [
                    f"Generated on {__import__('datetime').datetime.now()}",
                    f"\nOutcome: {outcome_name}",
                ]
            )
        )

        imports_buffer = io.StringIO()
        imports_buffer.write("import json\n")
        imports_buffer.write("import os\n")
        imports_buffer.write("import pandas as pd\n")
        imports_buffer.write("from copy import deepcopy\n")
        imports_buffer.write("from pathlib import Path\n")
        imports_buffer.write("from numpyencoder import NumpyEncoder\n")
        imports_buffer.write("import MEDiml\n")
        cells.append(self._code_cell(imports_buffer.getvalue()))

        for idx, pipeline in enumerate(pipelines):
            pipeline_header = self._markdown_cell([
                f"## Generated Pipeline: {pipelines_names[idx]}",
                f"\n### Pipeline's nodes: {pipeline._to_str()}"
            ])
            cells.append(pipeline_header)

            pipeline_imports = io.StringIO()
            pipeline.generate_code(pipeline_imports)
            cells.append(self._code_cell(pipeline_imports.getvalue()))

        notebook = {
            "cells": cells,
            "metadata": {
                "language_info": {"name": "python"},
                "kernelspec": {"display_name": "Python 3", "language": "python", "name": "python3"},
            },
            "nbformat": 4,
            "nbformat_minor": 5,
        }

        with open(notebook_path, "w", encoding="utf-8") as notebook_file:
            json.dump(notebook, notebook_file, indent=2, ensure_ascii=False)

        return {"path_notebook": str(notebook_path)}
