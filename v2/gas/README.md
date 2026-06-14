# Google Sheet / GAS Command Center MVP

Falo x Force Teaching Runtime

這個資料夾提供最小雲平台版本。它不需要 ngrok，也不需要讓雲端打進本機。

流程是：

```text
Google Sheet / GAS 建任務
-> 本機 Python worker 每 N 秒主動 polling
-> GAS 用 DriveApp 讀 Google Drive file/folder
-> 本機下載成暫存檔
-> 轉成本機 command package
-> 本機 runtime 上傳 NotebookLM
-> 回寫 Sheet 任務狀態
```

## Sheet 結構

`setupSheet()` 會建立：

- `Settings`：API token、建議 polling 秒數。
- `Users`：三種身份，密碼先都是 `666666`。
- `Projects`：NotebookLM project 對照。
- `Folders`：所有 Google Drive folder id 都在這裡動態指定。
- `Tasks`：任務 queue。
- `Runtime_Log`：雲端 log。

## 身份 MVP

| Role | 用途 |
|---|---|
| `user` | 建立自己的上傳任務。 |
| `document_manager` | 管理文件與上傳任務。 |
| `admin` | 管理設定、資料夾、任務與 log。 |

預設密碼全部是：

```text
666666
```

這是教學與開發用，正式使用前要換成更安全的機制。

## 部署步驟

1. 建一個 Google Sheet。
2. 開 Apps Script。
3. 把 `gas/Code.gs` 貼到 Apps Script。
4. 執行 `setupSheet()`。
5. 到 `Folders` 表填入各種 `google_drive_folder_id`。
6. 到 `Projects` 表填入 NotebookLM 對應的 `notebook_id`。
7. Deploy as Web App。
8. 把 Web App URL 填到本機 `config/gas_config.json`。

## 建立測試資料

執行 GAS function：

```js
createSampleMarkdownTask()
```

它會在 `Folders.incoming` 指定的 Google Drive folder 建立：

```text
gas-sample-YYYYMMDD-HHmmss.md
```

檔案內容與檔名相同。這樣測試 NotebookLM 上傳時，可以直接用檔名與內容互相驗證。

## 本機設定

先產生設定檔：

```bash
python3 gas_adapter.py
```

編輯：

```text
config/gas_config.json
```

最小設定：

```json
{
  "enabled": true,
  "web_app_url": "PASTE_GAS_WEB_APP_URL",
  "api_token": "CHANGE_ME_LOCAL_TOKEN",
  "poll_interval_seconds": 30,
  "max_tasks_per_poll": 5,
  "auto_execute": false
}
```

手動抓一次：

```bash
python3 gas_adapter.py --once
```

依設定秒數自動抓：

```bash
python3 gas_adapter.py --loop
```

或直接打開本機 Portal：

```bash
python3 runtime_server.py
```

再到 `Tab 6 GAS Cloud` 設定：

- GAS Web App URL
- API token
- polling 秒數
- 每次最多抓幾個 task
- 是否自動 poll
- 是否抓到後自動執行

## Cloud Heartbeat 定期測試

GAS Web App 內建 `Cloud Heartbeat`。它的用途是教學與健康檢查：

```text
Apps Script trigger
-> 定期建立 timestamp .md
-> 寫入 Tasks queued
-> 本機 runtime 下次 polling 時抓走
-> 上傳 NotebookLM
-> 回寫 completed / failed
```

可在 GAS Web App 介面用 token 操作：

- `Use Default Token`：教學時一鍵帶入 `CHANGE_ME_LOCAL_TOKEN`，避免學員卡在 token 欄位；正式使用時請改 `Settings.api_token`。
- `Install 5 min Heartbeat`
- `Install 15 min Heartbeat`
- `Run Heartbeat Now`：立刻執行 `scheduledHealthCheck()`，用來測定時器 handler 本身，不同於 Simulation Test 的手動建檔路徑。
- `List Heartbeat Triggers`
- `Stop Heartbeat`

`Cloud Heartbeat` 支援設定時間區間：

