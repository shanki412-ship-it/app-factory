# {{APP_NAME}}

{{TAGLINE}}

A Google Sheets + Apps Script phone app, made by [app-factory](https://github.com/{{OWNER}}/app-factory) on {{DATE}}.
The links to the Sheet and the app are in `deploy.json`.

**Change anything in `src/` on `main` and GitHub updates the app automatically.** There's no copy-paste and
no clicking Deploy, and the app link stays the same.

| File | What it is |
|---|---|
| `src/App.gs` | This app's own server code: its tabs, schedules and the functions the phone app calls |
| `src/Index.html` | The phone app |
| `src/Core.gs` | Shared starter: menu, ▶ Start, tabs, schedules, emails, helpers |
| `src/Gemini.gs` | Shared starter: Gemini with model fallback and free-quota handling |
| `src/appsscript.json` | Project settings. Who can open the app: **{{ACCESS_TEXT}}** |

## First run (once)
Open the Sheet, then choose **{{APP_NAME}} ▸ ▶ Start / repair** and click **Allow**. It builds the tabs, checks
the AI, sets up any schedules and emails you the app link. Open that email on your phone and add the app to your
home screen.

## How a change goes live
1. A file in `src/` changes on `main`.
2. **Actions → Deploy to Apps Script** runs, which takes about a minute. It checks the code first, and if it finds
   a mistake it stops, so the live app stays as it was.
3. Close and reopen the app on the phone.

## Good to know
- **Changes made in the Apps Script editor are overwritten by the next deploy.** Make them here instead.
- **Secrets:** `CLASPRC_JSON` is your Google sign-in for Apps Script, and `GEMINI_API_KEY` is the shared Gemini
  key. GitHub adds the key at deploy time, so it's never stored in the repo. To use a different key for this app
  only, choose **{{APP_NAME}} ▸ 🔑 Set Gemini key** in the Sheet.
- Anyone you make an **editor of the Sheet** can open its Apps Script project and see the key. Share the Sheet
  as **Viewer** unless they need to edit it.
- Keep this repo **private**.
