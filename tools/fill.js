// Fills the {{PLACEHOLDERS}} in every text file of a new app's folder.
// Usage: NAME=… TAGLINE=… REPO=… OWNER=… ACCESS=MYSELF|ANYONE node tools/fill.js <folder>
const fs = require('fs'), path = require('path');
const dir = process.argv[2];
if (!dir || !fs.existsSync(dir)) { console.error('Usage: node tools/fill.js <folder>'); process.exit(1); }

const env = process.env;
const access = env.ACCESS === 'ANYONE' ? 'ANYONE' : 'MYSELF';
const values = {
  APP_NAME: env.NAME,
  TAGLINE: env.TAGLINE || '',
  REPO: env.REPO,
  OWNER: env.OWNER,
  ACCESS: access,
  ACCESS_TEXT: access === 'ANYONE' ? 'anyone signed in to a Google account' : 'only you',
  DATE: new Date().toISOString().slice(0, 10),
};
['APP_NAME', 'REPO', 'OWNER'].forEach(k => { if (!values[k]) { console.error('Missing value for ' + k); process.exit(1); } });
// the name and tagline go inside '…' strings in the code, so quotes and backslashes are never allowed
['APP_NAME', 'TAGLINE'].forEach(k => { if (/['"\\<>`$]/.test(values[k])) { console.error(k + ' has a character that isn\'t allowed'); process.exit(1); } });

const textExt = /\.(gs|js|html|json|md|yml|yaml|txt)$|^\.gitignore$/;
let changed = 0, unknown = new Set();
(function walk(d) {
  for (const f of fs.readdirSync(d)) {
    const p = path.join(d, f);
    if (fs.statSync(p).isDirectory()) { walk(p); continue; }
    if (!textExt.test(f)) continue;
    const before = fs.readFileSync(p, 'utf8');
    const after = before.replace(/\{\{([A-Z_]+)\}\}/g, (m, k) => (k in values ? values[k] : (unknown.add(k), m)));
    if (after !== before) { fs.writeFileSync(p, after); changed++; }
  }
})(dir);
if (unknown.size) { console.error('Unknown placeholders: ' + [...unknown].join(', ')); process.exit(1); }
console.log('Filled ' + changed + ' files for "' + values.APP_NAME + '"');
