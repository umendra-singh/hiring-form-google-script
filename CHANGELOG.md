# Changelog

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
- Final Hiring Status, Final Hiring Comment
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
