# AI NotebookLM Runtime Lab

這是一個教學型 MVP，示範如何把 NotebookLM 上傳流程從「個人腳本」整理成可操作、可觀察、可治理的 local-first runtime。

公開版重點放在架構與方法，不放真實帳號、Notebook ID、cookie、本機絕對路徑或實際資料。

## Public Page

- GitHub Pages: <https://falo-taiwan.github.io/ai-notebooklm/>
- Refactor Notes: <https://falo-taiwan.github.io/ai-notebooklm/docs/refactor_notes.html>
- Student Guide: <https://falo-taiwan.github.io/ai-notebooklm/docs/student_guide.html>
- Command Package Example: <https://falo-taiwan.github.io/ai-notebooklm/examples/sample_command_package_upload_folder.json>

## 核心概念

- HTML portal 是操作入口，不是核心。
- Python runtime 負責掃描、排隊、執行、紀錄與 adapter 呼叫。
- NotebookLM 前面的 ETL layer 才是可治理、可擴充的價值點。
- JSON / CSV / Excel 可以作為 AI-native 的中介資料格式。
- Command package 先在本機 queue 驗證，未來可接 API、GAS 或遠端主機。

## MVP 功能

- Simple Upload：選 NotebookLM project，選檔案或掃描資料夾後上傳。
- ETL Upload：Excel 轉 CSV、normalize、再上傳。
- Project Manager：專案搜尋、排序、分頁、選取與新增。
- Logs / Governance：操作 log、錯誤 log、runtime 狀態與匯出。
- Command Queue：用 JSON 指令包模擬多人派工與自動執行。

## 本機啟動

```bash
python3 runtime_server.py
```

或在 macOS 使用專案提供的一鍵啟動檔。

## 公開版邊界

這個 repo 適合公開展示 runtime / ETL / governance 的設計思路。正式部署時請另外管理：

- NotebookLM 登入狀態與 cookies
- 真實 project / notebook id
- 本機資料路徑
- 客戶、學生或組織資料
- 上傳紀錄與 evidence copy

## 文件

- `index.html`：GitHub Pages 用的單檔專案簡介。
- `docs/refactor_notes.md`：架構與改版筆記。
- `docs/refactor_notes.html`：人看的 HTML 版筆記。
- `examples/sample_command_package_upload_folder.json`：去識別化指令包範例。
