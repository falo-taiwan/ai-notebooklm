# v2.01版 Falo x Force Cheng 2026/6/14
"""輪詢 Google Sheet / GAS 雲端中控，並餵進本機 queue。

Falo x Force 教學註解：
這個 adapter 的核心觀念是「地端主動拉任務」，不是讓雲端打進 localhost。
這樣不用 ngrok，初學者也比較容易理解安全邊界：
雲端只負責發布任務；真正執行、下載、上傳 NotebookLM 的 runtime 留在本機。
"""

from __future__ import annotations

import argparse
import base64
import json
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Dict, Iterable, List, Tuple

from app_config import AppConfig, load_or_create_config
from runtime_server import (
    PROJECT_ROOT,
    command_filename,
    command_stage_dir,
    execute_command_queue,
    find_project,
    get_active_project,
    now_iso,
    parse_extensions,
    queue_command_packages,
    simple_evidence_dir,
    time_stamp,
    write_runtime_log,
)


DEFAULT_GAS_CONFIG = {
    "enabled": False,
    "auto_poll_enabled": False,
    "web_app_url": "https://script.google.com/macros/s/AKfycbw9X3Y6MQ2XpvsS9BXuCZeZsVkrbT1VL0JkDkotrbs-omYG8OpuWpAl1fowiJa_QW1i/exec",
    "api_token": "123456",
    "poll_interval_seconds": 600,
    "max_tasks_per_poll": 3,
    "auto_execute": False,
    "local_download_root": "data/gas_downloads",
    "default_file_types": [".pdf", ".md", ".csv", ".docx", ".xlsx", ".pptx", ".png", ".jpg", ".jpeg"],
    "default_duplicate_policy": "rename",
}


def gas_config_path(config: AppConfig) -> Path:
    return config.project_root / "config" / "gas_config.json"


