# Laghubitta Khabar — Help, Career & Network Portal

Single-page bilingual (English + Nepali) portal with **4 forms** for the Laghubitta Khabar / SENNA Network initiative:

1. **Job Career Sathi** - Free CV, cover letter & exam preparation help for MFI/bank/cooperative jobs
2. **Client Help Model** - Grievance reporting: harassment, illegal interest, CIB problems
3. **SENNA Network** - Membership registration for the genuine people's network
4. **Confession** - Anonymous sharing of experiences (no identity required)
5. **Admin Studio** (separate app, password-protected) - Records, bulk import, Confessions queue, Content Studio, CV generator & placement tracking

## Architecture

**One source, many deploy targets.** You only ever edit a handful of source files; a build script regenerates every artifact.

```
                        edit only these
                       ┌──────────────────────────────┐
                       │  Code.gs       (backend)      │
                       │  src/portal.html (public site) │
                       │  studio.html   (admin studio)  │
                       └──────────────┬───────────────┘
                                      │  node build.js
                       ┌──────────────┴───────────────┐
                       │                              │
                 appscript/                    dist/ + blogger-page.html
            (paste Code.gs + studio.html)   (Cloudflare Pages + Blogger iframe)
```

```
Users -> Cloudflare Pages (dist/) -> fetch(POST/GET) -> Google Apps Script Web App -> Google Sheets + Google Drive (CVs)
```

Live URLs:
- Portal: `https://laghubittakhabar.pages.dev` (Cloudflare Pages)
- Admin Studio: your Apps Script Web App URL (no query string)
- Backup mirror: `https://subashnp169.github.io/laghubitta-khabar-forms/`

## Single-Source Build

1. Edit `Code.gs`, `src/portal.html`, `studio.html` (and `site-config.json` for URLs).
2. Run `node build.js`. It regenerates:
   - `appscript/Code.gs` + `appscript/studio.html` — paste these into Apps Script.
   - `dist/` — Cloudflare Pages output (`index.html`, `logo.webp`, `_headers`).
   - `blogger-page.html` — iframe wrapper to paste into Blogger.
3. Commit + push. GitHub Pages (gh-pages) mirrors the repo root; Cloudflare deploys `dist/`.

> **Important:** after changing `Code.gs`/`studio.html`, re-paste them into Apps Script and re-deploy **the same deployment** (Manage Deployments → edit pencil → Version: New version) so your existing `/exec` URL stays valid.

## Setup

### 1. Google Sheet + Apps Script

1. Create a new Google Sheet named "Laghubitta Khabar Forms"
2. Go to Extensions -> Apps Script
3. Delete default code, paste the contents of `appscript/Code.gs`
4. Deploy -> New deployment -> Web app
   - Execute as: Me
   - Who has access: Anyone
5. Copy the Web App URL (ends in `/exec`) and set it as `scriptUrl` in `site-config.json`, then run `node build.js` so the portal uses it.

### 2. Connect Frontend

1. Open `site-config.json`
2. Set `scriptUrl` to your Web App URL and `portalUrl` to your public portal URL
3. Run `node build.js` — this injects the URL into `dist/index.html`, `blogger-page.html`, and regenerates `appscript/`

### 3. Set Admin Password (Authorization)

1. Open your Google Sheet (the same one linked to the script)
2. A **Setup** menu appears at the top of the Sheet
3. Click **Setup -> Set Admin Password** and enter a password
4. This password unlocks the **Admin Studio** at your Web App URL for viewing stats, records, CSV export, bulk import, and the newer features below

### 4. Add the Admin Studio UI

1. In the Apps Script editor, click **+** next to Files -> HTML
2. Name it exactly `Index`
3. Delete the default content and paste the contents of `appscript/studio.html`
4. Save. Visiting your **Web App URL** (with no query string) now opens the **Admin Studio** — password-protected dashboard with Records, Bulk Import, Settings, Confessions, and Content Studio tabs

> Note: the public portal (`index.html`) no longer contains any admin code. Admin functions live only in the Studio.

### 5. Deploy to Cloudflare Pages (primary)

```
npx wrangler login
npx wrangler pages deploy dist --project-name=laghubittakhabar
```

1. Live at `https://laghubittakhabar.pages.dev`
2. Set `portalUrl` in `site-config.json` to this URL and re-run `node build.js`.

(Optional) connect the GitHub repo in the Cloudflare dashboard so each push rebuilds automatically — build command `node build.js`, output directory `dist`.

### 6. Custom Domain (Cloudflare)

1. In the Cloudflare dashboard: **Workers & Pages -> laghubittakhabar -> Custom domains**
2. Click **Set up a custom domain** and enter your domain (e.g. `forms.laghubittakhabar.com`)
3. If your domain is already on Cloudflare, DNS is added automatically.
4. If it is not on Cloudflare yet: add your domain to Cloudflare first, then repeat step 2 (a `CNAME laghubittakhabar.pages.dev` record is created for you).

### 7. Backup Mirror (GitHub Pages)

