/**
 * Gemini helper – shared starter from app-factory (same engine as FitBull).
 * Tries each model in order, remembers the one that works, and parks a model for a while
 * when its free allowance runs out, so the app keeps working on the next one.
 *
 * The key comes from (1) 🔑 Set Gemini key in the Sheet menu, else (2) the GEMINI_API_KEY
 * GitHub secret, which GitHub adds at deploy time (Secrets.gs – never stored in the repo).
 */
const AI_MODELS = ['gemini-3.8-flash', 'gemini-3.5-flash-lite', 'gemini-3.7-flash', 'gemini-2.5-flash'];
// photos, voice and longer reasoning: stronger models first, "lite" only as a last resort
const AI_SMART_MODELS = ['gemini-3.8-flash', 'gemini-3.7-flash', 'gemini-2.5-flash', 'gemini-3.5-flash-lite'];

let lastGeminiError_ = '';

function injectedKey_() { return typeof INJECTED_GEMINI_KEY !== 'undefined' ? String(INJECTED_GEMINI_KEY || '').trim() : ''; }
function geminiKey_() { return PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY') || injectedKey_(); }
function aiOn_() { return !!geminiKey_(); }

/** Sheet menu: paste a key for this app only (leave blank to go back to the GitHub key). */
function setGeminiKey() {
  const ui = SpreadsheetApp.getUi();
  const r = ui.prompt('Gemini key for ' + APP.name,
    'Paste a key from aistudio.google.com → Get API key.\nLeave blank to use the key from GitHub' + (injectedKey_() ? ' (one is set).' : ' (none set).'),
    ui.ButtonSet.OK_CANCEL);
  if (r.getSelectedButton() !== ui.Button.OK) return;
  const key = r.getResponseText().trim(), props = PropertiesService.getScriptProperties();
  if (key) props.setProperty('GEMINI_API_KEY', key); else props.deleteProperty('GEMINI_API_KEY');
  props.deleteProperty('GEMINI_MODEL'); props.deleteProperty('GEMINI_SMART_MODEL');
  testGemini();
}

/** Simple prompt → text (json=true asks for a JSON reply). Returns null on failure – see lastGeminiError_. */
function callGemini_(prompt, json) {
  const body = { contents: [{ role: 'user', parts: [{ text: prompt }] }] };
  if (json) body.generationConfig = { responseMimeType: 'application/json' };
  return geminiText_(body);
}

/** Full generateContent body → text. smart=true for photos/voice/harder tasks; budgetMs stops retries after that long. */
function geminiText_(body, smart, budgetMs) {
  const r = geminiCall_(body, true, smart, budgetMs);
  return r ? r.text.replace(/^\x60{3}(?:html|json)?\s*/i, '').replace(/\x60{3}\s*$/, '').trim() : null;
}

/** Like geminiText_ but parses JSON; returns null if the reply isn't JSON. */
function geminiJson_(prompt, smart, budgetMs) {
  const t = geminiText_({ contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: { responseMimeType: 'application/json' } }, smart, budgetMs);
  if (!t) return null;
  try { return JSON.parse(t); } catch (e) { lastGeminiError_ = 'AI reply was not JSON'; return null; }
}

/** Returns {text, parts, model} or null. body.fast = true (or 'photo') keeps thinking short for quick replies. */
function geminiCall_(body, needText, smart, budgetMs) {
  lastGeminiError_ = '';
  const deadline = budgetMs ? Date.now() + budgetMs : 0;
  const props = PropertiesService.getScriptProperties();
  const key = geminiKey_();
  if (!key) { lastGeminiError_ = 'No Gemini key – use ' + APP.name + ' ▸ 🔑 Set Gemini key'; return null; }
  const remembered = smart ? props.getProperty('GEMINI_SMART_MODEL') : props.getProperty('GEMINI_MODEL');
  const list = smart ? AI_SMART_MODELS : AI_MODELS;
  let models = remembered && !(smart && /lite/i.test(remembered)) ? [remembered].concat(list.filter(m => m !== remembered)) : list.slice();
  // models whose free allowance ran out wait until it resets
  let cool = {}; try { cool = JSON.parse(props.getProperty('GEMINI_COOL') || '{}'); } catch (e) {}
  const nowMs = Date.now(), resting = models.filter(m => cool[m] && cool[m] > nowMs);
  if (resting.length && resting.length < models.length) models = models.filter(m => !resting.includes(m)).concat(resting);
  const tried = {}; let quotaHits = 0;

  for (let mi = 0; mi < models.length; mi++) {
    const model = models[mi];
    if (deadline && mi > 0 && Date.now() > deadline) { lastGeminiError_ = 'Gemini is slow right now (' + lastGeminiError_ + ')'; break; }
    try {
      const send = Object.assign({}, body); delete send.fast;
      const photo = body.fast === 'photo';
      if (body.fast && !tried['nothink:' + model] && !/lite/i.test(model)) send.generationConfig = Object.assign({}, body.generationConfig || {},
        { thinkingConfig: /gemini-2\./.test(model) ? { thinkingBudget: 0 } : { thinkingLevel: photo && !tried['low:' + model] ? 'minimal' : 'low' } });
      if (photo && !tried['nomedia:' + model]) send.generationConfig = Object.assign({}, send.generationConfig || body.generationConfig || {}, { mediaResolution: 'MEDIA_RESOLUTION_LOW' });
      const res = UrlFetchApp.fetch('https://generativelanguage.googleapis.com/v1beta/models/' + model + ':generateContent', {
        method: 'post', contentType: 'application/json', muteHttpExceptions: true,
        headers: { 'x-goog-api-key': key }, payload: JSON.stringify(send),
      });
      const code = res.getResponseCode(), raw = res.getContentText();
      // a model that doesn't take a speed setting: same model again without it (minimal → low → none)
      const gc = send.generationConfig || {};
      if (code === 400 && gc.mediaResolution && /media/i.test(raw)) { tried['nomedia:' + model] = true; mi--; continue; }
      if (code === 400 && gc.thinkingConfig && /think|level/i.test(raw)) {
        if (gc.thinkingConfig.thinkingLevel === 'minimal') tried['low:' + model] = true; else tried['nothink:' + model] = true;
        mi--; continue;
      }
      if (code === 404 || (code === 403 && /model|not found|not available|access/i.test(raw))) { lastGeminiError_ = model + ': ' + code; continue; }
      if (code !== 200) {
        let msg = raw; try { msg = JSON.parse(raw).error.message; } catch (e) {}
        lastGeminiError_ = model + ': ' + code + ' – ' + msg;
        console.error('Gemini error ' + lastGeminiError_);
        if (code === 429) {
          quotaHits++;
          const secs = Number((String(msg).match(/retry in ([\d.]+)s/i) || [])[1]) || 0;
          const perDay = /per.?day|PerDay|free_tier_requests/i.test(msg) && !/per.?minute/i.test(msg);
          cool[model] = Date.now() + (perDay ? 6 * 3600e3 : Math.max(60, secs) * 1000);
          try { props.setProperty('GEMINI_COOL', JSON.stringify(cool)); } catch (e) {}
          lastGeminiError_ = 'The free Gemini allowance is used up for now (' + model + ')';
          continue;
        }
        if (code === 400 || code === 401) return null;   // bad request or key – other models won't help
        if (smart && (code === 503 || code === 500) && !tried[model] && (!deadline || Date.now() + 1500 < deadline)) { tried[model] = true; Utilities.sleep(1500); mi--; }
        continue;
      }
      const data = JSON.parse(raw);
      const parts = (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts) || [];
      const text = parts.filter(p => !p.thought).map(p => p.text || '').join('').trim();
      const hasCall = parts.some(p => p.functionCall);
      if (needText ? !text : (!text && !hasCall)) { lastGeminiError_ = model + ': empty reply'; continue; }
      if (remembered !== model) props.setProperty(smart ? 'GEMINI_SMART_MODEL' : 'GEMINI_MODEL', model);
      return { text, parts, model };
    } catch (e) {
      lastGeminiError_ = model + ': ' + e.message;
      console.error(e);
    }
  }
  if (quotaHits) lastGeminiError_ = 'Today\'s free Gemini allowance is used up on every model – it resets within a day.';
  console.error('All Gemini models failed. Last error: ' + lastGeminiError_);
  return null;
}

/** Sheet menu / editor: checks the key and shows which models work. */
function testGemini() {
  const props = PropertiesService.getScriptProperties();
  props.deleteProperty('GEMINI_MODEL'); props.deleteProperty('GEMINI_SMART_MODEL');
  const quick = callGemini_('Reply with JSON only: {"ok": true}', true);
  const lines = [quick ? '✓ Quick replies use ' + props.getProperty('GEMINI_MODEL') : '✗ ' + lastGeminiError_];
  if (quick) {
    const smart = geminiText_({ contents: [{ role: 'user', parts: [{ text: 'Reply with JSON only: {"ok": true}' }] }], generationConfig: { responseMimeType: 'application/json' } }, true);
    lines.push(smart ? '✓ Harder tasks use ' + props.getProperty('GEMINI_SMART_MODEL') : '✗ Harder tasks: ' + lastGeminiError_);
  }
  const out = lines.join('\n');
  console.log(out);
  try { SpreadsheetApp.getUi().alert('AI check', out, SpreadsheetApp.getUi().ButtonSet.OK); } catch (e) {}
  return out;
}
