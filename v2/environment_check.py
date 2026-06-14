# v2.01版 Falo x Force Cheng 2026/6/14
"""Local environment checks for the AI NotebookLM Runtime Lab local lab."""

from __future__ import annotations

import os
import shutil
from pathlib import Path
from typing import Dict

from app_config import AppConfig


def check_environment(config: AppConfig) -> Dict[str, Dict[str, str]]:
    return {
        "source_dir": _folder_check(config.source_dir, "來源資料夾"),
        "temp_dir": _folder_check(config.temp_dir, "暫存資料夾"),
        "completed_dir": _folder_check(config.completed_dir, "完成資料夾"),
        "failed_dir": _folder_check(config.failed_dir, "失敗資料夾"),
        "notebooklm": _command_check(config.notebooklm_command),
    }


def _folder_check(path: Path, label: str) -> Dict[str, str]:
    exists = path.exists()
    is_dir = path.is_dir()
    writable = os.access(path, os.W_OK) if exists else False
    ok = exists and is_dir and writable
    if ok:
        message = f"{label}可使用"
    elif not exists:
        message = f"{label}不存在"
    elif not is_dir:
        message = f"{label}不是資料夾"
    else:
        message = f"{label}不可寫入"
    return {"ok": ok, "path": str(path), "message": message}


def _command_check(command: str) -> Dict[str, str]:
    resolved = shutil.which(command) if command else None
    if resolved:
        return {
            "ok": True,
            "path": resolved,
            "message": "找到 NotebookLM CLI 指令",
        }
    return {
        "ok": False,
        "path": command or "",
        "message": "找不到 NotebookLM CLI；目前可啟動工具，但不能真的上傳到 NotebookLM",
    }


if __name__ == "__main__":
    from app_config import load_or_create_config
    status = check_environment(load_or_create_config(Path(__file__).resolve().parent))
    print("=================================")
    print("       Environment Check         ")
    print("=================================")
    all_ok = True
    for key, item in status.items():
        mark = "[OK]" if item["ok"] else "[FAIL]"
        print(f"{mark} {key}: {item['message']}")
        print(f"       Path: {item['path']}")
        if not item["ok"] and key != "notebooklm":
            # We don't fail immediately on notebooklm missing for simple portal demo, but other directories are critical
            all_ok = False
    print("=================================")
    if not all_ok:
        import sys
        sys.exit(1)
