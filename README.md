# AI NotebookLM Runtime Lab

這是一個整合 **地端 Python 伺服器 (Runtime Server)**、**前端操作面板 (Portal)**、**Google Apps Script (GAS) 雲端派工** 以及 **Excel 資料審計 (ETL/Audit)** 的完整教學展示專案。

為了方便學員循序漸進地學習，本專案已整理劃分為以下兩個主要版本目錄：

---

## 📂 版本目錄導覽

### 1. [v1/ (測試開發研究版)](file:///Users/force/Google_Antigravity/AI_NotebookLM/v1)
*   **定位**：專案最初的靜態概念與學術架構展示版本。
*   **特色**：
    *   僅包含單檔前端 Portal 模擬與系統架構圖（不需啟動地端 Python 伺服器即可直接點開瀏覽）。
    *   內含傳統 single-file 的 HTML 實作研究。
*   **線上 Pages 網址**：<https://falo-taiwan.github.io/ai-notebooklm/v1/index.html>

### 2. [v2/ (正式 POC/MVP 版)](file:///Users/force/Google_Antigravity/AI_NotebookLM/v2)
*   **定位**：整合多用戶、多 Session 對話、Apps Script web 控制台與權限安全隔離的正式版本。
*   **特色**：
    *   **地端 Runtime 伺服器**：採用多執行緒地端 Python 後端，提供對話、上傳排隊 (Task Queue) 與本地對帳審計。
    *   **智慧對話隔離**：同仁登入後僅能看到自己建立的 Session；管理員（Admin）可檢視全局審計日誌，但無法介入干擾同仁對話。
    *   **Apps Script 整合**：雲端 Apps Script 與 `gas-web.html` Portal 配合，實現外部郵件/表單自動派工地端。
