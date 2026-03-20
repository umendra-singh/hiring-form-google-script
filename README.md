# Hiring Form — Google Apps Script

A dynamic job application web app built entirely on Google Apps Script with Google Sheets as the database, Google Drive for resume storage, and Google Maps APIs for distance calculation.

## Features

- **Dynamic Form** — Location-dependent position dropdown, auto-populated from a Google Sheet
- **Distance Calculator** — Google Maps Places Autocomplete + Distance Matrix API with manual fallback
- **Resume Upload** — PDF/DOC/DOCX (up to 30 MB), stored in Google Drive with unique filenames
- **Application Tracking** — Auto-generated IDs (`APP-YYYYMMDD-XXXXX`), timestamped submissions
- **Two Print Versions** — User-facing (personal records) and HR version (with map + 4 review sections)
- **Retrieve Application** — Passkey-protected lookup with rate limiting
- **Security** — Secrets in Script Properties, one-time resume tokens, XSS-safe HTML escaping, rate limiting

## Architecture

```
src/
  Code.gs         Server-side Apps Script (business logic, data, security)
  Form.html       Complete SPA (form, success screen, retrieve, print)
  Success.html    Fallback success page (for direct URL access)
```

**No frameworks** — vanilla JavaScript running inside the Apps Script iframe sandbox.

## Google Sheet Layout

### JobData Tab

| Column | Field          |
|--------|----------------|
| A      | Location       |
| B      | Position       |
| C      | Office Address |

### Responses Tab (27 columns, A-AA)

| Columns | Fields |
|---------|--------|
| A-B     | Application ID, Status |
| C       | Timestamp |
| D-E     | Location, Position |
| F-L     | Personal Info (Name, Age, Gender, Education, City, Address, Distance) |
| M-N     | Contact (Mobile, Email) |
| O-S     | Professional (Experience, Company, Notice, Current CTC, Expected CTC) |
| T-U     | Resume (Filename, Link) |
| V       | Declaration |
| W-AA    | Backend only: POC, Referral, Comment (filled by HR in Sheet) |

## Setup

### Prerequisites

- Google account with access to Google Apps Script
- Google Cloud project with billing enabled (for Maps APIs)

### 1. Create the Google Sheet

Create a Google Sheet (Shared Drive OK) with a **JobData** tab:

| Location  | Position             | Office Address                                    |
|-----------|----------------------|---------------------------------------------------|
| Bangalore | Full Stack Developer | Outer Ring Road, Marathahalli, Bangalore 560037   |
| Mumbai    | Business Analyst     | Bandra Kurla Complex, Mumbai 400051               |

The **Responses** tab is auto-created on first submission.

### 2. Create the Resume Folder

Create a folder in Google Drive (or Shared Drive) for resume storage. Copy its folder ID from the URL.

### 3. Configure the Script

In `Code.gs`, set:

```javascript
CONFIG.SPREADSHEET_ID = 'your-sheet-id';
CONFIG.RESUME_FOLDER_ID = 'your-folder-id';
```

### 4. Store Secrets

Edit `initializeSecrets()` in `Code.gs` — replace `CHANGE_ME` with your actual passkey and add your Maps API key:

```javascript
props.setProperty('PASSKEY', 'your-secure-passkey');
props.setProperty('MAPS_API_KEY', 'your-google-maps-api-key');
```

Run `initializeSecrets()` once in the Apps Script editor, then **clear the values from the source code** and save.

### 5. Enable Google Cloud APIs

In your Google Cloud Console, enable:

- Maps JavaScript API
- Places API
- Distance Matrix API
- Maps Static API
- Geocoding API

**Restrict your API key:**
- HTTP referrer: your deployed Apps Script URL
- API restrictions: limit to the 5 APIs above

### 6. Deploy

1. Open Apps Script editor
2. Deploy > New deployment > Web app
3. Execute as: **Me**
4. Who has access: **Anyone**

### 7. Test

- Submit a form and verify data appears in the Responses sheet
- Verify resume uploads to the Drive folder
- Test distance calculator (automatic + manual fallback)
- Test Retrieve Application with your passkey
- Test both print versions (user-facing + HR)

## Security

| Mechanism | Details |
|-----------|---------|
| **Passkey** | Stored in Script Properties, never in client code |
| **Maps API Key** | Stored in Script Properties; exposed to client (required for Places API) — restrict in Cloud Console |
| **Resume Token** | One-time UUID via `CacheService` (1-hour TTL) for post-submission resume access without passkey |
| **Rate Limiting** | Max 5 retrieve attempts per minute per session |
| **XSS Protection** | All user/server data HTML-escaped before injection |
| **Input Masking** | Application ID and passkey fields use `type="password"` |

## Known Limitations

- **Indian addresses**: Google Maps may geocode inaccurately. The form shows resolved addresses for transparency and provides a manual distance override.
- **Shared Drive permissions**: `file.setSharing()` may fail due to org policies. Files are still accessible to Drive members.
- **iframe sandbox**: Standard `<a href>` links don't work in Apps Script. Navigation uses `onclick` with try/catch reload cascades.
- **Concurrent submissions**: Two simultaneous submissions could theoretically get the same Application ID (extremely unlikely; Apps Script serializes execution).

## License

MIT
