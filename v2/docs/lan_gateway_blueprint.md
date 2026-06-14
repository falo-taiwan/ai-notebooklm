# AI NotebookLM 區網共享與治理網關設計藍圖 (LAN Gateway & Governance Blueprint)

本文件定義了 AI NotebookLM 專區的未來核心架構，旨在將地端 Python Runtime 建設為**「企業區網共享與 AI 治理網關 (LAN Gateway & AI Governance Layer)」**。

---

## 1. 核心願景 (Core Vision)
讓區網 (LAN) 內的同仁在**無須各自登入 NotebookLM、無須配置個人 Cookie/API Token** 的前提下，透過統一且受控的介面（HTML Portal / GAS 試算表），共享託管於伺服器端的**「公司最強帳號」**與統一的知識庫資料，並確保所有中間過程皆可被記錄、稽核與優化。

```
  [ 區網同仁 (LAN Users) ]
      │      │
      │(GAS) │(HTML Portal)
      ▼      ▼
┌──────────────────────────────────────────────┐
│        地端 Python Runtime 治理網關          │
│  - 任務排隊與分發 (Command Queue)            │
│  - 雙向 AI 協助 (Pre & Post ETL)             │
│  - 身分與行為審計 (Audit Logs & Evidence)    │
└──────────────────────────────────────────────┘
      │
      │ (使用託管之「最強帳號」Cookie/Session)
      ▼
┌──────────────────────────────────────────────┐
│         NotebookLM 雲端知識庫                │
└──────────────────────────────────────────────┘
```

---

## 2. 系統架構設計 (System Architecture)

### 2.1 雙端輸入介面 (Dual-Interface Entry)
1. **地端 HTML Portal (區網 Web 入口)**:
   - 伺服器綁定 `0.0.0.0:8765` 開放區網存取。
   - 同仁在瀏覽器輸入 `http://[伺服器IP]:8765` 進入操作面板。
   - 介面增加「使用者/部門」選擇或輸入框（身分識別）。
2. **GAS / Google Sheets (雲端任務中控)**:
   - 雲端共享試算表作為任務看板，同仁填寫任務、上傳檔案至指定 Drive 資料夾。
   - 地端 Runtime 透過 API/Polling 定期拉取任務，處理完畢後回寫結果至試算表。

### 2.2 帳號託管與 CLI 執行
- 伺服器端 `.venv` 內安裝 `notebooklm-py` 庫，並透過 `notebooklm login` 完成「最強帳號」授權。
- 伺服器統一執行 `notebooklm source add`、`notebooklm ask` 等指令，對同仁屏蔽底層驗證細節。

---

## 3. 治理與安全機制 (Governance & Security)

### 3.1 過程留痕 (Audit Trail)
- **身分識別 (Who)**: 每次請求均強制要求附帶 `submitter` 參數。
- **行為記錄 (What)**: 審計日誌 (`logs/runtime.jsonl` 與資料庫) 記錄：
  - 任務送出者 (Submitter)
  - 來源 IP 地址
  - 操作類型 (上傳 / 提問 / 生成)
  - 處理之檔案名稱與雜湊值 (Hash)
  - 目標 Notebook 專案 ID 與名稱
  - 執行結果與狀態碼
- **證據存檔 (Evidence Copy)**: 只要檔案被送往 NotebookLM，地端即自動備份一份至 `data/evidence/[submitter]/[YYYYMMDD]/` 目錄，以便日後追溯。

### 3.2 敏感資訊與合規防護 (Security Guardrails)
- **敏感字詞掃描 (Data Scrubbing)**: 上傳前進行正則掃描，阻斷或替換個人敏感資料 (PII)、內部機密金鑰。
- **重名防禦 (Collision Policy)**: 支援「自動改名」、「跳過已存在」、「取代更新」策略，避免同仁間檔案互相覆蓋。

---

## 4. 雙向 AI 協助 (Pre & Post AI Processing)

地端網關不只是傳輸工具，更是附加價值的來源：

### 4.1 前置 AI 處理 (Pre-Processing)
- **Excel/CSV 整理**: 將複雜的結構化報表轉化為 AI 友善的 Semantic Text 或 Markdown，提高 NotebookLM 讀取率。
- **自動分類與標籤**: 地端利用本地輕量 LLM 或規則引擎，在上傳前自動為檔案打上分類標籤（如：稅務、合約、會議記錄），寫入 Metadata。

### 4.2 後置 AI 處理 (Post-Processing)
- **會議紀錄轉換器 (Tab 8)**: NotebookLM 整理出 Markdown 會議紀錄後，地端轉換模組 (`md_to_meeting_docx.py`) 自動將其轉換為集團標準格式的 Word (.docx) 與 HTML 檔案。
- **自動摘要與通知**: 產出生成後，地端 AI 生成一頁式簡報，並透過企業通訊軟體 (LINE/Slack) 通知對應的同仁。

---

## 5. 開發實施路徑 (Roadmap)

1. **第一階段：區網存取與身分標記 (已打底，進行中)**
   - 綁定 `0.0.0.0:8765` 開放 LAN 存取。
   - 在 Portal 主要介面（Simple Upload, Meeting Converter）加入「操作者身分 (Submitter)」輸入欄位。
2. **第二階段：安全與敏感資訊過濾 (待開發)**
   - 增加檔案上傳前的關鍵字掃描與 PII 去識別化功能。
   - 優化 Evidence 資料夾的目錄結構，改依同仁身分階層存檔。
3. **第三階段：GAS 雲端多用戶派工優化 (待開發)**
   - 擴展 `Code.gs` 與 `gas_adapter.py`，支援在 Google 試算表上記錄多個同仁遞交的任務，並將處理好的 Word/HTML 會議記錄下載連結直接回寫至 Google 試算表中。
