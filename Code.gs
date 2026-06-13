/**
 * AI NotebookLM Runtime Lab - Google Sheet / GAS Command Center MVP
 * Falo x Force Teaching Runtime
 *
 * Cloud side responsibilities:
 * - one Google Sheet controls users, projects, folders, tasks, logs
 * - Drive folder ids are dynamic data, not hard-coded paths
 * - local Python worker polls this Web App; no ngrok is required
 *
 * 中文教學說明：
 * - GAS 不是直接操作 NotebookLM 的核心 runtime。
 * - GAS 的角色是「雲端任務中控」：建立任務、保存狀態、提供 Drive 檔案給本機 worker 下載。
 * - 本機 Python worker 才負責真正執行 NotebookLM upload，這樣權限邊界更清楚，也方便課堂示範。
 *
 * First run:
 * 1. Open Apps Script attached to a Google Sheet.
 * 2. Paste this file into Code.gs.
 * 3. Open appsscript.json and add oauthScopes.
 *    Trigger management needs:
 *    https://www.googleapis.com/auth/script.scriptapp
 *    Closed-loop Spreadsheet export needs:
 *    https://www.googleapis.com/auth/spreadsheets
 *    If this scope is missing, List / Install / Stop Heartbeat will fail with:
 *    "You do not have permission to call ScriptApp.getProjectTriggers".
 * 4. Run setupSheet().
 * 5. Run listHealthCheckTriggers() once from the Apps Script editor to trigger authorization.
 * 6. Deploy as Web App. Execute as: Me. Access: Anyone with the link, or your domain.
 */

const APP_NAME = 'AI NotebookLM Runtime Lab';
const WATERMARK = 'Falo x Force';
const DEFAULT_PASSWORD = '666666';
const DEFAULT_TOKEN = 'CHANGE_ME_LOCAL_TOKEN';
const DEFAULT_WORKSTATION_MAC_URL = 'https://conclude-reapply-backhand.ngrok-free.dev/';
const DEFAULT_WORKSTATION_WIN365_URL = '';
const HEALTH_CHECK_TRIGGER_HANDLER = 'scheduledHealthCheck';
const INCOMING_FOLDER_SCAN_TRIGGER_HANDLER = 'scheduledIncomingFolderScan';
const TEACHING_FOLDER_DEFAULTS = {
  incoming: '174_nbJlxQH72tbe1fE0nS6-vFJUKUvGP',
  processing: '1H6v8amVEIpBpINcp4nDBwqLxIuJMIMx3',
  archive: '1SNjie5hsHXGUftyFNUAbGeMNc47wzgWJ',
  error: '1jJjT2ZNu2cCfvjhB2VawPhcx0fYYPfw6',
  evidence: '1hM_BJ3mKpdC1REw9RlcI8TAfC8Hl9UkF',
};

const SHEETS = {
  SETTINGS: 'Settings',
  USERS: 'Users',
  PROJECTS: 'Projects',
  FOLDERS: 'Folders',
  TASKS: 'Tasks',
  FILE_STATE: 'Drive_File_State',
  LOGS: 'Runtime_Log',
};

const HEADERS = {
  Settings: ['key', 'value', 'note'],
  Users: ['user_id', 'display_name', 'role', 'password', 'active'],
  Projects: ['project_id', 'project_name', 'notebook_id', 'active', 'note'],
  Folders: ['folder_key', 'folder_name', 'google_drive_folder_id', 'purpose', 'active'],
  Tasks: [
    'task_id', 'created_at', 'updated_at', 'submitter', 'role',
    'project_id', 'source_folder_key', 'source_file_id', 'action',
    'status', 'duplicate_policy', 'file_types',
    'trigger_source', 'trigger_mode', 'cloud_event_type', 'source_file_name',
    'result', 'error'
  ],
  Drive_File_State: ['file_id', 'folder_key', 'file_name', 'first_seen_at', 'last_seen_at', 'task_id', 'status', 'note'],
  Runtime_Log: ['log_id', 'timestamp', 'task_id', 'actor', 'event_type', 'message', 'detail_json'],
};

function setupSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  ensureSheet_(ss, SHEETS.SETTINGS, HEADERS.Settings, [
    ['api_token', DEFAULT_TOKEN, 'Local Python worker must send this token.'],
    ['default_poll_seconds', '600', 'Local worker polling interval suggestion.'],
    ['heartbeat_window_start', '', 'Optional Cloud Heartbeat start datetime-local.'],
    ['heartbeat_window_end', '', 'Optional Cloud Heartbeat end datetime-local.'],
    ['scanner_window_start', '', 'Optional Cloud Folder Scanner start datetime-local.'],
    ['scanner_window_end', '', 'Optional Cloud Folder Scanner end datetime-local.'],
    ['workstation_url', DEFAULT_WORKSTATION_MAC_URL, 'Local runtime URL. Supports ngrok public URL, Tailscale private URL, LAN IP, or Win365 URL.'],
    ['workstation_url_preset_1_mac', DEFAULT_WORKSTATION_MAC_URL, 'Teaching preset 1: Mac host URL, currently ngrok; may also be Tailscale.'],
    ['workstation_url_preset_2_win365', DEFAULT_WORKSTATION_WIN365_URL, 'Teaching preset 2: reserved for Win365 host URL.'],
  ]);
  ensureSheet_(ss, SHEETS.USERS, HEADERS.Users, [
    ['admin', 'Admin', 'admin', DEFAULT_PASSWORD, true],
    ['manager', 'Document Manager', 'document_manager', DEFAULT_PASSWORD, true],
    ['user', 'User', 'user', DEFAULT_PASSWORD, true],
  ]);
  ensureSheet_(ss, SHEETS.PROJECTS, HEADERS.Projects, [
    ['demo_project', 'Demo Notebook Project', 'REPLACE_WITH_NOTEBOOK_ID', true, 'Replace with NotebookLM id before real upload.'],
  ]);
  ensureSheet_(ss, SHEETS.FOLDERS, HEADERS.Folders, [
    ['incoming', 'Incoming', 'REPLACE_WITH_GOOGLE_DRIVE_FOLDER_ID', '待處理來源', true],
    ['processing', 'Processing', 'REPLACE_WITH_GOOGLE_DRIVE_FOLDER_ID', '處理中', true],
    ['archive', 'Archive', 'REPLACE_WITH_GOOGLE_DRIVE_FOLDER_ID', '完成歸檔', true],
    ['error', 'Error', 'REPLACE_WITH_GOOGLE_DRIVE_FOLDER_ID', '失敗歸檔', true],
    ['evidence', 'Evidence', 'REPLACE_WITH_GOOGLE_DRIVE_FOLDER_ID', '上傳證據保存', true],
  ]);
  ensureSheet_(ss, SHEETS.TASKS, HEADERS.Tasks, []);
  ensureSheet_(ss, SHEETS.FILE_STATE, HEADERS.Drive_File_State, []);
  ensureSheet_(ss, SHEETS.LOGS, HEADERS.Runtime_Log, []);
  log_('', 'system', 'setup', 'Sheet schema initialized.', {});
  return json_({ ok: true, app: APP_NAME, message: 'Sheet schema initialized.' });
}

function createSampleMarkdownTask() {
  return json_(createSampleMarkdownTask_());
}

function createSampleMarkdownTask_(sourceInfo) {
  // Falo x Force 教學註解：
  // 測試檔使用「帶時間戳的 .md，內容等於檔名」，是為了讓老師和學生一眼看懂：
  // 1. 雲端確實產生了新檔案；2. 本機確實抓到了同一個檔案；3. NotebookLM 來源也能對上。
  const origin = sourceInfo || {
    trigger_source: 'simulation_test',
    trigger_mode: 'manual',
    cloud_event_type: 'create_sample_markdown_task',
  };
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const folder = getFolderByKey_('incoming');
  if (!folder || !folder.google_drive_folder_id || String(folder.google_drive_folder_id).indexOf('REPLACE_') === 0) {
    throw new Error('Please set Folders.incoming google_drive_folder_id before creating sample data.');
  }
  const stamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd-HHmmss');
  const filename = `gas-sample-${stamp}.md`;
  const driveFolder = DriveApp.getFolderById(folder.google_drive_folder_id);
  const file = driveFolder.createFile(filename, filename, MimeType.PLAIN_TEXT);
  const task = createTask_({
    submitter: 'admin',
    role: 'admin',
    project_id: 'demo_project',
    source_folder_key: 'incoming',
    source_file_id: file.getId(),
    action: 'upload_drive_file',
    duplicate_policy: 'rename',
    file_types: '.md',
    source_file_name: filename,
    trigger_source: origin.trigger_source,
    trigger_mode: origin.trigger_mode,
    cloud_event_type: origin.cloud_event_type,
  });
  recordDriveFileState_(file, 'incoming', task.task_id, 'queued', 'created_by_sample_markdown_task');
  log_(task.task_id, 'admin', origin.cloud_event_type || 'create_sample_markdown_task', `Created ${filename}`, { file_id: file.getId(), trigger_source: origin.trigger_source, trigger_mode: origin.trigger_mode });
  return { ok: true, file_name: filename, file_id: file.getId(), task: task };
}

function doGet(e) {
  const params = e && e.parameter ? e.parameter : {};
  const action = params.action || 'ui';
  try {
    if (action === 'ui') return renderPortal_();
    if (action === 'setup') return setupSheet();
    if (action !== 'ping' && action !== 'login') {
      requireToken_(params.token);
    }
    if (action === 'ping') return json_({ ok: true, app: APP_NAME, now: now_(), timezone: Session.getScriptTimeZone() });
    if (action === 'login') return json_(login_(params.user_id, params.password));
    if (action === 'test_connection') return json_(testConnection_(params.token));
    if (action === 'cloud_status') return json_(getCloudStatus_());
    if (action === 'config') return json_(getRuntimeConfig_());
    if (action === 'tasks') return json_(listTasks_(params.status || 'queued', Number(params.limit || 20)));
    if (action === 'command_package') return json_(buildCommandPackage_(params.task_id));
    if (action === 'download') return json_(downloadFile_(params.file_id));
    if (action === 'logs') return json_(listLogs_(params.event || '', params.search || '', Number(params.limit || 100)));
    if (action === 'folders') return json_({ ok: true, folders: rows_(SHEETS.FOLDERS), teaching_defaults: TEACHING_FOLDER_DEFAULTS });
    if (action === 'test_folders') return json_(testFolders_());
    if (action === 'export_json') return json_(exportWorkbookJson_());
    if (action === 'export_excel') return json_(exportWorkbookSpreadsheet_());
    if (action === 'export_logs_json') return json_(exportSheetJson_(SHEETS.LOGS, 'cloud_logs'));
    if (action === 'export_logs_excel') return json_(exportSheetSpreadsheet_(SHEETS.LOGS, 'cloud_logs'));
    if (action === 'export_tasks_json') return json_(exportSheetJson_(SHEETS.TASKS, 'cloud_tasks'));
    if (action === 'export_tasks_excel') return json_(exportSheetSpreadsheet_(SHEETS.TASKS, 'cloud_tasks'));
    if (action === 'export_duplicate_guard_json') return json_(exportSheetJson_(SHEETS.FILE_STATE, 'duplicate_guard'));
    if (action === 'export_duplicate_guard_excel') return json_(exportSheetSpreadsheet_(SHEETS.FILE_STATE, 'duplicate_guard'));
    if (action === 'sample_md_task') return json_(createSampleMarkdownTask_());
    if (action === 'scan_incoming_folder') return json_(scanIncomingFolderToTasks_());
    return json_({ ok: false, error: `Unknown action: ${action}` });
  } catch (err) {
    return json_({ ok: false, error: String(err && err.message ? err.message : err) });
  }
}

