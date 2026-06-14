/**
 * AI NotebookLM GAS Command Center V2 - Spreadsheet Setup & Data Access Helpers
 * Falo x Force Teaching Command Center
 */

function setupSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // 1. Reset or create Settings sheet
  resetOrCreateSheet_(ss, SHEETS.SETTINGS, HEADERS.Settings, [
    ['api_token', DEFAULT_TOKEN, 'Local Python worker must send this token.'],
    ['workstation_url', DEFAULT_WORKSTATION_MAC_URL, 'Local runtime URL.'],
    ['runtime_reported_lan_url', '', 'Last reported LAN URL from Python worker.'],
    ['runtime_hostname', '', 'Last reported hostname from Python worker.'],
    ['runtime_os_type', '', 'Last reported OS platform.'],
    ['runtime_report_method', '', 'Last reported connection method.'],
    ['runtime_poll_interval_seconds', '', 'Last reported polling interval in seconds.'],
    ['runtime_last_seen_at', '', 'Last reported timestamp from Python worker.'],
  ]);
  
  // 2. Reset or create Users sheet
  resetOrCreateSheet_(ss, SHEETS.USERS, HEADERS.Users, [
    ['admin', 'Admin', 'admin', '123456', true],
    ['manager', 'Document Manager', 'document_manager', '123456', true],
    ['user', 'User', 'user', '123456', true],
    ['power', 'Power User', 'power', '123456', true],
  ]);
  
  // 3. Delete any other sheets not in Settings or Users
  const allowedNames = [SHEETS.SETTINGS, SHEETS.USERS];
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
  
  return json_({ ok: true, app: APP_NAME, message: 'Sheet reset and initialized successfully. Legacy sheets cleared.' });
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
