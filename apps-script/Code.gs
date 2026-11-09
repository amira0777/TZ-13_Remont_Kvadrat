/**
 * TZ-13 educational lead receiver.
 * Set the script property SPREADSHEET_ID to the ID of the Google Sheet.
 */
var LEAD_HEADERS = [
  'request_id',
  'created_at',
  'name',
  'phone',
  'email',
  'repair_type',
  'area_m2',
  'object_type',
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_content',
  'status'
];

var REPAIR_TYPES = ['cosmetic', 'capital', 'designer', 'bathroom'];
var OBJECT_TYPES = ['new_build', 'secondary'];
var UTM_DEFAULTS = {
  utm_source: 'direct',
  utm_medium: 'none',
  utm_campaign: 'not_set',
  utm_content: 'not_set'
};
var UTM_HEADERS = [
  'number', 'channel', 'placement', 'source', 'medium', 'campaign', 'content',
  'destination', 'full_url', 'short_url', 'publication_url', 'publication_date'
];
var UTM_RECORDS = [
  ['U-01', 'instagram', 'profile_bio', 'instagram', 'social', 'estimate_nov_2026', 'bio', 'index.html'],
  ['U-02', 'instagram', 'manychat_reel_auto_reply', 'instagram', 'social', 'estimate_nov_2026', 'reel_timelapse_01', 'checklist.html'],
  ['U-03', 'instagram', 'manychat_bathroom_branch', 'instagram', 'social', 'bathroom_nov_2026', 'reel_timelapse_01_bath', 'services.html#bathroom'],
  ['U-04', 'instagram', 'stories_link_sticker', 'instagram', 'social', 'estimate_nov_2026', 'stories_01', 'calculator.html'],
  ['U-05', 'vkontakte', 'community_post', 'vk', 'social', 'estimate_nov_2026', 'post_01', 'portfolio.html'],
  ['U-06', 'vkontakte', 'newbuild_group_post', 'vk', 'social', 'estimate_nov_2026', 'newbuild_post_01', 'calculator.html'],
  ['U-07', 'telegram', 'channel_post', 'telegram', 'social', 'estimate_nov_2026', 'post_01', 'calculator.html'],
  ['U-08', 'telegram', 'house_chat_message', 'telegram', 'social', 'estimate_nov_2026', 'house_chat', 'index.html'],
  ['U-09', 'youtube', 'video_description', 'youtube', 'social', 'estimate_nov_2026', 'video_2room', 'portfolio.html'],
  ['U-10', 'blogger', 'partner_story', 'demo_blogger_01_replace_with_real_handle', 'affiliate', 'estimate_nov_2026', 'story_01', 'index.html'],
  ['U-11', 'blogger', 'realtor_reel', 'demo_realtor_02_replace_with_real_handle', 'affiliate', 'estimate_nov_2026', 'reel_01', 'calculator.html'],
  ['U-12', 'banner', 'newbuild_qr_banner', 'banner_qr', 'qr', 'estimate_nov_2026', 'newbuild_banner', 'calculator.html']
];
var DEFAULT_SITE_BASE_URL = 'https://remont-kvadrat.vercel.app';

/**
 * Creates the educational workbook on first run, or opens SPREADSHEET_ID,
 * then prepares the leads and utm sheets. Run from the Apps Script editor.
 */
function setupSpreadsheet() {
  var properties = PropertiesService.getScriptProperties();
  var spreadsheetId = properties.getProperty('SPREADSHEET_ID');
  var spreadsheet;

  if (spreadsheetId) {
    spreadsheet = SpreadsheetApp.openById(spreadsheetId);
  } else {
    spreadsheet = SpreadsheetApp.create('Kvadrat — Leads');
    spreadsheetId = spreadsheet.getId();
    properties.setProperty('SPREADSHEET_ID', spreadsheetId);
  }

  var leads = getOrCreateSheet_(spreadsheet, 'leads');
  var utm = getOrCreateSheet_(spreadsheet, 'utm');
  setupLeadsSheet_(leads);
  setupUtmSheet_(utm, properties.getProperty('SITE_BASE_URL'));

  return { spreadsheetId: spreadsheetId, url: spreadsheet.getUrl() };
}

/** Backward-friendly entry point named in the TZ-13 setup instructions. */
function setupLeadSheets() {
  return setupSpreadsheet();
}

function getOrCreateSheet_(spreadsheet, name) {
  return spreadsheet.getSheetByName(name) || spreadsheet.insertSheet(name);
}