def load_or_create_gas_config(config: AppConfig) -> Dict[str, object]:
    path = gas_config_path(config)
    path.parent.mkdir(parents=True, exist_ok=True)
    if path.exists():
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            data = {}
    else:
        data = {}
    merged = {**DEFAULT_GAS_CONFIG, **data}
    path.write_text(json.dumps(merged, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return merged


def _request_json(web_app_url: str, params: Dict[str, object], timeout: int = 60) -> Dict[str, object]:
    query = urllib.parse.urlencode({key: value for key, value in params.items() if value is not None})
    separator = "&" if "?" in web_app_url else "?"
    url = f"{web_app_url}{separator}{query}"
    request = urllib.request.Request(url, headers={"Accept": "application/json"})
    with urllib.request.urlopen(request, timeout=timeout) as response:
        payload = response.read().decode("utf-8")
    data = json.loads(payload)
    return data if isinstance(data, dict) else {"ok": False, "error": "GAS response is not an object"}


def _post_json(web_app_url: str, payload: Dict[str, object], timeout: int = 60) -> Dict[str, object]:
    body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    request = urllib.request.Request(
        web_app_url,
        data=body,
        method="POST",
        headers={"Content-Type": "application/json; charset=utf-8", "Accept": "application/json"},
    )
    with urllib.request.urlopen(request, timeout=timeout) as response:
        text = response.read().decode("utf-8")
    data = json.loads(text)
    return data if isinstance(data, dict) else {"ok": False, "error": "GAS response is not an object"}


def _safe_name(name: str, fallback: str) -> str:
    clean = Path(name or fallback).name
    return clean or fallback


def download_drive_files(
    config: AppConfig,
    gas_settings: Dict[str, object],
    task_id: str,
    files: Iterable[Dict[str, object]],
) -> Tuple[Path, List[Dict[str, object]]]:
    root = Path(str(gas_settings.get("local_download_root") or "data/gas_downloads")).expanduser()
    if not root.is_absolute():
        root = (config.project_root / root).resolve()
    target_dir = root / _safe_name(task_id, "task") / "incoming"
    target_dir.mkdir(parents=True, exist_ok=True)

    web_app_url = str(gas_settings.get("web_app_url") or "")
    token = str(gas_settings.get("api_token") or "")
    downloaded = []
    for item in files:
        file_id = str(item.get("file_id") or item.get("id") or "").strip()
        if not file_id:
            continue
        meta = _request_json(web_app_url, {"action": "download", "token": token, "file_id": file_id}, timeout=180)
        if not meta.get("ok"):
            raise RuntimeError(f"download failed for {file_id}: {meta.get('error', '')}")
        filename = _safe_name(str(meta.get("name") or item.get("name") or file_id), file_id)
        content = base64.b64decode(str(meta.get("content_base64") or ""))
        target = target_dir / filename
        if target.exists():
            stamp = time_stamp("%Y%m%d-%H%M%S")
            target = target.with_name(f"{target.stem}__dup_{stamp}{target.suffix}")
        target.write_bytes(content)
        downloaded.append(
            {
                "file_id": file_id,
                "name": filename,
                "path": str(target),
                "size_kb": round(target.stat().st_size / 1024, 1),
                "mime_type": meta.get("mime_type", ""),
            }
        )
    return target_dir, downloaded


def command_from_gas_task(config: AppConfig, gas_settings: Dict[str, object], task: Dict[str, object]) -> Dict[str, object]:
    task_id = str(task.get("task_id") or task.get("command_id") or "").strip()
    if not task_id:
        task_id = f"gas_task_{time_stamp('%Y%m%d_%H%M%S')}"
    cloud_project_id = str(task.get("project_id") or task.get("target_project_id") or "").strip()
    project_id = cloud_project_id
    if project_id and not find_project(config, project_id):
        active = get_active_project(config)
        active_project_id = str(active.get("active_project_id") or "")
        if active_project_id:
            project_id = active_project_id
    files = task.get("files", []) if isinstance(task.get("files", []), list) else []
    if not files and task.get("source_file_id"):
        files = [{"file_id": task.get("source_file_id"), "name": task.get("source_file_name", "")}]

    local_folder, downloaded = download_drive_files(config, gas_settings, task_id, files)
    file_types = parse_extensions(task.get("file_types", []) if isinstance(task.get("file_types", []), list) else [])
    if not file_types:
        file_types = list(gas_settings.get("default_file_types", DEFAULT_GAS_CONFIG["default_file_types"]))

    return {
        "app": "AI NotebookLM Runtime Lab",
        "kind": "command_package",
        "version": "0.1",
        "command_id": f"gas_{task_id}",
        "command_type": "upload_folder",
        "cloud_task_id": task_id,
        "trigger_source": str(task.get("trigger_source") or "unknown_gas_task"),
        "trigger_mode": str(task.get("trigger_mode") or ""),
        "cloud_event_type": str(task.get("cloud_event_type") or ""),
        "submitter": str(task.get("submitter") or "gas_user"),
        "role": str(task.get("role") or "document_manager"),
        "target_project_id": project_id,
        "source": {
            "type": "folder",
            "path": str(local_folder),
            "recursive": False,
            "file_types": file_types,
            "order": str(task.get("order") or "name"),
        },
        "options": {
            "duplicate_policy": str(task.get("duplicate_policy") or gas_settings.get("default_duplicate_policy") or "rename"),
            "copy_evidence": True,
            "evidence_root": str(task.get("evidence_root") or simple_evidence_dir(config)),
        },
        "execution": {
            "mode": "gas_poll",
            "requires_confirm": False,
        },
        "gas": {
            "task_id": task_id,
            "cloud_project_id": cloud_project_id,
            "local_project_fallback": project_id if project_id != cloud_project_id else "",
            "source_folder_key": task.get("source_folder_key", ""),
            "source_folder_id": task.get("source_folder_id", ""),
            "source_file_name": task.get("source_file_name", ""),
            "trigger_source": task.get("trigger_source", ""),
            "trigger_mode": task.get("trigger_mode", ""),
            "cloud_event_type": task.get("cloud_event_type", ""),
            "downloaded": downloaded,
        },
        "created_at": now_iso(),
    }


def write_command_to_inbox(config: AppConfig, command: Dict[str, object]) -> Path:
    target = command_stage_dir(config, "inbox") / command_filename(str(command.get("command_id", "")))
    target.write_text(json.dumps(command, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return target


def update_cloud_task(gas_settings: Dict[str, object], task_id: str, status: str, result: Dict[str, object]) -> Dict[str, object]:
    web_app_url = str(gas_settings.get("web_app_url") or "")
    token = str(gas_settings.get("api_token") or "")
    if not web_app_url or not task_id:
        return {"ok": False, "error": "web_app_url or task_id missing"}
    return _post_json(
        web_app_url,
        {
            "action": "update_task",
            "token": token,
            "task_id": task_id,
            "status": status,
            "result": result,
        },
    )


def test_gas_connection(config: AppConfig) -> Dict[str, object]:
    gas_settings = load_or_create_gas_config(config)
    web_app_url = str(gas_settings.get("web_app_url") or "").strip()
    if not web_app_url:
        return {"ok": False, "mode": "gas_test_connection", "error": "web_app_url is required"}
    token = str(gas_settings.get("api_token") or "")
    result = _request_json(web_app_url, {"action": "test_connection", "token": token}, timeout=60)
    if not result.get("ok") and "Unknown action: test_connection" in str(result.get("error", "")):
        # Falo x Force 教學註解：
        # 學員常會更新本機程式，但忘記重新部署 GAS Web App。
        # 舊版 GAS 沒有 test_connection，所以退回用 tasks 查詢驗證 token 與 URL 是否能通。
        fallback = _request_json(web_app_url, {"action": "tasks", "status": "queued", "limit": 1, "token": token}, timeout=60)
        result = {
            "ok": bool(fallback.get("ok")),
            "mode": "gas_test_connection",
            "compatibility_fallback": "tasks",
            "message": "GAS Web App is reachable, but deployed Code.gs is older and does not support action=test_connection. Please redeploy GAS when convenient.",
            "fallback_response": fallback,
        }
    write_runtime_log(config, "gas_test_connection", {"ok": result.get("ok", False), "error": result.get("error", "")})
    result["mode"] = "gas_test_connection"
    return result


def poll_gas_once(
    config: AppConfig,
    wake_context: Dict[str, object] | None = None,
    execute_override: bool | None = None,
) -> Dict[str, object]:
    # Falo x Force 教學註解：
    # 這是地端 worker 的一次「心跳」。
    # 它會向 GAS 詢問 queued tasks，下載 Drive 檔案，轉成本機 command package。
    # 是否馬上執行 NotebookLM upload，則交給 auto_execute 控制。
    wake_context = wake_context or {}
    poll_origin = str(wake_context.get("poll_origin") or "manual_or_local")
    gas_settings = load_or_create_gas_config(config)
    if not gas_settings.get("enabled"):
        return {"ok": False, "mode": "gas_poll_once", "error": "GAS polling is disabled in config/gas_config.json"}
    web_app_url = str(gas_settings.get("web_app_url") or "").strip()
    if not web_app_url:
        return {"ok": False, "mode": "gas_poll_once", "error": "web_app_url is required"}

    token = str(gas_settings.get("api_token") or "")
    limit = int(gas_settings.get("max_tasks_per_poll") or DEFAULT_GAS_CONFIG["max_tasks_per_poll"])
    response = _request_json(web_app_url, {"action": "tasks", "status": "queued", "limit": limit, "token": token})
    if not response.get("ok"):
        write_runtime_log(config, "gas_poll_failed", {"error": response.get("error", ""), "response": response})
        return {"ok": False, "mode": "gas_poll_once", "error": response.get("error", ""), "response": response}

    tasks = response.get("tasks", []) if isinstance(response.get("tasks", []), list) else []
    commands = []
    errors = []
    for task in tasks[:limit]:
        task_id = str(task.get("task_id") or "")
        try:
            update_cloud_task(
                gas_settings,
                task_id,
                "processing",
                {
                    "message": "Local worker accepted the task.",
                    "poll_origin": poll_origin,
                    "wake_context": wake_context,
                },
            )
            command = command_from_gas_task(config, gas_settings, task)
            path = write_command_to_inbox(config, command)
            commands.append({
                "task_id": task_id,
                "command_id": command.get("command_id", ""),
                "path": str(path),
                "trigger_source": command.get("trigger_source", ""),
                "trigger_mode": command.get("trigger_mode", ""),
                "cloud_event_type": command.get("cloud_event_type", ""),
            })
            update_cloud_task(
                gas_settings,
                task_id,
                "queued_local",
                {
                    "command_id": command.get("command_id", ""),
                    "path": str(path),
                    "poll_origin": poll_origin,
                    "wake_context": wake_context,
                },
            )
        except Exception as exc:
            errors.append({"task_id": task_id, "error": str(exc)})
            update_cloud_task(gas_settings, task_id, "failed", {"error": str(exc)})

    queued = queue_command_packages(config)
    failed_items = queued.get("failed", []) if isinstance(queued.get("failed", []), list) else []
    for failed in failed_items:
        failed_command_id = str(failed.get("command_id") or "")
        cloud_task_id = ""
        for command in commands:
            if command.get("command_id") == failed_command_id:
                cloud_task_id = str(command.get("task_id") or "")
                break
        if cloud_task_id:
            update_cloud_task(
                gas_settings,
                cloud_task_id,
                "failed",
                {"stage": "local_validation", "errors": failed.get("errors", [])},
            )
    should_execute = bool(gas_settings.get("auto_execute")) if execute_override is None else bool(execute_override)
    executed = {}
    if should_execute and commands:
        execution_results = []
        for command in commands:
            command_id = str(command.get("command_id") or "")
            if not command_id:
                continue
            item_result = execute_command_queue(config, command_id=command_id, limit=1)
            if isinstance(item_result.get("results", []), list):
                execution_results.extend(item_result.get("results", []))
        executed = {
            "ok": not any(not item.get("ok") for item in execution_results),
            "mode": "execute_created_gas_commands",
            "executed_count": len(execution_results),
            "results": execution_results,
        }
        for item in execution_results:
            result = item.get("result", {}) if isinstance(item.get("result", {}), dict) else {}
            cloud_task_id = ""
            # Finished command files include cloud_task_id in their JSON; use command_id fallback here.
            for command in commands:
                if command.get("command_id") == item.get("command_id"):
                    cloud_task_id = str(command.get("task_id") or "")
                    break
            if cloud_task_id:
                update_cloud_task(gas_settings, cloud_task_id, str(item.get("status") or "completed"), result or item)

    summary = {
        "ok": not errors and (not executed or bool(executed.get("ok", True))),
        "mode": "gas_poll_once",
        "poll_origin": poll_origin,
        "wake_context": wake_context,
        "execution_requested": should_execute,
        "execution_source": "request_override" if execute_override is not None else "local_auto_execute",
        "executed_count": executed.get("executed_count", 0) if isinstance(executed, dict) else 0,
        "task_count": len(tasks),
        "created_commands": commands,
        "errors": errors,
        "queued": queued,
        "executed": executed,
    }
    event_name = "gas_cloud_wake_pull" if poll_origin == "cloud_wake" else "gas_poll_once"
    write_runtime_log(config, event_name, summary)
    return summary



def detect_wan_url(port: int) -> str:
    import urllib.request
    import json
    # 1. Try to detect ngrok tunnel
    try:
        req = urllib.request.Request("http://127.0.0.1:4040/api/tunnels")
        with urllib.request.urlopen(req, timeout=2) as response:
            data = json.loads(response.read().decode('utf-8'))
            tunnels = data.get("tunnels", [])
            for t in tunnels:
                pub_url = t.get("public_url", "")
                if pub_url.startswith("https://") or pub_url.startswith("http://"):
                    return pub_url
    except Exception:
        pass

    # 2. Fallback to public WAN IP
    for service_url in ["https://api.ipify.org", "https://httpbin.org/ip"]:
        try:
            req = urllib.request.Request(service_url)
            with urllib.request.urlopen(req, timeout=2) as response:
                res_data = response.read().decode('utf-8').strip()
                if service_url.endswith("ip"):
                    try:
                        res_data = json.loads(res_data).get("origin", "").split(",")[0].strip()
                    except Exception:
                        pass
                if res_data and len(res_data.split(".")) == 4:
                    return f"http://{res_data}:{port}"
        except Exception:
            pass

    return ""


def push_host_info_to_gas(config: AppConfig, method: str = "scheduled") -> Dict[str, object]:
    import socket
    import platform
    from runtime_server import detect_lan_ip, RUNTIME_BIND_PORT
    
    gas_settings = load_or_create_gas_config(config)
    web_app_url = str(gas_settings.get("web_app_url") or "").strip()
    if not web_app_url:
        return {"ok": False, "error": "web_app_url is required"}
    token = str(gas_settings.get("api_token") or "")
    
    lan_ip = detect_lan_ip()
    port = RUNTIME_BIND_PORT
    lan_url = f"http://{lan_ip}:{port}"
    wan_url = detect_wan_url(port)
    hostname = socket.gethostname()
    
    payload = {
        "action": "update_host_info",
        "token": token,
        "lan_url": lan_url,
        "wan_url": wan_url,
        "hostname": hostname,
        "os_type": platform.system(),
        "report_method": method,
        "poll_interval_seconds": int(gas_settings.get("poll_interval_seconds") or 300),
        "local_time": time.strftime("%Y-%m-%d %H:%M:%S")
    }
    
    try:
        res = _post_json(web_app_url, payload, timeout=30)
        return res
    except Exception as exc:
        return {"ok": False, "error": str(exc)}


def poll_gas_loop(config: AppConfig) -> None:
    while True:
        settings = load_or_create_gas_config(config)
        interval = max(30, int(settings.get("poll_interval_seconds") or DEFAULT_GAS_CONFIG["poll_interval_seconds"]))
        started = time_stamp("%Y-%m-%d %H:%M:%S")
        try:
            result = poll_gas_once(config)
            print(f"[{started}] gas poll: ok={result.get('ok')} tasks={result.get('task_count', 0)}")
        except (urllib.error.URLError, TimeoutError, RuntimeError, ValueError, json.JSONDecodeError) as exc:
            write_runtime_log(config, "gas_poll_loop_error", {"error": str(exc)})
            print(f"[{started}] gas poll error: {exc}")
        time.sleep(interval)


def main() -> None:
    parser = argparse.ArgumentParser(description="Poll Google Sheet / GAS tasks into the local NotebookLM runtime queue.")
    parser.add_argument("--once", action="store_true", help="Run one polling cycle.")
    parser.add_argument("--loop", action="store_true", help="Poll forever using config/gas_config.json interval.")
    args = parser.parse_args()

    config = load_or_create_config(PROJECT_ROOT)
    # Ensure config file exists and show the user where to edit it.
    settings = load_or_create_gas_config(config)
    if not args.once and not args.loop:
        print(json.dumps({"gas_config_path": str(gas_config_path(config)), "settings": settings}, ensure_ascii=False, indent=2))
        return
    if args.loop:
        poll_gas_loop(config)
    else:
        print(json.dumps(poll_gas_once(config), ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
