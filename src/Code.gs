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
// RESPONSE SHEET HEADERS (44 columns)
// ──────────────────────────────────────────────────
// Writing uses header-based column lookup so column
// order changes won't break existing data rows.
// ──────────────────────────────────────────────────

var RESPONSE_HEADERS = [
  'Application ID',                               // A
  'Timestamp',                                     // B
  'Application Status',                            // C
  'Location',                                      // D
  'Position',                                      // E
  'Full Name',                                     // F
  'Age (in years)',                                // G
  'Gender',                                        // H
  'Highest Education Level',                       // I
  'Education Relevant to Applied Field',           // J
  'Current City',                                  // K
  'Address',                                       // L
  'Distance from Job Location (in KM)',            // M
  'Mobile Number',                                 // N
  'Email ID',                                      // O
  'Work Experience in Years (relevant to position)', // P
  'Current Company',                               // Q
  'Position in Current Company',                   // R
  'Number of Job Changes in Last 10 Years',        // S
  'Notice Period (in days)',                        // T
  'Current CTC (in lakhs)',                        // U
  'Expected CTC (in lakhs)',                       // V
  'Resume File Name',                              // W
  'Referral Employee Name',                        // X
  'Referral Employee ID',                          // Y
  'Declaration',                                   // Z
  'Resume Link',                                   // AA
  'HR POC Name',                                   // AB
  'HR Comment',                                    // AC
  'Skill Evaluation',                              // AD
  'Cost (INR)',                                    // AE
  'Reliability',                                   // AF
  'HR Status',                                     // AG
  'Screener Name',                                 // AH
  'Screener Comment',                              // AI
  'Screener Status',                               // AJ
  'Hiring Manager Name',                           // AK
  'Hiring Manager Comment',                        // AL
  'Hiring Manager Status',                         // AM
  'Final Hiring Status',                           // AN
  'Final Hiring Comment',                          // AO
  'Final Joining Status',                          // AP
  'Employee ID',                                   // AQ
  'Joining Application Form Link'                  // AR
];

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
  return CONFIG.PASSKEY || '';
}

function getMapsKey_() {
  var fromProps = PropertiesService.getScriptProperties().getProperty('MAPS_API_KEY');
  if (fromProps) return fromProps;
  return CONFIG.GOOGLE_MAPS_API_KEY || '';
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
// HEADER-BASED COLUMN LOOKUP
// ──────────────────────────────────────────────────

function getColumnMap_(sheet) {
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var map = {};
  for (var i = 0; i < headers.length; i++) {
    map[headers[i].toString().trim()] = i + 1; // 1-based column index
  }
  return map;
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
    sh.appendRow(RESPONSE_HEADERS);
    sh.getRange(1, 1, 1, RESPONSE_HEADERS.length).setFontWeight('bold').setBackground('#222595').setFontColor('#FFFFFF').setFontSize(10);
    sh.setFrozenRows(1);
  }

  // Build column map from actual headers (works with any column arrangement)
  var colMap = getColumnMap_(sh);
  var newRow = sh.getLastRow() + 1;

  // Helper: set cell value by header name
  function setVal(header, value) {
    var col = colMap[header];
    if (col) sh.getRange(newRow, col).setValue(value);
  }

  setVal('Application ID', appId);
  setVal('Timestamp', ts);
  setVal('Application Status', 'New');
  setVal('Location', formData.location);
  setVal('Position', formData.position);
  setVal('Full Name', formData.fullName);
  setVal('Age (in years)', formData.age);
  setVal('Gender', formData.gender);
  setVal('Highest Education Level', formData.educationLevel);
  setVal('Education Relevant to Applied Field', formData.educationRelevant);
  setVal('Current City', formData.currentCity);
  setVal('Address', formData.address || '');
  setVal('Distance from Job Location (in KM)', formData.distanceKm || '—');
  setVal('Mobile Number', "'" + formData.mobileNumber);
  setVal('Email ID', formData.email);
  setVal('Work Experience in Years (relevant to position)', formData.workExperience);
  setVal('Current Company', formData.currentCompany);
  setVal('Position in Current Company', formData.positionInCurrentCompany);
  setVal('Number of Job Changes in Last 10 Years', formData.jobChanges);
  setVal('Notice Period (in days)', formData.noticePeriod);
  setVal('Current CTC (in lakhs)', formData.currentCtc);
  setVal('Expected CTC (in lakhs)', formData.expectedCtc);
  setVal('Resume File Name', resumeFn);
  setVal('Referral Employee Name', formData.referralName || '');
  setVal('Referral Employee ID', formData.referralId || '');
  setVal('Declaration', formData.declaration ? 'Yes' : 'No');

  // Resume link as HYPERLINK formula
  if (resumeUrl !== '—') {
    var resumeCol = colMap['Resume Link'];
    if (resumeCol) {
      sh.getRange(newRow, resumeCol).setFormula('=HYPERLINK("' + resumeUrl + '","Open Resume")');
    }
  } else {
    setVal('Resume Link', '—');
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

  // Find Resume Link column by header (not hardcoded position)
  var colMap = getColumnMap_(sh);
  var resumeCol = colMap['Resume Link'];
  if (!resumeCol) throw new Error('Resume Link column not found.');

  var ids = sh.getRange(2, 1, lr - 1, 1).getValues();
  var formulas = sh.getRange(2, resumeCol, lr - 1, 1).getFormulas();
  var values = sh.getRange(2, resumeCol, lr - 1, 1).getValues();

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

/**
 * Run once to set up the Responses sheet with the new 44-column headers.
 * Safe to run on an existing sheet — only creates if it doesn't exist.
 */
function setupResponseSheet() {
  var ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  var sh = ss.getSheetByName(CONFIG.RESPONSES_SHEET_NAME);
  if (!sh) {
    sh = ss.insertSheet(CONFIG.RESPONSES_SHEET_NAME);
    sh.appendRow(RESPONSE_HEADERS);
    sh.getRange(1, 1, 1, RESPONSE_HEADERS.length).setFontWeight('bold').setBackground('#222595').setFontColor('#FFFFFF').setFontSize(10);
    sh.setFrozenRows(1);
    sh.autoResizeColumns(1, RESPONSE_HEADERS.length);
    Logger.log('Responses sheet created with ' + RESPONSE_HEADERS.length + ' columns.');
  } else {
    Logger.log('Responses sheet already exists. No changes made.');
    Logger.log('To add new columns to an existing sheet, add them manually to preserve data.');
  }
}