function setupLeadsSheet_(sheet) {
  var lastRow = sheet.getLastRow();
  var lastColumn = sheet.getLastColumn();
  if (lastRow === 0 && lastColumn === 0) {
    sheet.getRange(1, 1, 1, LEAD_HEADERS.length).setValues([LEAD_HEADERS]);
  } else {
    if (lastColumn !== LEAD_HEADERS.length) {
      throw new Error('The leads sheet must have exactly 13 columns.');
    }
    var actualHeaders = sheet.getRange(1, 1, 1, LEAD_HEADERS.length).getDisplayValues()[0];
    if (actualHeaders.join('\u0000') !== LEAD_HEADERS.join('\u0000')) {
      throw new Error('The leads sheet headers do not match the required schema.');
    }
  }

  var maxRows = sheet.getMaxRows();
  if (maxRows > 1) {
    var dataRows = maxRows - 1;
    sheet.getRange(2, 6, dataRows, 1).setDataValidation(
      SpreadsheetApp.newDataValidation()
        .requireValueInList(REPAIR_TYPES, true)
        .setAllowInvalid(false)
        .build()
    );
    sheet.getRange(2, 8, dataRows, 1).setDataValidation(
      SpreadsheetApp.newDataValidation()
        .requireValueInList(OBJECT_TYPES, true)
        .setAllowInvalid(false)
        .build()
    );
    sheet.getRange(2, 13, dataRows, 1).setDataValidation(
      SpreadsheetApp.newDataValidation()
        .requireValueInList(['new', 'contacted', 'visit_booked', 'estimate_sent', 'contract', 'lost'], true)
        .setAllowInvalid(false)
        .build()
    );
    sheet.getRange(2, 7, dataRows, 1).setDataValidation(
      SpreadsheetApp.newDataValidation()
        .requireNumberBetween(10, 300)
        .setAllowInvalid(false)
        .build()
    );

    var tableRange = sheet.getRange(2, 1, dataRows, LEAD_HEADERS.length);
    var rules = [
      SpreadsheetApp.newConditionalFormatRule()
        .whenFormulaSatisfied('=OR($A2="",$B2="",$C2="",$D2="",$F2="",$G2="",$H2="",$I2="",$J2="",$K2="",$L2="",$M2="")')
        .setBackground('#fce8e6')
        .setRanges([tableRange])
        .build(),
      SpreadsheetApp.newConditionalFormatRule()
        .whenFormulaSatisfied('=AND($A2<>"",COUNTIF($A$2:$A,$A2)>1)')
        .setBackground('#f4cccc')
        .setRanges([tableRange])
        .build()
    ];
    sheet.setConditionalFormatRules(rules);
  }

  sheet.setFrozenRows(1);
  styleHeader_(sheet.getRange(1, 1, 1, LEAD_HEADERS.length));
  sheet.setColumnWidth(1, 180);
  sheet.setColumnWidth(2, 160);
  sheet.setColumnWidth(3, 200);
  sheet.setColumnWidth(4, 150);
  sheet.setColumnWidth(5, 220);
  sheet.setColumnWidth(6, 130);
  sheet.setColumnWidth(7, 100);
  sheet.setColumnWidth(8, 140);
  sheet.setColumnWidths(9, 5, 190);
  sheet.setColumnWidth(13, 150);
}

