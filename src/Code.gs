// ============================================================
// DYNAMIC HIRING FORM — Google Apps Script (SECURED)
// ============================================================
// SECURITY:
//   - Passkey stored in Script Properties (not source code)
//   - Maps API key stored in Script Properties (not source code)
//   - Rate limiting on retrieve (max 5 attempts per minute per session)
//   - Separate resume retrieval for fresh submissions (no passkey)
//
// FIRST-TIME SETUP: Run initializeSecrets() once to set up keys.
// ============================================================

const CONFIG = {
  SPREADSHEET_ID: '',                // <-- Sheet ID (Shared Drive OK)
  DATA_SHEET_NAME: 'JobData',
  RESPONSES_SHEET_NAME: 'Responses',
  RESUME_FOLDER_ID: '',              // <-- REQUIRED for Shared Drive
  MAX_FILE_SIZE_MB: 30,
  ALLOWED_EXTENSIONS: ['pdf', 'doc', 'docx'],
  GOOGLE_MAPS_API_KEY: '',           // <-- Fallback: paste key here if not using Script Properties
  PASSKEY: ''                        // <-- Fallback: paste passkey here if not using Script Properties
};

// ──────────────────────────────────────────────────
// SECRET MANAGEMENT — Keys stored in Script Properties
// ──────────────────────────────────────────────────

/**
 * RUN THIS ONCE to store your secrets securely.
 * After running, your keys are in Script Properties (not visible in code).
 * Then clear the values below and redeploy.
 */
function initializeSecrets() {
  var props = PropertiesService.getScriptProperties();

  // Set your passkey here, run this function, then CLEAR this line
  props.setProperty('PASSKEY', 'CHANGE_ME');  // <-- Replace with your actual passkey before running

  // Set your Maps API key here, run this function, then CLEAR this line
  props.setProperty('MAPS_API_KEY', '');  // <-- paste your key, run, then clear

  Logger.log('Secrets stored successfully in Script Properties.');
  Logger.log('IMPORTANT: Now clear the values in initializeSecrets() and redeploy.');
  Logger.log('Your secrets are safely stored and accessible via getPasskey_() and getMapsKey_().');
}

function getPasskey_() {
  var fromProps = PropertiesService.getScriptProperties().getProperty('PASSKEY');
  if (fromProps) return fromProps;
  // Fallback to CONFIG if initializeSecrets hasn't been run yet
  return CONFIG.PASSKEY || '';
}

function getMapsKey_() {
  var fromProps = PropertiesService.getScriptProperties().getProperty('MAPS_API_KEY');
  if (fromProps) return fromProps;
  // Fallback to CONFIG if initializeSecrets hasn't been run yet
  return CONFIG.MAPS_API_KEY || '';
}

// ──────────────────────────────────────────────────
// WEB APP ENTRY
// ──────────────────────────────────────────────────

