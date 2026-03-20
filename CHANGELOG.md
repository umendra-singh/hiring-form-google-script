# Changelog

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
