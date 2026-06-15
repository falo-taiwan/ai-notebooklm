# 💡 HTML-Extension-Cowork (HEC) 架構設計與技術概念手冊

本手冊定義並記錄了 **`html-extension-cowork`** (HTML + 瀏覽器外掛雙向協作) 架構的核心設計與實現路徑。這是一套專為繞過傳統地端伺服器網路開埠限制、防火牆阻擋與防爬蟲 WAF 檢測而設計的「零開埠、零伺服器 (Zero-Port, Zero-Server)」跨網頁/跨 AI 協作引擎。

---

## 🎯 核心設計初衷

傳統地端 AI 協作或自動化腳本（如使用 Python 呼叫 Selenium、Playwright，或開啟本機 8765 埠作為 WebSocket Server）常面臨以下痛點：
1. **防爬蟲阻擋 (WAF)**：主流 AI 網頁（ChatGPT、Claude 等）具有極強的 Cloudflare 或自訂 WAF 防禦，自動化瀏覽器驅動常因 TLS 指紋不符被回傳 `403 Forbidden`。
2. **Session 保持困難**：網頁登入狀態（Cookie/LocalStorage）維護繁瑣，容易失效。
3. **安全審計與開埠限制**：企業內網嚴格禁止任何地端程式開啟監聽 Port（Port binding），且常因防火牆或防毒軟體阻攔導致 WebSocket 連線失敗。

**`html-extension-cowork`** 採用「順水推舟」的思路：**利用使用者本人的真實瀏覽器作為執行載體，透過外掛的內部通訊 IPC 來協作分頁**，徹底解決上述痛點。

---

## 🧩 HEC 雙軌協作架構

本架構由三個核心組件構成，形成穩固的黃金三角：

```
                    ┌────────────────────────┐
                    │      Chrome 瀏覽器     │
                    │                        │
                    │   ┌────────────────┐   │
                    │   │  本地 Portal   │   │  (主控界面 index.html)
                    │   │  (Dashboard)   │   │
                    │   └───────▲────────┘   │
                    │           │            │
                    │   ┌───────▼────────┐   │
                    │   │  Chrome 外掛   │   │  (中央路由 background.js)
                    │   │ Service Worker │   │
                    │   └───────▲────────┘   │
                    │           │            │
                    │   ┌───────▼────────┐   │
                    │   │  AI SaaS 網頁  │   │  (ChatGPT / Claude / NotebookLM)
                    │   │ (Tab Injector) │   │
                    │   └────────────────┘   │
                    └───────────▲────────────┘
                                │ (Native Messaging / Stdio)
                    ┌───────────▼────────────┐
                    │      地端 Python       │  (本地檔案與資料庫處理)
                    │      (Native Host)     │
                    └────────────────────────┘
```

### 1. 本地 Portal 控制台 (`index.html`)
* **定位**：使用者操作的 Dashboard 介面。
* **特色**：提供寬敞、美觀的視覺面板，用於輸入指令、選擇書庫、檢視對話進度與下載報表。它不需要由地端 Web 伺服器託管，可直接點擊雙擊打開。
* **通訊**：透過注入在該頁面的 Content Script，與外掛大腦進行 `chrome.runtime` 雙向通訊。

### 2. Chrome 外掛中介大腦 (`background.js`)
* **定位**：中央訊息分派與狀態管理中心 (Service Worker)。
* **特色**：
  * **雙向分頁路由**：同時監聽 Portal 頁面與複數個 AI 分頁。當收到 Portal 的請求時，負責將任務派發給對應的 AI 網頁 Content Script。
  * **零 Port 穿透**：所有通訊都在 Chrome 的 C++ 底層安全沙箱 IPC 中完成，外部無任何監聽 Port。
  * **本地 Native 連接**：在需要地端算力時，直接發起 Native Messaging 管道。

### 3. 目標網頁 Content Scripts
* **定位**：AI 頁面的「虛擬手腳」。
* **特色**：
  * 注入在 `chatgpt.com`、`claude.ai` 或 `notebooklm.google.com` 中。
  * 接收外掛大腦的指令，自動填入對話框、模擬發送。
  * 透過 `MutationObserver` 精準監聽 AI 的打字機輸出狀態。
  * 判定生成完畢後，抓取 DOM 內容並回傳給外掛大腦。

### 4. 地端 Python 原生通訊進程 (Native Host)
* **定位**：地端擴展引擎。
* **特色**：
  * 不開啟任何 Port (TCP/UDP)。
  * 透過 Standard I/O (Stdio) 與 Chrome 直接傳輸 JSON 封包。
  * 用於處理本地文件讀寫（如產生 Docx、Excel 報表）或呼叫本機 CLI 工具。

---

## 🏆 架構三大優勢 (Why It Wins)

* **100% 真人指紋**：因為操作完全發生在使用者已登入的真實瀏覽器分頁中，帶有完美的 TLS 指紋與真實網絡環境，完美繞過防爬蟲檢測。
* **零配置部署**：地端 Python 與前端完全不需要設定防火牆白名單或端口轉發，只要外掛載入，即刻運行。
* **生命週期自動回收**：當 Chrome 關閉時，底層 Python 進程會自動隨之外掛釋放而被系統回收，絕不殘留背景殭屍行程。

---

## 📌 版本控制與版權聲明

* **專案版本**：ver 0.1
* **發布日期**：2026/06/15
* **開發與維護**：Falo x Force Cheng

---
© 2026 Falo x Force Cheng 2026/6/15 ver0.1. All rights reserved.
