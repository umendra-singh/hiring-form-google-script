# Hiring Form — Project Guide

## What This Is
A Google Apps Script web app — a dynamic job application form with Google Sheets as the database, Google Drive for resume storage, and Google Maps APIs for distance calculation.

## Files
```
src/
  Code.gs         → Server-side Apps Script (all business logic)
  Form.html       → Main form UI (complete SPA, ~650 lines)
  Success.html    → Fallback success page (rarely used)
PROJECT_LEARNINGS.txt → Detailed learnings from the entire build
```

## Tech Stack
- Google Apps Script (HtmlService web app)
- Google Sheets (Shared Drive) as database
- Google Drive (Shared Drive) for resume file storage
- Google Maps APIs (Distance Matrix, Places, Static Maps, Geocoding)
- Vanilla JS (no frameworks) — runs inside Apps Script iframe sandbox

## Config (Code.gs)
```javascript
CONFIG.SPREADSHEET_ID   → Google Sheet ID (REQUIRED)
CONFIG.RESUME_FOLDER_ID → Drive folder ID for resumes (REQUIRED)
CONFIG.GOOGLE_MAPS_API_KEY → Leave blank (stored in Script Properties)
CONFIG.PASSKEY             → Leave blank (stored in Script Properties)
```
Secrets are in Script Properties via `initializeSecrets()`. CONFIG fields are fallbacks.

## Branding
- Primary color: `#222595`
- Header: "Jobs Application Center"
- All center-aligned

## Google Sheet Layout

### JobData Tab (3 columns)
Location | Position | Office Address

### Responses Tab (44 columns A–AR)
Data is written by **header-based column lookup** (`getColumnMap_()`) so column order changes won't break existing data.

```
A:  Application ID (APP-YYYYMMDD-XXXXX)
B:  Timestamp
C:  Application Status (default "New")
    ↳ Dropdown: New / In-Progress / Offer Released / Offer Rejected /
      Joined as Employee / Flagged / Rejected / On Hold
D:  Location
E:  Position
F:  Full Name
G:  Age (in years)
H:  Gender
I:  Highest Education Level
J:  Education Relevant to Applied Field
K:  Current City
L:  Address
M:  Distance from Job Location (in KM)
N:  Mobile Number (with +91 prefix)
O:  Email ID
P:  Work Experience in Years (relevant to position)
Q:  Current Company
R:  Position in Current Company
S:  Number of Job Changes in Last 10 Years
T:  Notice Period (in days)
U:  Current CTC (in lakhs)
V:  Expected CTC (in lakhs)
W:  Resume File Name
X:  Referral Employee Name        ← user-submitted (optional)
Y:  Referral Employee ID          ← user-submitted (optional)
Z:  Declaration
AA: Resume Link (HYPERLINK formula)
--- Below: managed internally at sheet level by HR ---
AB: HR POC Name
AC: HR Comment
AD: Skill Evaluation (1–10 dropdown)
AE: Cost (INR)
AF: Reliability (Low / Medium / High / Excellent)
AG: HR Status (Selected / Rejected / Flagged / On Hold)
AH: Screener Name
AI: Screener Comment
AJ: Screener Status (Selected / Rejected / Flagged / On Hold)
AK: Hiring Manager Name
AL: Hiring Manager Comment
AM: Hiring Manager Status (Selected / Rejected / Flagged / On Hold)
AN: Final Hiring Status (Selected / Rejected / Flagged / On Hold)
AO: Final Hiring Comment
AP: Final Joining Status (Joined / Offer Rejected / On Hold)
AQ: Employee ID
AR: Joining Application Form Link
```

## Form Sections (user-facing)
1. Position Details (Location → Position conditional dropdown)
2. Personal Information (Name, Age, Gender, Education Level, Education Relevant, City, Distance Calculator)
3. Contact Details (Mobile with +91, Email)
4. Professional Details (Experience, Company, Position in Current Company, Job Changes, Notice, CTC)
5. Referral Details (Employee Name + ID — **optional**)
6. Resume Upload (PDF/DOC/DOCX, max 30MB)
7. Declaration checkbox