function doPost(e) {
  try {
    const payload = JSON.parse(e.postData && e.postData.contents ? e.postData.contents : '{}');
    const action = payload.action || '';
    requireToken_(payload.token);
    if (action === 'create_task') return json_(createTask_(payload));
    if (action === 'update_task') return json_(updateTask_(payload.task_id, payload.status, payload.result || {}, payload.error || ''));
    if (action === 'clear_logs') return json_(clearLogs_());
    if (action === 'clear_tasks') return json_(clearTasks_());
    if (action === 'clear_duplicate_guard') return json_(clearDuplicateGuard_());
    if (action === 'save_folders') return json_(saveFolders_(payload.folders || {}));
    if (action === 'log') {
      log_(payload.task_id || '', payload.actor || 'local_worker', payload.event_type || 'log', payload.message || '', payload.detail || {});
      return json_({ ok: true });
    }
    return json_({ ok: false, error: `Unknown POST action: ${action}` });
  } catch (err) {
    return json_({ ok: false, error: String(err && err.message ? err.message : err) });
  }
}

function uiListQueuedTasks(token) {
  requireToken_(token);
  return listTasks_('queued', 20);
}

function uiTestConnection(token) {
  requireToken_(token);
  return testConnection_(token);
}

function uiCloudStatus(token) {
  requireToken_(token);
  return getCloudStatus_();
}

function uiUseTeachingFolderDefaults(token) {
  requireToken_(token);
  return saveFolders_(TEACHING_FOLDER_DEFAULTS);
}

function uiSaveFolders(token, folderInputs) {
  requireToken_(token);
  return saveFolders_(folderInputs || {});
}

function uiTestFolders(token) {
  requireToken_(token);
  return testFolders_();
}

function uiCreateSampleMarkdownTask(token) {
  requireToken_(token);
  return createSampleMarkdownTask_();
}

function uiUploadFileToIncomingAndWake(token, uploadPayload) {
  requireToken_(token);
  return uploadFileToIncomingAndWake_(uploadPayload || {});
}

function uiScanIncomingFolder(token, context) {
  requireToken_(token);
  const result = scanIncomingFolderToTasks_('manual_cloud_scan');
  if (result.created_count > 0) {
    const options = context || {};
    result.wake = wakeLocalWorker_({
      trigger_source: 'cloud_folder_scanner',
      trigger_mode: 'manual_cloud_scan',
      cloud_event_type: 'scan_incoming_then_wake_local',
      execute: options.execute || 'no',
    });
  }
  return result;
}

function uiSaveWorkstationUrl(token, url) {
  requireToken_(token);
  return saveWorkstationUrl_(url);
}

function uiWakeLocalWorker(token, context) {
  requireToken_(token);
  return wakeLocalWorker_(context || {});
}

function uiRunHealthCheckNow(token) {
  requireToken_(token);
  return scheduledHealthCheck('manual');
}

function scheduledHealthCheck(triggerMode) {
  // Falo x Force 教學註解：
  // Cloud Heartbeat 是雲端定期丟一個最小測試任務。
  // 它不是正式資料處理，而是用來確認「GAS -> Sheet -> Drive -> 本機 worker」整條路還活著。
  const windowState = getScheduleWindowState_('heartbeat');
  if (!windowState.active) {
    log_('', 'cloud_trigger', 'scheduled_health_check_skipped', windowState.message, windowState);
    return { ok: true, skipped: true, reason: windowState.message, window: windowState };
  }
  const mode = triggerMode || 'scheduled';
  const result = createSampleMarkdownTask_({
    trigger_source: 'cloud_heartbeat',
    trigger_mode: mode,
    cloud_event_type: mode === 'manual' ? 'run_health_check_now' : 'scheduled_health_check',
  });
  log_(result.task.task_id, 'cloud_trigger', 'scheduled_health_check', 'Cloud heartbeat sample task created.', result);
  return result;
}

function scheduledIncomingFolderScan() {
  // Falo x Force 教學註解：
  // Apps Script 沒有一般 Google Drive folder 的即時 onUpload trigger。
  // 所以 MVP 採用「雲端定期掃 incoming folder」：一發現新 file_id，就建立 queued task。
  const windowState = getScheduleWindowState_('scanner');
  if (!windowState.active) {
    log_('', 'cloud_trigger', 'scheduled_incoming_folder_scan_skipped', windowState.message, windowState);
    return { ok: true, skipped: true, reason: windowState.message, window: windowState };
  }
  const result = scanIncomingFolderToTasks_('scheduled');
  if (result.created_count > 0) {
    result.wake = wakeLocalWorker_({
      trigger_source: 'cloud_folder_scanner',
      trigger_mode: 'scheduled',
      cloud_event_type: 'scheduled_incoming_folder_scan_then_wake_local',
    });
  }
  log_('', 'cloud_trigger', 'scheduled_incoming_folder_scan', `Cloud folder scan created ${result.created_count || 0} task(s).`, result);
  return result;
}

function installHealthCheckTrigger(minutes, windowStart, windowEnd) {
  requireAllowedTriggerMinutes_(minutes);
  saveScheduleWindow_('heartbeat', windowStart, windowEnd);
  removeHealthCheckTriggers_();
  ScriptApp.newTrigger(HEALTH_CHECK_TRIGGER_HANDLER)
    .timeBased()
    .everyMinutes(Number(minutes))
    .create();
  const windowState = getScheduleWindowState_('heartbeat');
  log_('', 'admin', 'install_health_check_trigger', `Installed every ${minutes} minutes.`, { minutes: Number(minutes), window: windowState });
  return { ok: true, handler: HEALTH_CHECK_TRIGGER_HANDLER, every_minutes: Number(minutes), window: windowState, triggers: listHealthCheckTriggers_() };
}

function installIncomingFolderScanTrigger(minutes, windowStart, windowEnd) {
  requireAllowedTriggerMinutes_(minutes);
  saveScheduleWindow_('scanner', windowStart, windowEnd);
  removeIncomingFolderScanTriggers_();
  ScriptApp.newTrigger(INCOMING_FOLDER_SCAN_TRIGGER_HANDLER)
    .timeBased()
    .everyMinutes(Number(minutes))
    .create();
  const windowState = getScheduleWindowState_('scanner');
  log_('', 'admin', 'install_incoming_folder_scan_trigger', `Installed every ${minutes} minutes.`, { minutes: Number(minutes), window: windowState });
  return { ok: true, handler: INCOMING_FOLDER_SCAN_TRIGGER_HANDLER, every_minutes: Number(minutes), window: windowState, triggers: listIncomingFolderScanTriggers_() };
}

function removeIncomingFolderScanTriggers() {
  const removed = removeIncomingFolderScanTriggers_();
  log_('', 'admin', 'stop_incoming_folder_scan_triggers', `Stopped ${removed} trigger(s).`, {});
  return { ok: true, stopped: removed, triggers: listIncomingFolderScanTriggers_() };
}

function listIncomingFolderScanTriggers() {
  return { ok: true, window: getScheduleWindowState_('scanner'), triggers: listIncomingFolderScanTriggers_() };
}

function removeHealthCheckTriggers() {
  const removed = removeHealthCheckTriggers_();
  log_('', 'admin', 'stop_health_check_triggers', `Stopped ${removed} trigger(s).`, {});
  return { ok: true, stopped: removed, triggers: listHealthCheckTriggers_() };
}

function listHealthCheckTriggers() {
  // Falo x Force 教學註解：
  // 這個函式會呼叫 ScriptApp.getProjectTriggers()。
  // 學員若看到「沒有呼叫 ScriptApp.getProjectTriggers 的權限」，
  // 不是 token 錯，而是 appsscript.json 缺少 script.scriptapp scope，
  // 或新增 scope 後尚未在 Apps Script 編輯器重新授權。
  return { ok: true, window: getScheduleWindowState_('heartbeat'), triggers: listHealthCheckTriggers_() };
}

function uiInstallHealthCheckTrigger(token, minutes, windowStart, windowEnd) {
  requireToken_(token);
  return installHealthCheckTrigger(minutes, windowStart, windowEnd);
}

function uiInstallIncomingFolderScanTrigger(token, minutes, windowStart, windowEnd) {
  requireToken_(token);
  return installIncomingFolderScanTrigger(minutes, windowStart, windowEnd);
}

function uiRemoveIncomingFolderScanTriggers(token) {
  requireToken_(token);
  return removeIncomingFolderScanTriggers();
}

function uiListIncomingFolderScanTriggers(token) {
  requireToken_(token);
  return listIncomingFolderScanTriggers();
}

function uiRemoveHealthCheckTriggers(token) {
  requireToken_(token);
  return removeHealthCheckTriggers();
}

function uiListHealthCheckTriggers(token) {
  requireToken_(token);
  return listHealthCheckTriggers();
}

function uiListLogs(token, event, search, limit) {
  requireToken_(token);
  return listLogs_(event || '', search || '', Number(limit || 100));
}

function uiClearLogs(token) {
  requireToken_(token);
  return clearLogs_();
}

function uiClearTasks(token) {
  requireToken_(token);
  return clearTasks_();
}

function uiClearDuplicateGuard(token) {
  requireToken_(token);
  return clearDuplicateGuard_();
}

function uiExportLogsJson(token) {
  requireToken_(token);
  return exportSheetJson_(SHEETS.LOGS, 'cloud_logs');
}

function uiExportLogsSpreadsheet(token) {
  requireToken_(token);
  return exportSheetSpreadsheet_(SHEETS.LOGS, 'cloud_logs');
}

function uiExportTasksJson(token) {
  requireToken_(token);
  return exportSheetJson_(SHEETS.TASKS, 'cloud_tasks');
}

function uiExportTasksSpreadsheet(token) {
  requireToken_(token);
  return exportSheetSpreadsheet_(SHEETS.TASKS, 'cloud_tasks');
}

function uiExportDuplicateGuardJson(token) {
  requireToken_(token);
  return exportSheetJson_(SHEETS.FILE_STATE, 'duplicate_guard');
}

function uiExportDuplicateGuardSpreadsheet(token) {
  requireToken_(token);
  return exportSheetSpreadsheet_(SHEETS.FILE_STATE, 'duplicate_guard');
}

function requireAllowedTriggerMinutes_(minutes) {
  const allowed = [1, 5, 10, 15, 30];
  if (allowed.indexOf(Number(minutes)) === -1) {
    throw new Error('Trigger minutes must be one of: 1, 5, 10, 15, 30.');
  }
}

function removeHealthCheckTriggers_() {
  let removed = 0;
  ScriptApp.getProjectTriggers().forEach(trigger => {
    if (trigger.getHandlerFunction() === HEALTH_CHECK_TRIGGER_HANDLER) {
      ScriptApp.deleteTrigger(trigger);
      removed += 1;
    }
  });
  return removed;
}

function listHealthCheckTriggers_() {
  return ScriptApp.getProjectTriggers()
    .filter(trigger => trigger.getHandlerFunction() === HEALTH_CHECK_TRIGGER_HANDLER)
    .map(trigger => ({
      handler: trigger.getHandlerFunction(),
      event_type: String(trigger.getEventType()),
      source: String(trigger.getTriggerSource()),
      unique_id: trigger.getUniqueId(),
    }));
}

function removeIncomingFolderScanTriggers_() {
  let removed = 0;
  ScriptApp.getProjectTriggers().forEach(trigger => {
    if (trigger.getHandlerFunction() === INCOMING_FOLDER_SCAN_TRIGGER_HANDLER) {
      ScriptApp.deleteTrigger(trigger);
      removed += 1;
    }
  });
  return removed;
}