1. Push to the GitHub repo
2. Settings -> Pages -> Source: `gh-pages` branch (root `/`)
3. Backup at `https://subashnp169.github.io/laghubitta-khabar-forms/`

### 8. Generate QR Code

```
https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=https://laghubittakhabar.pages.dev/
```

## Google Sheets Structure

The backend creates four sheets automatically. **Google Sheets acts as the database** — it stores every submission for later use and supports bulk import of large member lists (e.g. importing 1.12 lakh members into SENNA in batches).

**JobCareer** (last 3 columns drive the placement lifecycle):
| Timestamp | Full Name | Mobile | Email | Academic Qualification | Experience | Current Status | Home District | Preferred Province | Preferred City | Desired Sector | Help Needed | Notes | Placement Status | Placed Date | Mentor/Referrer |
| | | | | | | | | | | | | | `New`/`In Review`/`CV Sent`/`Interview`/`Placed` | when `Placed` | who referred them |

**ClientHelp:**
| Timestamp | Name | Mobile | Home District | Institution Name | Institution Type | Issue Type | Issue Description | Preferred Contact Time | Contact Method |

**SennaNetwork** (last column is the pay-it-forward flag):
| Timestamp | Full Name | Mobile | Email | Home District | Category | Institution | Profession | Contribution | Reason | Consent | Member Type |
| | | | | | | | | | | | `Member`/`Alumni` |

**Confessions:**
| Timestamp | Category | Confession | Nickname | District | Status | Published |
| | | | | | `Pending`/`Approved`/`Rejected`/`Published` | platform + URL |

**Articles** (created by Content Studio):
| Timestamp | Title | Labels | Status | Source Link | Body HTML | Blogger URL | Facebook URL |
| | | comma-separated tags | `Draft`/`Published` | optional source URL | article HTML | published post URL | published post URL |

## API Endpoints

- `POST` - Submit a form (`form: "job" | "help" | "senna" | "confession"` in the JSON body)
- `GET ?action=login&pass=...` - Admin login, returns a token
- `GET ?action=stats&token=...` - Record counts per form
- `GET ?action=records&form=job&limit=500&token=...` - Latest records as JSON (admin only)
- `GET ?action=export&form=senna&token=...` - Full CSV download (admin only)
- `GET ?action=confessions&status=Pending&token=...` - Confession queue as JSON (admin only)
- `POST` with `{action:"import", form:"senna", token:..., rows:[[...]]}` - Bulk import rows (admin only)
- `POST` with `{action:"setConfession", token, id, status}` - Set queue status (admin only)
- `POST` with `{action:"publishBlogger", token, id, title, body}` - Publish to Blogger (admin only)
- `POST` with `{action:"publishFacebook", token, id, message}` - Post to Facebook page (admin only)

## Bulk Import Format (SENNA Members)

Paste CSV rows in the Admin Dashboard. Column order (header row optional):

```
Full Name, Mobile, Email, Home District, Category, Institution, Profession, Contribution, Reason, Consent
```

Blank `Category` defaults to **Microfinance**. Recommended batch size: 5,000 rows per import.

## Step 2 — Confessions Queue & Publish (how to use)

Flow: public Confession form submits → sheet row with status `Pending` → Studio **Confessions Queue** → review → publish.

1. In the Studio, open **Confessions Queue**. New submissions appear under **Pending**.
2. **Approve** a confession to unlock the publish buttons (Reject hides it from the queue; Restore brings it back).
3. **Publish to Blogger** — edit the auto-generated title/body, then click Publish. The blog post URL is saved back to the sheet.
4. **Publish to Facebook** — edit the pre-filled message, then click Post. The post URL is saved back to the sheet.
5. Once published, the row's Status becomes `Published` and the links column stores where it went.

