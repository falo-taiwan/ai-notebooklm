function token(){ return document.getElementById('token').value.trim(); }


initPortal();

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
  } else {
    renderHostStatus('guest');
    showLoginScreen();
  }
}

function showLoginScreen() {
  document.getElementById('login-wrapper').style.display = 'block';
  document.getElementById('main-content-wrapper').style.display = 'none';
}

function showMainContent(auth) {
  document.getElementById('login-wrapper').style.display = 'none';
  document.getElementById('main-content-wrapper').style.display = 'block';
  
  
  document.getElementById('token').value = auth.token || SYSTEM_API_TOKEN;
  
  
  renderHostStatus(auth.role);
}

function submitLogin(btn) {
  const user = document.getElementById('login_user').value.trim();
  const pass = document.getElementById('login_pass').value.trim();
  const errorEl = document.getElementById('login-error-msg');
  errorEl.textContent = '';
  
  if (!user || !pass) {
    errorEl.textContent = 'è«è¼¸å¥å¸³èèå¯ç¢¼ï¼';
    return;
  }
  
  setButtonState(btn, 'is-running', 'ç»å¥ä¸­...');
  google.script.run
    .withSuccessHandler(data => {
      setButtonState(btn, null, 'ç»å¥ç³»çµ±');
      if (data && data.ok) {
        sessionStorage.setItem('falo_auth', JSON.stringify(data));
        showMainContent(data);
      } else {
        errorEl.textContent = (data && data.error) ? data.error : 'ç»å¥å¤±æã';
      }
    })
    .withFailureHandler(err => {
      setButtonState(btn, null, 'ç»å¥ç³»çµ±');
      errorEl.textContent = 'ç³»çµ±é¯èª¤: ' + String(err && err.message ? err.message : err);
    })
    .uiLogin(user, pass);
}

function renderHostStatus(role) {
  const statusSection = document.getElementById('host-status-section');
  statusSection.style.display = 'block';
  
  const dot = document.getElementById('cloud-host-dot');
  const text = document.getElementById('cloud-host-status-text');
  const info = document.getElementById('cloud-host-info');
  
  if (!REPORTED_LAST_SEEN) {
    dot.style.color = '#9d2f2f';
    text.textContent = 'ð´ å°ç«¯ä¸»æ©æªä¸å ±ä»»ä½é£ç·è³è¨';
    info.style.display = 'none';
    
    if (role === 'admin') {
      document.getElementById('dev-diagnostic-panel').style.display = 'block';
      document.getElementById('dev-diagnostic-reason').textContent = 'ç°å¸¸åå ï¼é²ç«¯æªæ¾æ¶å°ä»»ä½å°ç«¯ä¸»æ©ä¸å ±ä¹çæã';
      document.getElementById('dev-diagnostic-json').textContent = 'ç¡ä¸å ±è³æ';
    }
    return;
  }
  
  
  const lastSeenStr = REPORTED_LAST_SEEN.replace(/-/g, '/');
  const lastSeenDate = new Date(lastSeenStr);
  const now = new Date();
  const diffMs = now - lastSeenDate;
  const diffMins = Math.floor(diffMs / 1000 / 60);
  
  const intervalSec = parseInt(REPORTED_INTERVAL) || 300;
  const thresholdMins = Math.max(10, Math.ceil((intervalSec * 2.5) / 60));
  
  const isOnline = diffMins < thresholdMins;
  
  document.getElementById('cloud-host-name').textContent = REPORTED_HOSTNAME || 'æªç¥ä¸»æ©';
  
  let methodStr = 'æªç¥';
  if (REPORTED_METHOD === 'manual') {
    methodStr = 'ð æåæ¨éæ´æ°';
  } else if (REPORTED_METHOD === 'scheduled') {
    const mins = Math.round(intervalSec / 60);
    methodStr = 'â±ï¸ å®æèªåä¸å ± (æ¯ ' + mins + ' åé)';
  }
  document.getElementById('cloud-host-method').textContent = methodStr;
  document.getElementById('cloud-host-last-seen').textContent = REPORTED_LAST_SEEN + ' (ç´ ' + diffMins + ' åéå)';
  document.getElementById('cloud-host-url').value = REPORTED_LAN_URL;
  
  if (isOnline) {
    dot.style.color = '#208454';
    text.textContent = 'ð¢ å°ç«¯ä¸»æ©é£ç·æ­£å¸¸';
    info.style.display = 'block';
    document.getElementById('dev-diagnostic-panel').style.display = 'none';
    statusSection.style.borderLeftColor = '#208454';
  } else {
    dot.style.color = '#9d2f2f';
    text.textContent = 'ð´ å°ç«¯ä¸»æ©å·²é¢ç·æé£ç·ç°å¸¸';
    info.style.display = 'block';
    statusSection.style.borderLeftColor = '#9d2f2f';
    
    if (role === 'admin') {
      document.getElementById('dev-diagnostic-panel').style.display = 'block';
      document.getElementById('dev-diagnostic-reason').textContent = 'ç°å¸¸åå ï¼å·²é¾æ ' + diffMins + ' åéæªæ¶å°åå ±ï¼é ä¼°é±æ: ' + Math.round(intervalSec / 60) + ' åéï¼å®¹è¨±é¥å¼: ' + thresholdMins + ' åéï¼ã';
      
      const rawJsonObj = {
        lan_url: REPORTED_LAN_URL,
        hostname: REPORTED_HOSTNAME,
        report_method: REPORTED_METHOD,
        poll_interval_seconds: intervalSec,
        last_seen_at: REPORTED_LAST_SEEN,
        server_current_time: now.toLocaleString()
      };
      document.getElementById('dev-diagnostic-json').textContent = JSON.stringify(rawJsonObj, null, 2);
    }
  }
}

function copyCloudHostUrl() {
  const urlInput = document.getElementById('cloud-host-url');
  navigator.clipboard.writeText(urlInput.value).then(() => {
    const btn = document.getElementById('cloud-host-copy-btn');
    const originalText = btn.textContent;
    btn.textContent = 'â å·²è¤è£½ï¼';
    setTimeout(() => {
      btn.textContent = originalText;
    }, 2000);
  }).catch(err => {
    console.error('Failed to copy host URL:', err);
    alert('è¤è£½å¤±æï¼è«æåè¤è£½ç¶²åï¼
' + urlInput.value);
  });
}

const REPORTED_LAN_URL = 'http://192.168.31.114:8765';
const REPORTED_HOSTNAME = 'YinlindeMac-mini.local';
const REPORTED_METHOD = 'manual';
const REPORTED_INTERVAL = '600';
const REPORTED_LAST_SEEN = '2026-06-14 12:34:43';
const PASSIVE_MODE_SETTING = 'true';
const SYSTEM_API_TOKEN = 'CHANGE_ME_LOCAL_TOKEN';

const WORKSTATION_PRESET_MAC = 'https://conclude-reapply-backhand.ngrok-free.dev';
const WORKSTATION_PRESET_WIN365 = '';
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
  document.getElementById('token').value = 'CHANGE_ME_LOCAL_TOKEN';
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