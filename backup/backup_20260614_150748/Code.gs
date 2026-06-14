/**
 * AI NotebookLM GAS Command Center V2 - Pre-2.0 Release
 * Falo x Force Teaching Command Center
 */

const APP_NAME = 'AI NotebookLM GAS Command Center V2';
const WATERMARK = 'Falo x Force';
const DEFAULT_TOKEN = '123456';
const DEFAULT_WORKSTATION_MAC_URL = 'https://conclude-reapply-backhand.ngrok-free.dev/';

const SHEETS = {
  SETTINGS: 'Settings',
  USERS: 'Users',
};

const HEADERS = {
  Settings: ['key', 'value', 'note'],
  Users: ['user_id', 'display_name', 'role', 'password', 'active'],
};

function doGet(e) {
  const params = e && e.parameter ? e.parameter : {};
  const action = params.action || 'ui';
  try {
    if (action === 'ui') return renderPortal_();
    if (action === 'setup') return setupSheet();
    if (action === 'ping') return json_({ ok: true, app: APP_NAME, now: new Date().toISOString() });
    if (action === 'login') return json_(login_(params.user_id, params.password));
    
    // Auth check for REST api actions
    const settings = getSettings_();
    const token = String(params.token || '').trim();
    if (!token || token !== String(settings.api_token || '').trim()) {
      return json_({ ok: false, error: 'Unauthorized token.' });
    }
    
    if (action === 'test_connection') {
      return json_({ ok: true, message: 'Connection verified. API token is correct.' });
    }
    if (action === 'cloud_status') {
      return json_(getCloudStatus_());
    }
    return json_({ ok: false, error: `Unknown action: ${action}` });
  } catch (err) {
    return json_({ ok: false, error: err.message });
  }
}

function doPost(e) {
  try {
    const payload = JSON.parse(e.postData && e.postData.contents ? e.postData.contents : '{}');
    const action = payload.action || '';
    
    if (action === 'login') {
      return json_(login_(payload.user_id, payload.password));
    }
    
    const settings = getSettings_();
    const token = String(payload.token || '').trim();
    if (!token || token !== String(settings.api_token || '').trim()) {
      return json_({ ok: false, error: 'Unauthorized token.' });
    }
    
    if (action === 'update_host_info') {
      updateSetting_('runtime_reported_lan_url', payload.lan_url || '');
      updateSetting_('runtime_hostname', payload.hostname || '');
      updateSetting_('runtime_os_type', payload.os_type || '');
      updateSetting_('runtime_report_method', payload.report_method || '');
      updateSetting_('runtime_poll_interval_seconds', payload.poll_interval_seconds || '');
      updateSetting_('runtime_last_seen_at', payload.local_time || new Date().toISOString());
      return json_({ ok: true, message: 'Host info updated successfully.' });
    }
    return json_({ ok: false, error: `Unknown POST action: ${action}` });
  } catch (err) {
    return json_({ ok: false, error: err.message });
  }
}


function login_(userId, password) {
  const defaults = {
    'admin': { role: 'admin', display_name: 'Admin' },
    'manager': { role: 'document_manager', display_name: 'Document Manager' },
    'user': { role: 'user', display_name: 'User' },
    'power': { role: 'power', display_name: 'Power User' }
  };
  
  let token = DEFAULT_TOKEN;
  try {
    const settings = getSettings_();
    token = String(settings.api_token || DEFAULT_TOKEN).trim();
  } catch (e) {
    // Settings sheet not set up yet, use default token
  }

  if (defaults[userId] && String(password) === '123456') {
    return { ok: true, user_id: userId, display_name: defaults[userId].display_name, role: defaults[userId].role, token: token };
  }

  try {
    const users = rows_(SHEETS.USERS);
    const user = users.find(row => row.user_id === userId && String(row.active).toUpperCase() === 'TRUE');
    if (user && String(user.password) === String(password)) {
      return { ok: true, user_id: user.user_id, display_name: user.display_name, role: user.role, token: token };
    }
  } catch (e) {
    // Users sheet not set up yet or query failed
  }

  return { ok: false, error: '帳號或密碼錯誤。' };
}

function uiLogin(user, pass) {
  return login_(user, pass);
}

function uiTestConnection(token) {
  requireToken_(token);
  return { ok: true, message: 'Connection verified. API token is correct.' };
}

function uiCloudStatus(token) {
  requireToken_(token);
  return getCloudStatus_();
}

