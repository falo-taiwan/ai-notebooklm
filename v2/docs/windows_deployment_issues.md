# 💻 Windows 環境部署挑戰與排除日誌 (V2.20)

本文件詳細記載了將 **AI NotebookLM v2** 整合地端伺服器移植至 Windows 系統時所遭遇的 6 項核心挑戰與解決方案。

> [!NOTE]
> **🎉 最新狀態**：以下所列的所有問題與程式碼修正，均已在 **v3.01** 版本中被 AI 助理預設修改完成。新環境部署時無需手動修改程式碼。

---

## 🛠️ Windows 本機環境脈絡
- **OS**: Windows 11 AMD64
- **預設根目錄**: `c:\AAA-Antigravity\ai-notebooklm`
- **Python 版本**: 3.12+
- **虛擬環境**: `.venv` (位於專案根目錄)
- **預設埠口**: `8765`

---

## 📂 核心挑戰與排錯日誌

| # | 遭遇問題 | 影響元件 | 根本原因 (Root Cause) | v3.01 自動修復與防呆機制 (Code Fix) |
|---|---|---|---|---|
| **1** | `PermissionError` 路徑建立失敗 | `app_config.py` / `config.json` | 原始設定檔中硬編碼了 macOS 絕對路徑（`/Users/force/...`），Windows 執行時嘗試建立該路徑而發生權限崩潰。 | **自動跨平台路徑防呆**：在 `app_config.py` 中加入了 `os.name == 'nt'` 判定，若在 Windows 執行時偵測到 Unix/macOS 路徑，會自動忽略並依本機實體路徑重新生成 `config.json`。 |
| **2** | Port `8765` 衝突無法自動關閉舊行程 | `falo_launcher.py` / `runtime_server.py` | 啟動器藉由請求 `/api/status` 取得舊行程 PID，但該 API 預設需要登入驗證（HTTP 401），未登入時會拋出異常中斷導致無法獲取 PID。 | **免驗證狀態放行**：修改 `runtime_server.py` 中的 `do_GET`，放行免驗證對 `/api/status` 的 GET 請求。啟動器重啟時能正常取得 PID 並自動、乾淨地殺死舊行程。 |
| **3** | 控制台字型編碼異常導致提問崩潰 | `ask_helper.py` & `gemini_helper.py` | `print(json.dumps(..., ensure_ascii=False))` 輸出原生中文字元。在 Windows 中，終端機預設編碼（`cp1252`/`cp950`）無法對映中文字元而崩潰。 | **強制 UTF-8 輸出流**：在 `ask_helper.py` 與 `gemini_helper.py` 開頭加入 `sys.stdout.reconfigure(encoding='utf-8')`；並在 `runtime_server.py` 的 `subprocess.run` 中指定 `encoding="utf-8"` 解碼。 |
| **4** | Gemini 提問遺失 `orjson` 依賴庫 | `requirements.txt` / `gemini_helper` | `gemini_helper.py` 所調用的 `gemini_webapi` 模組依賴高效能 JSON 庫 `orjson`，但原始 requirements 中遺漏了此套件。 | **依賴庫補齊**：已將 `orjson` 正式加入 `v2/requirements.txt`。 |
| **5** | CLI 登入程式無聲閃退 | `notebooklm login --fresh` | 虛擬環境中雖安裝了 `playwright`，但尚未下載 Chromium 瀏覽器的實體二進位檔案。 | **手動安裝指令**：於部署指南中補上執行 `.venv\Scripts\playwright install chromium` 的步驟說明。 |
| **6** | ngrok 穿透 Port 對接錯誤 (8012) | `ngrok.exe` | ngrok 本地代理被配置轉發至 `8888`，而 Python 伺服器卻運行在 `8765`，導致連線被拒。 | **強制佔用清除**：在 `falo_launcher.py` 中新增 `get_any_process_on_port` 機制，若 Port 8765 被佔用，自動透過 `netstat -aon` 找出 PID 並強制終止，確保 Port 8765 必定可用且與 ngrok 對齊。 |

---

## ⚡ 備份與一鍵啟動說明 (`FALO_Runtime.bat`)
本專案已在 `v2/` 目錄下為您配置好 [FALO_Runtime.bat](file:///v2/FALO_Runtime.bat) 一鍵啟動批次檔：
- 自動進行環境與 Port 衝突管理。
- 在獨立的 cmd 背景視窗啟動地端 Python 伺服器。
- 自動以 `curl` 偵測 `/api/status` 就緒狀態。
- 伺服器就緒後，自動彈出預設瀏覽器開啟本地控制台網頁。

---

© 2026 AI NotebookLM Windows Deployment Documentation.
