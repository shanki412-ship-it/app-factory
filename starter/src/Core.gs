/**
 * Shared starter from app-factory – the same in every app.
 * The app's own features live in App.gs (server) and Index.html (phone app).
 *
 * Setup is one step: open the Sheet → {{APP_NAME}} menu → ▶ Start / repair → Allow.
 */

// ---------- Sheet menu ----------
function onOpen() {
  SpreadsheetApp.getUi().createMenu(APP.name)
    .addItem('▶ Start / repair', 'start')
    .addItem('📱 Open my app', 'showAppLink')
    .addSeparator()
    .addItem('🔑 Set Gemini key', 'setGeminiKey')
    .addItem('🤖 Test AI', 'testGemini')
    .addToUi();
}

/** Builds the tabs, checks the AI, sets the schedules and emails you the app link. Safe to run any time. */
function start() {
  const lines = [];
  ensureTabs_();
  lines.push('✓ Tabs ready: ' + Object.keys(allTabs_()).join(', '));

  const props = PropertiesService.getScriptProperties();
  if (geminiKey_()) {
    props.deleteProperty('GEMINI_MODEL'); props.deleteProperty('GEMINI_SMART_MODEL');
    const ok = !!callGemini_('Reply with JSON only: {"ok": true}', true);
    lines.push(ok ? '✓ AI is on (' + props.getProperty('GEMINI_MODEL') + ').'
      : '✗ AI problem: ' + lastGeminiError_ + '. Use ' + APP.name + ' ▸ 🔑 Set Gemini key.');
  } else {
    lines.push('• AI is off – add a key with ' + APP.name + ' ▸ 🔑 Set Gemini key.');
  }

  const n = ensureSchedules_();
  lines.push(n ? '✓ ' + n + ' schedule' + (n === 1 ? '' : 's') + ' set.' : '• No scheduled jobs in this app yet.');

  const url = appUrl_();
  if (url) {
    lines.push('✓ Your app: ' + url);
    try { welcomeEmail_(url); lines.push('✓ Emailed you the link – open it on your phone.'); }
    catch (e) { lines.push('• Could not email the link: ' + e.message); }
  } else {
    lines.push('✗ No app link yet – run "Deploy to Apps Script" on GitHub, then Start again.');
  }
  props.setProperty('SETUP_DONE', new Date().toISOString());

  const out = lines.join('\n');
  console.log(out);
  try { SpreadsheetApp.getUi().alert(APP.name + ' is ready', out, SpreadsheetApp.getUi().ButtonSet.OK); } catch (e) {}
  return out;
}

// ---------- Tabs ----------
function allTabs_() { return Object.assign({}, APP.tabs || {}, { Settings: ['Setting', 'Value'] }); }

/** Creates missing tabs and adds missing header columns on the right. Never removes data. */
function ensureTabs_() {
  const ss = SpreadsheetApp.getActive();
  Object.entries(allTabs_()).forEach(([name, headers]) => {
    const sh = ss.getSheetByName(name) || ss.insertSheet(name);
    if (sh.getLastRow() === 0 || String(sh.getRange(1, 1).getValue()) === '') {
      sh.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
      sh.setFrozenRows(1);
      return;
    }
    const have = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(String);
    const missing = headers.filter(h => !have.includes(h));
    if (missing.length) sh.getRange(1, have.length + 1, 1, missing.length).setValues([missing]).setFontWeight('bold');
  });
  const blank = ss.getSheetByName('Sheet1');
  if (blank && ss.getSheets().length > 1 && blank.getLastRow() === 0) ss.deleteSheet(blank);
}

function sheet_(name) {
  const ss = SpreadsheetApp.getActive();
  let sh = ss.getSheetByName(name);
  if (!sh) { ensureTabs_(); sh = ss.getSheetByName(name); }
  if (!sh) throw new Error('No tab called "' + name + '" – add it to APP.tabs in App.gs.');
  return sh;
}

/** Rows as objects keyed by header, plus _row (the Sheet row number). Blank rows are skipped. */
function readTable_(name) {
  const v = sheet_(name).getDataRange().getValues();
  if (v.length < 2) return [];
  const h = v[0].map(String);
  return v.slice(1).map((r, i) => {
    const o = { _row: i + 2 };
    h.forEach((k, j) => { o[k] = r[j]; });
    return o;
  }).filter((o, i) => v[i + 1].some(c => c !== ''));
}

/** Adds a row from an object keyed by header (missing keys stay blank). */
function appendRow_(name, obj) {
  const sh = sheet_(name);
  const h = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  sh.appendRow(h.map(k => (obj[k] === undefined || obj[k] === null ? '' : obj[k])));
}

/** Changes the given fields on the row whose ID matches. Returns true if found. */
function updateById_(name, id, fields) {
  const sh = sheet_(name), row = readTable_(name).find(r => String(r.ID) === String(id));
  if (!row) return false;
  const h = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  Object.keys(fields).forEach(k => { const c = h.indexOf(k); if (c >= 0) sh.getRange(row._row, c + 1).setValue(fields[k]); });
  return true;
}

