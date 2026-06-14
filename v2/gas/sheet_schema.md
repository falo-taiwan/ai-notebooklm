# Sheet Schema

Falo x Force Teaching Runtime

## Settings

| 欄位 | 說明 |
|---|---|
| `key` | 設定鍵，例如 `api_token`。 |
| `value` | 設定值。 |
| `note` | 給人的說明。 |

常用 key：

| key | 說明 |
|---|---|
| `api_token` | 本機 runtime / GAS Web App UI 使用的最小驗證 token。 |
| `default_poll_seconds` | 建議本機 polling 秒數；實際秒數仍以本機 `config/gas_config.json` 為準。 |
| `heartbeat_window_start` | Cloud Heartbeat 可執行時間窗起點，格式為 `yyyy-MM-ddTHH:mm`，粒度到分鐘。 |
| `heartbeat_window_end` | Cloud Heartbeat 可執行時間窗終點，格式為 `yyyy-MM-ddTHH:mm`，粒度到分鐘。 |
| `scanner_window_start` | Cloud Folder Scanner 可執行時間窗起點，格式為 `yyyy-MM-ddTHH:mm`，粒度到分鐘。 |
| `scanner_window_end` | Cloud Folder Scanner 可執行時間窗終點，格式為 `yyyy-MM-ddTHH:mm`，粒度到分鐘。 |

教學預設 token 是 `CHANGE_ME_LOCAL_TOKEN`。GAS Web App 介面提供 `Use Default Token` 按鈕，可一鍵填入，避免學員一開始卡在 token 欄位。正式部署時請改 `Settings.api_token`，並同步更新本機 `config/gas_config.json`。

排程時間窗的教學語意：

- `Use 1 Hour Window` 只是把時間欄位帶入「現在到 1 小時後」。
- 按下 `Install Heartbeat` 或 `Install Scanner` 才會真正保存到 `Settings`。
- `Stop Heartbeat` / `Stop Scanner` 只停止 trigger，不會刪除歷史 task 或 log。
- Google Sheet 可能自動把時間字串轉成 Date 物件；程式會讀寫時統一成 `yyyy-MM-ddTHH:mm`，並把 `Settings.value` 用純文字保存。

## Users

| 欄位 | 說明 |
|---|---|
| `user_id` | 使用者代號。 |
| `display_name` | 顯示名稱。 |
| `role` | `user` / `document_manager` / `admin`。 |
| `password` | MVP 預設 `666666`。 |
| `active` | 是否啟用。 |

## Projects

| 欄位 | 說明 |
|---|---|
| `project_id` | 本系統使用的 project key，需與本機 `config/projects.json` 對得上。 |
| `project_name` | 給人看的專案名稱。 |
| `notebook_id` | NotebookLM notebook id。 |
| `active` | 是否啟用。 |
| `note` | 備註。 |

## Folders

| 欄位 | 說明 |
|---|---|
| `folder_key` | `incoming` / `processing` / `archive` / `error` / `evidence`。 |
| `folder_name` | 給人看的名稱。 |
| `google_drive_folder_id` | Google Drive folder id，全部可動態指定。 |
| `purpose` | 用途。 |
| `active` | 是否啟用。 |

## Tasks

| 欄位 | 說明 |
|---|---|
| `task_id` | 任務 ID。 |
| `created_at` | 建立時間。 |
| `updated_at` | 更新時間。 |
| `submitter` | 提交者。 |
| `role` | 提交者身份。 |
| `project_id` | 目標 project。 |
| `source_folder_key` | 來源 folder key。 |
| `source_file_id` | 單一 Drive file id；若空白，可由 folder 掃描。 |
| `action` | `upload_drive_file` 或 `upload_drive_folder`。 |
| `status` | `queued` / `processing` / `queued_local` / `completed` / `failed`。 |
| `duplicate_policy` | `rename` / `skip` / `replace` / `upload_anyway`。 |
| `file_types` | 例如 `.md,.pdf,.csv,.docx,.xlsx`。 |
| `trigger_source` | 任務來源：`simulation_test` / `cloud_heartbeat` / `cloud_folder_scanner` / `manual_task`。 |
| `trigger_mode` | 觸發模式：`manual` / `scheduled`。 |
| `cloud_event_type` | 雲端事件類型，例如 `scheduled_health_check`、`scan_incoming_folder`。 |
| `source_file_name` | Drive 來源檔名，讓本機 command / log 更容易辨識。 |
| `result` | 本機 worker 回寫結果 JSON。 |
| `error` | 錯誤訊息。 |

## Runtime_Log

| 欄位 | 說明 |
|---|---|
| `log_id` | log ID。 |
| `timestamp` | 時間。 |
| `task_id` | 關聯任務。 |
| `actor` | 操作者或 worker。 |
| `event_type` | 事件類型。 |
| `message` | 人看的訊息。 |
| `detail_json` | 細節 JSON。 |

GAS Web App 的 `Cloud Logs / Closed Loop` 可列出、清除、匯出、匯入 log 與工作簿資料。`Clear Logs Only` 只清 `Runtime_Log`，不會刪除 `Tasks` 或 `Drive_File_State`。

閉環匯出包含：

- `Settings`
- `Users`
- `Projects`
- `Folders`
- `Tasks`
- `Drive_File_State`
- `Runtime_Log`

`Export Excel / Sheet` 會建立新的 Google Spreadsheet；因此 `appsscript.json` 需要 `https://www.googleapis.com/auth/spreadsheets`。

## Cloud Heartbeat Trigger

Cloud Heartbeat 不需要額外 sheet。它使用 Apps Script trigger 呼叫：

```js
scheduledHealthCheck()
```

每次觸發時會：

1. 在 `Folders.incoming` 指定的 Drive folder 建立 timestamp `.md`。
2. 在 `Tasks` 新增一筆 `queued` 任務。
3. 在 `Runtime_Log` 寫入 `scheduled_health_check`。

這是教學與健康檢查用，讓學生能清楚看到「雲端自動產生任務，本機主動抓任務」的完整鏈路。

若設定了 `heartbeat_window_start` / `heartbeat_window_end`，trigger 在時間窗外仍可能被 Apps Script 呼叫，但 `scheduledHealthCheck()` 會寫入 skipped log，不會建立測試任務。

## Cloud Folder Scanner Trigger

Cloud Folder Scanner 使用 Apps Script trigger 呼叫：

```js
scheduledIncomingFolderScan()
```

每次觸發時會：

1. 掃描 `Folders.incoming` 指定的 Drive folder。
2. 檢查 `Drive_File_State`，避免同一個 `file_id` 重複建立 task。
3. 新檔案會變成 `Tasks.queued`，等待本機 worker 主動 polling。

紅字教學提醒：未完成前不要刪除雲端 incoming 檔案。系統用 Google Drive `file_id` 防重複，但本機 worker 仍需要原始檔案才能下載與上傳；若 task 還在 `queued` / `queued_local` / `processing` 就刪除，會造成後續處理失敗。`completed` 後再手動搬移或刪除較安全。

若設定了 `scanner_window_start` / `scanner_window_end`，trigger 在時間窗外只會留下 skipped log。


---
© 2026 Falo x Force Cheng 2026/6/15. All rights reserved.