# app-factory

Makes new Google Sheets + Apps Script apps (see README). `starter/` is copied into each new app and
`{{PLACEHOLDERS}}` are filled by `tools/fill.js`. `.github/workflows/new-app.yml` does the creating.

- **Ask the owner before pushing anything** (to this repo or a new app's repo). Explain first, then wait for OK.
- A "new app" request: write a short spec and get it approved, then have the owner run **Actions → New app**
  (or run it if the session can), then attach the new repo and build the features in `src/App.gs` and
  `src/Index.html`, showing each change before pushing.
- Starter changes must pass `NAME=Test REPO=Test OWNER=x node tools/fill.js <copy> && node <copy>/tools/check.js`.
