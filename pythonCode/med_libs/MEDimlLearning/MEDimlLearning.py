from __future__ import annotations

from typing import Any

from .notebook_builder import NotebookBuilder
from .workflow import LearningWorkflow


class MEDimlLearning:
    """Facade used by the application to run or export learning workflows."""

    def __init__(self, json_config: dict[str, Any]) -> None:
        self.json_config = json_config
        self._progress = {"currentLabel": "", "now": 0.0}
        self.workflow = LearningWorkflow(json_config)
        self.id = json_config.get("id", "default")

    def get_progress(self) -> dict[str, Any]:
        self._progress = self.workflow.get_progress()
        return self._progress

    def set_progress(self, now: int = -1, label: str = "same") -> None:
        if now == -1:
            now = self._progress["now"]
        if label == "same":
            label = self._progress["currentLabel"]
        self._progress = {"currentLabel": label, "now": now}
        self.workflow.set_progress(now=now, label=label)

    def run_all(self) -> dict[str, Any]:
        return self.workflow.run_all()

    def finalize_model(self) -> dict[str, Any]:
        return self.workflow.finalize(
            pipeline_name=self.json_config["pipeline"],
            path_study=self.json_config["path_study"],
            models_path=self.json_config.get("models_path"),
        )

    def generate_notebooks(self) -> dict[str, Any]:
        return NotebookBuilder(self.json_config).generate()

    def make_save_ready(self) -> None:
        return None

    def init_obj(self) -> None:
        return None
