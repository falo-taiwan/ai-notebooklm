# 💻 AI NotebookLM v2 Windows 新環境部署與 AI 接力指南

本文件說明如何將本專案轉移部署至 **Windows** 作業系統，並引導新環境的 AI 助理（Antigravity）如何快速接手後續的開發與測試工作。

---

## 📂 1. Windows 本機環境準備

在開始之前，請確保 Windows 主機已安裝以下基礎工具：

1. **Python 3.10+**：
   * 請前往 [Python 官網](https://www.python.org/downloads/) 下載 Windows 安裝檔。
   * **[關鍵步驟]**：安裝時請務必勾選 **"Add Python.exe to PATH"**（將 Python 加入系統環境變數）。
2. **Node.js (LTS 版本)**：
   * 用於執行 `clasp` 進行 Google Apps Script 雲端部署。
   * 請前往 [Node.js 官網](https://nodejs.org/) 安裝，安裝後 npm 會自動加入環境變數。
3. **Git**：
   * 請前往 [Git for Windows](https://git-scm.com/) 下載安裝，以便進行版本控制與拉取。

---

## 🛠️ 2. 專案解壓縮與目錄定位

1. 將最新的專案壓縮檔 `AI_NotebookLM_v3.01_Windows_Deploy.zip` 解壓縮至您的 Windows 工作資料夾（例如：`D:\Workspace\AI_NotebookLM`）。
2. 用 VS Code 開啟此資料夾，並開啟終端機（Terminal）。

---

## 📦 3. 安裝 Python 依賴套件

在 VS Code 終端機（PowerShell 或 CMD）中定位到 `v2` 資料夾，執行以下指令安裝 Python 依賴庫：

```powershell
cd v2
pip install -r requirements.txt
```

> [!NOTE]
> 安裝的套件包含：`Flask`, `requests`, `openpyxl`, `google-genai` 等本地伺服器與資料治理所需的元件。

---

## 🚀 4. 啟動 Windows 地端服務

在 Windows 環境中，請直接雙擊執行：
👉 **`v2/FALO_Runtime.bat`**

此批次檔會自動在背景執行以下動作：
1. **執行環境檢查**（`environment_check.py`）：確認您的環境變數與套件皆已齊備。
2. **啟動 Runtime Python 伺服器**（`runtime_server.py`）：預設會在 Port `8765` 上啟動服務。
3. **自動彈出瀏覽器**：開啟並載入本地控制台網頁（`index.html`）。

---

## 🤖 5. 致新環境 AI 助理 (Antigravity) 的接力指令

如果您在新的 Windows 環境中使用 Antigravity（本 AI 助理）協助您：
請您直接**複製以下這段提示詞**發送給新的 Antigravity，它就會自動理解專案現狀並接手工作：

```markdown
<USER_REQUEST>
我們現在轉移到了 Windows 環境，這是一個 AI NotebookLM v2 專案。
請你：
1. 閱讀本地的 [windows_deployment_guide.md](file:///v2/docs/windows_deployment_guide.md) 理解 Windows 部署架構。
2. 閱讀 [student_guide.md](file:///v2/docs/student_guide.md) 與 [refactor_notes.md](file:///v2/docs/refactor_notes.md) 掌握核心業務邏輯。
3. 執行 v2/environment_check.py 驗證本地環境是否正常，並列出地端伺服器（runtime_server.py）的現行狀態。
4. 如果需要重新與 Google Apps Script (GAS) 對接，請教我如何使用 clasp 指令登入並推送。
</USER_REQUEST>
```

---

## ☁️ 6. 雲端 GAS 重新對接說明 (適用於新 AI/開發者)

若在新 Windows 環境中需要將修改後的程式碼同步到 GAS 雲端：

1. **登入 Google 帳號**：
   ```powershell
   clasp login
   ```
   *系統會彈出瀏覽器，請登入擁有該 Google 試算表與 GAS 權限的 Google 帳號。*

2. **推送程式碼**：
   ```powershell
   clasp push
   ```
   *這會將本地的 `程式碼.js`、`setup.js` 自動推送覆蓋到雲端專案中。*

3. **重新發行 Web App 部署**：
   ```powershell
   clasp deploy -i AKfycbw9X3Y6MQ2XpvsS9BXuCZeZsVkrbT1VL0JkDkotrbs-omYG8OpuWpAl1fowiJa_QW1i -d "v2.01版 Windows Deploy"
   ```
   *這會發行新版本，使 Web App 的 `/exec` 連結立即套用最新的防呆覆寫與 URL 設定！*

---

© 2026 FALO x TAAT x Force Cheng. Windows 環境部署維護指南。
