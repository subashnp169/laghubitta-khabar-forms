# Laghubitta Khabar — Help, Career & Network Portal

Single-page bilingual (English + Nepali) portal with **3 forms** for the Laghubitta Khabar / SENNA Network initiative:

1. **Job Career Sathi** - Free CV, cover letter & exam preparation help for MFI/bank/cooperative jobs
2. **Client Help Model** - Grievance reporting: harassment, illegal interest, CIB problems
3. **SENNA Network** - Membership registration for the genuine people's network
4. **Confession** - Anonymous sharing of experiences (no identity required)
5. **Admin Dashboard** - Password-protected stats, records viewer, CSV export & bulk SENNA member import

## Architecture

```
QR code -> Cloudflare Pages (index.html) -> fetch(POST) -> Google Apps Script Web App -> Google Sheets
```

Live URLs:
- Portal: `https://laghubitta-khabar-forms.pages.dev`
- Admin Studio: your Apps Script Web App URL (no query string)
- Backup mirror: `https://subashnp169.github.io/laghubitta-khabar-forms/`

## Setup

### 1. Google Sheet + Apps Script

1. Create a new Google Sheet named "Laghubitta Khabar Forms"
2. Go to Extensions -> Apps Script
3. Delete default code, paste the contents of `Code.gs`
4. Deploy -> New deployment -> Web app
   - Execute as: Me
   - Who has access: Anyone
5. Copy the Web App URL (ends in `/exec`) and set it as `SCRIPT_URL` in `index.html`

### 2. Connect Frontend

1. Open `index.html`
2. Find `var SCRIPT_URL = "...";`
3. Replace with your Web App URL (already done for the current deployment)

### 3. Set Admin Password (Authorization)

1. Open your Google Sheet (the same one linked to the script)
2. A **Setup** menu appears at the top of the Sheet
3. Click **Setup -> Set Admin Password** and enter a password
4. This password unlocks the **Admin Dashboard** (login link in the homepage footer) for viewing stats, records, CSV export, and bulk import

### 4. Add the Admin Studio UI

1. In the Apps Script editor, click **+** next to Files -> HTML
2. Name it exactly `Index`
3. Delete the default content and paste the contents of `studio.html`
4. Save. Visiting your **Web App URL** (with no query string) now opens the **Admin Studio** — password-protected dashboard with Records, Bulk Import, and Settings tabs

### 4. Deploy to Cloudflare Pages (primary)

1. Put `index.html` + `logo.webp` in a folder (e.g. `cloudflare-dist`)
2. Deploy with wrangler (already authenticated):
   ```
   npx wrangler pages deploy cloudflare-dist --project-name=laghubitta-khabar-forms
   ```
3. Live at `https://laghubitta-khabar-forms.pages.dev`

### 5. Custom Domain (Cloudflare)

1. In the Cloudflare dashboard: **Workers & Pages -> laghubitta-khabar-forms -> Custom domains**
2. Click **Set up a custom domain** and enter your domain (e.g. `forms.laghubittakhabar.com`)
3. If your domain is already on Cloudflare, DNS is added automatically.
4. If it is not on Cloudflare yet: add your domain to Cloudflare first, then repeat step 2 (a `CNAME laghubitta-khabar-forms.pages.dev` record is created for you).

### 6. Backup Mirror (GitHub Pages)

1. Push to the GitHub repo
2. Settings -> Pages -> Source: `gh-pages` branch (root `/`)
3. Backup at `https://subashnp169.github.io/laghubitta-khabar-forms/`

### 7. Generate QR Code

```
https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=https://laghubitta-khabar-forms.pages.dev/
```

## Google Sheets Structure

The backend creates four sheets automatically. **Google Sheets acts as the database** — it stores every submission for later use and supports bulk import of large member lists (e.g. importing 1.12 lakh members into SENNA in batches).

**JobCareer:**
| Timestamp | Full Name | Mobile | Email | Academic Qualification | Experience | Current Status | Home District | Preferred Province | Preferred City | Desired Sector | Help Needed | Notes |

**ClientHelp:**
| Timestamp | Name | Mobile | Home District | Institution Name | Institution Type | Issue Type | Issue Description | Preferred Contact Time | Contact Method |

**SennaNetwork:**
| Timestamp | Full Name | Mobile | Email | Home District | Category | Institution | Profession | Contribution | Reason | Consent |

**Confessions:**
| Timestamp | Category | Confession | Nickname | District |

## API Endpoints

- `POST` - Submit a form (`form: "job" | "help" | "senna" | "confession"` in the JSON body)
- `GET ?action=login&pass=...` - Admin login, returns a token
- `GET ?action=stats&token=...` - Record counts per form
- `GET ?action=records&form=job&limit=500&token=...` - Latest records as JSON (admin only)
- `GET ?action=export&form=senna&token=...` - Full CSV download (admin only)
- `POST` with `{action:"import", form:"senna", token:..., rows:[[...]]}` - Bulk import rows (admin only)

## Bulk Import Format (SENNA Members)

Paste CSV rows in the Admin Dashboard. Column order (header row optional):

```
Full Name, Mobile, Email, Home District, Category, Institution, Profession, Contribution, Reason, Consent
```

Blank `Category` defaults to **Microfinance**. Recommended batch size: 5,000 rows per import.

## Roadmap (step by step)

- **Step 1 (done):** Forms portal (4 forms) + Google Sheet database + Admin Studio UI
- **Step 2:** Confessions review & publish queue (Blogger + Facebook) + staff field reports
- **Step 3:** Content Studio (Gemini AI article generation + manual publish)
- **Step 4:** Full Laghubitta Khabar platform redesign

The Studio's **Settings** tab already stores `BLOG_ID`, `FB_PAGE_ID`, `FB_TOKEN`, `GEMINI_API_KEY`, and `FOLDER_ID` in Script Properties, ready for Steps 2-3.

## Project Files

- `Code.gs` — Apps Script backend (form intake, admin auth, REST + Studio routes)
- `studio.html` — Admin Studio UI (paste into Apps Script as an HTML file named `Index`)
- `index.html` — public forms portal on GitHub Pages
- `logo.webp` — portal logo
- `README.md` — this file
