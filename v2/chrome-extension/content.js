// Falo Co-Work Node Extension Content Script
// © 2026 Falo x Force Cheng. All rights reserved.

console.log("[Falo Node] Content script loaded successfully on " + window.location.host);

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "ask") {
    console.log(`[Falo Node] Received ask request for task: ${message.id}`);
    
    // Run the automation asynchronously and call sendResponse when done
    executeTask(message)
      .then(result => {
        console.log(`[Falo Node] Task ${message.id} completed successfully`);
        sendResponse(result);
      })
      .catch(err => {
        console.error(`[Falo Node] Task ${message.id} failed:`, err);
        sendResponse({
          action: "response",
          id: message.id,
          ok: false,
          error: err.message || "未知的前端自動化錯誤"
        });
      });

    return true; // Keep message channel open for asynchronous response
  }
});

async function executeTask(task) {
  const { id, prompt, platform } = task;
  const host = window.location.host;
  const isClaude = platform === "claude" || host.includes("claude.ai");
  const isNotebookLM = platform === "notebooklm" || host.includes("notebooklm.google.com");
  const isChatGPT = !isClaude && !isNotebookLM;
  
  console.log(`[Falo Node] Auto-injecting prompt into ${isClaude ? "Claude" : (isNotebookLM ? "NotebookLM" : "ChatGPT")}...`);
  
  // 1. Find the input element
  let inputEl = null;
  if (isClaude) {
    inputEl = document.querySelector('div[contenteditable="true"]') || document.querySelector('textarea');
  } else if (isNotebookLM) {
    inputEl = document.querySelector('textarea[placeholder*="提問" i]') || 
              document.querySelector('textarea[placeholder*="Ask" i]') ||
              document.querySelector('textarea') ||
              document.querySelector('div[contenteditable="true"]');
  } else {
    inputEl = document.getElementById('prompt-textarea') || document.querySelector('textarea') || document.querySelector('div[contenteditable="true"]');
  }

  if (!inputEl) {
    throw new Error("找不到輸入文字框！請確保網頁已完全載入。");
  }

  // 2. Focus and inject text
  inputEl.focus();
  
  // Use bulletproof document.execCommand to trigger react state updates
  try {
    document.execCommand('selectall', false, null);
    document.execCommand('insertText', false, prompt);
  } catch (e) {
    console.warn("[Falo Node] execCommand failed, falling back to direct value setter:", e);
    if (inputEl.tagName === "TEXTAREA" || inputEl.tagName === "INPUT") {
      inputEl.value = prompt;
    } else {
      inputEl.innerText = prompt;
    }
    // Dispatch input events
    inputEl.dispatchEvent(new Event('input', { bubbles: true }));
    inputEl.dispatchEvent(new Event('change', { bubbles: true }));
  }

  // Small delay to let React/Vue register the input
  await sleep(600);

  // 3. Find and click the send button
  let sendBtn = null;
  if (isClaude) {
    // Claude send buttons
    sendBtn = document.querySelector('button[aria-label*="Send message" i]') || 
              document.querySelector('button[aria-label*="Send Message" i]') || 
              document.querySelector('button[aria-label*="Send" i]') ||
              document.querySelector('button[type="submit"]') ||
              document.querySelector('button.bg-accent'); // fallback
  } else if (isNotebookLM) {
    // NotebookLM send buttons
    sendBtn = document.querySelector('button[aria-label*="Send" i]') || 
              document.querySelector('button[aria-label*="Submit" i]') || 
              document.querySelector('button[aria-label*="發送" i]') || 
              document.querySelector('button[type="submit"]') ||
              (inputEl && inputEl.parentElement ? inputEl.parentElement.querySelector('button') : null) ||
              document.querySelector('button'); // broad fallback
  } else {
    // ChatGPT send buttons
    sendBtn = document.querySelector('button[data-testid="send-button"]') || 
              document.querySelector('button[aria-label*="Send prompt" i]') || 
              document.querySelector('button[aria-label*="Send message" i]') ||
              document.querySelector('button[type="submit"]') ||
              inputEl.nextElementSibling; // fallback
  }

  if (!sendBtn) {
    throw new Error("找不到發送按鈕！");
  }

  console.log("[Falo Node] Clicking send button...");
  sendBtn.click();

  // Wait a bit for the answer container to appear and generation to start
  await sleep(2000);

  // 4. Monitor generation status
  console.log("[Falo Node] Monitoring answer generation...");
  const answer = await waitForGeneration(platform);
  
  return {
    action: "response",
    id: id,
    ok: true,
    answer: answer
  };
}

