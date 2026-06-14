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

## 💡 獨家防爬蟲突破技術 (TLS & HTTP/2 指紋偽裝)

本專案實作了特殊的反爬蟲繞過技術，以解決地端 Python 模擬瀏覽器訪問 Google NotebookLM 時，被 Cloudflare 等 WAF 阻斷的問題：

*   **問題背景**：標準 Python `requests` 或 `httpx` 在進行 TLS 握手時，使用的是系統的 OpenSSL 庫，這會產生特定的 **JA3/JA4 加密指紋**，與真實瀏覽器（如使用 BoringSSL 的 Chrome）不同，因而會被 Cloudflare 識別並回傳 `403 Forbidden`。
*   **核心技術**：引進並依賴了 **`curl_cffi`**（基於底層 C 語言 `curl-impersonate`）。它在編譯時動態連結了瀏覽器專用的 SSL 庫，能字節級模擬 Chrome 120 的 TLS ClientHello 擴展順序（包含 GREASE 機制）及 HTTP/2 SETTINGS 幀特徵，成功偽裝成真實瀏覽器。
*   **無感熱更新設計**：本專案採用子行程（Subprocess）動態調用 `gemini_helper.py`。由於每次提問皆啟動獨立 Python 行程，因此在 Windows 虛擬環境中手動補齊 `curl_cffi` 依賴後，**地端伺服器無需重啟即可立即生效**。
*   **詳細原理網頁**：請參閱專案根目錄的 [TLS 指紋偽裝與防爬蟲突破技術指南 (tls_bypass_guide.html)](file:///Users/force/Google_Antigravity/AI_NotebookLM/tls_bypass_guide.html)。

---

## 📢 近期更新紀錄
*   **跨書庫交叉對話與精準日誌稽核 (2026/06/15)**:
    *   **打破官方限制**：打破了 Google NotebookLM 官方對話綁定單一筆記本的限制。地端系統支援在「同一個對話中切換下拉選單」提問不同書庫，實現多書庫交叉比對、綜合查詢。
    *   **輪次級審計紀錄**：後台 `multichat_sessions.json` 資料庫與管理後台日誌改為 Turn-level（問答輪次級）紀錄，精確記錄每一次發問當時選用的書庫 ID 與書庫名稱。
    *   **日誌與 Excel 匯出優化**：管理後台對話紀錄表格與導出 Excel 都增加了「書庫名稱」的友善顯示，方便資安審查。
*   **GAS 雲地跳轉優化 (2026/06/15)**: 
    *   將 GAS Web App 中，連回地端控制台的 `portal_url` 預設值由 `www.google.com.tw` 修改為 v2 雲端控制台 `https://falo-taiwan.github.io/ai-notebooklm/v2/gas-web.html`。
    *   於 GAS 程式碼中實作了「防呆覆寫機制」：即使試算表中仍遺留舊版的 `google.com.tw` 資料，網頁前端也會自動判定並安全重導向至正確的控制台頁面。

