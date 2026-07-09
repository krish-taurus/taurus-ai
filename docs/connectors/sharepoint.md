# SharePoint / OneDrive connector — setup

Connect a Microsoft account (read-only) and import a **OneDrive or SharePoint file
or folder** from a sharing link. Each supported file's text becomes a searchable
Knowledge Vault document your AI Employees can answer from. This is a one-time
setup on the Azure side (an app registration); after that, connecting is a few
clicks in the app.

Supported file types: PDF, Word (`.docx`), text/markdown/CSV/JSON. Folders import
supported files one level deep (up to 50); files over 10 MB are skipped.

## What you need

- An Azure account with access to [Microsoft Entra ID / Azure AD](https://portal.azure.com/).
- The app's public origin(s) — e.g. `https://taurus-ai-gold.vercel.app` for
  production and your preview/local origins.

## 1. Register an application

Azure Portal → **Microsoft Entra ID** → **App registrations** → **New registration**.

- **Name**: e.g. "Taurus AI Knowledge".
- **Supported account types**: choose what matches your users:
  - *Accounts in this organizational directory only* — your tenant only.
  - *Accounts in any organizational directory and personal Microsoft accounts* —
    work + personal OneDrive. (This maps to the `common` tenant, the default.)
- **Redirect URI**: platform **Web**, value:
  ```
  <app-origin>/api/knowledge/connectors/sharepoint/callback
  ```
  e.g. `https://taurus-ai-gold.vercel.app/api/knowledge/connectors/sharepoint/callback`
  (add `http://localhost:3000/...` too for local dev).
- **Register**, then copy the **Application (client) ID**. If you chose a
  single-tenant app, also copy the **Directory (tenant) ID**.

## 2. Add a client secret

App → **Certificates & secrets** → **New client secret** → set an expiry → copy
the secret **Value** (not the Id) immediately.

## 3. Grant delegated permissions

App → **API permissions** → **Add a permission** → **Microsoft Graph** →
**Delegated permissions** → add:

- `offline_access` (to obtain a refresh token)
- `User.Read`
- `Files.Read.All`
- `Sites.Read.All`

If your tenant requires it, click **Grant admin consent**. (These are read-only
scopes — the app can never modify files.)

## 4. Set the environment variables

Add these to the app's environment (Vercel Project Settings → Environment
Variables, and `.env.local` for local dev):

```
MICROSOFT_CLIENT_ID=<application (client) id>
MICROSOFT_CLIENT_SECRET=<client secret value>
# Optional. Default is "common" (work + personal). Set to your Directory (tenant)
# ID (or "organizations") for a single-tenant app.
MICROSOFT_TENANT=
# Optional — only to pin one exact redirect URI instead of deriving it from the
# request origin. Must match a value registered above.
MICROSOFT_REDIRECT_URI=
```

Also ensure `TAURUS_MODEL_CREDENTIALS_MASTER_KEY` is set (min 16 chars) — the
connector encrypts the stored refresh token with it. If empty, the connector is
disabled. Redeploy so the new variables take effect.

## 5. Connect and import (in the app)

Dashboard → **Knowledge Vault → Add Knowledge → SharePoint / OneDrive** →
**Connect Microsoft account** → sign in and approve read-only access. Back in the
form, give the source a name and paste a **sharing link** to a file or folder
(the **Share → Copy link** URL from OneDrive or SharePoint), then **Import from
Microsoft**. Use **Sync now** on the source page any time to refresh.

## How it behaves

- **Read-only**: the app only ever reads; it can't modify or delete content.
- A single **sharing link** works for both OneDrive and SharePoint — Graph resolves
  it to the underlying drive item.
- **Folders** are read one level deep (up to 50 files); nested folders are skipped
  (import them as their own sources). Files over 10 MB are skipped.
- **Security**: the refresh token is encrypted at rest and never sent to the
  browser; only the connected account email is shown. The OAuth `state` is signed
  and bound to the user + organization.

## Troubleshooting

- **`AADSTS50011` redirect mismatch** — the redirect URI on the app registration
  doesn't exactly match `<origin>/api/knowledge/connectors/sharepoint/callback`
  (scheme, host, path, no trailing slash).
- **"No offline access" / no refresh token** — make sure `offline_access` is in the
  delegated permissions, then reconnect.
- **"That link could not be opened"** — the sharing link is expired or the connected
  account doesn't have access; use a link the account can open, or re-share it.
- **The SharePoint / OneDrive tab is missing** — `MICROSOFT_CLIENT_ID` /
  `MICROSOFT_CLIENT_SECRET` aren't set in that environment.
