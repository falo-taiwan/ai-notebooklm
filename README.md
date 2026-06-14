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

---

## 📢 近期更新紀錄
*   **GAS 雲地跳轉優化 (2026/06/15)**: 
    *   將 GAS Web App 中，連回地端控制台的 `portal_url` 預設值由 `www.google.com.tw` 修改為 v2 雲端控制台 `https://falo-taiwan.github.io/ai-notebooklm/v2/gas-web.html`。
    *   於 GAS 程式碼中實作了「防呆覆寫機制」：即使試算表中仍遺留舊版的 `google.com.tw` 資料，網頁前端也會自動判定並安全重導向至正確的控制台頁面。

