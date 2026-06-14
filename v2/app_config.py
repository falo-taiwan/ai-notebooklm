# v2.01版 Falo x Force Cheng 2026/6/14
"""Application configuration for AI NotebookLM Runtime Lab.

This module is intentionally small: it removes hard-coded local paths and gives
the app one place to learn where local folders and commands are.
"""

from __future__ import annotations

import json
import os
import shutil
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any, Dict, Optional


@dataclass(frozen=True)
class AppConfig:
    project_root: Path
    source_dir: Path
    temp_dir: Path
    completed_dir: Path
    failed_dir: Path
    notebooklm_command: str

    @classmethod
    def default(cls, project_root: Path) -> "AppConfig":
        root = project_root.resolve()
        local_notebooklm_candidates = [
            root / ".venv" / "Scripts" / "notebooklm.exe",
            root / ".venv" / "bin" / "notebooklm",
            root.parent / ".venv" / "Scripts" / "notebooklm.exe",
            root.parent / ".venv" / "bin" / "notebooklm",
            root / ".venv-nlm" / "Scripts" / "notebooklm.exe",
            root / ".venv-nlm" / "bin" / "notebooklm",
            root.parent / ".venv-nlm" / "Scripts" / "notebooklm.exe",
            root.parent / ".venv-nlm" / "bin" / "notebooklm",
        ]
        local_notebooklm = next((path for path in local_notebooklm_candidates if path.exists()), None)
        notebooklm = (
            os.environ.get("NOTEBOOKLM_COMMAND")
            or (str(local_notebooklm) if local_notebooklm else None)
            or shutil.which("notebooklm")
            or shutil.which("nlm")
            or "notebooklm"
        )
        return cls(
            project_root=root,
            source_dir=root / "data" / "inbox",
            temp_dir=root / "data" / "temp",
            completed_dir=root / "data" / "completed",
            failed_dir=root / "data" / "failed",
            notebooklm_command=notebooklm,
        )

    @classmethod
    def from_dict(cls, project_root: Path, data: Dict[str, Any]) -> "AppConfig":
        default = cls.default(project_root)
        
        source_dir_val = data.get("source_dir")
        temp_dir_val = data.get("temp_dir")
        completed_dir_val = data.get("completed_dir")
        failed_dir_val = data.get("failed_dir")
        notebooklm_command_val = data.get("notebooklm_command")
        
        # Cross-platform sanity check: if on Windows but config has unix paths, discard them
        if os.name == 'nt':
            if source_dir_val and source_dir_val.startswith("/"):
                source_dir_val = None
            if temp_dir_val and temp_dir_val.startswith("/"):
                temp_dir_val = None
            if completed_dir_val and completed_dir_val.startswith("/"):
                completed_dir_val = None
            if failed_dir_val and failed_dir_val.startswith("/"):
                failed_dir_val = None
            if notebooklm_command_val and notebooklm_command_val.startswith("/"):
                notebooklm_command_val = None

        return cls(
            project_root=project_root.resolve(),
            source_dir=_path_value(source_dir_val, default.source_dir),
            temp_dir=_path_value(temp_dir_val, default.temp_dir),
            completed_dir=_path_value(completed_dir_val, default.completed_dir),
            failed_dir=_path_value(failed_dir_val, default.failed_dir),
            notebooklm_command=str(notebooklm_command_val or default.notebooklm_command),
        )

    def to_json_dict(self) -> Dict[str, str]:
        data = asdict(self)
        return {key: str(value) for key, value in data.items() if key != "project_root"}


def _path_value(value: Optional[str], fallback: Path) -> Path:
    if not value:
        return fallback
    return Path(value).expanduser().resolve()


def load_or_create_config(project_root: Path, config_path: Optional[Path] = None) -> AppConfig:
    root = project_root.resolve()
    path = config_path or root / "config" / "config.json"
    path.parent.mkdir(parents=True, exist_ok=True)

    if path.exists():
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            data = {}
        config = AppConfig.from_dict(root, data)
    else:
        config = AppConfig.default(root)

    for folder in (config.source_dir, config.temp_dir, config.completed_dir, config.failed_dir):
        folder.mkdir(parents=True, exist_ok=True)

    path.write_text(
        json.dumps(config.to_json_dict(), ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    return config
