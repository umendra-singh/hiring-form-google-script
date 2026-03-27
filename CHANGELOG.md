# Changelog

## [2.1.1] — 2026-03-27

### Bug Fixes
- **Email header branding location marked** — added `Branding location #4` comment at Code.gs line 202 for deployment customization. All text inside the blue header block must use explicit `color:#fff` (email clients do not inherit colors)

### Documentation
- Email branding location (#4) documented in CLAUDE.md

## [2.1.0] — 2026-03-23

### New Feature
- **Automated confirmation email via AWS SES** — on successful submission, candidate receives a professional HTML email with:
  - All submitted details (position, personal, contact, professional, referral, declaration)
  - Uploaded resume attached (PDF/DOC/DOCX)
  - Custom sender name ("Jobs Application Center")
  - AWS SigV4 request signing implemented in pure Apps Script (no SDK)
- **Non-blocking**: email failure never prevents form submission — errors are caught and logged
- **Graceful skip**: if AWS SES credentials are not configured, email is silently skipped

### Security
- AWS credentials (Access Key ID, Secret Access Key, Region, Sender Email) stored securely in Script Properties via `initializeSecrets()`
- Private helper functions (`sendConfirmationEmail_()`, `signAwsRequest_()`, etc.) not exposed to client

### Bug Fixes
- **Resume link missing for recent submissions** — added `SpreadsheetApp.flush()` after all sheet writes and before email send. Sheet `setValue()`/`setFormula()` calls are batched by Apps Script; the slow email operation (base64 encode + SES HTTP request) could cause timeout, losing unflushed writes including the HYPERLINK formula for Resume Link
- **Added `repairMissingResumeLinks()` utility** — one-time repair function that scans for rows where Resume File Name exists but Resume Link is blank, finds the matching file in Drive, and writes the HYPERLINK formula. Safe to run multiple times
- **Email subject uses ASCII only** — replaced Unicode em dash (`\u2014`) with plain dash to comply with MIME 7-bit header requirement
- **Email rupee symbol (₹) escaped correctly** — `&#8377;` placed outside `e()` escape function in CTC rows to prevent double-escaping (same pattern as print functions)

### Documentation
- Updated CLAUDE.md: added AWS SES config section, email flow description, security notes, gotchas #13-16
- Updated README.md: added confirmation email feature, AWS SES setup instructions (Step 5), security table entry
- Updated CHANGELOG.md: v2.1.0 release entry

## [2.0.2] — 2026-03-20

### Improvements
- **All brand, person, and account references removed** from source code and documentation — fully generic public release
- **DOCUMENTATION.html** added — self-contained, professional, printable HTML version of enterprise technical documentation with styled tables, code blocks, status badges, and print-optimized CSS
- Branding section (Section 8) rewritten with generic "Your Company Name" placeholders for custom deployment

### Documentation
- Updated DOCUMENTATION.md: removed all company-specific branding references, anonymized repository info
- Updated DOCUMENTATION.html: matching cleanup, commit hash references removed
- Updated CLAUDE.md: removed branding-specific references
- Added DOCUMENTATION.html to .gitignore (local documentation, not committed)

## [2.0.1] — 2026-03-20

### Bug Fixes
- **Timestamp format standardized** to `DD/MM/YYYY hh:mm:ss AM/PM` everywhere — Google Sheet, Applicant Print, HR Print, and success screen. Previously used locale-dependent `toLocaleString()` on client and raw `Date` object on server
- **Rupee symbol (₹) rendering fixed** in HR Print — `&#8377;` was being double-escaped by `escHtml()`, displaying as literal `&#8377;` text instead of the ₹ symbol. Fixed by placing the HTML entity outside the escape function
- **Status badges overlapping names fixed** in HR Print — replaced `margin-top:-20px` negative-margin hack with inline `fldBadge()` helper across all hiring chronology sections (HR, Screener, Hiring Manager, Joining Status)
- **Joining Application Form Link now renders as a clickable link** in HR Print — was previously passed through `fld()` which escaped the URL as plain text
- **All URL fields render as clickable links** in HR Print — new `fldLink()` helper auto-detects URLs and renders them as styled `<a>` tags with ↗ icon; applies to Resume Link and Joining Application Form Link

### Improvements
- Added `fldBadge()` helper — renders field with color-coded status badge inline
- Added `fldLink()` helper — renders field value as clickable link if URL, plain text otherwise (truncates long URLs at 55 chars)

### Documentation
- Updated CLAUDE.md: Form.html line count (~872), timestamp format note, rupee symbol gotcha
- Updated README.md: timestamp format in feature list and sheet layout table

## [2.0.0] — 2026-03-20

### Breaking Changes
- Google Sheet expanded from 27 to 44 columns with new column order
- Sheet writes now use header-based column lookup (`getColumnMap_()`) — safe for existing sheets but new columns must be added manually to pre-existing sheets
- Form and print headers updated to "Jobs Application Center"

### New Form Fields
- **Education Relevant to Applied Field** (mandatory) — text input in Personal Information
- **Position in Current Company** (mandatory) — text input in Professional Details
- **Number of Job Changes in Last 10 Years** (mandatory) — number input in Professional Details
- **Referral Employee Name** (optional) — moved from backend-only to user-facing form
- **Referral Employee ID** (optional) — moved from backend-only to user-facing form

### New Sheet Columns (managed internally by HR)
- HR POC Name, HR Comment, Skill Evaluation (1–10), Cost (INR), Reliability
- HR Status (Selected/Rejected/Flagged/On Hold)
- Screener Name, Screener Comment, Screener Status
- Hiring Manager Name, Hiring Manager Comment, Hiring Manager Status
- Final Hiring Status (Selected/Rejected/Flagged/On Hold), Final Hiring Comment
- Final Joining Status (Joined/Offer Rejected/On Hold)
- Employee ID, Joining Application Form Link
- Application Status expanded: New / In-Progress / Offer Released / Offer Rejected / Joined as Employee / Flagged / Rejected / On Hold

### Print Versions — Complete Redesign
- **Applicant Print**: Professional ATS-style layout, all submitted data including referral details, declaration & resume section, map
- **HR Print**: Full hiring chronology with actual data from sheet — HR Review, Screener Review, Hiring Manager Review, Final Hiring Decision, Joining Status — all with color-coded status badges and Date/Signature lines
- Both print versions use double-border headers, grid layouts, and professional typography

### Improvements
- `submitApplication()` uses header-based column lookup via `getColumnMap_()` — adding/reordering columns in the sheet won't break submissions
- `getResumeLink_()` finds Resume Link column by header name instead of hardcoded column index
- Added `setupResponseSheet()` utility function to create the 44-column Responses tab
- Form sections renumbered (1–7) to accommodate new Referral Details section

## [1.0.1] — 2026-03-20

### Security
- Removed exposed passkey from project documentation (CLAUDE.md)

### Improvements
- Polished distance calculator UI: pin icon, descriptive label ("Your Current Address to Job Location"), help text explaining the purpose, send-arrow icon on Calculate button
- Upgraded distance result and manual fallback styling (softer borders, rounded cards, white backgrounds)

### Documentation
- Added MIT LICENSE file
- Updated CLAUDE.md line count and removed passkey reference

## [1.0.0] — 2026-03-20

First public release.

### Features
- Dynamic job application form with location-dependent position dropdown
- Google Maps distance calculator with Places Autocomplete and manual fallback
- Resume upload to Google Drive (PDF/DOC/DOCX, max 30 MB)
- Auto-generated Application IDs (`APP-YYYYMMDD-XXXXX`)
- Two print versions: user-facing (personal records) and HR (with map + review sections)
- Passkey-protected application retrieval with rate limiting
- One-time resume access tokens (no passkey required post-submission)

### Security
- Secrets stored in Google Apps Script Properties (not in source code)
- XSS protection via HTML escaping on all user/server data injection points
- Rate limiting on retrieve endpoint (5 attempts/minute/session)
- Hardcoded passkey placeholder removed from source code

### Bug Fixes (pre-release)
- Fixed XSS vulnerabilities in print functions and innerHTML assignments
- Added request deduplication for position dropdown (prevents stale response race condition)
- Added request deduplication for distance calculation (prevents wrong distance on rapid location change)
- Improved file upload validation message when FileReader is still processing
- Added `encodeURIComponent` to Maps API key in Static Maps URL