/** Deletes the rows whose ID matches. Returns how many went. */
function deleteById_(name, id) {
  const sh = sheet_(name), rows = readTable_(name).filter(r => String(r.ID) === String(id));
  rows.reverse().forEach(r => sh.deleteRow(r._row));
  return rows.length;
}

/** Runs fn while holding the script lock, so two phones can't write over each other. */
function withLock_(fn) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try { return fn(); } finally { lock.releaseLock(); }
}

// ---------- Settings tab (Setting | Value) ----------
function getSetting_(key, fallback) {
  const row = readTable_('Settings').find(r => String(r.Setting) === key);
  return row && row.Value !== '' ? row.Value : fallback;
}
function setSetting_(key, value) {
  const row = readTable_('Settings').find(r => String(r.Setting) === key);
  if (row) sheet_('Settings').getRange(row._row, 2).setValue(value);
  else appendRow_('Settings', { Setting: key, Value: value });
}

// ---------- Schedules (APP.schedules) ----------
const DAY_NAMES_ = { Sun: 'SUNDAY', Mon: 'MONDAY', Tue: 'TUESDAY', Wed: 'WEDNESDAY', Thu: 'THURSDAY', Fri: 'FRIDAY', Sat: 'SATURDAY' };

/** Replaces this app's timed triggers with the ones listed in APP.schedules. Returns how many. */
function ensureSchedules_() {
  const list = APP.schedules || [];
  list.forEach(s => {
    if (typeof globalThis[s.fn] !== 'function') throw new Error('APP.schedules lists ' + s.fn + ' but there is no function with that name.');
    if (!(s.every === 'day' || DAY_NAMES_[s.every])) throw new Error('APP.schedules: "every" must be day or Mon…Sun (got ' + s.every + ').');
    if (!(s.hour >= 0 && s.hour <= 23)) throw new Error('APP.schedules: hour must be 0–23 for ' + s.fn + '.');
  });
  ScriptApp.getProjectTriggers()
    .filter(t => t.getEventType() === ScriptApp.EventType.CLOCK)
    .forEach(t => ScriptApp.deleteTrigger(t));
  list.forEach(s => {
    const b = ScriptApp.newTrigger(s.fn).timeBased().atHour(s.hour);
    (s.every === 'day' ? b.everyDays(1) : b.onWeekDay(ScriptApp.WeekDay[DAY_NAMES_[s.every]])).create();
  });
  return list.length;
}

// ---------- Phone app ----------
/** The web app's link. Set by GitHub at deploy time (Link.gs) so emails sent by timers have the right one. */
function appUrl_() {
  if (typeof APP_LINK !== 'undefined' && APP_LINK) return String(APP_LINK);
  try { return ScriptApp.getService().getUrl() || ''; } catch (e) { return ''; }
}

function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle(APP.name)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, viewport-fit=cover');
}

function showAppLink() {
  const url = appUrl_();
  const html = url
    ? '<div style="font:15px Arial,sans-serif;line-height:1.5"><p><a href="' + esc_(url) + '" target="_blank">Open ' + esc_(APP.name) + '</a></p>' +
      '<p>On your phone: open the link, then Share → <b>Add to Home Screen</b> (iPhone) or ⋮ → <b>Add to Home screen</b> (Android).</p></div>'
    : '<p style="font:15px Arial,sans-serif">No app link yet – run "Deploy to Apps Script" on GitHub first.</p>';
  SpreadsheetApp.getUi().showModalDialog(HtmlService.createHtmlOutput(html).setWidth(380).setHeight(170), APP.name);
}

function welcomeEmail_(url) {
  const html = '<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.5;color:#1C1A17">' +
    '<h2 style="margin:0 0 6px">' + esc_(APP.name) + ' is ready</h2>' +
    (APP.tagline ? '<p style="color:#6B655B;margin:0 0 12px">' + esc_(APP.tagline) + '</p>' : '') +
    '<p><a href="' + esc_(url) + '" style="background:#1C1A17;color:#fff;padding:12px 18px;border-radius:999px;text-decoration:none;font-weight:bold;display:inline-block">Open ' + esc_(APP.name) + '</a></p>' +
    '<ol><li>Open this email on your phone and tap the button.</li>' +
    '<li>iPhone: Share → <b>Add to Home Screen</b>. Android: ⋮ → <b>Add to Home screen</b>.</li></ol></div>';
  sendEmail_(APP.name + ' is ready – add it to your phone', html);
}

/** Emails you (the Sheet's owner). */
function sendEmail_(subject, htmlBody) {
  MailApp.sendEmail({ to: Session.getEffectiveUser().getEmail(), name: APP.name, subject, htmlBody });
}

// ---------- Small helpers ----------
function uid_() { return Utilities.getUuid().slice(0, 8); }
function tz_() { return Session.getScriptTimeZone() || 'Europe/Dublin'; }
function fmt_(d, pattern) {
  if (d === '' || d === null || d === undefined) return '';
  const date = d instanceof Date ? d : new Date(d);
  return isNaN(date) ? String(d) : Utilities.formatDate(date, tz_(), pattern || 'd MMM yyyy');
}
function esc_(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