function listIncomingFolderScanTriggers_() {
  return ScriptApp.getProjectTriggers()
    .filter(trigger => trigger.getHandlerFunction() === INCOMING_FOLDER_SCAN_TRIGGER_HANDLER)
    .map(trigger => ({
      handler: trigger.getHandlerFunction(),
      event_type: String(trigger.getEventType()),
      source: String(trigger.getTriggerSource()),
      unique_id: trigger.getUniqueId(),
    }));
}

function saveScheduleWindow_(prefix, windowStart, windowEnd) {
  // Falo x Force 教學註解：
  // 「帶入 1 小時」只是前端填表單；真正保存是在 Install trigger 時做。
  // 這樣學生可以理解：填資料、保存設定、開始排程，是三個不同動作。
  const start = normalizeScheduleWindowValue_(windowStart);
  const end = normalizeScheduleWindowValue_(windowEnd);
  if (start && end && new Date(start).getTime() > new Date(end).getTime()) {
    throw new Error(`${prefix} schedule window start must be before end.`);
  }
  updateSetting_(`${prefix}_window_start`, start, `Optional ${prefix} trigger start datetime-local, minute precision.`);
  updateSetting_(`${prefix}_window_end`, end, `Optional ${prefix} trigger end datetime-local, minute precision.`);
}

function normalizeScheduleWindowValue_(value) {
  // Google Sheet 很貼心也很麻煩：看起來像日期的字串可能會被自動轉成 Date。
  // 所以這裡同時支援 datetime-local 字串與 Sheet 讀回來的 Date 物件。
  if (Object.prototype.toString.call(value) === '[object Date]' && !isNaN(value.getTime())) {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), "yyyy-MM-dd'T'HH:mm");
  }
  const text = String(value || '').trim();
  if (!text) return '';
  const parsed = new Date(text);
  if (isNaN(parsed.getTime())) {
    throw new Error(`Invalid schedule window datetime: ${text}. Use yyyy-MM-ddTHH:mm.`);
  }
  // datetime-local 的教學粒度到分鐘，秒數不要進入設定，畫面比較乾淨。
  return text.slice(0, 16);
}

function getScheduleWindowState_(prefix) {
  const settings = objectFromRows_(rows_(SHEETS.SETTINGS), 'key', 'value');
  const start = normalizeScheduleWindowValue_(settings[`${prefix}_window_start`] || '');
  const end = normalizeScheduleWindowValue_(settings[`${prefix}_window_end`] || '');
  const now = new Date();
  const state = {
    prefix: prefix,
    start: start,
    end: end,
    now: Utilities.formatDate(now, Session.getScriptTimeZone(), "yyyy-MM-dd'T'HH:mm"),
    active: true,
    message: 'active',
  };
  if (start) {
    const startDate = new Date(start);
    if (now.getTime() < startDate.getTime()) {
      state.active = false;
      state.message = `not started until ${start}`;
      return state;
    }
  }
  if (end) {
    const endDate = new Date(end);
    if (now.getTime() > endDate.getTime()) {
      state.active = false;
      state.message = `ended at ${end}`;
      return state;
    }
  }
  return state;
}

function updateSetting_(key, value, note) {
  const sheet = sheet_(SHEETS.SETTINGS);
  const values = sheet.getDataRange().getValues();
  for (let i = 1; i < values.length; i += 1) {
    if (String(values[i][0]) === String(key)) {
      // Settings.value 先用純文字保存，避免 Sheet 把 datetime-local 自動轉成日期後丟失時間。
      sheet.getRange(i + 1, 2).setNumberFormat('@').setValue(String(value || ''));
      if (note) sheet.getRange(i + 1, 3).setValue(note);
      return;
    }
  }
  sheet.appendRow([key, String(value || ''), note || '']);
  sheet.getRange(sheet.getLastRow(), 2).setNumberFormat('@');
}

function login_(userId, password) {
  const users = rows_(SHEETS.USERS);
  const user = users.find(row => row.user_id === userId && String(row.active).toUpperCase() === 'TRUE');
  if (!user || String(user.password) !== String(password)) {
    return { ok: false, error: 'Invalid user or password.' };
  }
  return { ok: true, user_id: user.user_id, display_name: user.display_name, role: user.role };
}

function getRuntimeConfig_() {
  return {
    ok: true,
    app: APP_NAME,
    settings: objectFromRows_(rows_(SHEETS.SETTINGS), 'key', 'value'),
    users: rows_(SHEETS.USERS).filter(row => String(row.active).toUpperCase() === 'TRUE'),
    projects: rows_(SHEETS.PROJECTS).filter(row => String(row.active).toUpperCase() === 'TRUE'),
    folders: rows_(SHEETS.FOLDERS).filter(row => String(row.active).toUpperCase() === 'TRUE'),
  };
}

function testConnection_(token) {
  // Falo x Force 教學註解：
  // token 是「系統對系統」認證，不等於使用者登入。
  // 這個測試讓學員先確認 Web App URL 與 api_token 正確，再討論任務流程。
  requireToken_(token);
  log_('', 'admin', 'test_connection', 'GAS token connection test passed.', {});
  return { ok: true, app: APP_NAME, watermark: WATERMARK, now: now_(), timezone: Session.getScriptTimeZone() };
}

function getSettings_() {
  return objectFromRows_(rows_(SHEETS.SETTINGS), 'key', 'value');
}

function getWorkstationUrl_() {
  const settings = getSettings_();
  return String(settings.workstation_url || DEFAULT_WORKSTATION_MAC_URL || '').trim();
}

function normalizeWorkstationUrl_(url) {
  const text = String(url || '').trim();
  if (!text) return '';
  return text.endsWith('/') ? text.slice(0, -1) : text;
}

function saveWorkstationUrl_(url) {
  const clean = normalizeWorkstationUrl_(url);
  if (!clean) throw new Error('workstation_url is required.');
  updateSetting_('workstation_url', clean, 'Local runtime URL. GAS uses this URL to wake the local worker after cloud upload or scan; supports ngrok, Tailscale, LAN, or Win365.');
  log_('', 'admin', 'save_workstation_url', 'Workstation URL saved.', { workstation_url: clean });
  return { ok: true, mode: 'save_workstation_url', workstation_url: clean };
}

function wakeLocalWorker_(context) {
  // Falo x Force 教學註解：
  // 這裡是「雲主機 trigger 地端主機」的核心：GAS 不直接處理 NotebookLM，
  // 只在建立 task 後呼叫地端 runtime 的 /api/gas-poll，讓地端回頭撈取 queued task。
  const baseUrl = normalizeWorkstationUrl_(context.workstation_url || getWorkstationUrl_());
  if (!baseUrl) {
    const missing = { ok: false, mode: 'wake_local_worker', error: 'workstation_url is not set', context: context };
    log_(context.task_id || '', 'cloud_worker', 'wake_local_worker_failed', missing.error, missing);
    return missing;
  }
  const executeValue = String(context.execute || context.execute_mode || '').toLowerCase();
  const queryParts = [
    'response=json',
    'poll_origin=cloud_wake',
    `trigger_source=${encodeURIComponent(context.trigger_source || 'cloud_push')}`,
    `trigger_mode=${encodeURIComponent(context.trigger_mode || 'manual_cloud_push')}`,
    `cloud_event_type=${encodeURIComponent(context.cloud_event_type || 'wake_local_worker')}`,
    `task_id=${encodeURIComponent(context.task_id || '')}`,
  ];
  if (executeValue === 'yes' || executeValue === 'true' || executeValue === '1' || executeValue === 'on') {
    queryParts.push('execute=yes');
  } else if (executeValue === 'no' || executeValue === 'false' || executeValue === '0' || executeValue === 'off') {
    queryParts.push('execute=no');
  }
  const query = queryParts.join('&');
  const url = `${baseUrl}/api/gas-poll?${query}`;
  try {
    const response = UrlFetchApp.fetch(url, {
      method: 'get',
      muteHttpExceptions: true,
      followRedirects: true,
      validateHttpsCertificates: true,
      headers: {
        // Falo x Force 教學註解：
        // ngrok 免費版對瀏覽器/外部請求可能回傳 warning page。
        // 對機器對機器的 webhook / worker wake，要加這個 header 才能直接打到本機 runtime。
        // Tailscale / LAN / Win365 URL 會忽略這個 header，所以同一套流程可相容多種 workstation URL。
        'ngrok-skip-browser-warning': 'true',
      },
    });
    const code = response.getResponseCode();
    const text = response.getContentText();
    let parsed = {};
    try {
      parsed = JSON.parse(text);
    } catch (err) {
      parsed = { raw: text.slice(0, 1000) };
    }
    const gotNgrokWarning = String(parsed.raw || '').indexOf('ERR_NGROK_') >= 0;
    const result = { ok: code >= 200 && code < 300 && parsed.ok !== false && !gotNgrokWarning, mode: 'wake_local_worker', status_code: code, workstation_url: baseUrl, url: url, response: parsed, context: context };
    log_(context.task_id || '', 'cloud_worker', result.ok ? 'wake_local_worker' : 'wake_local_worker_failed', `Wake local worker via ${baseUrl}`, result);
    return result;
  } catch (err) {
    const result = { ok: false, mode: 'wake_local_worker', workstation_url: baseUrl, url: url, error: String(err && err.message ? err.message : err), context: context };
    log_(context.task_id || '', 'cloud_worker', 'wake_local_worker_failed', result.error, result);
    return result;
  }
}

function getCloudStatus_() {
  const taskRows = rows_(SHEETS.TASKS);
  const task_counts = {};
  taskRows.forEach(task => {
    const key = String(task.status || 'unknown');
    task_counts[key] = (task_counts[key] || 0) + 1;
  });
  return {
    ok: true,
    app: APP_NAME,
    watermark: WATERMARK,
    now: now_(),
    timezone: Session.getScriptTimeZone(),
    workstation_url: getWorkstationUrl_(),
    task_counts: task_counts,
    folders: rows_(SHEETS.FOLDERS),
    heartbeat: { window: getScheduleWindowState_('heartbeat'), triggers: listHealthCheckTriggers_() },
    scanner: { window: getScheduleWindowState_('scanner'), triggers: listIncomingFolderScanTriggers_() },
  };
}

function extractDriveFolderId_(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  const match = text.match(/\/folders\/([A-Za-z0-9_-]+)/);
  if (match) return match[1];
  const idMatch = text.match(/[A-Za-z0-9_-]{20,}/);
  return idMatch ? idMatch[0] : text;
}

function saveFolders_(folderInputs) {
  const sheet = sheet_(SHEETS.FOLDERS);
  const values = sheet.getDataRange().getValues();
  const headers = values[0].map(String);
  const keyCol = headers.indexOf('folder_key');
  const idCol = headers.indexOf('google_drive_folder_id');
  const activeCol = headers.indexOf('active');
  const updated = [];
  Object.keys(folderInputs || {}).forEach(key => {
    const folderId = extractDriveFolderId_(folderInputs[key]);
    if (!folderId) return;
    for (let i = 1; i < values.length; i += 1) {
      if (String(values[i][keyCol]) === String(key)) {
        sheet.getRange(i + 1, idCol + 1).setValue(folderId);
        if (activeCol >= 0) sheet.getRange(i + 1, activeCol + 1).setValue(true);
        updated.push({ folder_key: key, google_drive_folder_id: folderId });
        return;
      }
    }
  });
  log_('', 'admin', 'save_folders', `Saved ${updated.length} folder id(s).`, { updated: updated });
  return { ok: true, mode: 'save_folders', updated_count: updated.length, updated: updated, folders: rows_(SHEETS.FOLDERS) };
}

