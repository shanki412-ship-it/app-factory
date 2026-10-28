# Working on {{APP_NAME}}

A Google Sheets + Apps Script phone app made by app-factory. Every push to `main` that touches `src/`
deploys it automatically, so pushing to main is the same as releasing.

- **Ask before pushing or deploying anything.** Explain what you found and what you'll change, then wait
  for the owner's OK. Never fix things on your own.
- The app's features go in `src/App.gs` (server, `APP` settings, `web…` functions) and `src/Index.html`
  (phone UI, which calls `web…` functions via `call('webName', …)`). Leave `Core.gs` and `Gemini.gs` alone
  unless the change is really to the shared starter.
- New tabs go in `APP.tabs`, and timed jobs in `APP.schedules`. The owner then runs ▶ Start / repair once.
- Use `readTable_`, `appendRow_`, `updateById_`, `deleteById_` and `withLock_` for Sheet data, and give every
  row an `ID` column. Server functions must return plain strings and numbers, not Date objects, to the page.
- Never put API keys in code. `node tools/check.js` must pass before pushing; the deploy runs it too.
- Write for a phone: big tap targets, and the playful theme's colour blocks (`card blk sun|lav|mint|pink|sage`).
