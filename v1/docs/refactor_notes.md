# AI NotebookLM Runtime Lab v1.01

這份文件是公開版改版筆記。它保留可教學的架構精神，但移除明確私人資訊，例如真實人名、帳號、本機絕對路徑、Notebook ID、登入狀態與實際資料。

## 1. 專案定位

這個 MVP 的目標不是只做一個「上傳按鈕」，而是示範 NotebookLM 前面應該有一層可治理的 Runtime / ETL layer。

直覺比喻：NotebookLM 像知識庫目的地；Runtime 像 AI 印表機。使用者把檔案或任務丟進來，Runtime 先檢查、排隊、轉格式、留紀錄，再送到指定 NotebookLM。

## 2. 架構層次

| Layer | 說明 |
|---|---|
| Portal | HTML UI，讓非工程使用者能選專案、選檔案、看結果。 |
| Runtime | Python service，負責掃描、queue、執行、log 與 adapter。 |
| ETL | Excel / CSV normalize、metadata 注入、資料分片與治理。 |
| Project | NotebookLM 專案清單、搜尋、排序、分頁、選取與新增。 |
| Governance | audit log、error log、evidence copy、匯入匯出與清儲。 |
| Command Package | 本機 JSON 指令包；未來可接 API、GAS、遠端主機。 |

## 3. Tab 設計

### Tab 1：Simple Upload

主入口。使用者只需要：

1. 選 NotebookLM project。
2. 選檔案或指定掃描資料夾。
3. 選擇重名策略：改名、跳過、取代或仍然上傳。
4. 執行上傳並查看結果。

治理原則：只要檔案真的送往 NotebookLM，就先複製一份到 evidence folder，保留追蹤線索。

### Tab 2：Excel / CSV ETL

這是進階入口。Excel 轉 CSV、欄位整理、semantic CSV、metadata/tag 注入都放在這裡，避免主入口變複雜。

### Tab 3：Project Manager

NotebookLM 專案管理 MVP：

- 必要時 sync NotebookLM list。
- 可以新增 project。
- 支援即時搜尋。
- 點欄位排序。
- 分頁大小可選。
- 選取 project 後回寫到 Simple Upload 的設定。

### Tab 4：Logs / Governance

保留 audit、error、runtime state、匯出與清儲。這一層讓系統不只是「有沒有成功」，而是知道誰做了什麼、處理了哪些檔案、結果如何。

### Tab 5：Command Queue

本機指令包 queue。適合教學與 dev：

- inbox：接收新 JSON 指令包。
- queued：驗證後等待執行。
- processing：執行中。
- completed / failed：結果歸檔。
- archived：人工或自動封存。

未來 API、GAS、遠端主機都可以把任務轉成同一種 JSON。

## 4. 指令包範例

```json
{
  "version": "1.0",
  "app": "AI NotebookLM Runtime Lab",
  "command_id": "cmd_upload_folder_demo",
  "type": "upload_folder",
  "submitter": "example_user",
  "role": "document_manager",
  "target_project_id": "REPLACE_WITH_PROJECT_ID",
  "source": {
    "mode": "folder",
    "path": "data/source_pool/simple_upload/incoming",
    "recursive": false,
    "allowed_extensions": [".pdf", ".txt", ".md", ".docx", ".csv", ".xlsx"]
  },
  "upload": {
    "duplicate_policy": "rename",
    "evidence_root": "data/source_pool/simple_upload/evidence"
  }
}
```

## 5. 角色 MVP

| Role | 說明 |
|---|---|
| user | 一般使用者：建立自己的上傳任務、查看狀態。 |
| document_manager | 文件管理者：管理 project、整理檔案、執行上傳與 ETL。 |
| admin | 管理 runtime 設定、清儲、log、權限與全部任務。 |

## 6. 公開版去識別化規則

公開版保留架構，不保留私密狀態：

- 不放真實 Notebook ID。
- 不放本機絕對路徑。
- 不放登入 cookie 或 auth state。
- 不放客戶、學生、公司內部資料。
- 不放特定個人交接稱謂。
- 範例一律使用 placeholder。

## 7. 下一步

1. 先把 Simple Upload 做成最穩的主入口。
2. 再把 ETL 放在進階 tab，保持 UI 單純。
3. Command Queue 先本機運作，之後接 API / GAS / 遠端主機。
4. Logs / Governance 持續保留，避免系統變成黑盒。


---
© 2026 Falo x Force Cheng 2026/6/15. All rights reserved.