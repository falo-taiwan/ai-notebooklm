# 🛡️ 高穿透性 AI 代理與反爬蟲突破技術藍圖
## ── 從 TLS 協議指紋偽裝到 Chrome 外掛節點架構

> **機密技術儲備文檔 (Confidential Technical Blueprint)**  
> **版權所有：© 2026 Falo x Force Cheng 2026/6/15. All rights reserved.**  
> **發布日期：2026/06/15**

---

## 導言
隨著各大 AI SaaS 服務（如 Google NotebookLM, ChatGPT, Claude, Midjourney）商業價值的提升，其前端的防爬蟲安全防禦已升級至協議層與行為分析維度。常規的 API 逆向手法與自動化腳本面臨高昂的維護成本與極易被封號的風險。

本文件旨在對本專案已實現的 **TLS 指紋偽裝技術** 進行總結，並前瞻性地設計一套**「地端 Python 伺服器控制 Chrome 外掛代理人」**之降維打擊架構，作為未來商業應用中突破極端防禦的技術儲備。

---

## 第一部分：本專案已實現之突破技術（AI NotebookLM 實戰經驗）

在當前的 `AI_NotebookLM (v3.01)` 專案中，我們採用了 **`notebooklm-cli` (底層通訊驅動)** 與 **`falo-force` (上層管理平台)** 的雙層解耦架構，成功克服了以下技術難關：

### 1. 網路與協議層指紋偽裝 (TLS & HTTP/2 Impersonation)
*   **技術痛點**：標準 Python `requests` 庫底層基於 OpenSSL，其握手階段發送的 `ClientHello` 會產生特定的 **JA3/JA4 加密指紋**。Cloudflare 等 WAF 網關在尚未解密 HTTP 資料前，若發現 JA3 指紋與 HTTP 標頭宣告的 `User-Agent`（如 Chrome）不符，會直接判定為腳本並返回 `403 Forbidden`。
*   **解決手法**：引進 **`curl_cffi`**（基於底層 C 語言 `curl-impersonate`）。它在編譯時動態連結了 Chrome 專用的 **BoringSSL** 庫，能字節級模擬 Chrome 120 的 TLS 擴展順序、GREASE 機制，以及 HTTP/2 握手時的 `SETTINGS` 幀特徵（Window Size, Stream Priority），欺騙 WAF 放行。

### 2. 獨立子行程解耦與無感熱更新 (Subprocess Decoupling)
*   **技術痛點**：底層網路庫與 C 擴展模組在高頻率非同步調用下，常因 `asyncio` 事件循環衝突或 C 擴展記憶體洩漏導致主伺服器崩潰。
*   **解決手法**：`falo-force` 將 API 調用封裝於 `ask_helper.py` 中，主伺服器透過獨立子行程（Subprocess）動態調用。這使得每次提問的 API 通信都在獨立的 Python 解譯器沙盒中完成，在 Windows 部署環境中，手動修復/安裝 `curl_cffi` 後**地端伺服器無需重啟即可即刻生效**。

### 3. 跨書庫交叉對話上下文注入 (Context Injector)
*   **技術痛點**：Google 官方一個對話 ID 只能鎖定單一書庫，限制了跨領域資料比對的便利性。
*   **解決手法**：`falo-force` 在後台接管了歷史紀錄的快取管理。當使用者在同一對話中切換下拉選單選用新書庫時，平台在發起 API 請求前，**主動將之前的問答歷史手動注入（Populate）至底層客戶端的轉向快取中**，讓 Google 後端將其視為連續對話，成功實現跨書庫逆向查詢。

---

## 第二部分：極端安全防禦下的 API 模擬瓶頸

當我們嘗試將上述技術應用於 **ChatGPT (OpenAI)** 或 **Claude (Anthropic)** 等高度商業化的平台時，會面臨更為複雜的「安全陷阱」：

1.  **短壽命憑證 (Access Token Expiration)**：
    *   ChatGPT 使用 Bearer JWT Access Token，效期僅有 1 小時。必須在後台實現複雜的登入 Session 刷新邏輯，否則連接很快中斷。
2.  **前端算力挑戰 (Client-side Proof of Work)**：
    *   OpenAI 引入了 `openai-sentinel-proof-of-work` 機制。瀏覽器發送對話前，必須先執行 JS 計算出符合難度係數的 SHA-256 雜湊解。逆向這套算法的 CPU 運算開銷與代碼維護成本極高。
3.  **動態 CAPTCHA (Arkose Labs FunCaptcha)**：
    *   WAF 隨時會根據 IP 信用度彈出 3D 旋轉物件等高強度驗證碼。在純 API 模擬模式下，一旦觸發，整個自動化流程即告報廢。

---

## 第三部分：終極避風港 ——「Chrome 外掛節點」降維打擊架構