function doGet(e) {
  var page = (e && e.parameter) ? e.parameter.page : null;
  if (page === 'success') {
    var t = HtmlService.createTemplateFromFile('Success');
    t.applicationId = e.parameter.appId || '';
    return t.evaluate().setTitle('Application Submitted').setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }
  return HtmlService.createHtmlOutputFromFile('Form').setTitle('Job Application Form').setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// ──────────────────────────────────────────────────
// DATA FUNCTIONS
// ──────────────────────────────────────────────────

function getLocations() {
  var ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  var sh = ss.getSheetByName(CONFIG.DATA_SHEET_NAME);
  if (!sh) throw new Error('Sheet "' + CONFIG.DATA_SHEET_NAME + '" not found.');
  var lr = sh.getLastRow(); if (lr < 2) return [];
  var d = sh.getRange(2, 1, lr - 1, 1).getValues();
  var l = [...new Set(d.map(function(r){return r[0].toString().trim();}).filter(function(v){return v;}))];
  l.sort(); return l;
}

function getPositionsByLocation(location) {
  var ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  var sh = ss.getSheetByName(CONFIG.DATA_SHEET_NAME);
  if (!sh) throw new Error('Sheet not found.');
  var lr = sh.getLastRow(); if (lr < 2) return [];
  var d = sh.getRange(2, 1, lr - 1, 2).getValues();
  var p = d.filter(function(r){return r[0].toString().trim().toLowerCase()===location.toLowerCase();})
           .map(function(r){return r[1].toString().trim();}).filter(function(v){return v;});
  return [...new Set(p)].sort();
}

function getOfficeAddress(location) {
  var ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  var sh = ss.getSheetByName(CONFIG.DATA_SHEET_NAME);
  if (!sh) return '';
  var lr = sh.getLastRow(); if (lr < 2) return '';
  var d = sh.getRange(2, 1, lr - 1, 3).getValues();
  for (var i = 0; i < d.length; i++) {
    if (d[i][0].toString().trim().toLowerCase() === location.toLowerCase()) {
      var a = d[i][2] ? d[i][2].toString().trim() : ''; if (a) return a;
    }
  }
  return '';
}

function getOfficeAddressForLocation(location) {
  var addr = getOfficeAddress(location);
  return { location: location, officeAddress: addr || 'Not configured for this location' };
}

function getUploadConfig() {
  var key = getMapsKey_();
  var hasKey = key && key.length > 5;
  return { maxSizeMB: CONFIG.MAX_FILE_SIZE_MB, allowedExtensions: CONFIG.ALLOWED_EXTENSIONS, hasMapsKey: hasKey };
}

/**
 * Returns Maps API key for client-side use (Places Autocomplete, Static Maps).
 * IMPORTANT: Restrict this key in Google Cloud Console:
 *   - HTTP referrer: your deployed Apps Script URL
 *   - API restrictions: Maps JavaScript API, Places API, Static Maps API only
 */
function getMapsApiKey() {
  return getMapsKey_() || '';
}

// ──────────────────────────────────────────────────
// DISTANCE CALCULATION
// ──────────────────────────────────────────────────

function calculateDistance(applicantAddress, officeLocation) {
  var apiKey = getMapsKey_();
  if (!apiKey) return { distanceKm: -1, distanceText: 'Maps API not configured', durationText: '', officeAddress: '', resolvedOrigin: '', resolvedDestination: '' };
  var officeAddress = getOfficeAddress(officeLocation);
  if (!officeAddress) return { distanceKm: -1, distanceText: 'Office address not set for ' + officeLocation, durationText: '', officeAddress: '', resolvedOrigin: '', resolvedDestination: '' };
  try {
    var url = 'https://maps.googleapis.com/maps/api/distancematrix/json?origins=' + encodeURIComponent(applicantAddress) + '&destinations=' + encodeURIComponent(officeAddress) + '&mode=driving&units=metric&key=' + apiKey;
    var resp = UrlFetchApp.fetch(url, {muteHttpExceptions: true});
    var json = JSON.parse(resp.getContentText());

    // Extract resolved addresses (what Google actually interpreted)
    var resolvedOrigin = (json.origin_addresses && json.origin_addresses[0]) ? json.origin_addresses[0] : applicantAddress;
    var resolvedDestination = (json.destination_addresses && json.destination_addresses[0]) ? json.destination_addresses[0] : officeAddress;

    if (json.status !== 'OK' || !json.rows || !json.rows[0] || !json.rows[0].elements || !json.rows[0].elements[0])
      return { distanceKm: -1, distanceText: 'Could not calculate', durationText: '', officeAddress: officeAddress, resolvedOrigin: resolvedOrigin, resolvedDestination: resolvedDestination };
    var el = json.rows[0].elements[0];
    if (el.status !== 'OK') return { distanceKm: -1, distanceText: 'Route not found', durationText: '', officeAddress: officeAddress, resolvedOrigin: resolvedOrigin, resolvedDestination: resolvedDestination };
    return {
      distanceKm: Math.round(el.distance.value / 1000),
      distanceText: el.distance.text,
      durationText: el.duration.text,
      officeAddress: officeAddress,
      resolvedOrigin: resolvedOrigin,
      resolvedDestination: resolvedDestination
    };
  } catch (e) { return { distanceKm: -1, distanceText: 'Error: ' + e.message, durationText: '', officeAddress: '', resolvedOrigin: '', resolvedDestination: '' }; }
}

// ──────────────────────────────────────────────────
// APPLICATION ID
// ──────────────────────────────────────────────────

function generateApplicationId_() {
  var now = new Date();
  var ds = Utilities.formatDate(now, Session.getScriptTimeZone(), 'yyyyMMdd');
  var pfx = 'APP-' + ds + '-';
  var ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  var sh = ss.getSheetByName(CONFIG.RESPONSES_SHEET_NAME);
  var seq = 1;
  if (sh && sh.getLastRow() > 1) {
    var ids = sh.getRange(2, 1, sh.getLastRow() - 1, 1).getValues();
    for (var i = ids.length - 1; i >= 0; i--) {
      var id = ids[i][0].toString();
      if (id.indexOf(pfx) === 0) { var n = parseInt(id.replace(pfx, ''), 10); if (!isNaN(n) && n >= seq) seq = n + 1; }
    }
  }
  return pfx + ('00000' + seq).slice(-5);
}

// ──────────────────────────────────────────────────
// FORM SUBMISSION
// ──────────────────────────────────────────────────

function submitApplication(formData, fileData, fileName, mimeType) {
  var appId = generateApplicationId_();
  var ts = new Date();
  var resumeUrl = '—', resumeFn = '—';

  if (fileData && fileName) {
    var ext = fileName.split('.').pop().toLowerCase();
    if (CONFIG.ALLOWED_EXTENSIONS.indexOf(ext) === -1) throw new Error('File type not allowed.');
    var bytes = Utilities.base64Decode(fileData);
    if (bytes.length / (1024 * 1024) > CONFIG.MAX_FILE_SIZE_MB) throw new Error('File exceeds ' + CONFIG.MAX_FILE_SIZE_MB + ' MB.');
    var blob = Utilities.newBlob(bytes, mimeType, fileName);
    var folder = getResumeFolder_();
    var safeName = formData.fullName.replace(/[^a-zA-Z0-9]/g, '_');
    var ufn = appId + '_' + safeName + '.' + ext;
    blob.setName(ufn);
    var file = folder.createFile(blob);
    try { file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch(e) {}
    resumeUrl = file.getUrl(); resumeFn = ufn;
  }

  var ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  var sh = ss.getSheetByName(CONFIG.RESPONSES_SHEET_NAME);
  if (!sh) {
    sh = ss.insertSheet(CONFIG.RESPONSES_SHEET_NAME);
    var h = ['Application ID','Current Status','Timestamp','Location','Position','Full Name','Age','Gender','Education Level','Current City','Address','Distance from Job Location (KM)','Mobile Number','Email ID','Work Experience (Years)','Current Company','Notice Period (Days)','Current CTC (Lakhs)','Expected CTC (Lakhs)','Resume File Name','Resume Link','Declaration Accepted','POC Name','POC Employee ID','Referral Employee Name','Referral Employee ID','Comment'];
    sh.appendRow(h);
    sh.getRange(1, 1, 1, h.length).setFontWeight('bold').setBackground('#222595').setFontColor('#FFFFFF').setFontSize(10);
    sh.setFrozenRows(1);
  }

  sh.appendRow([
    appId, 'New', ts, formData.location, formData.position, formData.fullName,
    formData.age, formData.gender, formData.educationLevel, formData.currentCity,
    formData.address || '', formData.distanceKm || '—',
    "'" + formData.mobileNumber, formData.email, formData.workExperience,
    formData.currentCompany, formData.noticePeriod, formData.currentCtc, formData.expectedCtc,
    resumeFn, resumeUrl, formData.declaration ? 'Yes' : 'No',
    '', '', '', '', ''
  ]);

  if (resumeUrl !== '—') {
    var lr = sh.getLastRow();
    sh.getRange(lr, 21).setFormula('=HYPERLINK("' + resumeUrl + '","Open Resume")');
  }

  // Store a one-time token for this application (allows resume access without passkey)
  var token = Utilities.getUuid();
  var cache = CacheService.getScriptCache();
  cache.put('resume_token_' + appId, token, 3600); // Valid for 1 hour

  return { success: true, applicationId: appId, resumeToken: token };
}

// ──────────────────────────────────────────────────
// RESUME ACCESS (for fresh submissions — no passkey needed)
// Uses a one-time token generated at submission time
// ──────────────────────────────────────────────────

function getResumeByToken(appId, token) {
  var cache = CacheService.getScriptCache();
  var storedToken = cache.get('resume_token_' + appId);
  if (!storedToken || storedToken !== token) {
    throw new Error('Resume access expired or invalid. Please use Retrieve Application.');
  }

  return getResumeLink_(appId);
}

function getResumeLink_(appId) {
  var ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  var sh = ss.getSheetByName(CONFIG.RESPONSES_SHEET_NAME);
  if (!sh) throw new Error('Responses sheet not found.');
  var lr = sh.getLastRow(); if (lr < 2) throw new Error('No data.');

  var ids = sh.getRange(2, 1, lr - 1, 1).getValues();
  var formulas = sh.getRange(2, 21, lr - 1, 1).getFormulas(); // Column U = Resume Link
  var values = sh.getRange(2, 21, lr - 1, 1).getValues();

  for (var i = 0; i < ids.length; i++) {
    if (ids[i][0].toString().trim() === appId.trim()) {
      var formula = formulas[i][0] || '';
      if (formula.indexOf('HYPERLINK') >= 0) {
        var match = formula.match(/HYPERLINK\("([^"]+)"/);
        if (match) return match[1];
      }
      var val = values[i][0] ? values[i][0].toString() : '';
      if (val && val !== '—' && val.indexOf('http') === 0) return val;
      return '';
    }
  }
  return '';
}

// ──────────────────────────────────────────────────
// RETRIEVE APPLICATION (passkey-protected)
// With rate limiting via CacheService
// ──────────────────────────────────────────────────

function verifyAndGetApplication(appId, passkey) {
  // Rate limiting: max 5 attempts per minute
  var cache = CacheService.getScriptCache();
  var rateLimitKey = 'rate_' + Session.getTemporaryActiveUserKey();
  var attempts = parseInt(cache.get(rateLimitKey) || '0');
  if (attempts >= 5) {
    throw new Error('Too many attempts. Please wait a minute and try again.');
  }
  cache.put(rateLimitKey, (attempts + 1).toString(), 60);

  // Verify passkey from Script Properties
  var correctPasskey = getPasskey_();
  if (!correctPasskey || passkey !== correctPasskey) {
    throw new Error('Invalid passkey. Access denied.');
  }

  var ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  var sh = ss.getSheetByName(CONFIG.RESPONSES_SHEET_NAME);
  if (!sh) throw new Error('Responses sheet not found.');
  var lr = sh.getLastRow();
  if (lr < 2) throw new Error('No applications found.');

  var headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  var data = sh.getRange(2, 1, lr - 1, sh.getLastColumn()).getValues();
  var formulas = sh.getRange(2, 1, lr - 1, sh.getLastColumn()).getFormulas();

  for (var i = 0; i < data.length; i++) {
    if (data[i][0].toString().trim() === appId.trim()) {
      var row = data[i]; var fRow = formulas[i]; var result = {};
      for (var j = 0; j < headers.length; j++) {
        var key = headers[j].toString().trim();
        var val = row[j]; var formula = fRow[j] || '';
        if (formula && formula.indexOf('HYPERLINK') >= 0) {
          var match = formula.match(/HYPERLINK\("([^"]+)"/);
          if (match) val = match[1];
        }
        if (val instanceof Date) val = Utilities.formatDate(val, Session.getScriptTimeZone(), 'dd-MMM-yyyy hh:mm a');
        result[key] = val !== null && val !== undefined ? val.toString() : '';
      }
      if (result['Location']) result['Office Address'] = getOfficeAddress(result['Location']);
      return result;
    }
  }
  throw new Error('Application ID "' + appId + '" not found.');
}

// ──────────────────────────────────────────────────
// DRIVE FOLDER
// ──────────────────────────────────────────────────

function getResumeFolder_() {
  if (!CONFIG.RESUME_FOLDER_ID) throw new Error('RESUME_FOLDER_ID is required for Shared Drive.');
  try { return DriveApp.getFolderById(CONFIG.RESUME_FOLDER_ID); }
  catch (e) { throw new Error('Resume folder not found. Check RESUME_FOLDER_ID.'); }
}

// ──────────────────────────────────────────────────
// SETUP
// ──────────────────────────────────────────────────

function setupSampleData() {
  var ss;
  if (CONFIG.SPREADSHEET_ID) { ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID); }
  else { ss = SpreadsheetApp.create('Hiring Form Data'); Logger.log('Sheet ID: ' + ss.getId()); }
  var sh = ss.getSheetByName(CONFIG.DATA_SHEET_NAME);
  if (!sh) sh = ss.insertSheet(CONFIG.DATA_SHEET_NAME); else sh.clear();
  sh.appendRow(['Location', 'Position', 'Office Address']);
  sh.getRange(1, 1, 1, 3).setFontWeight('bold').setBackground('#222595').setFontColor('#FFFFFF');
  var d = [
    ['Bangalore','Full Stack Developer','Outer Ring Road, Marathahalli, Bangalore 560037'],
    ['Bangalore','Android Developer','Outer Ring Road, Marathahalli, Bangalore 560037'],
    ['Mumbai','Business Analyst','Bandra Kurla Complex, Mumbai 400051'],
    ['Mumbai','HR Manager','Bandra Kurla Complex, Mumbai 400051'],
  ];
  sh.getRange(2, 1, d.length, 3).setValues(d);
  sh.autoResizeColumns(1, 3); sh.setFrozenRows(1);
  Logger.log('Sheet: ' + ss.getUrl());
}
