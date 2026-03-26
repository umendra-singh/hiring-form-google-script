# Hiring Form — Google Apps Script

A dynamic job application web app built entirely on Google Apps Script with Google Sheets as the database, Google Drive for resume storage, and Google Maps APIs for distance calculation.

## Features

- **Dynamic Form** — Location-dependent position dropdown, auto-populated from a Google Sheet
- **Distance Calculator** — Google Maps Places Autocomplete + Distance Matrix API with manual fallback
- **Resume Upload** — PDF/DOC/DOCX (up to 30 MB), stored in Google Drive with unique filenames
- **Application Tracking** — Auto-generated IDs (`APP-YYYYMMDD-XXXXX`), timestamps in `DD/MM/YYYY hh:mm:ss AM/PM` format
- **Full Hiring Pipeline** — 44-column response sheet with HR, Screener, Hiring Manager, and Final status tracking
- **Two Print Versions** — Applicant copy (personal records) and HR version (full hiring chronology with status badges)
- **Retrieve Application** — Passkey-protected lookup with rate limiting
- **Confirmation Email** — Automated email via AWS SES on submission with full details + resume attached
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

### Responses Tab (44 columns, A–AR)

| Columns | Fields |
|---------|--------|
| A–C     | Application ID, Timestamp (DD/MM/YYYY hh:mm:ss AM/PM), Application Status |
| D–E     | Location, Position |
| F–M     | Personal Info (Name, Age, Gender, Education Level, Education Relevant, City, Address, Distance) |
| N–O     | Contact (Mobile, Email) |
| P–V     | Professional (Experience, Company, Position, Job Changes, Notice, Current CTC, Expected CTC) |
| W       | Resume File Name |
| X–Y     | Referral (Employee Name, Employee ID) — user-submitted, optional |
| Z       | Declaration |
| AA      | Resume Link (HYPERLINK formula) |
| AB–AG   | HR Review (POC Name, Comment, Skill Evaluation, Cost, Reliability, Status) |
| AH–AJ   | Screener Review (Name, Comment, Status) |
| AK–AM   | Hiring Manager Review (Name, Comment, Status) |
| AN–AO   | Final Hiring (Status: Selected/Rejected/Flagged/On Hold, Comment) |
| AP–AR   | Joining (Status, Employee ID, Application Form Link) |

**Data integrity:** Submissions use header-based column lookup (`getColumnMap_()`) — reordering or adding columns won't break existing data.

## Form Sections

1. **Position Details** — Location → Position (conditional dropdown)
2. **Personal Information** — Name, Age, Gender, Education Level, Education Relevant to Applied Field, City, Distance Calculator
3. **Contact Details** — Mobile (+91), Email
4. **Professional Details** — Experience, Company, Position in Current Company, Job Changes in Last 10 Years, Notice Period, CTC
5. **Referral Details** — Employee Name + ID (optional)
6. **Resume / CV** — File upload (PDF/DOC/DOCX, max 30 MB)
7. **Declaration** — Consent checkbox

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

The **Responses** tab is auto-created on first submission, or run `setupResponseSheet()` to create the 44-column header upfront.

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

### 5. Configure AWS SES (Optional — for confirmation emails)

In `initializeSecrets()`, also set:

```javascript
props.setProperty('AWS_ACCESS_KEY_ID', 'your-aws-access-key');
props.setProperty('AWS_SECRET_ACCESS_KEY', 'your-aws-secret-key');
props.setProperty('AWS_REGION', 'us-east-1');  // Your SES region
props.setProperty('SES_SENDER_EMAIL', 'noreply@yourdomain.com');  // Must be verified in SES
```

**Requirements:**
- Verified sender email/domain in AWS SES
- IAM user with `ses:SendRawEmail` permission
- If SES is in sandbox mode, recipient emails must also be verified

If SES is not configured, the form works normally — email is silently skipped.

### 6. Enable Google Cloud APIs

In your Google Cloud Console, enable:

- Maps JavaScript API
- Places API
- Distance Matrix API
- Maps Static API
- Geocoding API

**Restrict your API key:**
- HTTP referrer: your deployed Apps Script URL
- API restrictions: limit to the 5 APIs above

### 7. Deploy

1. Open Apps Script editor
2. Deploy > New deployment > Web app
3. Execute as: **Me**
4. Who has access: **Anyone**

### 8. Test

- Submit a form and verify data appears in the Responses sheet
- Verify resume uploads to the Drive folder
- Test distance calculator (automatic + manual fallback)
- Test Retrieve Application with your passkey
- Test both print versions (applicant + HR with hiring chronology)
- If SES configured: verify confirmation email received with all details + resume attached

## Security

| Mechanism | Details |
|-----------|---------|
| **Passkey** | Stored in Script Properties, never in client code |
| **Maps API Key** | Stored in Script Properties; exposed to client (required for Places API) — restrict in Cloud Console |
| **Resume Token** | One-time UUID via `CacheService` (1-hour TTL) for post-submission resume access without passkey |
| **Rate Limiting** | Max 5 retrieve attempts per minute per session |
| **XSS Protection** | All user/server data HTML-escaped before injection |
| **AWS SES Keys** | Access Key, Secret Key, Region, Sender stored in Script Properties — never in source |
| **Input Masking** | Application ID and passkey fields use `type="password"` |

## Known Limitations

- **Indian addresses**: Google Maps may geocode inaccurately. The form shows resolved addresses for transparency and provides a manual distance override.
- **Shared Drive permissions**: `file.setSharing()` may fail due to org policies. Files are still accessible to Drive members.
- **iframe sandbox**: Standard `<a href>` links don't work in Apps Script. Navigation uses `onclick` with try/catch reload cascades.
- **Concurrent submissions**: Two simultaneous submissions could theoretically get the same Application ID (extremely unlikely; Apps Script serializes execution).

## License

MIT
