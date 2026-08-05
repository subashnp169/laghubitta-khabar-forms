# Laghubitta Khabar — Help, Career & Network Portal

Single-page bilingual (English + Nepali) portal with **3 forms** for the Laghubitta Khabar / SENNA Network initiative:

1. **Job Career Sathi** - Free CV, cover letter & exam preparation help for MFI/bank/cooperative jobs
2. **Client Help Model** - Grievance reporting: harassment, illegal interest, CIB problems
3. **SENNA Network** - Membership registration for the genuine people's network
4. **Confession** - Anonymous sharing of experiences (no identity required)
5. **Admin Dashboard** - Password-protected stats, records viewer, CSV export & bulk SENNA member import

## Architecture

```
QR code -> GitHub Pages (index.html) -> fetch(POST) -> Google Apps Script Web App -> Google Sheets
```

## Setup

### 1. Google Sheet + Apps Script

1. Create a new Google Sheet named "Laghubitta Khabar Forms"
2. Go to Extensions -> Apps Script
3. Delete default code, paste the contents of `Code.gs`
4. Deploy -> New deployment -> Web app
   - Execute as: Me
   - Who has access: Anyone
5. Copy the Web App URL (ends in `/exec`)

### 2. Connect Frontend

1. Open `index.html`
2. Find `var SCRIPT_URL = "PASTE_YOUR_GOOGLE_APPS_SCRIPT_WEB_APP_URL_HERE";`
3. Replace with your Web App URL

### 3. Set Admin Password (Authorization)

1. Open your Google Sheet (the same one linked to the script)
2. A **Setup** menu appears at the top of the Sheet
3. Click **Setup -> Set Admin Password** and enter a password
4. This password unlocks the **Admin Dashboard** (login link in the homepage footer) for viewing stats, records, CSV export, and bulk import

### 4. Deploy to GitHub

1. Push this folder to a GitHub repo
2. Go to Settings -> Pages -> Source: deploy from branch -> `gh-pages` (root `/`)
3. Your portal will be live at `https://<username>.github.io/<repo>/`

### 4. Generate QR Code

```
https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=https://<username>.github.io/<repo>/
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