**Blogger setup (required for Blogger publishing):**
1. Create the blog at blogger.com and note its Blog ID (Settings → Basic → Blog ID, or from the blog URL).
2. Get an access token: open [Google OAuth Playground](https://developers.google.com/oauthplayground/), click the gear (OAuth 2.0 configuration), check "Use your own OAuth credentials" only if you have a Google Cloud client — otherwise use the default playground client and click **Authorize APIs**.
3. In "Select & authorize APIs" enter scope: `https://www.googleapis.com/auth/blogger` → Authorize → Exchange authorization code for tokens.
4. Copy the **Access token** into Studio → Settings → **Blogger Access Token**, and the Blog ID into **Blogger Blog ID**.
5. (Optional, for auto-refresh) also copy the **Refresh token** from the same screen, plus your Google Cloud OAuth **Client ID/Secret** (OAuth consent screen → client type *Web application*, redirect URI `https://developers.google.com/oauthplayground`). Note: the default playground client's refresh token only lasts 7 days; your own client is permanent.

**Facebook setup (required for Facebook publishing):**
1. Get your page ID: open the page → About → find the page ID (or from the page URL `/pages/<Name>/<ID>`).
2. Create a Facebook App (developers.facebook.com → Create App), add the *pages_manage_posts* and *publish_pages* permissions, and generate a **long-lived page access token** (System User or the app's access token exchange — see Facebook's "Long-lived Page Access Token" guide).
3. Paste the Page ID and the token into Studio → Settings.

## Step 3 — Content Studio (Gemini AI articles)

Flow: enter a topic in the Studio → Gemini drafts the article (title + labels + HTML body) → you review/edit → save as a draft → manually publish to Blogger / Facebook.

1. Open the Studio → **Content Studio**.
2. In **Settings**, paste a free Gemini API key into **Gemini API Key** (get it at `https://aistudio.google.com/apikey`). The **Gemini Model** field defaults to `gemini-2.5-flash`.
3. Enter a **Topic** (Nepali or English), choose Language / Type / Length, optionally add keywords, then **Generate Draft** (takes 10–30 s).
4. The draft loads into the **Draft editor**. Edit the title, labels, source link and HTML body, then **Save Draft**.
5. **Publish to Blogger** — opens a modal with editable title/labels/body; the source link is appended to the post. The post URL is saved back to the sheet.
6. **Publish to Facebook** — opens a modal with a text summary; the source link is attached to the post automatically. The post URL is saved back to the sheet.
7. Published articles show a `Published` status and their platform links in the **Article list**.

Requirements: Blogger Blog ID + Blogger Access Token (Step 2) and/or Facebook Page ID + Page Access Token (Step 2) are reused for article publishing. Publishing is always manual — no unattended auto-posting.

## Step 4 — Help the Needy (CV generator + placement + pay-it-forward)

The Studio **Records** tab now has action buttons per row:

- **→ SENNA** (Job / Client Help rows) — push a genuine applicant into the SENNA Network membership sheet (duplicate-guarded by mobile/email).
- **CV** (Job / SENNA rows) — builds a professional CV as a Google Doc in your Drive folder (`Settings → Folder ID`) and opens the shareable link, ready to send to the applicant.
- **Place** (Job rows) — set the placement lifecycle: `New → In Review → CV Sent → Interview → Placed`. When you mark someone **Placed**, the matching SENNA member (by mobile/email) is automatically flagged **Alumni** — the pay-it-forward loop where helped people mentor/donate to the next batch.

Requirements: set a **Folder ID** in Studio → Settings (create a Drive folder and copy its URL ID). The first time you use CV generation, Apps Script will ask for Drive/Docs permissions — run `studioGenCV` from the editor or just use the button once.

## Blogger Embed (optional — "genuine" blogspot home)

`blogger-page.html` is now a **tiny iframe wrapper** (regenerated by `node build.js`) that loads the real portal from Cloudflare — no more duplicated code:

1. Blogger dashboard → **Pages → New Page**
2. In the editor toolbar click the **HTML view** icon
3. Paste the **entire** contents of `blogger-page.html`
4. Title the page **Forms**, then **Publish**
5. Your portal is now live at `https://laghubittakhabar.blogspot.com/p/forms.html` — forms still submit to your Google Sheet via the Apps Script `scriptUrl` in `site-config.json`

Notes:
- The iframe fills the whole page; the logo and all assets load from Cloudflare/GitHub Pages.
- Blogger gives page URLs the `/p/<name>.html` format. A clean `/forms` path needs a custom domain attached to Blogger.
- The blog theme wraps the page (header/sidebar). Pick a minimal theme or hide the header if you want a full-screen look.

## Roadmap (step by step)

- **Step 1 (done):** Forms portal (4 forms) + Google Sheet database + Admin Studio UI
- **Step 2 (done):** Confessions review & publish queue (Blogger + Facebook)
- **Step 3 (done):** Content Studio (Gemini AI article generation + manual publish)
- **Step 4 (done):** Single-source build (`node build.js`), Cloudflare Pages hosting, CV generator, placement tracking + SENNA Alumni flag
- **Step 5:** Full Laghubitta Khabar platform redesign

The Studio's **Settings** tab stores `BLOG_ID`, `BLOGGER_TOKEN` (+ refresh token / client id / client secret), `FB_PAGE_ID`, `FB_TOKEN`, `GEMINI_API_KEY`, `GEMINI_MODEL`, and `FOLDER_ID` in Script Properties, ready for Steps 2-4.

## Project Files

- `Code.gs` — Apps Script backend (form intake, admin auth, REST + Studio routes, CV generation, placement)
- `src/portal.html` — public forms portal source (uses `__SCRIPT_URL__`; built into `index.html`)
- `studio.html` — Admin Studio UI (paste `appscript/studio.html` into Apps Script as an HTML file named `Index`)
- `index.html` — generated public portal (GitHub Pages root; re-run `node build.js` to refresh)
- `build.js` + `site-config.json` + `src/blogger-template.html` — single-source build pipeline
- `appscript/` — generated paste-ready copies (run `node build.js`)
- `dist/` — generated Cloudflare Pages output (run `node build.js`)
- `blogger-page.html` — generated iframe wrapper for Blogger
- `wrangler.toml` — Cloudflare Pages direct-upload config
- `logo.webp` — portal logo
- `README.md` — this file
