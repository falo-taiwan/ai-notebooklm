// Falo Co-Work Node Extension Background Service Worker
// © 2026 Falo x Force Cheng. All rights reserved.

let ws = null;
let reconnectInterval = 3000;
let wsUrl = "ws://127.0.0.1:8765/ws/node";
let isConnecting = false;
let heartbeatTimer = null;

// Keep tab alive
chrome.power.requestKeepAwake("system");

// Load custom server address if saved
chrome.storage.local.get(["serverPort"], (result) => {
  if (result.serverPort) {
    wsUrl = `ws://127.0.0.1:${result.serverPort}/ws/node`;
  }
  connectWebSocket();
});

// Watch for port changes
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (changes.serverPort) {
    console.log("[BG] Port changed, reconnecting...");
    wsUrl = `ws://127.0.0.1:${changes.serverPort.newValue}/ws/node`;
    if (ws) {
      ws.close();
    }
  }
});

function connectWebSocket() {
  if (isConnecting) return;
  isConnecting = true;
  console.log(`[BG] Connecting to ${wsUrl}...`);

  try {
    ws = new WebSocket(wsUrl);
  } catch (err) {
    console.error("[BG] WebSocket creation failed:", err);
    isConnecting = false;
    setTimeout(connectWebSocket, reconnectInterval);
    return;
  }

  ws.onopen = () => {
    isConnecting = false;
    console.log("[BG] WebSocket connected 🟢");
    chrome.storage.local.set({ status: "connected" });
    
    // Start heartbeat
    if (heartbeatTimer) clearInterval(heartbeatTimer);
    heartbeatTimer = setInterval(() => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ action: "heartbeat" }));
      }
    }, 15000);
  };

  ws.onclose = () => {
    isConnecting = false;
    console.log("[BG] WebSocket disconnected 🔴");
    chrome.storage.local.set({ status: "disconnected" });
    if (heartbeatTimer) clearInterval(heartbeatTimer);
    setTimeout(connectWebSocket, reconnectInterval);
  };

  ws.onerror = (err) => {
    console.error("[BG] WebSocket error:", err);
    ws.close();
  };

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      if (data.action === "ask") {
        handleServerTask(data);
      }
    } catch (err) {
      console.error("[BG] Error parsing message:", err);
    }
  };
}

function handleServerTask(task) {
  const { id, platform, prompt, notebook_id } = task;
  console.log(`[BG] Received task ${id} for ${platform}, notebook_id: ${notebook_id || "none"}`);

  if (platform === "notebooklm") {
    const matchDomain = "notebooklm.google.com";
    chrome.tabs.query({}, (tabs) => {
      // 1. Look for tab with specific notebook_id
      let targetTab = null;
      if (notebook_id) {
        targetTab = tabs.find(t => t.url && t.url.includes(matchDomain) && t.url.includes(notebook_id));
      }
      
      // 2. If not found, look for any notebooklm tab
      if (!targetTab) {
        targetTab = tabs.find(t => t.url && t.url.includes(matchDomain));
      }

      // 3. If no notebooklm tab is open, open a new one
      if (!targetTab) {
        const url = notebook_id ? `https://notebooklm.google.com/notebook/${notebook_id}` : `https://notebooklm.google.com/`;
        console.log(`[BG] Creating new NotebookLM tab for: ${url}`);
        chrome.tabs.create({ url: url }, (newTab) => {
          setTimeout(() => {
            sendToContentScript(newTab.id, task);
          }, 6000);
        });
        return;
      }

      // 4. If target tab is open but not on the correct notebook ID, update the tab URL
      if (notebook_id && targetTab.url && !targetTab.url.includes(notebook_id)) {
        const url = `https://notebooklm.google.com/notebook/${notebook_id}`;
        console.log(`[BG] Updating tab ${targetTab.id} to notebook URL: ${url}`);
        chrome.tabs.update(targetTab.id, { url: url, active: true }, (updatedTab) => {
          setTimeout(() => {
            sendToContentScript(updatedTab.id, task);
          }, 6000);
        });
        return;
      }

      // 5. Otherwise, send message directly
      sendToContentScript(targetTab.id, task);
    });
  } else {
    // ChatGPT or Claude
    const matchDomain = platform === "claude" ? "claude.ai" : "chatgpt.com";
    chrome.tabs.query({}, (tabs) => {
      const targetTab = tabs.find(t => t.url && t.url.includes(matchDomain));
      if (!targetTab) {
        console.warn(`[BG] No active tab found for ${platform}`);
        sendResponseToServer({
          action: "response",
          id: id,
          ok: false,
          error: `找不到 ${platform} 分頁！請開啟 ${matchDomain} 並登入帳號。`
        });
        return;
      }
      sendToContentScript(targetTab.id, task);
    });
  }
}

function sendToContentScript(tabId, task) {
  const { id, platform, prompt, notebook_id } = task;
  console.log(`[BG] Sending task to tab ID ${tabId}...`);
  chrome.tabs.sendMessage(tabId, {
    action: "ask",
    id: id,
    prompt: prompt,
    platform: platform,
    notebook_id: notebook_id
  }, (response) => {
    if (chrome.runtime.lastError) {
      console.error("[BG] Send message error:", chrome.runtime.lastError.message);
      sendResponseToServer({
        action: "response",
        id: id,
        ok: false,
        error: `無法與分頁通訊 (${chrome.runtime.lastError.message})。請重新整理該 AI 網頁後再試一次。`
      });
      return;
    }
    if (response) {
      sendResponseToServer(response);
    } else {
      sendResponseToServer({
        action: "response",
        id: id,
        ok: false,
        error: "瀏覽器分頁未回應任何結果"
      });
    }
  });
}

function sendResponseToServer(responsePayload) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(responsePayload));
    console.log(`[BG] Forwarded response for task ${responsePayload.id} to server`);
  } else {
    console.error("[BG] Cannot send response, WebSocket not connected");
  }
}
