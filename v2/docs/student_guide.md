# AI NotebookLM Runtime Lab - 學生教學導覽手冊 (v3.01)

本專案是一個整合 **地端 Python 伺服器 (Runtime Server)**、**前端操作面板 (Portal)**、**Google Apps Script (GAS)** 以及 **Excel 資料治理 (ETL/Audit)** 的全棧教學系統。

本手冊旨在為學員說明整個專案目錄中，各檔案的用途、使用技術以及它們在系統架構中的角色。

---

## 📂 專案核心檔案清單與用途說明

### 1. 啟動與環境檢查 (Bootstrap)
*   **[FALO_Runtime.command](file:///Users/force/Google_Antigravity/AI_NotebookLM/FALO_Runtime.command)** (macOS) / **[FALO_Runtime.bat](file:///Users/force/Google_Antigravity/AI_NotebookLM/FALO_Runtime.bat)** (Windows)
    *   **用途**：學員啟動專案的「唯一主入口」。會自動執行環境檢查、解決 Port 衝突、在背景啟動 Python 伺服器，並建立 Ngrok 外網通道以供 GAS 呼叫。
    *   **技術**：Shell Script (macOS / zsh) & Windows Batch (Windows)。
*   **[environment_check.py](file:///Users/force/Google_Antigravity/AI_NotebookLM/environment_check.py)**
    *   **用途**：檢查專案必備的地端資料夾結構是否存在（如 `data/inbox`、`data/temp` 等），並確認 `notebooklm` 執行檔權限是否正常。
    *   **技術**：Python。
*   **[falo_launcher.py](file:///Users/force/Google_Antigravity/AI_NotebookLM/falo_launcher.py)**
    *   **用途**：Port 衝突解析器。偵測預設 Port `8765` 是否被佔用，若是，會自動掃描並選取備用 Port，防止服務因衝突而無法啟動。
    *   **技術**：Python。

### 2. 後端伺服器 (Backend Runtime)
*   **[runtime_server.py](file:///Users/force/Google_Antigravity/AI_NotebookLM/runtime_server.py)**
    *   **用途**：整個系統的「大腦」。負責處理所有 HTTP API 請求、Session 認證（密碼/金鑰）、讀寫 JSON 地端資料庫、調度排隊工作佇列 (Task Queue)，並執行 NotebookLM CLI 上傳與對話任務。
    *   **技術**：Python (內建 `http.server`、多執行緒設計)。
*   **[app_config.py](file:///Users/force/Google_Antigravity/AI_NotebookLM/app_config.py)**
    *   **用途**：全域配置檔。集中定義專案根目錄、資料庫儲存路徑、上傳格式白名單以及其他環境變數。
    *   **技術**：Python。

### 3. 前端入口與控制台 (Frontend Portal)
*   **[index.html](file:///Users/force/Google_Antigravity/AI_NotebookLM/index.html)**
    *   **用途**：一般同仁使用的主介面。包含對話視窗（與 Gemini/NotebookLM 互動）、檔案/資料夾上傳 UI、Excel ETL 工具、佇列監控以及個人設定。
    *   **技術**：HTML5, CSS3 (Vanilla CSS, 採用磨砂玻璃與暗黑極簡風), Javascript (純 JS 無框架 DOM操作 與 SSE/長輪詢)。
*   **[gas-web.html](file:///Users/force/Google_Antigravity/AI_NotebookLM/gas-web.html)**
    *   **用途**：部署於 Google Apps Script 的雲端控制台網頁。整合心跳監控、在線主機註冊，以及派工單任務記錄。
    *   **技術**：HTML5, CSS3, Javascript (純 JS 無框架 DOM 操作)。
*   **[admin.html](file:///Users/force/Google_Antigravity/AI_NotebookLM/admin.html)**
    *   **用途**：管理員專用的控制台。提供使用者帳號密碼管理、臨時金鑰配發（6位數防重機制）、地端對話審計紀錄（Audit Logs）檢視，以及備份復原與一鍵二階段清除功能。
    *   **技術**：HTML5, CSS3, Javascript。

### 4. 雲端整合模組 (GAS Cloud Integration)
*   **[Code.gs](file:///Users/force/Google_Antigravity/AI_NotebookLM/Code.gs)** / **[程式碼.js](file:///Users/force/Google_Antigravity/AI_NotebookLM/程式碼.js)**
    *   **用途**：部署在 Google Apps Script (GAS) 的代碼。可將 Google 試算表、Gmail 附件或 AppSheet 的異動，透過 Ngrok 隧道自動推送到我們地端的 Python Runtime。
    *   **技術**：Javascript (Google Apps Script)。
*   **[setup.gs](file:///Users/force/Google_Antigravity/AI_NotebookLM/setup.gs)** / **[setup.js](file:///Users/force/Google_Antigravity/AI_NotebookLM/setup.js)**
    *   **用途**：引導學員在 Google 雲端快速完成 GAS 屬性設定與觸發器配置的教學腳本。
    *   **技術**：Javascript (Google Apps Script)。

### 5. 地端工具與資料夾 (Tools & Data)
*   **[appsscript.json](file:///Users/force/Google_Antigravity/AI_NotebookLM/appsscript.json)**：GAS 專案的配置定義檔。
*   **[requirements.txt](file:///Users/force/Google_Antigravity/AI_NotebookLM/requirements.txt)**：列出 Python 依賴套件（包含 `openpyxl` 處理 Excel、`playwright` 網頁爬取、`watchdog` 資料夾監控等）。
*   **📂 data/**：地端資料儲存庫。
    *   `multichat_sessions.json`：NotebookLM 的對話 Session 紀錄資料庫。
    *   `gemini_sessions.json`：Gemini 的對話 Session 紀錄資料庫。
    *   `inbox/`：自動監控資料夾（放進此處的檔案會被自動處理上傳）。
*   **📂 backup/**：存放各版本發行套件的 ZIP 封包。
*   **📂 docs/**：存放專案架構設計、部署指南與教學檔案。

---

## 🛠️ 教學架構圖 (Architecture Map)

下列架喚展示了各組件間的協同關係：

```mermaid
graph TD
    subgraph 雲端 (Google Cloud)
        Sheet[Google Sheets / AppSheet] -->|Webhook 推送| GAS[Google Apps Script]
    end
    
    subgraph 地端 (Local Lab Environment)
        Ngrok[Ngrok 外網隧道] -->|轉發 API| Runtime[runtime_server.py 後端]
        Portal[index.html / admin.html] -->|HTTP / SSE 互動| Runtime
        Runtime -->|讀寫| DB[(JSON 檔案資料庫)]
        Runtime -->|調度| Queue[工作佇列 Task Queue]
        Queue -->|自動化指令| NLM[NotebookLM CLI / Gemini API]
    end

    GAS -->|透過 HTTPS 喚醒| Ngrok
```

---

## 💡 學員實驗重點提示 (Lab Focus)
1.  **地端優先 (Local-First)**：系統不依賴重量級雲端資料庫，使用輕量級的 JSON 檔案作為資料庫，學員可直接打開 `data/` 下的 JSON 觀察資料結構的變動。
2.  **角色與權限隔離 (v3.01)**：
    *   **一般同仁**登入後（使用帳密或金鑰），只能在 `index.html` 看到與聊天自己擁有的 Session。
    *   **Admin** 可以在 `admin.html` 看到所有同仁的審計紀錄，但後端限制了 Admin 介入他人對話的權限，防止 Admin 的訊息干擾到對方的對話視窗。
3.  **跨書庫交叉對話 (v3.01+)**：
    *   **打破官方限制**：Google NotebookLM 官方對話是終身鎖定單一筆記本的。地端系統支援在「同一個對話中隨時切換下拉選單」向不同書庫提問，提供極佳的**交叉比對、綜合查詢與對照運用**的靈活性。
    *   **精密治理**：後端在 `multichat_sessions.json` 資料庫中以 `turns` 陣列內部精確地在每一輪問答節點上記錄當時發問的 `notebook_id` 和 `notebook_title`，完美平衡了「使用者操作彈性」與「管理稽核審計需求」。