*   **一鍵啟動**：
    *   macOS: 執行 [v2/FALO_Runtime.command](file:///Users/force/Google_Antigravity/AI_NotebookLM/v2/FALO_Runtime.command)
    *   Windows: 執行 [v2/FALO_Runtime.bat](file:///Users/force/Google_Antigravity/AI_NotebookLM/v2/FALO_Runtime.bat)
*   **線上 Pages 網址**：<https://falo-taiwan.github.io/ai-notebooklm/v2/index.html>

---

## 🌐 線上部署與教學連結 (GitHub Pages)

本專案已於 `falo-taiwan` GitHub 組織中啟用 Pages 靜態網站部署：

*   **雙版本入口網頁 (Main Gateway)**: <https://falo-taiwan.github.io/ai-notebooklm/>
*   **V2 學生教學手冊 (Student Guide)**: <https://falo-taiwan.github.io/ai-notebooklm/v2/docs/student_guide.html>
*   **V2 改版架構筆記 (Refactor Notes)**: <https://falo-taiwan.github.io/ai-notebooklm/v2/docs/refactor_notes.html>
*   **V2 GAS 雲端控制台 (GAS Portal)**: <https://falo-taiwan.github.io/ai-notebooklm/v2/gas-web.html>
*   **V2 Windows 新環境部署指南 (Windows Guide)**: <https://falo-taiwan.github.io/ai-notebooklm/v2/docs/windows_deployment_guide.html>
*   **V2 Windows 實戰排錯日誌 (Troubleshooting Guide)**: <https://falo-taiwan.github.io/ai-notebooklm/v2/docs/windows_deployment_issues.html>

---

## 🛠️ 地端啟動說明 (v2)

請確保已在本機完成 `pip install -r requirements.txt`，接著只需進入 `v2/` 目錄並執行啟動腳本即可：

```bash
cd v2
./FALO_Runtime.command
```

啟動後會自動完成環境檢查、Port 衝突管理，並在背景運行服務後自動彈出瀏覽器開啟 Portal 主畫面。

---

© 2026 FALO x TAAT x Force Cheng. All rights reserved. 教學實戰示範專案。

## 💡 專案核心特殊技術與架構對比

本專案圍繞著 **`notebooklm-cli`**（底層通訊驅動）與 **`falo-force`**（上層業務與管理平台）兩大核心進行開發，實現了多項突破官方限制與商用級強化的獨家技術：

### 1. 底層通訊與指紋偽裝：`notebooklm-cli` (notebooklm-py)
*   **WAF 繞過**：標準 Python `requests` 在進行 TLS 握手時會產生 OpenSSL 特徵的 **JA3/JA4 加密指紋**，易被 WAF 識別並回傳 `403 Forbidden`。本專案底層連結了 **`curl_cffi`**（基於 `curl-impersonate` 與 BoringSSL），能字節級模擬 Chrome 120 的 TLS ClientHello 擴展順序（含 GREASE 機制）及 HTTP/2 SETTINGS 幀特徵，成功偽裝成真實瀏覽器。
*   **RPC 協議逆向**：在沒有官方 API Key 的情況下，底層逆向封裝了 Google 前端網頁的 Protobuf/JSON RPC 格式，實現自動化建置書庫、對話與文件上傳。

### 2. 上層增強與業務管理平台：`falo-force` (Runtime Server & Portal)
*   **跨書庫交叉對話 (Context Injector)**：突破 Google 官方一個對話 ID 只能鎖定單一書庫的限制。`falo-force` 在發問前主動重組歷史問答紀錄並手動注入到底層快取中，讓對話在切換書庫時仍能延續上下文。
*   **零停機熱更新子行程 (Subprocess Isolation)**：核心 API 操作均交由獨立子行程動態運行，隔離記憶體洩漏與 Asyncio 衝突；更新虛擬環境依賴（如 `curl_cffi`）時，**地端主伺服器完全無需重啟**，下次提問即刻生效。
*   **雲地一體化任務佇列 (Hybrid Queue)**：以 Google Apps Script (GAS) 作為雲端緩衝 Sheet，地端伺服器 FIFO 佇列拉取並限流處理，內建指數退避重試，保證高併發或網絡不穩時任務不丟失。
*   **輪次級精密資安審計與 Log CMS**：記錄每一次發問當下所用的同仁 IP、時間、書庫 ID 與書庫名稱。管理員可透過 Log CMS 後台進行全局檢索、歷史比對並導出 Excel 報表。
*   **啟動埠衝突協商與動態 Ngrok 綁定**：啟動時自動掃描並清理舊專案進程，並在啟用 Ngrok 時自動捕捉隨機公網 URL 覆寫前端配置，實現 Plug & Play。

### 📊 架構能力對比表

| 特色維度 | `notebooklm-cli` (底層通訊) | `falo-force` (業務與管理平台) |
| :--- | :--- | :--- |
| **主要定位** | Google API 通訊與網絡層指紋模擬器 | 多同仁協作、資安稽核與功能拓展網關 |
| **核心挑戰** | 繞過 Cloudflare 阻斷、模擬 Google 專屬協定 | 突破單一對話鎖定書庫限制、雲地派工整合 |
| **執行方式** | 作為 Python 依賴庫被調用 | 獨立地端常駐 Web 伺服器 + 腳本自動化 |
| **資料儲存** | Google 帳密 Cookie 持久化 | Turn-level 歷史紀錄 (`multichat_sessions.json`) |
| **安全控制** | 僅處理 API 常規授權 | 多同仁對話隱私隔離、管理員全局審計 |

---

*   **詳細原理與互動模擬網頁**：請參閱專案根目錄的 [TLS 指紋偽裝與防爬蟲突破技術指南 (tls_bypass_guide.html)](file:///Users/force/Google_Antigravity/AI_NotebookLM/tls_bypass_guide.html)。

---

## 📢 近期更新紀錄
*   **跨書庫交叉對話與精準日誌稽核 (2026/06/15)**:
    *   **打破官方限制**：打破了 Google NotebookLM 官方對話綁定單一筆記本的限制。地端系統支援在「同一個對話中切換下拉選單」提問不同書庫，實現多書庫交叉比對、綜合查詢。
    *   **輪次級審計紀錄**：後台 `multichat_sessions.json` 資料庫與管理後台日誌改為 Turn-level（問答輪次級）紀錄，精確記錄每一次發問當時選用的書庫 ID 與書庫名稱。
    *   **日誌與 Excel 匯出優化**：管理後台對話紀錄表格與導出 Excel 都增加了「書庫名稱」的友善顯示，方便資安審查。
*   **GAS 雲地跳轉優化 (2026/06/15)**: 
    *   將 GAS Web App 中，連回地端控制台的 `portal_url` 預設值由 `www.google.com.tw` 修改為 v2 雲端控制台 `https://falo-taiwan.github.io/ai-notebooklm/v2/gas-web.html`。
    *   於 GAS 程式碼中實作了「防呆覆寫機制」：即使試算表中仍遺留舊版的 `google.com.tw` 資料，網頁前端也會自動判定並安全重導向至正確的控制台頁面。



---
© 2026 Falo x Force Cheng 2026/6/15. All rights reserved.