function testFolders_() {
  const results = rows_(SHEETS.FOLDERS).map(folder => {
    const id = String(folder.google_drive_folder_id || '').trim();
    if (!id || id.indexOf('REPLACE_') === 0) {
      return { folder_key: folder.folder_key, ok: false, error: 'folder id is not set' };
    }
    try {
      const driveFolder = DriveApp.getFolderById(id);
      return { folder_key: folder.folder_key, ok: true, id: id, name: driveFolder.getName() };
    } catch (err) {
      return { folder_key: folder.folder_key, ok: false, id: id, error: String(err && err.message ? err.message : err) };
    }
  });
  log_('', 'admin', 'test_folders', 'Folder access tested.', { results: results });
  return { ok: results.every(item => item.ok), mode: 'test_folders', results: results };
}

function listTasks_(status, limit) {
  const tasks = rows_(SHEETS.TASKS).filter(row => !status || row.status === status).slice(0, Math.max(1, limit || 20));
  return { ok: true, tasks: tasks };
}

function createTask_(payload) {
  const taskId = payload.task_id || `task_${Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd_HHmmss')}_${Math.floor(Math.random() * 10000)}`;
  const now = now_();
  appendObjectRow_(SHEETS.TASKS, {
    task_id: taskId,
    created_at: now,
    updated_at: now,
    submitter: payload.submitter || 'user',
    role: payload.role || 'user',
    project_id: payload.project_id || payload.target_project_id || '',
    source_folder_key: payload.source_folder_key || '',
    source_file_id: payload.source_file_id || '',
    action: payload.action || 'upload_drive_folder',
    status: payload.status || 'queued',
    duplicate_policy: payload.duplicate_policy || 'rename',
    file_types: Array.isArray(payload.file_types) ? payload.file_types.join(',') : (payload.file_types || '.md,.pdf,.csv,.docx,.xlsx'),
    trigger_source: payload.trigger_source || 'manual_task',
    trigger_mode: payload.trigger_mode || 'manual',
    cloud_event_type: payload.cloud_event_type || 'create_task',
    source_file_name: payload.source_file_name || '',
    result: '',
    error: '',
  });
  log_(taskId, payload.submitter || 'user', 'create_task', 'Task created.', payload);
  return { ok: true, task_id: taskId, status: 'queued' };
}

function scanIncomingFolderToTasks_(triggerMode) {
  // Falo x Force 教學註解：
  // 這是「雲端上傳檔案 -> 自動變任務」的 MVP。
  // GAS 不直接上傳 NotebookLM，只把新 file_id 寫成 task，後續仍交給本機 worker。
  const folder = getFolderByKey_('incoming');
  if (!folder || !folder.google_drive_folder_id || String(folder.google_drive_folder_id).indexOf('REPLACE_') === 0) {
    throw new Error('Please set Folders.incoming google_drive_folder_id before scanning.');
  }
  const iterator = DriveApp.getFolderById(folder.google_drive_folder_id).getFiles();
  const mode = triggerMode || 'manual';
  const seen = objectFromRows_(rows_(SHEETS.FILE_STATE), 'file_id', 'task_id');
  rows_(SHEETS.TASKS).forEach(task => {
    if (task.source_file_id) seen[task.source_file_id] = task.task_id || 'existing_task';
  });
  const created = [];
  const skipped = [];
  while (iterator.hasNext()) {
    const file = iterator.next();
    const fileId = file.getId();
    if (seen[fileId]) {
      skipped.push({ file_id: fileId, name: file.getName(), reason: 'already_has_task' });
      continue;
    }
    const task = createTask_({
      submitter: 'cloud_folder_scanner',
      role: 'document_manager',
      project_id: 'demo_project',
      source_folder_key: 'incoming',
      source_file_id: fileId,
      action: 'upload_drive_file',
      duplicate_policy: 'rename',
      file_types: fileExtension_(file.getName()) || '.md',
      source_file_name: file.getName(),
      trigger_source: 'cloud_folder_scanner',
      trigger_mode: mode,
      cloud_event_type: mode === 'scheduled' ? 'scheduled_incoming_folder_scan' : 'scan_incoming_folder',
    });
    recordDriveFileState_(file, 'incoming', task.task_id, 'queued', 'created_by_cloud_folder_scan');
    created.push({ task_id: task.task_id, file_id: fileId, name: file.getName() });
  }
  log_('', 'cloud_folder_scanner', mode === 'scheduled' ? 'scheduled_incoming_folder_scan' : 'scan_incoming_folder', `Created ${created.length} task(s).`, { created: created, skipped_count: skipped.length, trigger_source: 'cloud_folder_scanner', trigger_mode: mode });
  return { ok: true, mode: 'scan_incoming_folder', trigger_source: 'cloud_folder_scanner', trigger_mode: mode, created_count: created.length, skipped_count: skipped.length, created: created, skipped: skipped };
}

function uploadFileToIncomingAndWake_(uploadPayload) {
  // Falo x Force 教學註解：
  // 雲端上傳不是直接送 NotebookLM，而是先存進 Drive incoming，
  // 建立 queued task，再叫醒地端 runtime。這樣 log / task / duplicate guard 都走同一條治理路徑。
  const folder = getFolderByKey_('incoming');
  if (!folder || !folder.google_drive_folder_id || String(folder.google_drive_folder_id).indexOf('REPLACE_') === 0) {
    throw new Error('Please set Folders.incoming google_drive_folder_id before uploading.');
  }
  const filename = String(uploadPayload.name || '').trim();
  const contentBase64 = String(uploadPayload.content_base64 || '').trim();
  if (!filename || !contentBase64) throw new Error('upload name and content_base64 are required.');
  const mimeType = String(uploadPayload.mime_type || 'application/octet-stream');
  const bytes = Utilities.base64Decode(contentBase64);
  const blob = Utilities.newBlob(bytes, mimeType, filename);
  const driveFile = DriveApp.getFolderById(folder.google_drive_folder_id).createFile(blob);
  const task = createTask_({
    submitter: 'cloud_upload',
    role: 'document_manager',
    project_id: uploadPayload.project_id || 'demo_project',
    source_folder_key: 'incoming',
    source_file_id: driveFile.getId(),
    action: 'upload_drive_file',
    duplicate_policy: uploadPayload.duplicate_policy || 'rename',
    file_types: fileExtension_(driveFile.getName()) || '.md',
    source_file_name: driveFile.getName(),
    trigger_source: 'cloud_upload',
    trigger_mode: 'manual_cloud_push',
    cloud_event_type: 'upload_to_incoming_then_wake_local',
  });
  recordDriveFileState_(driveFile, 'incoming', task.task_id, 'queued', 'created_by_cloud_upload');
  log_(task.task_id, 'cloud_upload', 'cloud_upload_to_incoming', `Uploaded ${driveFile.getName()} to incoming.`, { file_id: driveFile.getId(), file_name: driveFile.getName(), trigger_source: 'cloud_upload', trigger_mode: 'manual_cloud_push' });
  const wake = wakeLocalWorker_({
    task_id: task.task_id,
    trigger_source: 'cloud_upload',
    trigger_mode: 'manual_cloud_push',
    cloud_event_type: 'upload_to_incoming_then_wake_local',
    execute: uploadPayload.execute || 'no',
  });
  return { ok: true, mode: 'cloud_upload_then_wake', file_name: driveFile.getName(), file_id: driveFile.getId(), task: task, wake: wake };
}

function recordDriveFileState_(file, folderKey, taskId, status, note) {
  sheet_(SHEETS.FILE_STATE).appendRow([
    file.getId(),
    folderKey,
    file.getName(),
    now_(),
    now_(),
    taskId,
    status,
    note || '',
  ]);
}

function fileExtension_(name) {
  const text = String(name || '');
  const idx = text.lastIndexOf('.');
  return idx >= 0 ? text.slice(idx).toLowerCase() : '';
}

function updateTask_(taskId, status, result, error) {
  const sheet = sheet_(SHEETS.TASKS);
  const values = sheet.getDataRange().getValues();
  const header = values[0];
  const taskCol = header.indexOf('task_id');
  const statusCol = header.indexOf('status');
  const updatedCol = header.indexOf('updated_at');
  const resultCol = header.indexOf('result');
  const errorCol = header.indexOf('error');
  for (let i = 1; i < values.length; i++) {
    if (values[i][taskCol] === taskId) {
      sheet.getRange(i + 1, statusCol + 1).setValue(status);
      sheet.getRange(i + 1, updatedCol + 1).setValue(now_());
      sheet.getRange(i + 1, resultCol + 1).setValue(JSON.stringify(result || {}));
      sheet.getRange(i + 1, errorCol + 1).setValue(error || '');
      log_(taskId, 'local_worker', 'update_task', `Task status -> ${status}`, result || {});
      return { ok: true, task_id: taskId, status: status };
    }
  }
  return { ok: false, error: `Task not found: ${taskId}` };
}

function buildCommandPackage_(taskId) {
  const task = rows_(SHEETS.TASKS).find(row => row.task_id === taskId);
  if (!task) return { ok: false, error: `Task not found: ${taskId}` };
  const project = rows_(SHEETS.PROJECTS).find(row => row.project_id === task.project_id);
  const folder = getFolderByKey_(task.source_folder_key);
  const files = [];
  if (task.source_file_id) {
    const file = DriveApp.getFileById(task.source_file_id);
    files.push(fileMeta_(file));
  } else if (folder && folder.google_drive_folder_id) {
    const iterator = DriveApp.getFolderById(folder.google_drive_folder_id).getFiles();
    while (iterator.hasNext()) {
      files.push(fileMeta_(iterator.next()));
    }
  }
  return {
    ok: true,
    task_id: task.task_id,
    command_type: 'upload_folder',
    submitter: task.submitter,
    role: task.role,
    project_id: task.project_id,
    notebook_id: project ? project.notebook_id : '',
    source_folder_key: task.source_folder_key,
    source_folder_id: folder ? folder.google_drive_folder_id : '',
    duplicate_policy: task.duplicate_policy || 'rename',
    file_types: String(task.file_types || '.md').split(',').map(s => s.trim()).filter(Boolean),
    trigger_source: task.trigger_source || '',
    trigger_mode: task.trigger_mode || '',
    cloud_event_type: task.cloud_event_type || '',
    source_file_name: task.source_file_name || '',
    files: files,
  };
}

function downloadFile_(fileId) {
  if (!fileId) return { ok: false, error: 'file_id is required.' };
  const file = DriveApp.getFileById(fileId);
  const blob = file.getBlob();
  return {
    ok: true,
    file_id: fileId,
    name: file.getName(),
    mime_type: blob.getContentType(),
    content_base64: Utilities.base64Encode(blob.getBytes()),
  };
}

function fileMeta_(file) {
  return {
    file_id: file.getId(),
    name: file.getName(),
    mime_type: file.getMimeType(),
    size: file.getSize(),
    updated_at: file.getLastUpdated(),
  };
}

function workbookSheetNames_() {
  return [SHEETS.SETTINGS, SHEETS.USERS, SHEETS.PROJECTS, SHEETS.FOLDERS, SHEETS.TASKS, SHEETS.FILE_STATE, SHEETS.LOGS];
}

function tableForSheet_(sheetName) {
  const sheet = sheet_(sheetName);
  const values = sheet.getDataRange().getValues();
  if (!values.length) return { headers: [], rows: [] };
  const headers = values[0].map(String);
  const rows = values.slice(1).filter(row => row.join('') !== '').map(row => {
    const item = {};
    headers.forEach((header, index) => item[header] = normalizeExportValue_(row[index]));
    return item;
  });
  return { headers: headers, rows: rows };
}

