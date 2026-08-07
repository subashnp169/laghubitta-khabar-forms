# NEXT STEPS — Saved for tomorrow

## Goal
Make **Blogger (laghubittakhabar.blogspot.com) the single front door**, since that is where people actually come, and stop re-pasting the portal into Blogspot manually.

## Chosen architecture
```
People visit  →  laghubittakhabar.blogspot.com  (Blogger)
                     ├─ blog (articles from Content Studio — native to Blogger)
                     └─ /p/forms.html  →  <iframe src="https://laghubitta-khabar-forms.pages.dev/">
                                              ↳ posts to Apps Script → Google Sheets
                     └─ Facebook posts link back to blogspot articles
```

- **Blogger** = public face (content + forms page)
- **Cloudflare Pages** = single home of the portal code (`index.html`, `logo.webp`)
- **GitHub Pages** = automatic backup (repo already does this)
- **Apps Script + Sheets** = database (one web app, one `SCRIPT_URL`; redeploy as "New version on same deployment")

## Todo for tomorrow
1. Generate an **iframe version of `blogger-page.html`** that just frames `https://laghubitta-khabar-forms.pages.dev/`.
2. Replace the Blogspot **Forms** page body with that iframe content (Blogger → Pages → edit the existing Forms page → HTML view).
3. Verify the portal still submits to the sheet from blogspot; hard-refresh after.
4. (Optional, highest value) Attach a **custom domain** to Blogger (e.g. `www.laghubittakhabar.com`):
   - Blogger Dashboard → Settings → Domain → custom domain setup (CNAME to `ghs.google.com`)
   - Manage DNS on Cloudflare; keep `*.pages.dev` as-is
5. Keep backend/publishing as-is (manual review → Blogger + Facebook).

## Fallback
If the iframe misbehaves on some phones, revert the Forms page to the current inline paste method (regenerate `blogger-page.html`) and re-paste — but try iframe first.

---

## Form refinements (ideas from the PMLIL job-application form — deferred)

Reference: the pasted PMLIL vacancy form (good: file upload zones, AD/BS date picker, privacy note, progress steps, dropdowns, section cards).

Suggested priority for `index.html` (single portal → one deploy updates CF Pages + GH Pages + Blogspot iframe):
1. **File upload** — Job Career Sathi (CV) + Client Help (evidence photos) → save to Google Drive (`FOLDER_ID` already reserved in `Code.gs` settings). Needs: frontend base64 file read; backend `uploadFile`-style handler in `Code.gs`; store Drive link in the sheet row.
2. **Privacy note near submit + reference/ticket number** — switch POST from `mode:"no-cors"` to `mode:"cors"` (Apps Script web apps return CORS headers) so we can read the response and show e.g. `LK-2026-XXXX` (grievance no.) after submit.
3. **AD/BS DOB picker** — reuse the example's calendar logic; add DOB to Job + SENNA.
4. **77-district dropdown + progress/step indicator** on the Job form.

Skip: CSRF token, Cloudflare beacon, vacancy banner (unless posting real vacancies).

Also: Facebook/Messenger plan — **Way 1 (recommended)**: `m.me/YourPageUsername` + Page → Settings → Messaging → Instant Reply auto-sends the portal link (works inside Messenger's in-app browser; forms already POST to Sheets). **Way 2**: a Messenger chat-bot form writing to Sheets (needs Meta app + webhook, hostable in Apps Script). Deferred pending user decision.
