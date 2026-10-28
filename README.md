# app-factory

Makes a new Google Sheets + Apps Script phone app in about 2 minutes, with no laptop needed.

## Make a new app
1. **Actions → New app → Run workflow.**
2. Fill in the app name, an optional one-line description, and who can open it. Leave the repo name empty to make
   one from the app name.
3. Wait for the green tick, about 2 minutes. The run's summary has the Sheet, the phone-app link and the new repo.
4. Open the Sheet, choose **<App name> ▸ ▶ Start / repair** and click **Allow**. Google requires a person to do
   this once per app. Start then emails you the app link to add to your phone.

The factory sets up everything else:

| Before | Now |
|---|---|
| Create the GitHub repo | Created private, with the starter code, deploy workflow and checker |
| Create the Sheet and Apps Script | Created together, with the script inside the Sheet |
| Copy the code across | The starter is pushed to the script |
| Script ID and `.clasp.json` | Written into the new repo |
| Deploy and copy the link | First web-app deployment made, link saved in `deploy.json` |
| Secrets and the Gemini key | `CLASPRC_JSON` and `GEMINI_API_KEY` copied into the new repo |
| Codespace so Claude can deploy | Not needed. Every push to the new repo's `main` deploys itself |

Every app made here is listed in `apps.json`.

## What's in a new app (`starter/`)
- `src/App.gs` and `src/Index.html`: the app's own part. It starts as a working blank app (an Items list plus
  Ask AI), so you can see the Sheet, the phone app and Gemini are connected. Its real features get built here.
- `src/Core.gs`: the Sheet menu, ▶ Start, building tabs from `APP.tabs`, schedules from `APP.schedules`, the
  welcome email and Sheet helpers.
- `src/Gemini.gs`: FitBull's Gemini engine, with model fallback and free-quota handling.
- The playful theme and phone shell (top menu, tabs, toasts, dark mode), the code checker, and the deploy
  workflow.

## Secrets this repo needs
| Secret | What |
|---|---|
| `FACTORY_TOKEN` | Fine-grained token on All repositories with Administration, Contents, Secrets and Workflows set to Read and write. It expires, so renew it here when it does. |
| `CLASPRC_JSON` | Your Google sign-in for Apps Script (the same one FitBull uses) |
| `GEMINI_API_KEY` | Shared Gemini key, copied into each new app |

To cut off Google access everywhere at once, remove "clasp – The Apps Script CLI" at
myaccount.google.com/permissions.

## Changing the starter
Edits to `starter/` only affect apps made afterwards. **Test starter** runs on every push and checks the
starter still fills and passes the code checker.