function normalizeExportValue_(value) {
  if (Object.prototype.toString.call(value) === '[object Date]' && !isNaN(value.getTime())) {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), "yyyy-MM-dd'T'HH:mm:ssXXX");
  }
  return value;
}

function exportWorkbookJson_() {
  const workbook = {
    ok: true,
    app: APP_NAME,
    watermark: WATERMARK,
    exported_at: now_(),
    sheets: {},
  };
  workbookSheetNames_().forEach(name => workbook.sheets[name] = tableForSheet_(name));
  log_('', 'admin', 'export_workbook_json', 'Workbook JSON exported.', { sheets: workbookSheetNames_() });
  return workbook;
}

function exportWorkbookSpreadsheet_() {
  const exportName = `${APP_NAME} Export ${Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd-HHmmss')}`;
  const exportSs = SpreadsheetApp.create(exportName);
  const names = workbookSheetNames_();
  names.forEach((name, index) => {
    const target = index === 0 ? exportSs.getSheets()[0] : exportSs.insertSheet(name);
    target.setName(name);
    const table = tableForSheet_(name);
    const values = [table.headers].concat(table.rows.map(row => table.headers.map(header => row[header] !== undefined ? row[header] : '')));
    if (values.length && values[0].length) {
      target.getRange(1, 1, values.length, values[0].length).setValues(values);
      target.setFrozenRows(1);
    }
  });
  log_('', 'admin', 'export_workbook_spreadsheet', 'Workbook spreadsheet exported.', { spreadsheet_id: exportSs.getId(), url: exportSs.getUrl() });
  return { ok: true, spreadsheet_id: exportSs.getId(), url: exportSs.getUrl(), name: exportName };
}

function exportSheetJson_(sheetName, label) {
  const payload = {
    ok: true,
    app: APP_NAME,
    watermark: WATERMARK,
    kind: label || sheetName,
    sheet: sheetName,
    exported_at: now_(),
    table: tableForSheet_(sheetName),
  };
  log_('', 'admin', `export_${label || sheetName}_json`, `${sheetName} JSON exported.`, { sheet: sheetName });
  return payload;
}

function exportSheetSpreadsheet_(sheetName, label) {
  const exportName = `${APP_NAME} ${label || sheetName} Export ${Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd-HHmmss')}`;
  const exportSs = SpreadsheetApp.create(exportName);
  const target = exportSs.getSheets()[0];
  target.setName(sheetName);
  const table = tableForSheet_(sheetName);
  const values = [table.headers].concat(table.rows.map(row => table.headers.map(header => row[header] !== undefined ? row[header] : '')));
  if (values.length && values[0].length) {
    target.getRange(1, 1, values.length, values[0].length).setValues(values);
    target.setFrozenRows(1);
  }
  log_('', 'admin', `export_${label || sheetName}_spreadsheet`, `${sheetName} spreadsheet exported.`, { spreadsheet_id: exportSs.getId(), url: exportSs.getUrl() });
  return { ok: true, sheet: sheetName, spreadsheet_id: exportSs.getId(), url: exportSs.getUrl(), name: exportName };
}

function importWorkbookJson_(workbook) {
  const data = typeof workbook === 'string' ? JSON.parse(workbook) : workbook;
  const sheets = data && data.sheets ? data.sheets : data;
  if (!sheets || typeof sheets !== 'object') throw new Error('Import JSON must contain sheets.');
  const imported = [];
  workbookSheetNames_().forEach(name => {
    if (!sheets[name]) return;
    replaceSheetFromTable_(name, sheets[name]);
    imported.push(name);
  });
  log_('', 'admin', 'import_workbook_json', `Imported ${imported.length} sheet(s).`, { imported: imported });
  return { ok: true, imported: imported };
}

function importWorkbookSpreadsheet_(spreadsheetId) {
  if (!spreadsheetId) throw new Error('spreadsheet_id is required.');
  const source = SpreadsheetApp.openById(spreadsheetId);
  const imported = [];
  workbookSheetNames_().forEach(name => {
    const sheet = source.getSheetByName(name);
    if (!sheet) return;
    replaceSheetValues_(name, sheet.getDataRange().getValues());
    imported.push(name);
  });
  log_('', 'admin', 'import_workbook_spreadsheet', `Imported ${imported.length} sheet(s).`, { spreadsheet_id: spreadsheetId, imported: imported });
  return { ok: true, spreadsheet_id: spreadsheetId, imported: imported };
}

function replaceSheetFromTable_(sheetName, table) {
  const headers = table.headers || HEADERS[sheetName] || [];
  const rows = table.rows || [];
  const values = [headers].concat(rows.map(row => headers.map(header => row[header] !== undefined ? row[header] : '')));
  replaceSheetValues_(sheetName, values);
}

function replaceSheetValues_(sheetName, values) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) sheet = ss.insertSheet(sheetName);
  sheet.clearContents();
  if (values && values.length && values[0].length) {
    sheet.getRange(1, 1, values.length, values[0].length).setValues(values);
  }
  sheet.setFrozenRows(1);
}

function listLogs_(event, search, limit) {
  const eventText = String(event || '').trim().toLowerCase();
  const searchText = String(search || '').trim().toLowerCase();
  let logs = rows_(SHEETS.LOGS).slice().reverse();
  if (eventText) {
    logs = logs.filter(row => String(row.event_type || '').toLowerCase().indexOf(eventText) >= 0 || String(row.actor || '').toLowerCase().indexOf(eventText) >= 0);
  }
  if (searchText) {
    logs = logs.filter(row => JSON.stringify(row).toLowerCase().indexOf(searchText) >= 0);
  }
  const max = Math.max(1, Math.min(500, Number(limit || 100)));
  return { ok: true, total: logs.length, logs: logs.slice(0, max) };
}

function clearLogs_() {
  const sheet = sheet_(SHEETS.LOGS);
  const last = sheet.getLastRow();
  if (last > 1) sheet.getRange(2, 1, last - 1, sheet.getLastColumn()).clearContent();
  log_('', 'admin', 'clear_logs', 'Runtime_Log cleared.', {});
  return { ok: true, mode: 'clear_logs', cleared_rows: Math.max(0, last - 1) };
}

function clearTasks_() {
  const sheet = sheet_(SHEETS.TASKS);
  const last = sheet.getLastRow();
  if (last > 1) sheet.getRange(2, 1, last - 1, sheet.getLastColumn()).clearContent();
  log_('', 'admin', 'clear_tasks', 'Tasks cleared. Drive_File_State was kept.', { cleared_rows: Math.max(0, last - 1) });
  return { ok: true, mode: 'clear_tasks', cleared_rows: Math.max(0, last - 1), note: 'Drive_File_State was kept. Use Clear Duplicate Guard only when you intentionally want to allow re-scan.' };
}

function clearDuplicateGuard_() {
  const sheet = sheet_(SHEETS.FILE_STATE);
  const last = sheet.getLastRow();
  if (last > 1) sheet.getRange(2, 1, last - 1, sheet.getLastColumn()).clearContent();
  log_('', 'admin', 'clear_duplicate_guard', 'Drive_File_State cleared.', { cleared_rows: Math.max(0, last - 1) });
  return { ok: true, mode: 'clear_duplicate_guard', cleared_rows: Math.max(0, last - 1), warning: 'Clearing duplicate guard can make existing Drive files become new tasks again.' };
}

function getFolderByKey_(key) {
  return rows_(SHEETS.FOLDERS).find(row => row.folder_key === key && String(row.active).toUpperCase() === 'TRUE');
}

function requireToken_(token) {
  const settings = objectFromRows_(rows_(SHEETS.SETTINGS), 'key', 'value');
  const expected = settings.api_token || DEFAULT_TOKEN;
  if (String(token || '') !== String(expected)) {
    throw new Error('Invalid api token.');
  }
}

function ensureSheet_(ss, name, headers, seedRows) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
    if (seedRows && seedRows.length) {
      sheet.getRange(2, 1, seedRows.length, headers.length).setValues(seedRows);
    }
  } else {
    // Falo x Force 教學註解：
    // 既有學員的 Sheet 可能是舊版 schema。setupSheet() 再跑一次時自動補欄，
    // 避免「程式碼更新了，但工作表缺欄位」造成隱性錯誤。
    const current = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), 1)).getValues()[0].map(String);
    const missing = headers.filter(header => current.indexOf(header) === -1);
    if (missing.length) {
      sheet.getRange(1, current.length + 1, 1, missing.length).setValues([missing]);
    }
  }
  sheet.setFrozenRows(1);
  return sheet;
}

function sheet_(name) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
  if (!sheet) throw new Error(`Sheet not found: ${name}. Run setupSheet() first.`);
  ensureHeaders_(sheet, HEADERS[name] || []);
  return sheet;
}

function ensureHeaders_(sheet, headers) {
  if (!headers || !headers.length || sheet.getLastRow() === 0) return;
  const current = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), 1)).getValues()[0].map(String);
  const missing = headers.filter(header => current.indexOf(header) === -1);
  if (missing.length) {
    sheet.getRange(1, current.length + 1, 1, missing.length).setValues([missing]);
  }
}

function rows_(sheetName) {
  const sheet = sheet_(sheetName);
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];
  const headers = values[0].map(String);
  return values.slice(1).filter(row => row.join('') !== '').map(row => {
    const obj = {};
    headers.forEach((key, idx) => obj[key] = row[idx]);
    return obj;
  });
}

function appendObjectRow_(sheetName, item) {
  const sheet = sheet_(sheetName);
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(String);
  sheet.appendRow(headers.map(header => item[header] !== undefined ? item[header] : ''));
}

function objectFromRows_(rows, keyField, valueField) {
  const obj = {};
  rows.forEach(row => obj[row[keyField]] = row[valueField]);
  return obj;
}

function log_(taskId, actor, eventType, message, detail) {
  sheet_(SHEETS.LOGS).appendRow([
    `log_${Utilities.getUuid()}`,
    now_(),
    taskId || '',
    actor || '',
    eventType || '',
    message || '',
    JSON.stringify(detail || {}),
  ]);
}

function now_() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd'T'HH:mm:ssXXX");
}

function json_(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload, null, 2))
    .setMimeType(ContentService.MimeType.JSON);
}