## Distance Calculator — Critical Architecture
State machine: `IDLE → LOADING → SUCCESS / MANUAL / ERROR`

Key decisions:
- Calculate button enabled when address has text (no location dependency for button state)
- Location check happens inside `calcDist()` with a friendly alert
- Suggestions use `mousedown` (not `click`) to prevent race condition with dropdown hide
- 15-second failsafe timeout → shows manual fallback with Job Location address
- Manual fallback always shows the office address for the selected location
- After success: shows resolved addresses (what Google interpreted) + "Distance seems wrong?" manual override link
- `cleanupDistTimers()` called on EVERY state transition — no orphan timers

## Security
- Passkey stored in Script Properties, NOT in source code
- Maps API key stored in Script Properties
- One-time resume token (UUID via `Utilities.getUuid()`) in CacheService (1 hour TTL) — allows resume access post-submission without exposing passkey
- Rate limiting: max 5 retrieve attempts per minute per session
- Application ID input is `type="password"` (masked)
- Retrieved ID displayed masked: `APP-****-***01`

## Two Print Versions

### Applicant Version (from success screen → `printUserApp()`)
- Header: Jobs Application Center / Application ID / Timestamp
- All submitted data including referral details
- Declaration & Resume section
- Footer: "for your personal records"
- NO hiring chronology

### HR Version (from Retrieve Application → `printApp()` → `openPrintWindow()`)
- Header: + Application Status badge
- Full data including Referral (from sheet — always latest)
- Google Maps Static API image (two pins)
- **Hiring Chronology** with actual data from sheet:
  1. HR Review (POC, Comment, Skill Eval, Cost, Reliability, Status + Date/Signature)
  2. Screener Review (Name, Comment, Status + Date/Signature)
  3. Hiring Manager Review (Name, Comment, Status + Date/Signature)
  4. Final Hiring Decision (Status, Comment + Date/Signature with Designation)
  5. Joining Status (Final Joining Status, Employee ID, Joining Form Link)
- Status badges: color-coded (green=selected/joined, red=rejected, yellow=on hold, orange=flagged)

## Success Screen Layout
```
[Copy ID] [Print Application] [Print Resume] [Back to Home]  ← one row
                [Submit Another Application]                   ← below, separate
```

## Retrieve Application
- Hidden by default — shown via "Retrieve Application" hyperlink at bottom
- Application ID + Passkey fields (both `type="password"`)
- On success: masked ID + Print Application + Print Resume buttons

## Known Gotchas
1. **iframe sandbox**: `<a href>` links don't work. Use `onclick` with `window.top.location.reload()` try/catch cascade
2. **HYPERLINK formulas**: `getValues()` returns display text, not URL. Must also read `getFormulas()` and extract URL via regex
3. **Indian addresses**: Google Maps geocodes inaccurately. Show resolved addresses for transparency + manual override
4. **Shared Drive**: `file.setSharing()` may fail — wrap in try/catch. Files still accessible to drive members
5. **Autocomplete**: Must use `AutocompleteService` (programmatic), NOT `google.maps.places.Autocomplete` (which hijacks the input field)
6. **Static Maps for print**: JavaScript maps don't render in `window.open()` → use Static Maps API `<img>` tag
7. **Maps API key on client**: Necessary for Places Autocomplete. Restrict in Google Cloud Console (HTTP referrer + API restrictions)
8. **Header-based column lookup**: `submitApplication()` writes by header name via `getColumnMap_()`. Adding/reordering columns in the sheet won't break existing data.

## Required Google Cloud APIs
- Maps JavaScript API
- Places API
- Distance Matrix API
- Maps Static API
- Geocoding API

## Deployment
1. Fill `SPREADSHEET_ID` and `RESUME_FOLDER_ID` in Code.gs
2. Run `initializeSecrets()` once (sets passkey + Maps key in Script Properties)
3. Optionally run `setupResponseSheet()` to create the 44-column Responses tab
4. Deploy → Web app → Execute as: Me → Access: Anyone
5. Enable all 5 Maps APIs in Google Cloud Console
6. Restrict API key (HTTP referrer + API restrictions)