- `Start` / `End` 使用 `datetime-local`，粒度到分鐘。
- `Use 1 Hour Window` 只會把「現在起算 1 小時」帶入欄位，不會保存設定。
- 按下 `Install 5 min Heartbeat` 或 `Install 15 min Heartbeat` 時，才會把時間窗寫進 `Settings` sheet，並安裝 trigger。
- trigger 若在時間窗外觸發，會寫入 `Runtime_Log`，但不建立測試任務。
- 注意：Google Sheet 可能會把時間字串自動轉成日期。程式會在讀取時重新轉成 `yyyy-MM-ddTHH:mm`，寫入時也會把 `Settings.value` 設成純文字，避免時間被吃掉。

程式碼對應函式：

```js
scheduledHealthCheck()
uiRunHealthCheckNow(token)
installHealthCheckTrigger(minutes, windowStart, windowEnd)
removeHealthCheckTriggers()
listHealthCheckTriggers()
```

教學時可以這樣解釋：Cloud Heartbeat 不是正式排程中心，而是一個「定期丟測試球」的健康檢查。只要 NotebookLM 最後出現同一個 timestamp `.md`，就代表 GAS、Sheet、Drive、本機 worker、NotebookLM adapter 這條鏈基本可用。

### Apps Script 權限提醒

Cloud Heartbeat / Cloud Folder Scanner 會管理 Apps Script trigger，因此 `appsscript.json` 必須包含：

```text
https://www.googleapis.com/auth/script.scriptapp
https://www.googleapis.com/auth/spreadsheets
```

如果學員看到「沒有呼叫 ScriptApp.getProjectTriggers 的權限」，通常不是 token 錯，而是：

1. `appsscript.json` 沒有加 `script.scriptapp` scope。
2. 新增 scope 後還沒有在 Apps Script 編輯器重新授權。
3. Web App 沒有重新部署新版。

本專案提供範本：`gas/appsscript.json`。

## Cloud Logs / Closed Loop

GAS Web App 內建 `Cloud Logs / Closed Loop`：

- `List Logs`：查 `Runtime_Log`，可用 event / actor / keyword 篩選。
- `Clear Logs Only`：只清 `Runtime_Log`，不清 `Tasks` 與 `Drive_File_State`。
- `Export JSON`：匯出 `Settings / Users / Projects / Folders / Tasks / Drive_File_State / Runtime_Log`。
- `Export Excel / Sheet`：建立一份新的 Google Spreadsheet，作為 Excel 工作簿式交接。
- `Import JSON Full Cover`：用匯出的 JSON 覆蓋同名 sheet。
- `Import Spreadsheet Full Cover`：用 Spreadsheet ID 覆蓋同名 sheet。

三種雲端入口都會寫入來源欄位：

| trigger_source | trigger_mode | cloud_event_type |
|---|---|---|
| `simulation_test` | `manual` | `create_sample_markdown_task` |
| `cloud_heartbeat` | `manual` / `scheduled` | `run_health_check_now` / `scheduled_health_check` |
| `cloud_folder_scanner` | `manual` / `scheduled` | `scan_incoming_folder` / `scheduled_incoming_folder_scan` |

## Cloud Folder Scanner 定期掃描

`Cloud Folder Scanner` 是「雲端資料夾 -> queued task」的教學版。它會掃描 `Folders.incoming` 指定的 Google Drive folder，新的 `file_id` 會寫入 `Drive_File_State`，並建立 `Tasks.queued`。

紅字教學提醒：未完成前不要刪除雲端 incoming 檔案。防重複靠 Google Drive `file_id` 與 `Drive_File_State`，不是靠檔名；但本機 worker 在真正上傳 NotebookLM 前仍需要原始檔案可被 Drive 下載。若 task 還在 `queued` / `queued_local` / `processing` 就刪除或權限改掉，本機會下載失敗。`completed` 後再手動搬移到 archive 或刪除較安全。

它和 `Cloud Heartbeat` 一樣支援時間區間：

- `Use 1 Hour Window` 只帶入欄位。
- `Install 5 min Scanner` / `Install 15 min Scanner` 才保存 scanner 的時間窗。
- `Stop Scanner` 會停止 Apps Script trigger；語意上用 Stop，比 Remove 更適合給非工程背景使用者理解。

## MVP 邊界

- GAS 不直接操作 NotebookLM。
- 本機不需要公開 localhost。
- Drive file 由 GAS 轉成 base64 回給本機 worker。
- 本機仍然是唯一真正執行 NotebookLM CLI 的 runtime。
- 這版先重視可教、可測、可追蹤，不先做完整登入 session。


---
© 2026 Falo x Force Cheng 2026/6/15. All rights reserved.