function setupUtmSheet_(sheet, configuredBaseUrl) {
  var lastRow = sheet.getLastRow();
  var lastColumn = sheet.getLastColumn();
  if (lastRow === 0 && lastColumn === 0) {
    sheet.getRange(1, 1, 1, UTM_HEADERS.length).setValues([UTM_HEADERS]);
    var seedRows = UTM_RECORDS.map(function(record) {
      return record.concat(['', '', '', '']);
    });
    sheet.getRange(2, 1, seedRows.length, UTM_HEADERS.length).setValues(seedRows);
  } else {
    if (lastColumn < UTM_HEADERS.length) {
      throw new Error('The utm sheet does not contain all required columns.');
    }
    var actualHeaders = sheet.getRange(1, 1, 1, UTM_HEADERS.length).getDisplayValues()[0];
    if (actualHeaders.join('\u0000') !== UTM_HEADERS.join('\u0000')) {
      throw new Error('The utm sheet headers do not match docs/utm.csv.');
    }
    if (lastRow < UTM_RECORDS.length + 1) {
      var existingRecords = lastRow > 1
        ? sheet.getRange(2, 1, lastRow - 1, 8).getDisplayValues()
        : [];
      existingRecords.forEach(function(existing, index) {
        if (existing.join('\u0000') !== UTM_RECORDS[index].join('\u0000')) {
          throw new Error('The utm sheet records do not match docs/utm.csv.');
        }
      });
      for (var i = existingRecords.length; i < UTM_RECORDS.length; i++) {
        sheet.getRange(i + 2, 1, 1, UTM_HEADERS.length).setValues([
          UTM_RECORDS[i].concat(['', '', '', ''])
        ]);
      }
    } else {
      var configuredRecords = sheet.getRange(2, 1, UTM_RECORDS.length, 8).getDisplayValues();
      configuredRecords.forEach(function(existing, index) {
        if (existing.join('\u0000') !== UTM_RECORDS[index].join('\u0000')) {
          throw new Error('The utm sheet records do not match docs/utm.csv.');
        }
      });
    }
  }

  var baseCell = sheet.getRange('N2');
  if (configuredBaseUrl) {
    baseCell.setValue(configuredBaseUrl.replace(/\/$/, ''));
  } else if (!baseCell.getValue()) {
    baseCell.setValue(DEFAULT_SITE_BASE_URL);
  }
  sheet.getRange('N1').setValue('Site base URL');
  sheet.getRange('N1').setNote('Set Script Property SITE_BASE_URL or edit N2. Do not include a trailing slash.');
  styleHeader_(sheet.getRange(1, 1, 1, UTM_HEADERS.length));
  styleHeader_(sheet.getRange('N1'));
  sheet.setFrozenRows(1);

  var formulas = UTM_RECORDS.map(function(record, index) {
    var row = index + 2;
    return ['=IF($N$2="","",$N$2&"/"&REGEXREPLACE(H' + row + ',"#.*$","")&"?utm_source="&ENCODEURL(D' + row + ')&"&utm_medium="&ENCODEURL(E' + row + ')&"&utm_campaign="&ENCODEURL(F' + row + ')&"&utm_content="&ENCODEURL(G' + row + ')&IFERROR("#"&REGEXEXTRACT(H' + row + ',"#(.*)$"),""))'];
  });
  sheet.getRange(2, 9, formulas.length, 1).setFormulas(formulas);
  var shortFormulas = UTM_RECORDS.map(function(record, index) {
    var row = index + 2;
    return ['=IF($N$2="","",$N$2&"/u/"&LOWER(A' + row + '))'];
  });
  sheet.getRange(2, 10, shortFormulas.length, 1).setFormulas(shortFormulas);
  sheet.setColumnWidths(1, UTM_HEADERS.length, 190);
  sheet.setColumnWidth(1, 90);
  sheet.setColumnWidth(2, 130);
  sheet.setColumnWidth(3, 250);
  sheet.setColumnWidth(8, 200);
  sheet.setColumnWidth(9, 520);
  sheet.setColumnWidth(10, 360);
  sheet.setColumnWidth(14, 260);
}

function styleHeader_(range) {
  range
    .setFontWeight('bold')
    .setFontColor('#ffffff')
    .setBackground('#1f4e78')
    .setWrap(true);
}

function doPost(e) {
  var lock;

  try {
    var payload = parsePayload_(e);
    var lead = validatePayload_(payload);
    var sheet = getLeadsSheet_();

    lock = LockService.getScriptLock();
    lock.waitLock(30000);

    if (hasRequestId_(sheet, lead.request_id)) {
      return jsonResponse_({ ok: false, error: 'Duplicate request_id.' });
    }

    var row = [
      lead.request_id,
      new Date(),
      lead.name,
      lead.phone,
      lead.email,
      lead.repair_type,
      lead.area_m2,
      lead.object_type,
      lead.utm_source,
      lead.utm_medium,
      lead.utm_campaign,
      lead.utm_content,
      'new'
    ];

    sheet.appendRow(row);
    SpreadsheetApp.flush();
    return jsonResponse_({ ok: true, request_id: lead.request_id });
  } catch (error) {
    return jsonResponse_({
      ok: false,
      error: error && error.message ? error.message : 'Unable to save request.'
    });
  } finally {
    if (lock && lock.hasLock()) {
      lock.releaseLock();
    }
  }
}

function parsePayload_(e) {
  if (!e || !e.postData || typeof e.postData.contents !== 'string') {
    throw new Error('A JSON request body is required.');
  }

  var payload;
  try {
    payload = JSON.parse(e.postData.contents);
  } catch (error) {
    throw new Error('Request body must be valid JSON.');
  }

  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('Request body must be a JSON object.');
  }
  return payload;
}