function getAssistantMessageSelector(platform) {
  const host = window.location.host;
  const isClaude = platform === "claude" || host.includes("claude.ai");
  const isNotebookLM = platform === "notebooklm" || host.includes("notebooklm.google.com");
  
  if (isClaude) {
    return 'div.font-claude-message, div.claude-message, [data-testid="message-content"]';
  } else if (isNotebookLM) {
    return 'chat-message div.markdown, div.message-content, div.chat-bubble, div.response-text, div.markdown, .message-text, .response';
  } else {
    return 'div[data-message-author-role="assistant"] div.markdown, div.markdown';
  }
}

async function waitForGeneration(platform) {
  const selector = getAssistantMessageSelector(platform);
  let lastText = "";
  let noChangeCount = 0;
  let checkAttempts = 0;
  const maxAttempts = 180; // 3 minutes timeout

  while (checkAttempts < maxAttempts) {
    await sleep(1000);
    checkAttempts++;

    // Find all assistant messages and grab the last one
    const messages = document.querySelectorAll(selector);
    if (messages.length === 0) {
      console.log("[Falo Node] Waiting for assistant message element to appear...");
      continue;
    }

    const lastMsgEl = messages[messages.length - 1];
    const currentText = lastMsgEl.innerText || lastMsgEl.textContent || "";

    if (currentText.length > 0) {
      if (currentText === lastText) {
        noChangeCount++;
        // If content doesn't change for 3 consecutive checks (3 seconds), and the send/stop button suggests idle
        if (noChangeCount >= 3) {
          const isIdle = checkIsIdle(platform);
          if (isIdle) {
            console.log("[Falo Node] Generation complete based on content stability and UI state.");
            return currentText;
          }
        }
      } else {
        lastText = currentText;
        noChangeCount = 0; // reset
      }
    }
  }

  if (lastText.length > 0) {
    console.warn("[Falo Node] Timeout reached, but returning partial answer.");
    return lastText;
  }
  
  throw new Error("等待 AI 回覆生成逾時 (3分鐘)");
}

function checkIsIdle(platform) {
  const host = window.location.host;
  const isClaude = platform === "claude" || host.includes("claude.ai");
  const isNotebookLM = platform === "notebooklm" || host.includes("notebooklm.google.com");
  
  if (isClaude) {
    const stopBtn = document.querySelector('button[aria-label*="Stop" i]') || 
                    document.querySelector('button[aria-label*="Cancel" i]');
    return !stopBtn;
  } else if (isNotebookLM) {
    const stopBtn = document.querySelector('button[aria-label*="Stop" i]') || 
                    document.querySelector('button[aria-label*="Cancel" i]') ||
                    document.querySelector('button[aria-label*="停止" i]');
    if (stopBtn) return false;
    
    // Check if any textarea is disabled (generating)
    const textareas = document.querySelectorAll('textarea');
    for (let ta of textareas) {
      if (ta.disabled) return false;
    }
    
    const progress = document.querySelector('mat-progress-bar, [role="progressbar"], .loading, .spinner');
    if (progress) return false;
    
    return true;
  } else {
    const stopBtn = document.querySelector('button[aria-label*="Stop generating" i]') || 
                    document.querySelector('button[data-testid="stop-button"]');
    return !stopBtn;
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
