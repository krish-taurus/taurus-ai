# Cloud storage connector — setup

Connect an object store and import its files into the Knowledge Vault. Each
supported file's text becomes a searchable document your AI Employees can answer
from. Two providers are supported, both **read-only** and both configured
entirely in the app (no server env vars) — you paste a scoped, read-only
credential and it's stored encrypted.

Supported file types: PDF, Word (`.docx`), text/markdown/CSV/JSON. Other types are
skipped. Up to 50 files per source (optionally narrowed with a folder prefix);
files over 10 MB are skipped. **Sync now** re-reads the bucket/container.

---

## Azure Blob Storage — read-only container SAS URL

You give the app a **container-level SAS URL** with **Read + List** permission.
The SAS is scoped and time-boxed by you, so nothing else is needed and access
expires on its own.

Generate it one of these ways:

**Azure Portal**
1. Storage account → **Containers** → open the container.
2. **Shared access tokens** (left menu).
3. **Permissions**: check **Read** and **List** (leave Write/Delete/Add off).
4. Set an **Expiry** that suits you.
5. **Generate SAS token and URL** → copy the **Blob SAS URL**. It looks like:
   `https://<account>.blob.core.windows.net/<container>?sv=…&ss=…&sig=…`

**Azure CLI**
```
az storage container generate-sas \
  --account-name <account> --name <container> \
  --permissions rl --expiry 2026-12-31T00:00Z --https-only --output tsv
```
Prefix it with `https://<account>.blob.core.windows.net/<container>?` to form the
full URL.

In the app: **Add Knowledge → Cloud Storage → Azure Blob Storage**, paste the
**Container SAS URL**, optionally a folder **prefix**, then **Connect & import**.

> The connector only ever fetches `*.blob.core.windows.net`, and the SAS grants
> read/list only — it can't write or delete.

---

## Google Cloud Storage — read-only service account

You give the app a **service-account JSON key** whose account has read access to
the bucket.

1. **Google Cloud Console** → **IAM & Admin → Service Accounts** → **Create service
   account** (e.g. `taurus-knowledge`).
2. Grant it **Storage Object Viewer** (`roles/storage.objectViewer`) — either at the
   project level, or (tighter) on just the target bucket via the bucket's
   **Permissions** tab.
3. Open the service account → **Keys → Add key → Create new key → JSON** → download.
4. In the app: **Add Knowledge → Cloud Storage → Google Cloud Storage**, enter the
   **Bucket name**, paste the **service-account JSON**, optionally a **prefix**, then
   **Connect & import**.

> The app requests the `devstorage.read_only` scope when it authenticates, so the
> connection can only read objects — never write.

---

## Security notes

- The credential (SAS URL or service-account JSON) is **encrypted at rest**
  (AES-GCM, same key store as model credentials) and never returned to the
  browser; only the account/container or bucket name is shown.
- Requires `TAURUS_MODEL_CREDENTIALS_MASTER_KEY` to be set (min 16 chars) — if it's
  empty, the connector is disabled.
- Prefer least privilege: a read/list SAS (Azure) or a **Storage Object Viewer**
  service account scoped to the single bucket (GCS).

## Troubleshooting

- **"Could not list the Azure container"** — the SAS is missing **List**
  permission or has expired; regenerate with `rl` permissions.
- **"That doesn't look like an Azure Blob URL"** — the URL host must be
  `<account>.blob.core.windows.net` and include the container path and a `sig`.
- **"Google rejected the service-account key"** — the account lacks read access to
  the bucket, or the key JSON is incomplete; grant **Storage Object Viewer** and
  re-download the key.
- **"No supported files were found"** — the container/bucket (under the prefix)
  has no PDF/Word/text/CSV/JSON files, or they're all over 10 MB.