function validatePayload_(payload) {
  var requestId = requiredString_(payload, 'request_id');
  var name = requiredString_(payload, 'name');
  var phone = requiredString_(payload, 'phone');
  var email = optionalString_(payload, 'email');
  var repairType = requiredString_(payload, 'repair_type');
  var objectType = requiredString_(payload, 'object_type');

  if (name.length < 2 || name.length > 60) {
    throw new Error('name must contain 2–60 characters.');
  }
  if (!/^\+7\d{10}$/.test(phone)) {
    throw new Error('phone must contain +7 followed by 10 digits.');
  }
  if (email && (email.length > 200 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
    throw new Error('email must be a valid email address.');
  }
  if (REPAIR_TYPES.indexOf(repairType) === -1) {
    throw new Error('repair_type is not allowed.');
  }
  if (OBJECT_TYPES.indexOf(objectType) === -1) {
    throw new Error('object_type is not allowed.');
  }

  var area = payload.area_m2;
  if (typeof area === 'string' && area.trim() !== '') {
    area = Number(area);
  }
  if (typeof area !== 'number' || !isFinite(area) || area < 10 || area > 300) {
    throw new Error('area_m2 must be a number from 10 to 300.');
  }

  return {
    request_id: requestId,
    name: name,
    phone: phone,
    email: email,
    repair_type: repairType,
    area_m2: area,
    object_type: objectType,
    utm_source: utmString_(payload, 'utm_source'),
    utm_medium: utmString_(payload, 'utm_medium'),
    utm_campaign: utmString_(payload, 'utm_campaign'),
    utm_content: utmString_(payload, 'utm_content')
  };
}

function requiredString_(payload, field) {
  var value = payload[field];
  if (typeof value !== 'string') {
    throw new Error(field + ' is required and must be text.');
  }
  value = value.trim();
  if (!value) {
    throw new Error(field + ' is required.');
  }
  if (value.length > 200) {
    throw new Error(field + ' must be 200 characters or fewer.');
  }
  return value;
}

function optionalString_(payload, field) {
  var value = payload[field];
  if (value === undefined || value === null || value === '') {
    return '';
  }
  if (typeof value !== 'string') {
    throw new Error(field + ' must be text.');
  }
  value = value.trim();
  if (value.length > 200) {
    throw new Error(field + ' must be 200 characters or fewer.');
  }
  return value;
}

function utmString_(payload, field) {
  var value = payload[field];
  if (value === undefined || value === null || value === '') {
    return UTM_DEFAULTS[field];
  }
  if (typeof value !== 'string') {
    throw new Error(field + ' must be text.');
  }
  value = value.trim();
  if (!value) {
    return UTM_DEFAULTS[field];
  }
  if (value.length > 200) {
    throw new Error(field + ' must be 200 characters or fewer.');
  }
  return value;
}

function getLeadsSheet_() {
  var spreadsheetId = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  if (!spreadsheetId) {
    throw new Error('SPREADSHEET_ID script property is not configured.');
  }

  var spreadsheet = SpreadsheetApp.openById(spreadsheetId);
  var sheet = spreadsheet.getSheetByName('leads');
  if (!sheet) {
    throw new Error('The spreadsheet must contain a sheet named leads.');
  }

  var lastColumn = sheet.getLastColumn();
  var lastRow = sheet.getLastRow();
  if (lastRow === 0 && lastColumn === 0) {
    sheet.getRange(1, 1, 1, LEAD_HEADERS.length).setValues([LEAD_HEADERS]);
  } else {
    if (lastColumn !== LEAD_HEADERS.length) {
      throw new Error('The leads sheet must have exactly 13 columns.');
    }
    var headers = sheet.getRange(1, 1, 1, LEAD_HEADERS.length).getDisplayValues()[0];
    if (headers.join('\u0000') !== LEAD_HEADERS.join('\u0000')) {
      throw new Error('The leads sheet headers do not match the required schema.');
    }
  }
  return sheet;
}

function hasRequestId_(sheet, requestId) {
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    return false;
  }
  var matches = sheet.getRange(2, 1, lastRow - 1, 1)
    .createTextFinder(requestId)
    .matchEntireCell(true)
    .findNext();
  return matches !== null;
}

function jsonResponse_(value) {
  return ContentService
    .createTextOutput(JSON.stringify(value))
    .setMimeType(ContentService.MimeType.JSON);
}
