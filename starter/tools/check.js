// Catches mistakes before anything reaches Apps Script (runs on every deploy):
// the .gs files must parse together, every <script> in the .html files must parse,
// appsscript.json must be valid, and no API key or unfilled app-factory placeholder may be in src/.
const fs = require('fs'), path = require('path'), vm = require('vm');
const src = path.join(__dirname, '..', 'src');
let bad = 0;
const err = msg => { bad++; console.error('::error::' + msg); };

const files = fs.readdirSync(src);
const gs = files.filter(f => f.endsWith('.gs')).sort();
try { new vm.Script(gs.map(f => fs.readFileSync(path.join(src, f), 'utf8')).join('\n;\n'), { filename: gs.join('+') }); console.log('ok  ' + gs.join(', ')); }
catch (e) { err('Problem in the .gs files – ' + e.message); }

files.filter(f => f.endsWith('.html')).forEach(f => {
  const html = fs.readFileSync(path.join(src, f), 'utf8');
  const blocks = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)].map(m => m[1]);
  let ok = true;
  blocks.forEach((code, i) => { try { new vm.Script(code, { filename: f + ' script ' + (i + 1) }); } catch (e) { ok = false; err('Problem in ' + f + ' – ' + e.message); } });
  if (ok) console.log('ok  ' + f + ' (' + blocks.length + ' script block' + (blocks.length === 1 ? '' : 's') + ')');
});

try { JSON.parse(fs.readFileSync(path.join(src, 'appsscript.json'), 'utf8')); console.log('ok  appsscript.json'); }
catch (e) { err('appsscript.json is missing or not valid JSON – ' + e.message); }

files.filter(f => /\.(gs|html|json)$/.test(f) && !['Secrets.gs', 'Link.gs'].includes(f)).forEach(f => {
  const text = fs.readFileSync(path.join(src, f), 'utf8');
  if (/AIza[0-9A-Za-z_-]{20,}/.test(text)) err(f + ' has a Google API key in it. Keys belong in the GEMINI_API_KEY secret or 🔑 Set Gemini key, never in the code.');
  const ph = text.match(/\{\{[A-Z_]+\}\}/);
  if (ph) err(f + ' still has the placeholder ' + ph[0] + '.');
});

process.exit(bad ? 1 : 0);
