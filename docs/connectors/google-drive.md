# Google Drive connector — setup

The Google Drive connector lets a manager connect a Google account (read-only)
and import a Drive **file or folder** into the Knowledge Vault. Each file's text
becomes a searchable document your AI Employees can answer from. This is a
one-time setup on the Google Cloud side; after that, connecting an account is a
few clicks in the app.

## What you need

- A Google account with access to the [Google Cloud Console](https://console.cloud.google.com/).
- The app's public origin(s) — e.g. `https://taurus-ai-gold.vercel.app` for
  production and your preview/local origins.

## 1. Create (or pick) a Google Cloud project

Console → project picker (top bar) → **New Project** → name it (e.g. "Taurus AI")
→ **Create**.

## 2. Enable the Google Drive API

APIs & Services → **Library** → search **Google Drive API** → **Enable**.

## 3. Configure the OAuth consent screen

APIs & Services → **OAuth consent screen**.

- **User type**: choose **External** (unless every user is in your Google
  Workspace org, in which case **Internal** avoids the verification step).
- Fill in the app name, a support email, and a developer contact email.
- **Scopes**: add `.../auth/drive.readonly` and `.../auth/userinfo.email`.
  (These are the only scopes the app requests — read-only Drive + the account
  email for display.)
- **Test users**: while the app is in "Testing", add the email addresses that
  will connect Drive. (Publish the app later to allow anyone.)

> Read-only note: `drive.readonly` is a **restricted** scope. Google may require
> app verification before external, non-test users can use it. During development
> your listed **test users** can connect immediately without verification.

## 4. Create the OAuth client

APIs & Services → **Credentials** → **Create credentials** → **OAuth client ID**.

- **Application type**: **Web application**.
- **Authorized redirect URIs** — add one per origin, each in the exact form:

  ```
  <app-origin>/api/knowledge/connectors/google-drive/callback
  ```

  For example:
  - `https://taurus-ai-gold.vercel.app/api/knowledge/connectors/google-drive/callback`
  - `http://localhost:3000/api/knowledge/connectors/google-drive/callback`

- **Create**, then copy the **Client ID** and **Client secret**.

## 5. Set the environment variables

Add these to the app's environment (Vercel Project Settings → Environment
Variables, and `.env.local` for local dev):

```
GOOGLE_DRIVE_CLIENT_ID=<your client id>.apps.googleusercontent.com
GOOGLE_DRIVE_CLIENT_SECRET=<your client secret>
# Optional — only if you want to pin one exact redirect URI instead of deriving
# it from the request origin. Must match a value registered above.
GOOGLE_DRIVE_REDIRECT_URI=
```

Also make sure `TAURUS_MODEL_CREDENTIALS_MASTER_KEY` is set (min 16 chars) — the
connector encrypts the stored Google refresh token with it. If it's empty, the
connector is disabled.

Redeploy so the new variables take effect.

## 6. Connect and import (in the app)

Dashboard → **Knowledge Vault** → **Add Knowledge** → **Google Drive** tab →
**Connect Google Drive** → choose the account and approve read-only access. Back
in the form, give the source a name and paste a **Drive file or folder link**,
then **Import from Drive**. Use **Sync now** on the source page any time to
re-read Drive and refresh the content.

## How it behaves

- **Read-only**: the app only ever reads; it can't modify or delete Drive files.
- **Folders** are read one level deep, up to 50 files; nested folders are skipped
  (import them as their own sources). Files over 10 MB are skipped.
- **Supported files**: PDF, Word (`.docx`), text/markdown/CSV/JSON, and Google
  **Docs** (exported as Word), **Sheets** (exported as CSV — first sheet), and
  **Slides** (exported as text). Other types are skipped, not failed.
- **Security**: the refresh token is encrypted at rest and never sent to the
  browser; only the connected account email is shown. The OAuth `state` is signed
  and bound to the user + organization to prevent cross-site callbacks.

## Troubleshooting

- **`redirect_uri_mismatch`** — the redirect URI on the OAuth client doesn't
  exactly match the app origin (scheme, host, and path must match, no trailing
  slash). Add the exact `<origin>/api/knowledge/connectors/google-drive/callback`.
- **"Google didn't return offline access" / no refresh token** — reconnect and
  approve access; if it persists, remove the app's access at
  [myaccount.google.com/permissions](https://myaccount.google.com/permissions)
  and connect again.
- **`access_blocked` / app not verified** — add the connecting email as a **test
  user**, or publish/verify the app for external use.
- **The Google Drive tab is missing** — `GOOGLE_DRIVE_CLIENT_ID` /
  `GOOGLE_DRIVE_CLIENT_SECRET` aren't set in that environment.
