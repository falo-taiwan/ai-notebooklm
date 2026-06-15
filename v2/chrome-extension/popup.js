// Falo Co-Work Node Extension Popup Script
// © 2026 Falo x Force Cheng. All rights reserved.

document.addEventListener("DOMContentLoaded", () => {
  const statusDot = document.getElementById("status-dot");
  const statusText = document.getElementById("status-text");
  const serverPortInput = document.getElementById("server-port");
  const saveBtn = document.getElementById("save-btn");

  // Load current settings
  chrome.storage.local.get(["serverPort", "status"], (result) => {
    if (result.serverPort) {
      serverPortInput.value = result.serverPort;
    }
    updateStatusUI(result.status);
  });

  // Listen for storage changes
  chrome.storage.onChanged.addListener((changes) => {
    if (changes.status) {
      updateStatusUI(changes.status.newValue);
    }
  });

  // Save settings
  saveBtn.addEventListener("click", () => {
    const port = parseInt(serverPortInput.value, 10);
    if (isNaN(port) || port <= 0 || port > 65535) {
      alert("請輸入有效的 Port 號碼 (1-65535)！");
      return;
    }

    chrome.storage.local.set({ serverPort: port }, () => {
      alert("設定已儲存！外掛將自動嘗試重新連線。");
    });
  });

  function updateStatusUI(status) {
    if (status === "connected") {
      statusDot.className = "status-dot connected";
      statusText.innerText = "Connected 🟢";
      statusText.style.color = "#c3e88d";
    } else {
      statusDot.className = "status-dot";
      statusText.innerText = "Disconnected 🔴";
      statusText.style.color = "#ff5370";
    }
  }
});