function renderPortal_() {
  const settings = getSettings_();
  const workstationUrl = normalizeWorkstationUrl_(settings.workstation_url || DEFAULT_WORKSTATION_MAC_URL);
  const workstationMacUrl = normalizeWorkstationUrl_(settings.workstation_url_preset_1_mac || DEFAULT_WORKSTATION_MAC_URL);
  const workstationWin365Url = normalizeWorkstationUrl_(settings.workstation_url_preset_2_win365 || DEFAULT_WORKSTATION_WIN365_URL);
  const html = `<!doctype html>
<html lang="zh-Hant">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>AI NotebookLM GAS Command Center</title>
  <style>
    body{margin:0;background:#f6f7f4;color:#202326;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;line-height:1.6}
    main{max-width:960px;margin:auto;padding:36px 18px 56px}
    h1{font-size:36px;margin:0 0 8px} h2{color:#155343;margin-top:30px}
    .card{background:#fff;border:1px solid #d8e1dd;border-radius:8px;padding:18px;margin:14px 0}
    input{width:min(520px,100%);padding:10px;border:1px solid #cfd8d3;border-radius:6px}
    button,a.button{display:inline-block;border:0;border-radius:8px;background:#1e725f;color:#fff;padding:11px 16px;font-weight:700;text-decoration:none;cursor:pointer;margin:8px 8px 0 0}
    button.secondary,a.secondary{background:#315f86}
    button.gold,a.gold{background:#a46700}
    button.danger,a.danger{background:#933333}
    button.is-running{background:#a46700!important}
    button.is-done{background:#208454!important}
    button.is-failed{background:#9d2f2f!important}
    .output-ok{border-left:7px solid #208454}
    .output-error{border-left:7px solid #9d2f2f}
    .danger-text{color:#933333;font-weight:800}
    pre{white-space:pre-wrap;background:#eef4f1;border-radius:8px;padding:14px;overflow:auto}
    .muted{color:#657286}
    .brandline{color:#1e725f;font-weight:800;margin:4px 0 18px}
    .window-grid{display:grid;grid-template-columns:1fr 1fr auto;gap:10px;align-items:end;margin:12px 0}
    .field label{display:block;font-weight:700;margin:0 0 4px}
    .field input{width:100%;box-sizing:border-box}
    .watermark{position:fixed;right:18px;bottom:12px;color:rgba(30,114,95,.22);font-size:18px;font-weight:800;pointer-events:none}
    @media(max-width:720px){.window-grid{grid-template-columns:1fr}}
  </style>
</head>
<body><main>
  <h1>AI NotebookLM GAS Command Center</h1>
  <div class="brandline">${WATERMARK} · Cloud Command Center MVP</div>
  <p class="muted">Google Sheet 是雲端任務中控；本機 Python worker 會依設定秒數主動 polling，不需要 ngrok。</p>

  <section class="card">
    <h2>Cloud Status / Token Test</h2>
    <p>載入後可先按這裡確認：Web App 有回應、token 正確、trigger 目前狀態可查。這和使用者登入是兩件事；token 是系統參數，登入是角色控管。</p>
    <button onclick="testConnection(this)">Test Token Connection</button>
    <button class="secondary" onclick="cloudStatus(this)">Refresh Cloud Status</button>
    <pre id="statusOutput">Cloud status not checked yet.</pre>
  </section>

  <section class="card">
    <h2>Local Worker Wake Target</h2>
    <p>這裡設定「雲主機要叫醒哪一台地端主機」。GAS 會先把檔案存到 Drive incoming、建立 task，然後呼叫這個 workstation URL 的 <code>/api/gas-poll</code>，讓地端主機主動回來撈任務。</p>
    <p class="muted">這個 URL 可用 ngrok 公開網址、Tailscale 私網網址、區網 IP，或 Win365 runtime URL。測試1 目前是 Mac 主機 ngrok；測試2 先預留給 Win365。實際檔案下載與 NotebookLM upload 仍由地端 Python runtime 執行。</p>
    <input id="workstation_url" type="text" placeholder="https://your-runtime.ngrok-free.dev 或 http://tailscale-ip:8765" value="${workstationUrl}">
    <br>
    <button class="gold" onclick="useWorkstationPreset('mac', this)">測試1（Mac 主機）</button>
    <button class="secondary" onclick="useWorkstationPreset('win365', this)">預設值2（Win365 預留）</button>
    <button onclick="saveWorkstationUrl(this)">Save Workstation URL</button>
    <button class="secondary" onclick="wakeLocalWorker(this, 'no')">Wake Local Worker: Pull Only</button>
    <button class="gold" onclick="wakeLocalWorker(this, 'yes')">Wake Local Worker: Pull + Upload</button>
    <pre id="workstationOutput">Workstation URL not checked yet.</pre>
  </section>

  <section class="card">
    <h2>Folder Settings</h2>
    <p>這裡讓使用者部署自己的 Google Drive folder id。可貼完整 Drive folder 連結，也可只貼 folder id。</p>
    <p class="muted">教學版先固定五個資料夾：incoming / processing / archive / error / evidence。按 Use Teaching Defaults 只帶入目前教材預設，正式部署請換成自己的 Drive folder。</p>
    <div class="field"><label>incoming</label><input id="folder_incoming" type="text" placeholder="Drive folder URL or ID"></div>
    <div class="field"><label>processing</label><input id="folder_processing" type="text" placeholder="Drive folder URL or ID"></div>
    <div class="field"><label>archive</label><input id="folder_archive" type="text" placeholder="Drive folder URL or ID"></div>
    <div class="field"><label>error</label><input id="folder_error" type="text" placeholder="Drive folder URL or ID"></div>
    <div class="field"><label>evidence</label><input id="folder_evidence" type="text" placeholder="Drive folder URL or ID"></div>
    <button class="gold" onclick="useTeachingFolders(this)">Use Teaching Defaults</button>
    <button onclick="saveFolders(this)">Save Folder IDs</button>
    <button class="secondary" onclick="testFolders(this)">Test Folder Access</button>
    <pre id="folderOutput">Folder settings not checked yet.</pre>
  </section>

  <section class="card">
    <h2>Simulation Test</h2>
    <p>按下後會在 <code>Folders.incoming</code> 指定的 Google Drive folder 建立一個帶時間戳的 <code>.md</code> 檔，內容與檔名相同，並建立 queued task。</p>
    <input id="token" type="password" placeholder="api_token">
    <br>
    <button class="gold" onclick="useDefaultToken(this)">Use Default Token</button>
    <button onclick="createSample(this)">Create Timestamp .md Task</button>
    <button class="secondary" onclick="listQueued(this)">List Queued Tasks</button>
    <p class="muted">教學預設 token：<code>${DEFAULT_TOKEN}</code>。正式使用時請到 Settings sheet 改掉。</p>
    <pre id="output">Ready.</pre>
  </section>

  <section class="card">
    <h2>Cloud Upload → Incoming → Wake Local</h2>
    <p>這是你現在要測的路徑：雲端頁面選檔，GAS 存到 Drive incoming，建立 queued task，接著主動叫醒 Mac / Win365 地端 runtime 去撈取。</p>
    <p class="muted">兩地 log 都會分開標示：GAS 端會有 <code>cloud_upload_to_incoming</code> / <code>wake_local_worker</code>；地端會有 <code>gas_cloud_wake_pull</code>。</p>
    <input id="cloud_upload_file" type="file">
    <br>
    <button class="secondary" onclick="uploadCloudFile(this, 'no')">Upload + Wake Pull Only</button>
    <button onclick="uploadCloudFile(this, 'yes')">Upload + Wake + Upload NotebookLM</button>
    <pre id="uploadOutput">No cloud upload yet.</pre>
  </section>

  <section class="card">
    <h2>Cloud Heartbeat</h2>
    <p>這是雲端定期產生測試任務的教學功能。它會依設定時間建立一個 timestamp <code>.md</code>，讓本機 worker 可定期檢查雲端任務鏈是否正常。</p>
    <p class="muted">時間區間到分鐘。<code>Use 1 Hour Window</code> 只會把「現在到 1 小時後」帶入欄位；按下 Install 才會保存設定並啟動排程。</p>
    <div class="window-grid">
      <div class="field"><label for="heartbeat_start">Start</label><input id="heartbeat_start" type="datetime-local"></div>
      <div class="field"><label for="heartbeat_end">End</label><input id="heartbeat_end" type="datetime-local"></div>
      <button class="gold" onclick="fillOneHourWindow('heartbeat', this)">Use 1 Hour Window</button>
    </div>
    <button class="gold" onclick="installTrigger(5, this)">Install 5 min Heartbeat</button>
    <button class="gold" onclick="installTrigger(15, this)">Install 15 min Heartbeat</button>
    <button onclick="runHeartbeatNow(this)">Run Heartbeat Now</button>
    <button class="secondary" onclick="listTriggers(this)">List Heartbeat Triggers</button>
    <button class="danger" onclick="removeTriggers(this)">Stop Heartbeat</button>
    <pre id="triggerOutput">Heartbeat trigger not checked yet.</pre>
  </section>

  <section class="card">
    <h2>Cloud Folder Scanner</h2>
    <p>這是「雲端上傳一個檔案，稍後自動變成任務」的教學版。GAS 會掃描 <code>Folders.incoming</code>，只要看到新的 Drive file_id，就建立 queued task，讓本機 worker 後續處理。</p>
    <p class="danger-text">紅字提醒：檔案在 task 尚未 completed 前，請不要從 Google Drive incoming 刪除。系統用 Drive file_id 防重複，但本機 worker 仍需要原始檔案才能下載與上傳；未完成前刪除會造成本機處理失敗。完成後再手動搬移或刪除較安全。</p>
    <p class="muted">時間區間到分鐘。<code>Use 1 Hour Window</code> 只會帶入欄位；按下 Install 才會保存 scanner 的時間窗。</p>
    <div class="window-grid">
      <div class="field"><label for="scanner_start">Start</label><input id="scanner_start" type="datetime-local"></div>
      <div class="field"><label for="scanner_end">End</label><input id="scanner_end" type="datetime-local"></div>
      <button class="gold" onclick="fillOneHourWindow('scanner', this)">Use 1 Hour Window</button>
    </div>
    <button class="secondary" onclick="scanIncoming(this, 'no')">Scan + Wake Pull Only</button>
    <button onclick="scanIncoming(this, 'yes')">Scan + Wake + Upload NotebookLM</button>
    <button class="gold" onclick="installFolderScanTrigger(5, this)">Install 5 min Scanner</button>
    <button class="gold" onclick="installFolderScanTrigger(15, this)">Install 15 min Scanner</button>
    <button class="secondary" onclick="listFolderScanTriggers(this)">List Scanner Triggers</button>
    <button class="danger" onclick="removeFolderScanTriggers(this)">Stop Scanner</button>
    <pre id="folderScanOutput">Folder scanner not checked yet.</pre>
  </section>

  <section class="card">
    <h2>Cloud Logs / Tasks / Duplicate Guard</h2>
    <p>這裡是 GAS 端治理區。三種來源會在 task / log 中保留 <code>trigger_source</code>、<code>trigger_mode</code>、<code>cloud_event_type</code>，讓本機 worker 也能分辨來源。</p>
    <p class="danger-text">本版為穩定與治理考量，只提供清除與匯出，不提供匯入或修正。匯入全覆蓋等功能留到資料模型穩定後再開。</p>
    <input id="log_event" type="text" placeholder="event / actor filter，例如 heartbeat 或 scanner">
    <input id="log_search" type="text" placeholder="search task_id / filename / keyword">
    <br>
    <button onclick="listCloudLogs(this)">List Logs</button>
    <button class="danger" onclick="clearCloudLogs(this)">Clear Logs Only</button>
    <button class="secondary" onclick="exportCloudLogsJson(this)">Export Logs JSON</button>
    <button class="secondary" onclick="exportCloudLogsExcel(this)">Export Logs Excel / Sheet</button>
    <br>
    <button class="danger" onclick="clearCloudTasks(this)">Clear Tasks Only</button>
    <button class="secondary" onclick="exportCloudTasksJson(this)">Export Tasks JSON</button>
    <button class="secondary" onclick="exportCloudTasksExcel(this)">Export Tasks Excel / Sheet</button>
    <br>
    <button class="danger" onclick="clearDuplicateGuard(this)">Clear Duplicate Guard</button>
    <button class="secondary" onclick="exportDuplicateGuardJson(this)">Export Duplicate Guard JSON</button>
    <button class="secondary" onclick="exportDuplicateGuardExcel(this)">Export Duplicate Guard Excel / Sheet</button>
    <p class="muted">Duplicate Guard 是 <code>Drive_File_State</code>：主要用 <code>folder_key + file_id</code> / task 紀錄避免同一個 Drive 檔重複建立任務。清掉後，既有 Drive 檔可能再次被掃成新任務。</p>
    <pre id="logOutput">Cloud logs not checked yet.</pre>
  </section>

  <section class="card">
    <h2>Worker Endpoints</h2>
    <p><code>?action=tasks&status=queued&token=...</code></p>
    <p><code>?action=download&file_id=...&token=...</code></p>
    <p><code>POST action=update_task</code></p>
  </section>
</main>
<div class="watermark">${WATERMARK}</div>
<script>
function token(){ return document.getElementById('token').value.trim(); }
const WORKSTATION_PRESET_MAC = '${workstationMacUrl}';
const WORKSTATION_PRESET_WIN365 = '${workstationWin365Url}';
function localDatetimeValue(date){
  const pad = n => String(n).padStart(2, '0');
  return date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate()) + 'T' + pad(date.getHours()) + ':' + pad(date.getMinutes());
}
function fillOneHourWindow(prefix, btn){
  const now = new Date();
  const end = new Date(now.getTime() + 60 * 60 * 1000);
  document.getElementById(prefix + '_start').value = localDatetimeValue(now);
  document.getElementById(prefix + '_end').value = localDatetimeValue(end);
  setButtonState(btn, 'is-done', '1 Hour Filled');
  const target = prefix === 'heartbeat' ? 'triggerOutput' : 'folderScanOutput';
  const showFn = prefix === 'heartbeat' ? showTrigger : showFolderScan;
  showFn({ok:true, message:'1 hour window filled only. Press Install to save and start trigger.', start: document.getElementById(prefix + '_start').value, end: document.getElementById(prefix + '_end').value});
  markOutput(target, {ok:true});
}
function scheduleWindow(prefix){
  return {
    start: document.getElementById(prefix + '_start').value,
    end: document.getElementById(prefix + '_end').value
  };
}
function useDefaultToken(btn){
  document.getElementById('token').value = '${DEFAULT_TOKEN}';
  setButtonState(btn, 'is-done', 'Default Token Filled');
  show({ok:true, message:'Default teaching token filled. Formal deployments should change Settings.api_token.'});
}
function setButtonState(button, state, label){
  if (!button) return;
  button.classList.remove('is-running', 'is-done', 'is-failed');
  if (state) button.classList.add(state);
  if (label) button.textContent = label;
  button.disabled = state === 'is-running';
}
function markOutput(id, data){
  const el = document.getElementById(id);
  el.classList.remove('output-ok', 'output-error');
  if (data && typeof data === 'object') el.classList.add(data.ok ? 'output-ok' : 'output-error');
}
function show(data){ const el = document.getElementById('output'); el.textContent = typeof data === 'string' ? data : JSON.stringify(data, null, 2); markOutput('output', data); }
function showStatus(data){ const el = document.getElementById('statusOutput'); el.textContent = typeof data === 'string' ? data : JSON.stringify(data, null, 2); markOutput('statusOutput', data); }
function showFolderSettings(data){ const el = document.getElementById('folderOutput'); el.textContent = typeof data === 'string' ? data : JSON.stringify(data, null, 2); markOutput('folderOutput', data); }
function showWorkstation(data){ const el = document.getElementById('workstationOutput'); el.textContent = typeof data === 'string' ? data : JSON.stringify(data, null, 2); markOutput('workstationOutput', data); }
function showUpload(data){ const el = document.getElementById('uploadOutput'); el.textContent = typeof data === 'string' ? data : JSON.stringify(data, null, 2); markOutput('uploadOutput', data); }
function showTrigger(data){ const el = document.getElementById('triggerOutput'); el.textContent = typeof data === 'string' ? data : JSON.stringify(data, null, 2); markOutput('triggerOutput', data); }
function showFolderScan(data){ const el = document.getElementById('folderScanOutput'); el.textContent = typeof data === 'string' ? data : JSON.stringify(data, null, 2); markOutput('folderScanOutput', data); }
function showLogs(data){ const el = document.getElementById('logOutput'); el.textContent = typeof data === 'string' ? data : JSON.stringify(data, null, 2); markOutput('logOutput', data); }
function testConnection(btn){
  setButtonState(btn, 'is-running', 'Testing...');
  showStatus('Testing token connection...');
  google.script.run
    .withSuccessHandler(data => { showStatus(data); setButtonState(btn, data && data.ok ? 'is-done' : 'is-failed', data && data.ok ? 'Connected' : 'Check Result'); })
    .withFailureHandler(err => { showStatus({ok:false, error:String(err && err.message ? err.message : err)}); setButtonState(btn, 'is-failed', 'Failed'); })
    .uiTestConnection(token());
}
function cloudStatus(btn){
  setButtonState(btn, 'is-running', 'Loading...');
  showStatus('Loading cloud status...');
  google.script.run
    .withSuccessHandler(data => { showStatus(data); setButtonState(btn, data && data.ok ? 'is-done' : 'is-failed', data && data.ok ? 'Status Loaded' : 'Check Result'); })
    .withFailureHandler(err => { showStatus({ok:false, error:String(err && err.message ? err.message : err)}); setButtonState(btn, 'is-failed', 'Failed'); })
    .uiCloudStatus(token());
}
function useWorkstationPreset(kind, btn){
  const url = kind === 'win365' ? WORKSTATION_PRESET_WIN365 : WORKSTATION_PRESET_MAC;
  if (!url) {
    showWorkstation({ok:false, message:'Preset is reserved but not set yet.', preset: kind});
    setButtonState(btn, 'is-failed', 'Not Set');
    return;
  }
  document.getElementById('workstation_url').value = url;
  setButtonState(btn, 'is-done', kind === 'win365' ? 'Win365 Filled' : 'Mac Filled');
  showWorkstation({ok:true, mode:'fill_workstation_preset', preset: kind, workstation_url: url, note:'Only filled the field. Press Save Workstation URL to persist.'});
}
function saveWorkstationUrl(btn){
  setButtonState(btn, 'is-running', 'Saving...');
  showWorkstation('Saving workstation URL...');
  google.script.run
    .withSuccessHandler(data => { showWorkstation(data); setButtonState(btn, data && data.ok ? 'is-done' : 'is-failed', data && data.ok ? 'Saved' : 'Check Result'); })
    .withFailureHandler(err => { showWorkstation({ok:false, error:String(err && err.message ? err.message : err)}); setButtonState(btn, 'is-failed', 'Failed'); })
    .uiSaveWorkstationUrl(token(), document.getElementById('workstation_url').value);
}
function wakeLocalWorker(btn, executeMode){
  setButtonState(btn, 'is-running', 'Waking...');
  showWorkstation(executeMode === 'yes' ? 'Calling local worker /api/gas-poll with execute=yes...' : 'Calling local worker /api/gas-poll with execute=no...');
  google.script.run
    .withSuccessHandler(data => { showWorkstation(data); setButtonState(btn, data && data.ok ? 'is-done' : 'is-failed', data && data.ok ? 'Worker Woke' : 'Check Result'); })
    .withFailureHandler(err => { showWorkstation({ok:false, error:String(err && err.message ? err.message : err)}); setButtonState(btn, 'is-failed', 'Failed'); })
    .uiWakeLocalWorker(token(), {trigger_source:'cloud_manual_wake', trigger_mode:'manual', cloud_event_type:'manual_wake_local_worker', execute: executeMode || 'no', workstation_url: document.getElementById('workstation_url').value});
}
function uploadCloudFile(btn, executeMode){
  const fileInput = document.getElementById('cloud_upload_file');
  const file = fileInput.files && fileInput.files[0];
  if (!file) {
    showUpload({ok:false, error:'Please choose a file first.'});
    setButtonState(btn, 'is-failed', 'No File');
    return;
  }
  setButtonState(btn, 'is-running', 'Uploading...');
  showUpload('Reading file and uploading to GAS incoming...');
  const reader = new FileReader();
  reader.onload = function(){
    const contentBase64 = String(reader.result || '').split(',').pop();
    google.script.run
      .withSuccessHandler(data => { showUpload(data); setButtonState(btn, data && data.ok ? 'is-done' : 'is-failed', data && data.ok ? 'Uploaded + Woke' : 'Check Result'); })
      .withFailureHandler(err => { showUpload({ok:false, error:String(err && err.message ? err.message : err)}); setButtonState(btn, 'is-failed', 'Failed'); })
      .uiUploadFileToIncomingAndWake(token(), {name:file.name, mime_type:file.type || 'application/octet-stream', content_base64:contentBase64, execute: executeMode || 'no'});
  };
  reader.onerror = function(){ showUpload({ok:false, error:'File read failed.'}); setButtonState(btn, 'is-failed', 'Read Failed'); };
  reader.readAsDataURL(file);
}
function folderValues(){
  return {
    incoming: document.getElementById('folder_incoming').value,
    processing: document.getElementById('folder_processing').value,
    archive: document.getElementById('folder_archive').value,
    error: document.getElementById('folder_error').value,
    evidence: document.getElementById('folder_evidence').value
  };
}
function useTeachingFolders(btn){
  setButtonState(btn, 'is-running', 'Filling...');
  showFolderSettings('Saving teaching folder defaults...');
  google.script.run
    .withSuccessHandler(data => { showFolderSettings(data); setButtonState(btn, data && data.ok ? 'is-done' : 'is-failed', data && data.ok ? 'Defaults Saved' : 'Check Result'); })
    .withFailureHandler(err => { showFolderSettings({ok:false, error:String(err && err.message ? err.message : err)}); setButtonState(btn, 'is-failed', 'Failed'); })
    .uiUseTeachingFolderDefaults(token());
}
function saveFolders(btn){
  setButtonState(btn, 'is-running', 'Saving...');
  showFolderSettings('Saving folder ids...');
  google.script.run
    .withSuccessHandler(data => { showFolderSettings(data); setButtonState(btn, data && data.ok ? 'is-done' : 'is-failed', data && data.ok ? 'Saved' : 'Check Result'); })
    .withFailureHandler(err => { showFolderSettings({ok:false, error:String(err && err.message ? err.message : err)}); setButtonState(btn, 'is-failed', 'Failed'); })
    .uiSaveFolders(token(), folderValues());
}
function testFolders(btn){
  setButtonState(btn, 'is-running', 'Testing...');
  showFolderSettings('Testing folder access...');
  google.script.run
    .withSuccessHandler(data => { showFolderSettings(data); setButtonState(btn, data && data.ok ? 'is-done' : 'is-failed', data && data.ok ? 'Folders OK' : 'Check Result'); })
    .withFailureHandler(err => { showFolderSettings({ok:false, error:String(err && err.message ? err.message : err)}); setButtonState(btn, 'is-failed', 'Failed'); })
    .uiTestFolders(token());
}
async function createSample(btn){
  setButtonState(btn, 'is-running', 'Creating...');
  show('Creating sample markdown task...');
  google.script.run
    .withSuccessHandler(data => { show(data); setButtonState(btn, data && data.ok ? 'is-done' : 'is-failed', data && data.ok ? 'Created' : 'Check Result'); })
    .withFailureHandler(err => { show({ok:false, error:String(err && err.message ? err.message : err)}); setButtonState(btn, 'is-failed', 'Failed'); })
    .uiCreateSampleMarkdownTask(token());
}
async function listQueued(btn){
  setButtonState(btn, 'is-running', 'Loading...');
  show('Loading queued tasks...');
  google.script.run
    .withSuccessHandler(data => { show(data); setButtonState(btn, data && data.ok ? 'is-done' : 'is-failed', data && data.ok ? 'Listed' : 'Check Result'); })
    .withFailureHandler(err => { show({ok:false, error:String(err && err.message ? err.message : err)}); setButtonState(btn, 'is-failed', 'Failed'); })
    .uiListQueuedTasks(token());
}
function installTrigger(minutes, btn){
  const win = scheduleWindow('heartbeat');
  setButtonState(btn, 'is-running', 'Installing...');
  showTrigger('Installing cloud heartbeat trigger...');
  google.script.run
    .withSuccessHandler(data => { showTrigger(data); setButtonState(btn, data && data.ok ? 'is-done' : 'is-failed', data && data.ok ? 'Installed' : 'Check Result'); })
    .withFailureHandler(err => { showTrigger({ok:false, error:String(err && err.message ? err.message : err)}); setButtonState(btn, 'is-failed', 'Failed'); })
    .uiInstallHealthCheckTrigger(token(), minutes, win.start, win.end);
}
function runHeartbeatNow(btn){
  setButtonState(btn, 'is-running', 'Running...');
  showTrigger('Running scheduledHealthCheck now...');
  google.script.run
    .withSuccessHandler(data => { showTrigger(data); setButtonState(btn, data && data.ok ? 'is-done' : 'is-failed', data && data.ok ? 'Heartbeat Created' : 'Check Result'); })
    .withFailureHandler(err => { showTrigger({ok:false, error:String(err && err.message ? err.message : err)}); setButtonState(btn, 'is-failed', 'Failed'); })
    .uiRunHealthCheckNow(token());
}
function removeTriggers(btn){
  setButtonState(btn, 'is-running', 'Stopping...');
  showTrigger('Stopping cloud heartbeat trigger...');
  google.script.run
    .withSuccessHandler(data => { showTrigger(data); setButtonState(btn, data && data.ok ? 'is-done' : 'is-failed', data && data.ok ? 'Stopped' : 'Check Result'); })
    .withFailureHandler(err => { showTrigger({ok:false, error:String(err && err.message ? err.message : err)}); setButtonState(btn, 'is-failed', 'Failed'); })
    .uiRemoveHealthCheckTriggers(token());
}
function listTriggers(btn){
  setButtonState(btn, 'is-running', 'Loading...');
  showTrigger('Loading cloud heartbeat triggers...');
  google.script.run
    .withSuccessHandler(data => { showTrigger(data); setButtonState(btn, data && data.ok ? 'is-done' : 'is-failed', data && data.ok ? 'Listed' : 'Check Result'); })
    .withFailureHandler(err => { showTrigger({ok:false, error:String(err && err.message ? err.message : err)}); setButtonState(btn, 'is-failed', 'Failed'); })
    .uiListHealthCheckTriggers(token());
}
function scanIncoming(btn, executeMode){
  setButtonState(btn, 'is-running', 'Scanning...');
  showFolderScan('Scanning incoming folder...');
  google.script.run
    .withSuccessHandler(data => { showFolderScan(data); setButtonState(btn, data && data.ok ? 'is-done' : 'is-failed', data && data.ok ? 'Scanned' : 'Check Result'); })
    .withFailureHandler(err => { showFolderScan({ok:false, error:String(err && err.message ? err.message : err)}); setButtonState(btn, 'is-failed', 'Failed'); })
    .uiScanIncomingFolder(token(), {execute: executeMode || 'no'});
}
function installFolderScanTrigger(minutes, btn){
  const win = scheduleWindow('scanner');
  setButtonState(btn, 'is-running', 'Installing...');
  showFolderScan('Installing incoming folder scanner...');
  google.script.run
    .withSuccessHandler(data => { showFolderScan(data); setButtonState(btn, data && data.ok ? 'is-done' : 'is-failed', data && data.ok ? 'Installed' : 'Check Result'); })
    .withFailureHandler(err => { showFolderScan({ok:false, error:String(err && err.message ? err.message : err)}); setButtonState(btn, 'is-failed', 'Failed'); })
    .uiInstallIncomingFolderScanTrigger(token(), minutes, win.start, win.end);
}
function removeFolderScanTriggers(btn){
  setButtonState(btn, 'is-running', 'Stopping...');
  showFolderScan('Stopping incoming folder scanner...');
  google.script.run
    .withSuccessHandler(data => { showFolderScan(data); setButtonState(btn, data && data.ok ? 'is-done' : 'is-failed', data && data.ok ? 'Stopped' : 'Check Result'); })
    .withFailureHandler(err => { showFolderScan({ok:false, error:String(err && err.message ? err.message : err)}); setButtonState(btn, 'is-failed', 'Failed'); })
    .uiRemoveIncomingFolderScanTriggers(token());
}
function listFolderScanTriggers(btn){
  setButtonState(btn, 'is-running', 'Loading...');
  showFolderScan('Loading incoming folder scanner triggers...');
  google.script.run
    .withSuccessHandler(data => { showFolderScan(data); setButtonState(btn, data && data.ok ? 'is-done' : 'is-failed', data && data.ok ? 'Listed' : 'Check Result'); })
    .withFailureHandler(err => { showFolderScan({ok:false, error:String(err && err.message ? err.message : err)}); setButtonState(btn, 'is-failed', 'Failed'); })
    .uiListIncomingFolderScanTriggers(token());
}
function listCloudLogs(btn){
  setButtonState(btn, 'is-running', 'Loading...');
  showLogs('Loading cloud logs...');
  google.script.run
    .withSuccessHandler(data => { showLogs(data); setButtonState(btn, data && data.ok ? 'is-done' : 'is-failed', data && data.ok ? 'Listed' : 'Check Result'); })
    .withFailureHandler(err => { showLogs({ok:false, error:String(err && err.message ? err.message : err)}); setButtonState(btn, 'is-failed', 'Failed'); })
    .uiListLogs(token(), document.getElementById('log_event').value, document.getElementById('log_search').value, 100);
}
function clearCloudLogs(btn){
  if (!confirm('Clear Runtime_Log only? Tasks and Drive_File_State will stay.')) return;
  setButtonState(btn, 'is-running', 'Clearing...');
  showLogs('Clearing cloud logs...');
  google.script.run
    .withSuccessHandler(data => { showLogs(data); setButtonState(btn, data && data.ok ? 'is-done' : 'is-failed', data && data.ok ? 'Cleared' : 'Check Result'); })
    .withFailureHandler(err => { showLogs({ok:false, error:String(err && err.message ? err.message : err)}); setButtonState(btn, 'is-failed', 'Failed'); })
    .uiClearLogs(token());
}
function clearCloudTasks(btn){
  if (!confirm('Clear Tasks only? Runtime_Log and Drive_File_State will stay.')) return;
  setButtonState(btn, 'is-running', 'Clearing...');
  showLogs('Clearing cloud tasks...');
  google.script.run
    .withSuccessHandler(data => { showLogs(data); setButtonState(btn, data && data.ok ? 'is-done' : 'is-failed', data && data.ok ? 'Tasks Cleared' : 'Check Result'); })
    .withFailureHandler(err => { showLogs({ok:false, error:String(err && err.message ? err.message : err)}); setButtonState(btn, 'is-failed', 'Failed'); })
    .uiClearTasks(token());
}
function clearDuplicateGuard(btn){
  if (!confirm('Clear Drive_File_State duplicate guard? Existing Drive files may be scanned again.')) return;
  setButtonState(btn, 'is-running', 'Clearing...');
  showLogs('Clearing duplicate guard...');
  google.script.run
    .withSuccessHandler(data => { showLogs(data); setButtonState(btn, data && data.ok ? 'is-done' : 'is-failed', data && data.ok ? 'Guard Cleared' : 'Check Result'); })
    .withFailureHandler(err => { showLogs({ok:false, error:String(err && err.message ? err.message : err)}); setButtonState(btn, 'is-failed', 'Failed'); })
    .uiClearDuplicateGuard(token());
}
function exportCloudLogsJson(btn){
  setButtonState(btn, 'is-running', 'Exporting...');
  showLogs('Exporting cloud logs JSON...');
  google.script.run
    .withSuccessHandler(data => { showLogs(data); setButtonState(btn, data && data.ok ? 'is-done' : 'is-failed', data && data.ok ? 'Exported' : 'Check Result'); })
    .withFailureHandler(err => { showLogs({ok:false, error:String(err && err.message ? err.message : err)}); setButtonState(btn, 'is-failed', 'Failed'); })
    .uiExportLogsJson(token());
}
function exportCloudLogsExcel(btn){
  setButtonState(btn, 'is-running', 'Exporting...');
  showLogs('Creating cloud logs export spreadsheet...');
  google.script.run
    .withSuccessHandler(data => { showLogs(data); if (data && data.ok && data.url) window.open(data.url, '_blank'); setButtonState(btn, data && data.ok ? 'is-done' : 'is-failed', data && data.ok ? 'Exported' : 'Check Result'); })
    .withFailureHandler(err => { showLogs({ok:false, error:String(err && err.message ? err.message : err)}); setButtonState(btn, 'is-failed', 'Failed'); })
    .uiExportLogsSpreadsheet(token());
}
function exportCloudTasksJson(btn){
  setButtonState(btn, 'is-running', 'Exporting...');
  showLogs('Exporting cloud tasks JSON...');
  google.script.run
    .withSuccessHandler(data => { showLogs(data); setButtonState(btn, data && data.ok ? 'is-done' : 'is-failed', data && data.ok ? 'Exported' : 'Check Result'); })
    .withFailureHandler(err => { showLogs({ok:false, error:String(err && err.message ? err.message : err)}); setButtonState(btn, 'is-failed', 'Failed'); })
    .uiExportTasksJson(token());
}
function exportCloudTasksExcel(btn){
  setButtonState(btn, 'is-running', 'Exporting...');
  showLogs('Creating cloud tasks export spreadsheet...');
  google.script.run
    .withSuccessHandler(data => { showLogs(data); if (data && data.ok && data.url) window.open(data.url, '_blank'); setButtonState(btn, data && data.ok ? 'is-done' : 'is-failed', data && data.ok ? 'Exported' : 'Check Result'); })
    .withFailureHandler(err => { showLogs({ok:false, error:String(err && err.message ? err.message : err)}); setButtonState(btn, 'is-failed', 'Failed'); })
    .uiExportTasksSpreadsheet(token());
}
function exportDuplicateGuardJson(btn){
  setButtonState(btn, 'is-running', 'Exporting...');
  showLogs('Exporting duplicate guard JSON...');
  google.script.run
    .withSuccessHandler(data => { showLogs(data); setButtonState(btn, data && data.ok ? 'is-done' : 'is-failed', data && data.ok ? 'Exported' : 'Check Result'); })
    .withFailureHandler(err => { showLogs({ok:false, error:String(err && err.message ? err.message : err)}); setButtonState(btn, 'is-failed', 'Failed'); })
    .uiExportDuplicateGuardJson(token());
}
function exportDuplicateGuardExcel(btn){
  setButtonState(btn, 'is-running', 'Exporting...');
  showLogs('Creating duplicate guard export spreadsheet...');
  google.script.run
    .withSuccessHandler(data => { showLogs(data); if (data && data.ok && data.url) window.open(data.url, '_blank'); setButtonState(btn, data && data.ok ? 'is-done' : 'is-failed', data && data.ok ? 'Exported' : 'Check Result'); })
    .withFailureHandler(err => { showLogs({ok:false, error:String(err && err.message ? err.message : err)}); setButtonState(btn, 'is-failed', 'Failed'); })
    .uiExportDuplicateGuardSpreadsheet(token());
}
</script>
</body></html>`;
  return HtmlService.createHtmlOutput(html).setTitle('AI NotebookLM GAS Command Center');
}
