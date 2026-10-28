/**
 * {{APP_NAME}} – the app's own part. Its features live here and in Index.html.
 * Core.gs (tabs, menu, schedules, helpers) and Gemini.gs (AI) are the shared starter.
 *
 * Out of the box this is a working blank app: an Items list and an Ask AI box,
 * so you can see the Sheet, the phone app and Gemini are all connected.
 */
const APP = {
  name: '{{APP_NAME}}',
  tagline: '{{TAGLINE}}',

  // Tabs that Start builds (and repairs): tab name → header row. A Settings tab is always added.
  tabs: {
    Items: ['Date', 'Item', 'Notes', 'ID'],
  },

  // Timed jobs that Start sets up. every: 'day' or 'Mon'…'Sun'; hour: 0–23 in the Sheet's time zone.
  schedules: [
    // { fn: 'dailyEmail', every: 'day', hour: 7 },
  ],
};

// ---------- Called by the phone app (google.script.run) ----------

function webGetHome() {
  return {
    app: APP.name,
    tagline: APP.tagline,
    aiOn: aiOn_(),
    items: readTable_('Items').slice(-50).reverse().map(r => ({
      id: String(r.ID), item: String(r.Item), notes: String(r.Notes || ''), date: fmt_(r.Date),
    })),
  };
}

function webAddItem(item, notes) {
  item = String(item || '').trim().slice(0, 200);
  if (!item) throw new Error('Type something first.');
  withLock_(() => appendRow_('Items', { Date: new Date(), Item: item, Notes: String(notes || '').trim().slice(0, 500), ID: uid_() }));
  return webGetHome();
}

function webDeleteItem(id) {
  withLock_(() => deleteById_('Items', id));
  return webGetHome();
}

function webAsk(question) {
  question = String(question || '').trim().slice(0, 2000);
  if (!question) throw new Error('Ask a question first.');
  const items = readTable_('Items').slice(-30).map(r => '- ' + r.Item + (r.Notes ? ' (' + r.Notes + ')' : '')).join('\n');
  const prompt = 'You are the assistant inside a small personal app called "' + APP.name + '"' +
    (APP.tagline ? ' (' + APP.tagline + ')' : '') + '. Answer briefly and practically, in plain text.\n\n' +
    (items ? 'Items saved in the app:\n' + items + '\n\n' : '') + 'Question: ' + question;
  const reply = geminiText_({ contents: [{ role: 'user', parts: [{ text: prompt }] }], fast: true }, false, 25000);
  if (!reply) throw new Error(lastGeminiError_ || 'The AI is not available right now.');
  return reply;
}
