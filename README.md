# Laghubitta Khabar — Help, Career & Network Portal

Single-page bilingual (English + Nepali) portal with **3 forms** for the Laghubitta Khabar / SENNA Network initiative:

1. **Job Career Sathi** - Free CV, cover letter & exam preparation help for MFI/bank/cooperative jobs
2. **Client Help Model** - Grievance reporting: harassment, illegal interest, CIB problems
3. **SENNA Network** - Membership registration for the genuine people's network

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

### 3. Deploy to GitHub

1. Push this folder to a GitHub repo
2. Go to Settings -> Pages -> Source: deploy from branch -> `gh-pages` (root `/`)
3. Your portal will be live at `https://<username>.github.io/<repo>/`

### 4. Generate QR Code

```
https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=https://<username>.github.io/<repo>/
```

## Google Sheets Structure

The backend creates three sheets automatically:

**JobCareer:**
| Timestamp | Full Name | Mobile | Email | Academic Qualification | District | Desired Sector | Help Needed | Notes |

**ClientHelp:**
| Timestamp | Name | Mobile | Institution Name | Institution Type | Issue Type | Issue Description | Preferred Contact |

**SennaNetwork:**
| Timestamp | Full Name | Mobile | Email | District | Profession | Contribution | Reason | Consent |

## API Endpoints

- `POST` - Submit a form (`form: "job" | "help" | "senna"` in the JSON body)
- `GET ?action=records&form=job` - Fetch all records for a form as JSON