function uiSaveWorkstationUrl(token, url) {
  requireToken_(token);
  const clean = normalizeWorkstationUrl_(url);
  updateSetting_('workstation_url', clean, 'Updated workstation url from UI.');
  return { ok: true, message: 'Workstation URL saved successfully.', workstation_url: clean };
}

function requireToken_(token) {
  const settings = getSettings_();
  const tokenStr = String(token || '').trim();
  const settingsTokenStr = String(settings.api_token || '').trim();
  if (!tokenStr || tokenStr !== settingsTokenStr) {
    throw new Error('Unauthorized or invalid API token.');
  }
}

function getCloudStatus_() {
  const settings = getSettings_();
  return {
    ok: true,
    app: APP_NAME,
    now: new Date().toISOString(),
    reported_lan_url: settings.runtime_reported_lan_url || '',
    reported_hostname: settings.runtime_hostname || '',
    reported_os_type: settings.runtime_os_type || '',
    reported_method: settings.runtime_report_method || '',
    reported_interval: settings.runtime_poll_interval_seconds || '',
    reported_last_seen: settings.runtime_last_seen_at || '',
    workstation_url: settings.workstation_url || ''
  };
}

function normalizeWorkstationUrl_(url) {
  const text = String(url || '').trim();
  if (!text) return '';
  return text.endsWith('/') ? text.slice(0, -1) : text;
}

function json_(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload, null, 2))
    .setMimeType(ContentService.MimeType.JSON);
}

