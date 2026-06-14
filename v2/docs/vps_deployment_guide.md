# NotebookLM CLI + GAS Remote Deployment Guide

本指南說明如何將地端的 Python 網關與 `notebooklm-py` CLI 部署到雲端主機（Windows 365 或 Linux VPS），並利用 **Cloudflare Tunnel (cloudflared)** 提供免費、免開 Port、自動申請 SSL 的 HTTPS 連線，供 Google Apps Script (GAS) 呼叫。

---

## 系統架構圖

```mermaid
graph LR
    GAS[Google Apps Script] -- "HTTPS POST" --> CF[Cloudflare Tunnel]
    CF -- "Secure Forward" --> VPS[Windows / Linux 主機]
    subgraph VPS (雲端主機)
        Server[runtime_server.py] -- "Call" --> CLI[ask_helper.py / CLI Core]
    end
    CLI -- "Wiz RPC (Keepalive 保活)" --> NLM[Google NotebookLM 服務]
```

---

## 方案一：Windows 365 Cloud PC / Windows VM (圖形化，最簡單)

### 步驟 1：主機環境準備
1.  開啟 Windows 365，安裝 **Google Chrome** 與 **Python 3.12** (安裝時勾選 "Add Python to PATH")。
2.  安裝 **Git for Windows**。

### 步驟 2：複製專案與安裝依賴
開啟 PowerShell，執行：
```powershell
git clone https://github.com/falo-chinese/ai-notebooklm.git
cd ai-notebooklm
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
playwright install chromium
```

### 步驟 3：CLI 登入授權
在 PowerShell 中執行：
```powershell
.venv\Scripts\notebooklm login
```
*   這會自動打開當地的 Chrome 瀏覽器，請手動登入您的 Google 帳號。登入完成後關閉瀏覽器，認證狀態將自動儲存。

### 步驟 4：啟動伺服器
```powershell
python runtime_server.py
```
*   服務此時在本地 `http://127.0.0.1:8765` 運行。

### 步驟 5：使用 Cloudflare Tunnel 暴露服務（免開 Port）
1.  下載 Windows 版 [cloudflared.exe](https://github.com/cloudflare/cloudflared/releases)。
2.  在 PowerShell 中執行（快速測試通道）：
    ```powershell
    .\cloudflared.exe tunnel --url http://localhost:8765
    ```
3.  終端機會輸出一個隨機的 HTTPS 網址（例如 `https://xxxx.trycloudflare.com`）。
4.  將此網址複製，即可直接供 GAS 呼叫！

---

## 方案二：Linux VPS ($4~6 美元，性價比最高)

### 步驟 1：本機登入並備份授權
因為 Linux VPS 沒有圖形介面，我們在 **您的 Mac 本機** 上完成登入：
1.  在 Mac 終端機執行：`.venv/bin/notebooklm login`（完成登入）。
2.  找到產出的授權檔：`/Users/force/.notebooklm/profiles/default/storage_state.json`。

### 步驟 2：Linux VPS 環境安裝
SSH 登入您的 VPS（以 Ubuntu 為例），執行：
```bash
sudo apt update && sudo apt install -y python3-pip python3-venv git
git clone https://github.com/falo-chinese/ai-notebooklm.git
cd ai-notebooklm
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### 步驟 3：上傳授權檔至 VPS
將 Mac 上的 `storage_state.json` 上傳至 VPS 的對應目錄：
*   **VPS 目錄**: `~/.notebooklm/profiles/default/storage_state.json` (若目錄不存在請先 `mkdir -p ~/.notebooklm/profiles/default/`)。
*   您可以使用 `scp` 指令上傳：
    ```bash
    scp /Users/force/.notebooklm/profiles/default/storage_state.json root@your_vps_ip:~/.notebooklm/profiles/default/
    ```

### 步驟 4：背景啟動服務
使用 `screen` 或 `nohup` 讓服務在 VPS 背景持續運行：
```bash
nohup python3 runtime_server.py > server.log 2>&1 &
```

### 步驟 5：安裝 Cloudflare Tunnel 暴露服務
1.  在 Linux VPS 下載並安裝 cloudflared：
    ```bash
    curl -L --output cloudflared.deb https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
    sudo dpkg -i cloudflared.deb
    ```
2.  啟動免費通道：
    ```bash
    cloudflared tunnel --url http://localhost:8765
    ```
3.  記下終端機輸出的 `https://xxxx.trycloudflare.com` 網址。

---

## 步驟三：GAS (Google Apps Script) 呼叫代碼

在您的 Google 試算表或 GAS 專案中，撰寫以下代碼即可完成查詢：

```javascript
function askNotebookLM() {
  // 替換為您的 Cloudflare Tunnel 網址
  var tunnelUrl = "https://xxxx.trycloudflare.com/api/multichat/ask";
  
  var payload = {
    "notebook_id": "73085c64-dea5-4945-9226-949023b0ac9b", // 您的 Notebook ID
    "user_name": "GAS_User",
    "question": "請以繁體中文摘要今日重點。",
    "conversation_id": "new" // 或填入之前回傳的實體對話 ID 以接續對話
  };
  
  var options = {
    "method": "post",
    "contentType": "application/x-www-form-urlencoded",
    "payload": payload,
    "muteHttpExceptions": true
  };
  
  try {
    var response = UrlFetchApp.fetch(tunnelUrl, options);
    var json = JSON.parse(response.getContentText());
    
    if (json.ok) {
      Logger.log("AI 回覆: " + json.answer);
      Logger.log("對話 ID (請記錄下來以便多輪對話): " + json.conversation_id);
    } else {
      Logger.log("錯誤: " + json.error);
    }
  } catch (e) {
    Logger.log("連線失敗: " + e.toString());
  }
}
```
> [!TIP]
> **長期部署建議**：`trycloudflare.com` 是臨時通道，重啟後網址會變。若要長期穩定使用，可以在 Cloudflare 註冊一個免費的網域（或將您現有的網域託管在 Cloudflare），並建立一個 Persistent Tunnel，這樣就能獲得永久不變的 HTTPS 網址（例如 `https://notebooklm.yourdomain.com`）。


---
© 2026 Falo x Force Cheng 2026/6/15. All rights reserved.