為了解決 API 逆向的高維護成本，我們設計了一套**將安全驗證完全「外包」給真實瀏覽器**的輕量級架構：**Chrome Extension as an AI Node (瀏覽器外掛節點架構)**。

### 1. 系統架構設計

```
[地端 Python 伺服器 (falo-force)]
      │
      ├─► 任務佇列 (Task Queue, FIFO 排隊)
      │
      ▼ (本地 WebSocket 雙向通信 - ws://127.0.0.1:8765/ws/node)
[Chrome 外掛背景指令碼 (Service Worker)]
      │
      ▼ (Content Script - 標頭/DOM 注入)
[使用者 Chrome 瀏覽器分頁 (Pinned Tab - chatgpt.com / claude.ai)]
      │
      ▼ (原生 HTTPS 連線 - 自動算好 PoW & 附加已驗證 Cookie)
[SaaS 官方伺服器 (OpenAI / Anthropic)]
```

### 2. 技術運作流程

1.  **授權與安全繞過**：
    *   使用者在自己的 Chrome 瀏覽器中正常登入 ChatGPT / Claude，並完成手動驗證碼校驗。
    *   外掛安裝在該瀏覽器中，獲取此標籤頁的控制權。
2.  **建立地端橋接**：
    *   外掛啟動後，主動連線至地端 Python 伺服器之 WebSocket 端口，完成節點註冊。
3.  **DOM 語意化注入提問**：
    *   當地端伺服器接收到 Apps Script 或外部表單的 AI 任務時，將 Prompt 發送給外掛。
    *   外掛在背景分頁中，藉由語意化 Selector（如定位 `contenteditable="true"` 或 `aria-label="Send message"`）將內容填入輸入框並模擬點擊「發送」。
4.  **智能結果監聽與提取**：
    *   Content Script 利用 `MutationObserver` 監聽聊天區域 of DOM 變化。
    *   當發送按鈕從「停止 (Stop)」狀態變回「發送 (Send)」狀態，且最後一個模型回覆元素的字串停止增長時，判定生成結束。
    *   提取回覆內容，將 Markdown/HTML 資料序列化，透過 WebSocket 傳回 Python 後端，進而儲存並更新雲端。

### 3. 為什麼這是最優解？（降維打擊的優勢）

*   **零 WAF 成本**：完全使用真實瀏覽器的網路堆疊，沒有任何 TLS (JA3/JA4) 或 HTTP/2 異常特徵， Cloudflare 判定為 100% 正常人類流量。
*   **自動通過 PoW 計算**：所有的算力挑戰、混淆標頭均由網頁官方的原生 JavaScript 在背景運行完成，外掛不需知曉任何算法細節。
*   **極輕量資源消耗**：不需要在伺服器端運行重型 Headless 瀏覽器或配置虛擬顯示卡桌面，只需幾十 KB 的 Extension 代碼即可控制。
*   **極高穩定性**：即使網站變更 API 格式、接口路由，只要網頁 UI 沒有進行大改版，DOM 語意化注入就能照常運作。

### 4. 開發實作關鍵點 (Engineering Details)

*   **防範分頁休眠 (Prevent Tab Sleep)**：
    *   現代瀏覽器會凍結背景閒置分頁。外掛需使用 `chrome.power` API 請求電源鎖，或將工作分頁固定在一個極小的獨立視窗（如 100x100 像素）中，使其在系統看來依然是「可視且活躍的」。
*   **單線程阻塞限制 (Strict Concurrency Control)**：
    *   單個網頁對話窗口同一時間只能處理一個發問。地端 Python 伺服器的 `Task Queue` 必須執行嚴格的 FIFO 隊列，在前一次任務回傳成功或超時前，不得發送下一個任務。
*   **語意化 Selector 設計**：
    *   定位元素時避免使用脆弱的 CSS class（如 `.flex.items-center.p-2`），應使用不變的屬性（如 `[placeholder*="ChatGPT"]`、`[aria-label="Send"]`）。

---

## 第四部分：商業價值與跨平台應用前景

當未來出於商業機密或程式保護目的，我們將 Web 頁面上的技術細節移除時，此藍圖將作為核心技術指南保留。

這種**「地端 Python 伺服器控制 Chrome 外掛代理人」**的設計模式，具備強大的商業推廣價值，可廣泛應用於：

1.  **Claude.ai** 內部知識庫自動化同步。
2.  **Midjourney 網頁版** 的地端圖像生成批次排隊與自動下載。
3.  **DALL-E 3** 網頁版提示詞優化與大量生成。
4.  所有未提供 API Key 的利基型 SaaS 數據庫的自動化抓取與整合。

*這套設計真正做到了「讓安全防禦外包給瀏覽器，讓控制權回歸地端平台」，在未來高度對抗的爬蟲與反爬蟲技術演進中，這將是不可或缺的技術利器。*

---
© 2026 Falo x Force Cheng 2026/6/15. All rights reserved.