function renderPortal_() {
  const html = `<!doctype html>
<html lang="zh-Hant">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${APP_NAME}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;700&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #0b0f19;
      --card-bg: rgba(17, 24, 39, 0.75);
      --border: rgba(255, 255, 255, 0.08);
      --text: #f3f4f6;
      --text-muted: #9ca3af;
      --primary: #10b981;
      --primary-hover: #059669;
      --secondary: #3b82f6;
      --secondary-hover: #2563eb;
      --danger: #ef4444;
      --success: #10b981;
      --glow: rgba(16, 185, 129, 0.15);
    }
    body {
      margin: 0;
      background: radial-gradient(circle at top, #111827 0%, #030712 100%);
      color: var(--text);
      font-family: 'Outfit', -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      min-height: 100vh;
    }
    main {
      max-width: 800px;
      margin: 0 auto;
      padding: 40px 20px;
    }
    header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 40px;
      flex-wrap: wrap;
      gap: 15px;
    }
    .brand-section {
      text-align: left;
    }
    header h1 {
      font-size: 2.2rem;
      font-weight: 700;
      margin: 0 0 5px 0;
      background: linear-gradient(135deg, #34d399 0%, #3b82f6 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    .watermark {
      font-size: 0.85rem;
      color: var(--text-muted);
      letter-spacing: 2px;
      text-transform: uppercase;
      font-weight: 600;
    }
    .card {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 16px;
      padding: 24px;
      margin-bottom: 24px;
      box-shadow: 0 4px 30px rgba(0, 0, 0, 0.4);
      backdrop-filter: blur(12px);
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }
    .card:hover {
      border-color: rgba(16, 185, 129, 0.3);
      box-shadow: 0 10px 30px rgba(16, 185, 129, 0.08);
    }
    h2 {
      font-size: 1.3rem;
      margin-top: 0;
      margin-bottom: 20px;
      color: #34d399;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .field {
      margin-bottom: 20px;
    }
    .field label {
      display: block;
      font-size: 0.9rem;
      font-weight: 600;
      margin-bottom: 8px;
      color: var(--text-muted);
    }
    input[type="text"], input[type="password"] {
      width: 100%;
      box-sizing: border-box;
      background: rgba(0, 0, 0, 0.35);
      border: 1px solid var(--border);
      border-radius: 8px;
      color: #fff;
      padding: 12px;
      font-size: 1rem;
      outline: none;
      transition: border-color 0.2s;
    }
    input[type="text"]:focus, input[type="password"]:focus {
      border-color: var(--primary);
      box-shadow: 0 0 0 2px var(--glow);
    }
    .password-wrapper {
      position: relative;
      display: flex;
      align-items: center;
      width: 100%;
    }
    .password-wrapper input[type="password"],
    .password-wrapper input[type="text"] {
      padding-right: 42px;
    }
    .password-toggle-btn {
      position: absolute;
      right: 12px;
      background: none;
      border: none;
      color: var(--text-muted);
      cursor: pointer;
      font-size: 1.1rem;
      padding: 4px;
      display: flex;
      align-items: center;
      justify-content: center;
      outline: none;
      transition: color 0.2s;
    }
    .password-toggle-btn:hover {
      color: #fff;
    }
    .btn-group {
      display: flex;
      gap: 12px;
      flex-wrap: wrap;
    }
    button {
      background: var(--primary);
      color: #fff;
      border: none;
      padding: 12px 24px;
      font-size: 1rem;
      font-weight: 600;
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.2s;
      display: inline-flex;
      align-items: center;
      gap: 8px;
    }
    button:hover {
      background: var(--primary-hover);
      transform: translateY(-1px);
    }
    button.secondary {
      background: #374151;
    }
    button.secondary:hover {
      background: #4b5563;
    }
    button.danger {
      background: var(--danger);
    }
    button.danger:hover {
      background: #dc2626;
    }
    button:disabled {
      opacity: 0.5;
      cursor: not-allowed;
      transform: none !important;
    }
    pre {
      background: rgba(0, 0, 0, 0.45);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 16px;
      color: #34d399;
      font-family: monospace;
      font-size: 0.88rem;
      overflow-x: auto;
      margin-top: 15px;
      white-space: pre-wrap;
    }
    .status-container {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 20px;
    }
    .status-dot {
      width: 14px;
      height: 14px;
      border-radius: 50%;
      background: #9ca3af;
      box-shadow: 0 0 8px rgba(156, 163, 175, 0.5);
    }
    .status-text {
      font-size: 1.15rem;
      font-weight: 600;
    }
    .info-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
      gap: 16px;
      font-size: 0.92rem;
    }
    .info-item {
      background: rgba(255, 255, 255, 0.02);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 12px;
    }
    .info-label {
      color: var(--text-muted);
      font-size: 0.78rem;
      margin-bottom: 4px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .info-value {
      font-weight: 600;
    }
    .lock-banner {
      background: rgba(59, 130, 246, 0.08);
      border: 1px dashed rgba(59, 130, 246, 0.3);
      border-radius: 8px;
      padding: 12px;
      text-align: center;
      font-size: 0.9rem;
      color: #93c5fd;
      margin-top: 16px;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
    }
    .welcome-text {
      font-size: 1rem;
      color: #34d399;
      font-weight: 600;
    }
  </style>
</head>
<body>
  <main>
    <header>
      <div class="brand-section">
        <h1>${APP_NAME}</h1>
        <div class="watermark">${WATERMARK}</div>
      </div>
      <div id="user-info-section" style="display: none;">
        <span class="welcome-text" id="welcome-msg"></span>
        <button class="secondary" style="padding: 8px 16px; font-size: 0.9rem; margin-left: 10px;" onclick="logout()">登出</button>
      </div>
    </header>

    <!-- Card 1: Host Status (Always Public) -->
    <section class="card" id="status-card">
      <h2>地端主機狀態 (Host IP & Status)</h2>
      <div class="status-container">
        <div class="status-dot" id="status-dot"></div>
        <div class="status-text" id="status-text">偵測中...</div>
      </div>
      <div class="info-grid">
        <!-- Publicly Disclosed -->
        <div class="info-item">
          <div class="info-label">主機名稱</div>
          <div class="info-value" id="host-name">-</div>
        </div>
        <div class="info-item">
          <div class="info-label">作業系統</div>
          <div class="info-value" id="host-os">-</div>
        </div>
        <!-- Authenticated Only -->
        <div class="info-item private-field" style="display: none;">
          <div class="info-label">更新方式</div>
          <div class="info-value" id="host-method">-</div>
        </div>
        <div class="info-item private-field" style="display: none;">
          <div class="info-label">最後回報時間</div>
          <div class="info-value" id="host-last-seen">-</div>
        </div>
      </div>
      
      <!-- Lock message for guests -->
      <div class="lock-banner" id="lock-banner">
        🔒 登入系統後解鎖詳細上報頻率與時間差。
      </div>

      <div class="field" style="margin-top: 20px;">
        <label>地端連線網址</label>
        <div style="display: flex; gap: 8px;">
          <input type="text" id="host-url" readonly style="background: rgba(0, 0, 0, 0.55);">
          <button id="copy-btn" onclick="copyHostUrl()">📋 複製</button>
        </div>
      </div>
    </section>

    <!-- Card 2: Login Wrapper (Visible to Guests) -->
    <section class="card" id="login-wrapper">
      <h2>中控系統登入</h2>
      <p style="color: var(--text-muted); font-size: 0.88rem; margin-top: 0;">請輸入同仁帳密以存取工作站喚醒與連線診斷面板。</p>
      <div class="field">
        <label for="login-user">帳號 (Username)</label>
        <input type="text" id="login-user" placeholder="例如 admin">
      </div>
      <div class="field">
        <label for="login-pass">密碼 (Password)</label>
        <div class="password-wrapper">
          <input type="password" id="login-pass" placeholder="請輸入密碼">
          <button type="button" class="password-toggle-btn" onclick="toggleTokenVisibility('login-pass', this)" title="顯示/隱藏密碼">👁️</button>
        </div>
      </div>
      <button onclick="submitLogin(this)" style="width: 100%;">登入系統</button>
      <div id="login-error-msg" style="color: var(--danger); font-weight: 600; text-align: center; margin-top: 15px; font-size: 0.9rem;"></div>
      
      <div style="background: rgba(16, 185, 129, 0.05); border-left: 4px solid var(--primary); border-radius: 8px; padding: 12px; font-size: 0.8rem; color: var(--text-muted); margin-top: 20px; line-height: 1.5;">
        <strong style="color: #34d399; display: block; margin-bottom: 4px;">💡 預設測試帳密 (密碼皆為 123456)：</strong>
        管理員：<code>admin</code> | 特權：<code>power</code> | 一般：<code>user</code>
      </div>
    </section>

    <!-- Wrapper 3: Main Content (Visible to Logged-in Users) -->
    <div id="main-content-wrapper" style="display: none;">
      <!-- Workstation Settings Card -->
      <section class="card">
        <h2>喚醒地端伺服器設定 (Workstation Settings)</h2>
        <p style="color: var(--text-muted); font-size: 0.88rem; margin-top: 0;">設定本機/區網或 ngrok 轉發網址，雲端可在此直接儲存工作站 URL。</p>
        <div class="field">
          <label for="workstation-url">工作站 URL (Workstation URL)</label>
          <input type="text" id="workstation-url" placeholder="https://your-ngrok.ngrok-free.dev 或 http://192.168.x.x:8765">
        </div>
        <button onclick="saveWorkstationUrl(this)">💾 儲存工作站網址</button>
        <pre id="workstation-output" style="display: none;"></pre>
      </section>

      <!-- Diagnostics Card -->
      <section class="card">
        <h2>連線測試與診斷 (Diagnostics)</h2>
        <div class="field">
          <label for="api-token">系統 API 金鑰 (API Token)</label>
          <div class="password-wrapper">
            <input type="password" id="api-token" placeholder="請輸入 API 金鑰">
            <button type="button" class="password-toggle-btn" onclick="toggleTokenVisibility('api-token', this)" title="顯示/隱藏密碼">👁️</button>
          </div>
        </div>
        <div class="btn-group">
          <button onclick="testConnection(this)">⚡ 測試金鑰連線</button>
          <button class="secondary" onclick="refreshStatus(this)">🔄 重新整理狀態</button>
        </div>
        <pre id="diagnostic-output" style="display: none;"></pre>
      </section>
    </div>
  </main>

  <script>
    // System Configuration state (populated dynamically after login for security)
    let hostState = {
      lanUrl: '',
      hostname: '',
      osType: '',
      method: '',
      interval: '',
      lastSeen: '',
      workstationUrl: ''
    };

    function getApiToken() {
      return document.getElementById('api-token').value.trim();
    }

    function setBtnState(btn, loading, label) {
      if (!btn) return;
      btn.disabled = loading;
      if (label) btn.innerText = label;
    }

    function copyHostUrl() {
      const urlInput = document.getElementById('host-url');
      if (!urlInput || !urlInput.value) return;
      navigator.clipboard.writeText(urlInput.value).then(() => {
        const copyBtn = document.getElementById('copy-btn');
        const originalText = copyBtn.innerText;
        copyBtn.innerText = '✅ 已複製';
        setTimeout(() => { copyBtn.innerText = originalText; }, 2000);
      });
    }

    function renderHostStatus(role) {
      const dot = document.getElementById('status-dot');
      const text = document.getElementById('status-text');
      const nameEl = document.getElementById('host-name');
      const osEl = document.getElementById('host-os');
      const methodEl = document.getElementById('host-method');
      const lastSeenEl = document.getElementById('host-last-seen');
      const urlEl = document.getElementById('host-url');
      const copyBtn = document.getElementById('copy-btn');
      const lockBanner = document.getElementById('lock-banner');
      const privateFields = document.querySelectorAll('.private-field');

      if (!dot || !text || !nameEl || !osEl || !methodEl || !lastSeenEl || !urlEl || !copyBtn) return;

      try {
        // Handle field visibility based on role
        if (!role || role === 'guest') {
          lockBanner.style.display = 'flex';
          privateFields.forEach(el => el.style.display = 'none');
          urlEl.value = '•••••••••••••••••••• (請登入後檢視)';
          copyBtn.style.display = 'none';
        } else {
          lockBanner.style.display = 'none';
          privateFields.forEach(el => el.style.display = 'block');
          urlEl.value = hostState.lanUrl || '-';
          copyBtn.style.display = 'inline-flex';
        }

        if (!hostState.lastSeen) {
          dot.style.background = '#ef4444';
          dot.style.boxShadow = '0 0 10px rgba(239, 68, 68, 0.6)';
          text.textContent = '🔴 地端主機未上報連線資訊';
          nameEl.textContent = '無資料';
          osEl.textContent = '無資料';
          return;
        }

        let lastSeenDate = new Date(hostState.lastSeen);
        if (isNaN(lastSeenDate.getTime())) {
          const formatted = hostState.lastSeen.replace(/-/g, '/');
          lastSeenDate = new Date(formatted);
        }

        const now = new Date();
        const diffMs = now - lastSeenDate;
        const diffMins = Math.floor(diffMs / 1000 / 60);

        const intervalSec = parseInt(hostState.interval) || 300;
        const thresholdMins = Math.max(10, Math.ceil((intervalSec * 2.5) / 60));

        const isOnline = !isNaN(diffMs) && (diffMins < thresholdMins);

        nameEl.textContent = hostState.hostname || '未知主機';
        osEl.textContent = hostState.osType || '未知系統';
        // urlEl.value is set in the role-based conditional above

        // Details only populated/shown if logged in
        if (role && role !== 'guest') {
          let methodStr = '未知';
          if (hostState.method === 'manual') {
            methodStr = '👉 手動推送';
          } else if (hostState.method === 'scheduled') {
            methodStr = '⏱️ 自動排程 (' + Math.round(intervalSec / 60) + ' 分)';
          }
          methodEl.textContent = methodStr;
          lastSeenEl.textContent = hostState.lastSeen + ' (' + (isNaN(diffMins) ? '未知' : '約 ' + diffMins + ' 分鐘前') + ')';
        }

        if (isOnline) {
          dot.style.background = '#10b981';
          dot.style.boxShadow = '0 0 10px rgba(16, 185, 129, 0.6)';
          text.textContent = '🟢 地端主機連線正常';
        } else {
          dot.style.background = '#ef4444';
          dot.style.boxShadow = '0 0 10px rgba(239, 68, 68, 0.6)';
          text.textContent = '🔴 地端主機已離線或逾期';
        }
      } catch (err) {
        console.error('Error rendering host status:', err);
        text.textContent = '⚠️ 狀態解析錯誤: ' + err.message;
      }
    }

    function showLoginScreen() {
      document.getElementById('login-wrapper').style.display = 'block';
      document.getElementById('main-content-wrapper').style.display = 'none';
      document.getElementById('user-info-section').style.display = 'none';
    }

    function showMainContent(auth) {
      document.getElementById('login-wrapper').style.display = 'none';
      document.getElementById('main-content-wrapper').style.display = 'block';
      document.getElementById('user-info-section').style.display = 'flex';
      document.getElementById('welcome-msg').textContent = '歡迎, ' + auth.display_name;
      
      // Auto-fill token input
      document.getElementById('api-token').value = auth.token || '';
      document.getElementById('workstation-url').value = hostState.workstationUrl || '';
    }

    function toggleTokenVisibility(inputId, btn) {
      const input = document.getElementById(inputId);
      if (input.type === 'password') {
        input.type = 'text';
        btn.textContent = '🙈';
      } else {
        input.type = 'password';
        btn.textContent = '👁️';
      }
    }

    function submitLogin(btn) {
      const user = document.getElementById('login-user').value.trim();
      const pass = document.getElementById('login-pass').value.trim();
      const errorEl = document.getElementById('login-error-msg');
      errorEl.textContent = '';

      if (!user || !pass) {
        errorEl.textContent = '請輸入帳號與密碼！';
        return;
      }

      setBtnState(btn, true, '登入中...');
      google.script.run
        .withSuccessHandler(data => {
          setBtnState(btn, false, '登入系統');
          if (data && data.ok) {
            sessionStorage.setItem('falo_auth', JSON.stringify(data));
            showMainContent(data);
            refreshStatusSilent(data.token);
          } else {
            errorEl.textContent = (data && data.error) ? data.error : '登入失敗。';
          }
        })
        .withFailureHandler(err => {
          setBtnState(btn, false, '登入系統');
          errorEl.textContent = '系統錯誤: ' + err.message;
        })
        .uiLogin(user, pass);
    }

    function logout() {
      sessionStorage.removeItem('falo_auth');
      showLoginScreen();
      renderHostStatus('guest');
    }

    function showOutput(elId, data) {
      const el = document.getElementById(elId);
      if (el) {
        el.style.display = 'block';
        el.textContent = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
      }
    }

    function saveWorkstationUrl(btn) {
      const url = document.getElementById('workstation-url').value.trim();
      setBtnState(btn, true, '儲存中...');
      google.script.run
        .withSuccessHandler(data => {
          setBtnState(btn, false, '💾 儲存工作站網址');
          showOutput('workstation-output', data);
        })
        .withFailureHandler(err => {
          setBtnState(btn, false, '💾 儲存工作站網址');
          showOutput('workstation-output', { ok: false, error: err.message || String(err) });
        })
        .uiSaveWorkstationUrl(getApiToken(), url);
    }

    function testConnection(btn) {
      setBtnState(btn, true, '測試中...');
      google.script.run
        .withSuccessHandler(data => {
          setBtnState(btn, false, '⚡ 測試金鑰連線');
          showOutput('diagnostic-output', data);
        })
        .withFailureHandler(err => {
          setBtnState(btn, false, '⚡ 測試金鑰連線');
          showOutput('diagnostic-output', { ok: false, error: err.message || String(err) });
        })
        .uiTestConnection(getApiToken());
    }

    function refreshStatus(btn) {
      setBtnState(btn, true, '重新整理中...');
      google.script.run
        .withSuccessHandler(data => {
          setBtnState(btn, false, '🔄 重新整理狀態');
          if (data && data.ok) {
            hostState.lanUrl = data.reported_lan_url || '';
            hostState.hostname = data.reported_hostname || '';
            hostState.osType = data.reported_os_type || '';
            hostState.method = data.reported_method || '';
            hostState.interval = data.reported_interval || '';
            hostState.lastSeen = data.reported_last_seen || '';
            hostState.workstationUrl = data.workstation_url || '';
            
            document.getElementById('workstation-url').value = hostState.workstationUrl;
            
            let role = 'guest';
            try {
              const session = sessionStorage.getItem('falo_auth');
              if (session) {
                role = JSON.parse(session).role || 'guest';
              }
            } catch (e) {}
            
            renderHostStatus(role);
          }
        })
        .withFailureHandler(err => {
          setBtnState(btn, false, '🔄 重新整理狀態');
          alert('重新整理失敗: ' + (err.message || String(err)));
        })
        .uiCloudStatus(getApiToken());
    }

    function refreshStatusSilent(token) {
      google.script.run
        .withSuccessHandler(data => {
          if (data && data.ok) {
            hostState.lanUrl = data.reported_lan_url || '';
            hostState.hostname = data.reported_hostname || '';
            hostState.osType = data.reported_os_type || '';
            hostState.method = data.reported_method || '';
            hostState.interval = data.reported_interval || '';
            hostState.lastSeen = data.reported_last_seen || '';
            hostState.workstationUrl = data.workstation_url || '';
            
            document.getElementById('workstation-url').value = hostState.workstationUrl;
            
            let role = 'guest';
            try {
              const session = sessionStorage.getItem('falo_auth');
              if (session) {
                role = JSON.parse(session).role || 'guest';
              }
            } catch (e) {}
            
            renderHostStatus(role);
          }
        })
        .uiCloudStatus(token);
    }

    function initPortal() {
      let auth = null;
      try {
        const session = sessionStorage.getItem('falo_auth');
        if (session) {
          auth = JSON.parse(session);
        }
      } catch (e) {
        console.warn('sessionStorage is not available:', e);
      }

      if (auth) {
        showMainContent(auth);
        refreshStatusSilent(auth.token);
      } else {
        showLoginScreen();
        renderHostStatus('guest');
      }
    }

    // Call init at the end to avoid Temporal Dead Zone (TDZ) issues
    initPortal();
  </script>
</body>
</html>`;
  return HtmlService.createHtmlOutput(html).setTitle(APP_NAME);
}
