/**
 * AI NotebookLM GAS Command Center v2.01 - Spreadsheet Setup & Data Access Helpers
 * v2.01版 Falo x Force Cheng 2026/6/14
 */

function setupSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // 1. Reset or create Settings sheet with mock active host info
  resetOrCreateSheet_(ss, SHEETS.SETTINGS, HEADERS.Settings, [
    ['api_token', DEFAULT_TOKEN, 'Local Python worker must send this token.'],
    ['portal_url', 'https://falo-taiwan.github.io/ai-notebooklm/v2/gas-web.html', 'The external login page / frontend URL to redirect users to.'],
    ['workstation_url', 'http://192.168.6.8:8765', 'Local runtime URL.'],
    ['workstation_routing_mode', 'latest', 'Host routing mode: latest or manual.'],
    ['workstation_manual_host', '', 'Designated workstation hostname (when in manual mode).'],
    ['runtime_reported_lan_url', 'http://192.168.6.8:8765', 'Last reported LAN URL from Python worker.'],
    ['runtime_reported_wan_url', '', 'Last reported WAN URL from Python worker.'],
    ['runtime_hostname', 'falo-ai', 'Last reported hostname from Python worker.'],
    ['runtime_os_type', 'Windows', 'Last reported OS platform.'],
    ['runtime_report_method', 'manual', 'Last reported connection method.'],
    ['runtime_poll_interval_seconds', '300', 'Last reported polling interval in seconds.'],
    ['runtime_last_seen_at', '2026-06-06 12:00:00', 'Last reported timestamp from Python worker.'],
  ]);
  
  // 2. Reset or create Users sheet
  resetOrCreateSheet_(ss, SHEETS.USERS, HEADERS.Users, [
    ['admin', 'Admin', 'admin', '123456', true],
    ['manager', 'Document Manager', 'document_manager', '123456', true],
    ['user', 'User', 'user', '123456', true],
    ['power', 'Power User', 'power', '123456', true],
  ]);
  
  // 3. Reset or create Hosts sheet with mock hosts
  resetOrCreateSheet_(ss, SHEETS.HOSTS, HEADERS.Hosts, [
    ['falo-ai', 'http://192.168.6.8:8765', '', 'Windows', 'manual', '300', '2026-06-06 12:00:00']
  ]);

  // 4. Reset or create HostLogs sheet with mock logs
  resetOrCreateSheet_(ss, SHEETS.HOST_LOGS, HEADERS.HostLogs, [
    ['2026-06-06 12:00:00', 'falo-ai', 'http://192.168.6.8:8765', '', 'Windows', 'manual']
  ]);
  
  // 5. Delete any other sheets not allowed
  const allowedNames = [SHEETS.SETTINGS, SHEETS.USERS, SHEETS.HOSTS, SHEETS.HOST_LOGS];
  const allSheets = ss.getSheets();
  allSheets.forEach(sheet => {
    const name = sheet.getName();
    if (allowedNames.indexOf(name) === -1) {
      try {
        ss.deleteSheet(sheet);
      } catch (err) {
        // Ignore errors
      }
    }
  });
  
  return json_({ ok: true, app: APP_NAME, message: 'Sheet reset and initialized successfully. Mock data pre-filled.' });
}

function resetOrCreateSheet_(ss, name, headers, defaultRows = []) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
  } else {
    sheet.clear();
  }
  sheet.appendRow(headers);
  defaultRows.forEach(row => {
    sheet.appendRow(row);
  });
  return sheet;
}

function sheet_(name) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    throw new Error(`Sheet not found: ${name}. Run setupSheet() first.`);
  }
  return sheet;
}

function rows_(name) {
  const sheet = sheet_(name);
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];
  const headers = data[0];
  return data.slice(1).map(row => {
    const obj = {};
    headers.forEach((h, idx) => {
      obj[h] = row[idx];
    });
    return obj;
  });
}

function objectFromRows_(rows, keyField, valField) {
  const obj = {};
  rows.forEach(r => {
    obj[r[keyField]] = r[valField];
  });
  return obj;
}

function getSettings_() {
  return objectFromRows_(rows_(SHEETS.SETTINGS), 'key', 'value');
}

function updateSetting_(key, value, note = '') {
  const sheet = sheet_(SHEETS.SETTINGS);
  const data = sheet.getDataRange().getValues();
  let foundRowIdx = -1;
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === key) {
      foundRowIdx = i + 1;
      break;
    }
  }
  if (foundRowIdx !== -1) {
    sheet.getRange(foundRowIdx, 2).setValue(value);
    if (note) {
      sheet.getRange(foundRowIdx, 3).setValue(note);
    }
  } else {
    sheet.appendRow([key, value, note]);
  }
}
