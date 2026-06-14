/**
 * AI NotebookLM GAS Command Center v2.01
 * v2.01版 Falo x Force Cheng 2026/6/14
 */

const APP_NAME = 'AI NotebookLM GAS Command Center v2.01';
const WATERMARK = 'v2.01版 Falo x Force Cheng 2026/6/14';
const DEFAULT_TOKEN = '123456';
const DEFAULT_WORKSTATION_MAC_URL = 'https://conclude-reapply-backhand.ngrok-free.dev/';

const SHEETS = {
  SETTINGS: 'Settings',
  USERS: 'Users',
  HOSTS: 'Hosts',
  HOST_LOGS: 'HostLogs'
};

const HEADERS = {
  Settings: ['key', 'value', 'note'],
  Users: ['user_id', 'display_name', 'role', 'password', 'active'],
  Hosts: ['hostname', 'lan_url', 'wan_url', 'os_type', 'report_method', 'poll_interval_seconds', 'last_seen_at'],
  HostLogs: ['timestamp', 'hostname', 'lan_url', 'wan_url', 'os_type', 'report_method']
};

function doGet(e) {
  const params = e && e.parameter ? e.parameter : {};
  const action = params.action || 'ui';
  try {
    if (action === 'ui') return renderPortal_();
    if (action === 'portal') return HtmlService.createHtmlOutputFromFile('gas-web').setTitle(APP_NAME);
    if (action === 'setup') return setupSheet();
    if (action === 'ping') return json_({
      ok: true,
      app: APP_NAME,
      now: new Date().toISOString(),
      spreadsheet_url: SpreadsheetApp.getActiveSpreadsheet().getUrl()
    });
    if (action === 'login') return json_(login_(params.user_id, params.password));
    if (action === 'cloud_status') return json_(getCloudStatusGuest_());
    
    // Auth check for REST api actions
    const settings = getSettings_();
    const token = String(params.token || '').trim();
    const settingsToken = String(settings.api_token || DEFAULT_TOKEN).trim();
    if (!token || token !== settingsToken) {
      return json_({ ok: false, error: 'Unauthorized token.' });
    }
    
    if (action === 'test_connection') {
      return json_({ ok: true, message: 'Connection verified. API token is correct.' });
    }
    if (action === 'cloud_status_auth') {
      return json_(getCloudStatus_());
    }
    if (action === 'get_host_list') {
      return json_({ ok: true, hosts: rows_(SHEETS.HOSTS) });
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
    if (action === 'cloud_status') {
      return json_(getCloudStatusGuest_());
    }
    
    const settings = getSettings_();
    const token = String(payload.token || '').trim();
    const settingsToken = String(settings.api_token || DEFAULT_TOKEN).trim();
    
    if (action === 'update_host_info') {
      if (!token || token !== settingsToken) {
        return json_({ ok: false, error: 'Unauthorized token.' });
      }
      const hostname = payload.hostname || '未知主機';
      let lanUrl = payload.lan_url || '';
      const wanUrl = payload.wan_url || '';
      
      // Filter out 127.0.0.1 / localhost from overwriting valid LAN IP
      if (lanUrl.indexOf('://127.') !== -1 || lanUrl.indexOf('://localhost') !== -1) {
        const existingLan = settings.runtime_reported_lan_url || '';
        if (existingLan && existingLan.indexOf('://127.') === -1 && existingLan.indexOf('://localhost') === -1) {
          lanUrl = existingLan;
        }
      }
      const osType = payload.os_type || '';
      const method = payload.report_method || '';
      const interval = payload.poll_interval_seconds || '';
      const localTime = payload.local_time || new Date().toISOString();

      // 1. Write to HostLogs
      try {
        const logSheet = sheet_(SHEETS.HOST_LOGS);
        logSheet.appendRow([localTime, hostname, lanUrl, wanUrl, osType, method]);
      } catch (e) {
        console.error('Failed to write host log:', e);
      }

      // 2. Update/Insert in Hosts sheet
      try {
        const hostsSheet = sheet_(SHEETS.HOSTS);
        const hostsData = hostsSheet.getDataRange().getValues();
        let foundIdx = -1;
        for (let i = 1; i < hostsData.length; i++) {
          if (hostsData[i][0] === hostname) {
            foundIdx = i + 1;
            break;
          }
        }
        const rowData = [hostname, lanUrl, wanUrl, osType, method, interval, localTime];
        if (foundIdx !== -1) {
          hostsSheet.getRange(foundIdx, 1, 1, rowData.length).setValues([rowData]);
        } else {
          hostsSheet.appendRow(rowData);
        }
      } catch (e) {
        console.error('Failed to update host list:', e);
      }

      // 3. Routing updates based on workstation_routing_mode
      const routingMode = String(settings.workstation_routing_mode || 'latest').trim();
      if (routingMode === 'latest') {
        const existingLastSeen = settings.runtime_last_seen_at || '';
        let isNewer = true;
        if (existingLastSeen) {
          const oldTime = parseDateStr_(existingLastSeen).getTime();
          const newTime = parseDateStr_(localTime).getTime();
          isNewer = (newTime >= oldTime);
        }
        
        if (isNewer) {
          const activeUrl = wanUrl || lanUrl; // Prefer WAN/ngrok URL
          updateSetting_('workstation_url', activeUrl, 'Auto-updated from latest connection.');
          updateSetting_('runtime_reported_lan_url', lanUrl);
          updateSetting_('runtime_reported_wan_url', wanUrl);
          updateSetting_('runtime_hostname', hostname);
          updateSetting_('runtime_os_type', osType);
          updateSetting_('runtime_report_method', method);
          updateSetting_('runtime_poll_interval_seconds', interval);
          updateSetting_('runtime_last_seen_at', localTime);
        }
      } else {
        const manualHost = String(settings.workstation_manual_host || '').trim();
        if (manualHost === hostname) {
          const activeUrl = wanUrl || lanUrl;
          updateSetting_('workstation_url', activeUrl, 'Updated locked workstation URL.');
          updateSetting_('runtime_reported_lan_url', lanUrl);
          updateSetting_('runtime_reported_wan_url', wanUrl);
          updateSetting_('runtime_hostname', hostname);
          updateSetting_('runtime_os_type', osType);
          updateSetting_('runtime_report_method', method);
          updateSetting_('runtime_poll_interval_seconds', interval);
          updateSetting_('runtime_last_seen_at', localTime);
        }
      }
      return json_({ ok: true, message: 'Host info updated successfully.' });
    }
    
    // Auth check for all other operations
    if (!token || token !== settingsToken) {
      return json_({ ok: false, error: 'Unauthorized token.' });
    }
    
    if (action === 'test_connection') {
      return json_({ ok: true, message: 'Connection verified. API token is correct.' });
    }
    if (action === 'cloud_status_auth') {
      return json_(getCloudStatus_());
    }
    if (action === 'get_host_list') {
      return json_({ ok: true, hosts: rows_(SHEETS.HOSTS) });
    }
    if (action === 'set_routing_config') {
      const res = uiSetRoutingConfig(token, payload.routing_mode, payload.manual_host);
      return json_(res);
    }
    if (action === 'save_workstation_url') {
      const res = uiSaveWorkstationUrl(token, payload.workstation_url);
      return json_(res);
    }
    if (action === 'clear_logs_and_hosts') {
      const res = uiClearLogsAndHosts(token);
      return json_(res);
    }
    if (action === 'export_system_data') {
      const res = uiExportSystemData(token);
      return json_(res);
    }
    if (action === 'import_system_data') {
      const res = uiImportSystemData(token, payload.json_str);
      return json_(res);
    }
    
    return json_({ ok: false, error: `Unknown POST action: ${action}` });
  } catch (err) {
    return json_({ ok: false, error: err.message });
  }
}

function getCloudStatusGuest_() {
  const settings = getSettings_();
  return {
    ok: true,
    app: APP_NAME,
    now: new Date().toISOString(),
    reported_lan_url: settings.runtime_reported_lan_url || '',
    reported_hostname: settings.runtime_hostname || '',
    reported_os_type: settings.runtime_os_type || '',
    reported_interval: settings.runtime_poll_interval_seconds || '',
    reported_last_seen: settings.runtime_last_seen_at || '',
    guest_logs: getGuestLogs_()
  };
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

function uiGetHostList(token) {
  requireToken_(token);
  try {
    return { ok: true, hosts: rows_(SHEETS.HOSTS) };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

function uiSetRoutingConfig(token, mode, selectedHostname) {
  requireToken_(token);
  try {
    updateSetting_('workstation_routing_mode', mode);
    updateSetting_('workstation_manual_host', selectedHostname || '');
    
    if (mode === 'manual' && selectedHostname) {
      const hosts = rows_(SHEETS.HOSTS);
      const host = hosts.find(h => h.hostname === selectedHostname);
      if (host) {
        const activeUrl = host.wan_url || host.lan_url;
        updateSetting_('workstation_url', activeUrl, 'Updated to manual selected host URL.');
        updateSetting_('runtime_reported_lan_url', host.lan_url);
        updateSetting_('runtime_reported_wan_url', host.wan_url);
        updateSetting_('runtime_hostname', host.hostname);
        updateSetting_('runtime_os_type', host.os_type);
        updateSetting_('runtime_report_method', host.report_method);
        updateSetting_('runtime_poll_interval_seconds', host.poll_interval_seconds);
        updateSetting_('runtime_last_seen_at', host.last_seen_at);
      }
    }
    return { ok: true, message: 'Routing configuration updated successfully.' };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

function uiExportSystemData(token) {
  requireToken_(token);
  try {
    const settingsData = rows_(SHEETS.SETTINGS);
    const usersData = rows_(SHEETS.USERS);
    const data = {
      app: APP_NAME,
      exported_at: new Date().toISOString(),
      settings: settingsData,
      users: usersData
    };
    return { ok: true, json_str: JSON.stringify(data, null, 2) };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

function uiImportSystemData(token, jsonStr) {
  requireToken_(token);
  try {
    const data = JSON.parse(jsonStr);
    if (!data.settings || !data.users) {
      throw new Error('Invalid backup file. Settings or Users data missing.');
    }
    
    const settingsSheet = sheet_(SHEETS.SETTINGS);
    data.settings.forEach(s => {
      if (s.key) {
        updateSetting_(s.key, s.value, s.note || '');
      }
    });
    
    const usersSheet = sheet_(SHEETS.USERS);
    usersSheet.clearContents();
    usersSheet.appendRow(HEADERS.Users);
    data.users.forEach(u => {
      if (u.user_id) {
        usersSheet.appendRow([u.user_id, u.display_name, u.role, u.password, u.active]);
      }
    });
    
    return { ok: true, message: 'System data imported and restored successfully.' };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

function uiClearLogsAndHosts(token) {
  requireToken_(token);
  try {
    const hostsSheet = sheet_(SHEETS.HOSTS);
    hostsSheet.clearContents();
    hostsSheet.appendRow(HEADERS.Hosts);
    
    const logsSheet = sheet_(SHEETS.HOST_LOGS);
    logsSheet.clearContents();
    logsSheet.appendRow(HEADERS.HostLogs);
    
    return { ok: true, message: 'Host list and activity logs cleared successfully.' };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

function requireToken_(token) {
  const settings = getSettings_();
  const tokenStr = String(token || '').trim();
  const settingsTokenStr = String(settings.api_token || DEFAULT_TOKEN).trim();
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
    reported_wan_url: settings.runtime_reported_wan_url || '',
    reported_hostname: settings.runtime_hostname || '',
    reported_os_type: settings.runtime_os_type || '',
    reported_method: settings.runtime_report_method || '',
    reported_interval: settings.runtime_poll_interval_seconds || '',
    reported_last_seen: settings.runtime_last_seen_at || '',
    workstation_url: settings.workstation_url || '',
    routing_mode: settings.workstation_routing_mode || 'latest',
    manual_host: settings.workstation_manual_host || '',
    spreadsheet_url: SpreadsheetApp.getActiveSpreadsheet().getUrl(),
    auth_logs: getAuthLogs_()
  };
}

function getGuestLogs_() {
  try {
    const logs = rows_(SHEETS.HOST_LOGS);
    const candidates = logs.slice(-30);
    candidates.sort((a, b) => {
      return parseDateStr_(b.timestamp || b.local_time).getTime() - parseDateStr_(a.timestamp || a.local_time).getTime();
    });
    const top5 = candidates.slice(0, 5);
    return top5.map(log => {
      const copy = { ...log };
      if (copy.wan_url) {
        copy.wan_url = '••••••';
      }
      return copy;
    });
  } catch (e) {
    return [];
  }
}

function getAuthLogs_() {
  try {
    const logs = rows_(SHEETS.HOST_LOGS);
    const candidates = logs.slice(-30);
    candidates.sort((a, b) => {
      return parseDateStr_(b.timestamp || b.local_time).getTime() - parseDateStr_(a.timestamp || a.local_time).getTime();
    });
    return candidates.slice(0, 5);
  } catch (e) {
    return [];
  }
}

function parseDateStr_(val) {
  if (!val) return new Date(0);
  let d = new Date(val);
  if (isNaN(d.getTime()) && typeof val === 'string') {
    d = new Date(val.replace(/-/g, '/'));
  }
  return isNaN(d.getTime()) ? new Date(0) : d;
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
  const settings = getSettings_();
  const portalUrl = settings.portal_url || 'https://www.google.com.tw';
  const safeLanUrl = String(settings.runtime_reported_lan_url || '').replace(/'/g, "\\'").replace(/"/g, '\\"');
  const safeHostname = String(settings.runtime_hostname || '').replace(/'/g, "\\'").replace(/"/g, '\\"');
  const safeOsType = String(settings.runtime_os_type || '').replace(/'/g, "\\'").replace(/"/g, '\\"');
  const safeInterval = String(settings.runtime_poll_interval_seconds || '').replace(/'/g, "\\'").replace(/"/g, '\\"');
  const safeLastSeen = String(settings.runtime_last_seen_at || '').replace(/'/g, "\\'").replace(/"/g, '\\"');

  const guestLogs = getGuestLogs_();
  const logsJsonBase64 = Utilities.base64Encode(JSON.stringify(guestLogs), Utilities.Charset.UTF_8);

  const html = `<!doctype html>
<html lang="zh-Hant">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${APP_NAME}</title>
  <style>
    :root {
      --bg: #0d1117;
      --card-bg: #161b22;
      --border: #30363d;
      --text: #c9d1d9;
      --text-muted: #8b949e;
      --primary: #2ea44f;
      --primary-hover: #30a14e;
      --accent: #58a6ff;
    }
    body {
      margin: 0;
      background-color: var(--bg);
      color: var(--text);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 16px;
      box-sizing: border-box;
    }
    .card {
      background-color: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 6px;
      padding: 24px;
      width: 100%;
      max-width: 680px;
      box-sizing: border-box;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
    }
    h1 {
      font-size: 1.15rem;
      font-weight: 600;
      margin: 0 0 16px 0;
      border-bottom: 1px solid var(--border);
      padding-bottom: 8px;
    }
    .status-container {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 16px;
    }
    .status-dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background-color: #da3633;
    }
    .status-text {
      font-size: 0.88rem;
      font-weight: 600;
    }
    .info-item {
      font-size: 0.82rem;
      margin-bottom: 8px;
      display: flex;
      justify-content: space-between;
    }
    .info-label {
      color: var(--text-muted);
    }
    .info-value {
      font-weight: 600;
      font-family: monospace;
    }
    .field {
      margin-top: 16px;
    }
    .field label {
      display: block;
      font-size: 0.82rem;
      color: var(--text-muted);
      margin-bottom: 6px;
    }
    .input-group {
      display: flex;
      gap: 8px;
    }
    input[type="text"] {
      flex: 1;
      box-sizing: border-box;
      background-color: var(--bg);
      border: 1px solid var(--border);
      border-radius: 6px;
      color: var(--text);
      padding: 6px 12px;
      font-size: 0.82rem;
      font-family: monospace;
      outline: none;
    }
    button, .btn {
      background-color: var(--primary);
      color: #ffffff;
      border: 1px solid rgba(240, 246, 252, 0.1);
      padding: 6px 12px;
      font-size: 0.82rem;
      font-weight: 500;
      border-radius: 6px;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      text-decoration: none;
      transition: background-color 0.2s;
    }
    button:hover, .btn:hover {
      background-color: var(--primary-hover);
    }
    button.secondary {
      background-color: #21262d;
      border: 1px solid var(--border);
      color: #c9d1d9;
    }
    button.secondary:hover {
      background-color: #30363d;
      border-color: #8b949e;
    }
    .jump-btn {
      display: flex;
      margin-top: 20px;
      width: 100%;
      box-sizing: border-box;
    }
    .watermark {
      font-size: 0.65rem;
      color: var(--text-muted);
      text-align: center;
      margin-top: 16px;
      font-family: monospace;
    }
  </style>
</head>
<body>
  <div class="card">
    <h1>${APP_NAME}</h1>
    <div class="status-container">
      <div class="status-dot" id="status-dot"></div>
      <div class="status-text" id="status-text">偵測中...</div>
    </div>
    
    <div class="info-item">
      <span class="info-label">主機名稱</span>
      <span class="info-value">${safeHostname || '-'}</span>
    </div>
    <div class="info-item">
      <span class="info-label">作業系統</span>
      <span class="info-value">${safeOsType || '-'}</span>
    </div>
    <div class="info-item">
      <span class="info-label">最後回報</span>
      <span class="info-value" id="last-seen-text">-</span>
    </div>

    <div class="field">
      <label>地端內網網址 (LAN)</label>
      <div class="input-group">
        <input type="text" id="host-lan-url" readonly value="${safeLanUrl}">
        <button id="copy-lan-btn" onclick="copyText()">📋 複製</button>
      </div>
    </div>

    <a href="${portalUrl}" target="_blank" class="btn jump-btn">
      🔗 點我開啟登入網頁
    </a>

    <!-- Logs Section -->
    <div style="margin-top: 24px; text-align: left;">
      <h2 style="font-size: 0.95rem; font-weight: 600; margin-bottom: 12px; border-bottom: 1px solid var(--border); padding-bottom: 8px;">最新 5 筆地端上報日誌 (Last 5 Heartbeats)</h2>
      <div style="overflow-x: auto;">
        <table style="width: 100%; border-collapse: collapse; font-size: 0.82rem; text-align: left; background-color: rgba(0,0,0,0.1); border-radius: 6px; overflow: hidden; border: 1px solid var(--border);">
          <thead>
            <tr style="background-color: rgba(255,255,255,0.02); border-bottom: 1px solid var(--border);">
              <th style="padding: 10px; color: var(--text);">時間</th>
              <th style="padding: 10px; color: var(--text);">主機名稱</th>
              <th style="padding: 10px; color: var(--text);">系統</th>
              <th style="padding: 10px; color: var(--text);">地端內網網址 (LAN IP)</th>
            </tr>
          </thead>
          <tbody id="logs-table-body">
            <tr>
              <td colspan="4" style="padding: 15px; text-align: center; color: var(--text-muted);">無日誌資料</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div class="watermark">${WATERMARK}</div>
  </div>

  <script>
    function copyText() {
      const input = document.getElementById('host-lan-url');
      if (!input || !input.value) return;
      navigator.clipboard.writeText(input.value).then(() => {
        const btn = document.getElementById('copy-lan-btn');
        const orig = btn.innerText;
        btn.innerText = '✅ 已複製';
        setTimeout(() => { btn.innerText = orig; }, 2000);
      });
    }

    function copyTextDirect(text, btn) {
      if (!text) return;
      navigator.clipboard.writeText(text).then(() => {
        const orig = btn.innerText;
        btn.innerText = '✅ 已複製';
        setTimeout(() => { btn.innerText = orig; }, 2000);
      });
    }

    function formatTaipeiTime(dateStr) {
      if (!dateStr || dateStr === '-') return '-';
      try {
        let d = new Date(dateStr);
        if (isNaN(d.getTime())) {
          d = new Date(dateStr.replace(/-/g, '/'));
        }
        if (isNaN(d.getTime())) return dateStr;
        
        const formatter = new Intl.DateTimeFormat('zh-TW', {
          timeZone: 'Asia/Taipei',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false
        });
        
        const parts = formatter.formatToParts(d);
        const v = {};
        parts.forEach(p => { v[p.type] = p.value; });
        return \`\${v.year}-\${v.month}-\${v.day} \${v.hour}:\${v.minute}:\${v.second}\`;
      } catch(e) {
        return dateStr;
      }
    }

    function renderLogs() {
      const logsJsonBase64 = '${logsJsonBase64}';
      let logs = [];
      try {
        logs = JSON.parse(decodeURIComponent(escape(window.atob(logsJsonBase64))));
      } catch(e) {
        console.error('Failed to parse logs:', e);
      }
      
      const tableBodyEl = document.getElementById('logs-table-body');
      if (!tableBodyEl) return;
      tableBodyEl.innerHTML = '';
      
      if (!logs || logs.length === 0) {
        tableBodyEl.innerHTML = '<tr><td colspan="4" style="padding: 15px; text-align: center; color: var(--text-muted);">無日誌資料</td></tr>';
        return;
      }
      
      logs.forEach(l => {
        const row = document.createElement('tr');
        row.style.borderBottom = '1px solid var(--border)';
        
        const lanHtml = l.lan_url ? \`
          <div style="display: inline-flex; align-items: center; gap: 4px;">
            <a href="\${l.lan_url}" target="_blank" style="color: var(--accent); text-decoration: none;">\${l.lan_url}</a>
            <button class="secondary" style="padding: 1px 4px; font-size: 0.68rem;" onclick="copyTextDirect('\${l.lan_url}', this)">📋</button>
          </div>
        \` : '-';
        
        const timeStr = formatTaipeiTime(l.timestamp || l.local_time);

        row.innerHTML = \`
          <td style="padding: 10px;">\${timeStr}</td>
          <td style="padding: 10px; font-weight: 600;">\${l.hostname}</td>
          <td style="padding: 10px;">\${l.os_type || '-'}</td>
          <td style="padding: 10px;">\${lanHtml}</td>
        \`;
        tableBodyEl.appendChild(row);
      });
    }

    function init() {
      const dot = document.getElementById('status-dot');
      const statusText = document.getElementById('status-text');
      const lastSeenText = document.getElementById('last-seen-text');
      const lastSeen = '${safeLastSeen}';
      const intervalSec = parseInt('${safeInterval}') || 300;

      if (!lastSeen) {
        dot.style.backgroundColor = '#da3633';
        statusText.textContent = '🔴 未上報狀態';
        lastSeenText.textContent = '無紀錄';
        renderLogs();
        return;
      }

      let lastSeenDate = new Date(lastSeen);
      if (isNaN(lastSeenDate.getTime())) {
        lastSeenDate = new Date(lastSeen.replace(/-/g, '/'));
      }
      
      const now = new Date();
      const diffMs = now - lastSeenDate;
      const diffMins = Math.floor(diffMs / 1000 / 60);
      const thresholdMins = Math.max(10, Math.ceil((intervalSec * 2.5) / 60));
      const isOnline = !isNaN(diffMs) && (diffMins < thresholdMins);

      lastSeenText.textContent = isNaN(diffMins) ? '未知' : (diffMins === 0 ? '剛剛' : diffMins + ' 分鐘前');

      if (isOnline) {
        dot.style.backgroundColor = '#2ea44f';
        statusText.textContent = '🟢 地端主機連線正常';
      } else {
        dot.style.backgroundColor = '#da3633';
        statusText.textContent = '🔴 地端主機已離線';
      }
      
      renderLogs();
    }
    init();
  </script>
</body>
</html>`;
  return HtmlService.createHtmlOutput(html).setTitle(APP_NAME);
}