/**
 * Dublin Cleaners — What Should I Bring Next?
 * Google Apps Script HTMLService backend.
 */

var APP_CONFIG = Object.freeze({
  appName: 'What Should I Bring Next?',
  businessName: 'Dublin Cleaners',
  established: '1934',
  logoUrl: 'https://www.dublincleaners.com/wp-content/uploads/2024/12/Dublin-Logos-stacked.png',
  spreadsheetName: 'Dublin Cleaners - What Should I Bring Next - Kiosk Log',
  spreadsheetPropertyKey: 'DUBLIN_CLEANERS_KIOSK_SPREADSHEET_ID',
  usageLogSheetName: 'Usage Log',
  sheetName: 'Usage Log',
  dailySummarySheetName: 'Daily Summary',
  categorySummarySheetName: 'Category Summary',
  reminderLogSheetName: 'Reminder Log',
  defaultDeviceLabel: 'In-store touchscreen',
  allowedActions: [
    'app_loaded',
    'loading_complete',
    'category_selected',
    'checklist_viewed',
    'save_list_opened',
    'reset_tapped',
    'inactivity_reset'
  ],
  headers: [
    'id',
    'timestamp',
    'sessionId',
    'deviceLabel',
    'displayMode',
    'action',
    'category',
    'selectedItems',
    'forgottenItems',
    'smartAddOn',
    'nextStep',
    'userAgent',
    'viewportWidth',
    'viewportHeight',
    'orientation',
    'touchCapable',
    'referrer',
    'auditNotes'
  ],
  usageHeaders: [
    'id',
    'timestamp',
    'sessionId',
    'deviceLabel',
    'displayMode',
    'action',
    'category',
    'selectedItems',
    'forgottenItems',
    'smartAddOn',
    'nextStep',
    'userAgent',
    'viewportWidth',
    'viewportHeight',
    'orientation',
    'touchCapable',
    'referrer',
    'auditNotes'
  ],
  dailySummaryHeaders: [
    'date',
    'totalAppLoads',
    'totalCategorySelections',
    'uniqueSessions',
    'saveListOpens',
    'resetTaps',
    'topCategory',
    'kioskUses',
    'mobileUses',
    'desktopUses',
    'lastUpdated'
  ],
  categorySummaryHeaders: [
    'category',
    'totalSelections',
    'lastSelectedAt',
    'percentOfSelections',
    'relatedSmartAddOn',
    'lastUpdated'
  ],
  reminderHeaders: [
    'id',
    'timestamp',
    'sessionId',
    'category',
    'reminderDate',
    'emailDomain',
    'deliveryStatus',
    'deliveryReference'
  ],
  reminderTitle: 'Dublin Cleaners Reminder: Bring These Items',
  timeZone: 'America/New_York',
  businessPhone: '(614) 764-9934',
  businessAddress: '6845 Caine Rd'
});

var CHECKLISTS = Object.freeze({
  wedding_event: Object.freeze({
    id: 'wedding_event',
    title: 'Wedding / Event',
    icon: '✦',
    helperText: 'Formal pieces before the big day.',
    selectedItems: ['Suits', 'Dress shirts', 'Ties', 'Formal dresses', 'Wraps or shawls'],
    forgottenItems: ['Pocket squares', 'Dress pants with the matching jacket', 'Garment bags that need replacing'],
    smartAddOn: 'Alterations or professional pressing',
    nextStep: 'Ask us today if you need it ready before the weekend.'
  }),
  spring_closet_reset: Object.freeze({
    id: 'spring_closet_reset',
    title: 'Spring Closet Reset',
    icon: '☼',
    helperText: 'Freshen seasonal favorites.',
    selectedItems: ['Winter coats', 'Wool sweaters', 'Scarves', 'Comforters', 'Table linens'],
    forgottenItems: ['Pillow shams', 'Mattress pads', 'Light blankets'],
    smartAddOn: 'Coat cleaning and seasonal storage',
    nextStep: 'Ask us about household items before you switch seasons.'
  }),
  guest_room_refresh: Object.freeze({
    id: 'guest_room_refresh',
    title: 'Guest Room Refresh',
    icon: '⌂',
    helperText: 'Make linens guest-ready.',
    selectedItems: ['Comforters', 'Blankets', 'Bedspreads', 'Shams', 'Decorative pillows'],
    forgottenItems: ['Mattress pads', 'Table runners', 'Guest towels needing brightening'],
    smartAddOn: 'Comforters and household textile care',
    nextStep: 'Bring household items in before guests arrive.'
  }),
  traveling_soon: Object.freeze({
    id: 'traveling_soon',
    title: 'Traveling Very Soon',
    icon: '✈',
    helperText: 'Pack clean and pressed.',
    selectedItems: ['Vacation outfits', 'Resort wear', 'Jackets', 'Dress clothes', 'Travel laundry'],
    forgottenItems: ['Hats', 'Scarves', 'Packing pieces that need pressing'],
    smartAddOn: 'Rush service or professional pressing',
    nextStep: 'Ask what to clean first if you’re leaving soon.'
  }),
  stain_emergency: Object.freeze({
    id: 'stain_emergency',
    title: 'Stain Emergency',
    icon: '!',
    helperText: 'Bring stains in fast.',
    selectedItems: ['Stained shirts', 'Dresses', 'Table linens', 'Jackets', 'Specialty fabrics'],
    forgottenItems: ['Napkins', 'Matching pieces', 'Items they tried to spot-clean at home'],
    smartAddOn: 'Specialty stain treatment',
    nextStep: 'Bring it in today and don’t apply heat.'
  }),
  laundry_overload: Object.freeze({
    id: 'laundry_overload',
    title: 'Laundry Overload',
    icon: '∞',
    helperText: 'Take the week back.',
    selectedItems: ['Everyday laundry', 'Kids’ clothes', 'Bedding', 'Towels', 'Workwear'],
    forgottenItems: ['Socks and basics', 'Gym clothes', 'Extra household loads'],
    smartAddOn: 'Wash and fold',
    nextStep: 'Ask about wash and fold if you want your week back.'
  })
});

function doGet(e) {
  var view = e && e.parameter && e.parameter.view === 'print' ? 'print' : 'index';
  return HtmlService.createTemplateFromFile(view)
    .evaluate()
    .setTitle(APP_CONFIG.appName + ' | ' + APP_CONFIG.businessName)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, viewport-fit=cover');
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

function getAppPayload() {
  return {
    appName: APP_CONFIG.appName,
    businessName: APP_CONFIG.businessName,
    established: APP_CONFIG.established,
    logoUrl: APP_CONFIG.logoUrl,
    categories: getPublicCategories_(),
    deployment: {
      access: 'public_kiosk',
      loginRequired: false,
      storesCustomerData: false
    }
  };
}

function recordAppAction(request) {
  var cleanRequest = normalizeRequest_(request);
  validateAction_(cleanRequest.action);
  validateAnonymousOnly_(request || {});

  var category = cleanRequest.category ? getCategoryById_(cleanRequest.category) : null;
  if ((cleanRequest.action === 'category_selected' || cleanRequest.action === 'checklist_viewed') && !category) {
    throw new Error('Invalid category selection.');
  }
  if (cleanRequest.category && !category) {
    throw new Error('Invalid category selection.');
  }

  var row = buildLogRow_(cleanRequest, category);
  try {
    appendLogRow_(row);
  } catch (error) {
    return { ok: false };
  }

  return {
    ok: true,
    id: row[0],
    action: row[5],
    category: row[6],
    auditNotes: row[17]
  };
}


function sendChecklistReminder(request) {
  var cleanRequest = normalizeReminderRequest_(request);
  var category = getCategoryById_(cleanRequest.category);
  if (!category) {
    throw new Error('Invalid category selection.');
  }
  if (!isValidEmail_(cleanRequest.email)) {
    throw new Error('INVALID_EMAIL');
  }

  var reminderDate = resolveReminderDate_(cleanRequest.reminderDate);
  if (!reminderDate) {
    throw new Error('Invalid reminder date.');
  }

  var id = Utilities.getUuid();
  var timestamp = new Date().toISOString();
  var deliveryReference = 'email';
  var deliveryStatus = 'sent';
  try {
    sendReminderEmail_(cleanRequest.email, category, reminderDate);
  } catch (error) {
    deliveryStatus = 'failed';
    deliveryReference = '';
    tryAppendReminderLogRow_(buildReminderLogRow_(id, timestamp, cleanRequest, category, reminderDate, deliveryStatus, deliveryReference));
    return { ok: false, error: 'send_failed' };
  }

  tryAppendReminderLogRow_(buildReminderLogRow_(id, timestamp, cleanRequest, category, reminderDate, deliveryStatus, deliveryReference));
  return {
    ok: true,
    id: id,
    reminderDate: reminderDate.toISOString(),
    deliveryStatus: deliveryStatus
  };
}

function getOrCreateActivitySheet_() {
  return getOrCreateUsageLog_().usageLog;
}

function getOrCreateUsageSpreadsheet_() {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    return getOrCreateUsageSpreadsheetNoLock_();
  } finally {
    lock.releaseLock();
  }
}

function getOrCreateUsageLog_() {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    return getOrCreateUsageLogNoLock_();
  } finally {
    lock.releaseLock();
  }
}

function getOrCreateUsageSpreadsheetNoLock_() {
  var props = PropertiesService.getScriptProperties();
  var spreadsheetId = props.getProperty(APP_CONFIG.spreadsheetPropertyKey);
  var spreadsheet = null;
  if (spreadsheetId) {
    try {
      spreadsheet = SpreadsheetApp.openById(spreadsheetId);
    } catch (error) {
      spreadsheet = null;
    }
  }

  if (!spreadsheet) {
    spreadsheet = SpreadsheetApp.create(APP_CONFIG.spreadsheetName);
    props.setProperty(APP_CONFIG.spreadsheetPropertyKey, spreadsheet.getId());
  }

  return spreadsheet;
}

function getOrCreateUsageLogNoLock_() {
  var spreadsheet = getOrCreateUsageSpreadsheetNoLock_();
  var usageLog = ensureSheet_(spreadsheet, APP_CONFIG.usageLogSheetName, APP_CONFIG.usageHeaders);
  var dailySummary = ensureSheet_(spreadsheet, APP_CONFIG.dailySummarySheetName, APP_CONFIG.dailySummaryHeaders);
  var categorySummary = ensureSheet_(spreadsheet, APP_CONFIG.categorySummarySheetName, APP_CONFIG.categorySummaryHeaders);
  var reminderLog = ensureSheet_(spreadsheet, APP_CONFIG.reminderLogSheetName, APP_CONFIG.reminderHeaders);
  return {
    spreadsheet: spreadsheet,
    usageLog: usageLog,
    dailySummary: dailySummary,
    categorySummary: categorySummary,
    reminderLog: reminderLog
  };
}

function ensureSheet_(spreadsheet, sheetName, headers) {
  var sheet = spreadsheet.getSheetByName(sheetName) || spreadsheet.insertSheet(sheetName);
  ensureHeaders_(sheet, headers);
  return sheet;
}

function appendLogRow_(row) {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var sheets = getOrCreateUsageLogNoLock_();
    var nextRow = getLastRow_(sheets.usageLog) + 1;
    sheets.usageLog.getRange(nextRow, 1, 1, APP_CONFIG.usageHeaders.length).setValues([row]);
    refreshSummarySheets_(sheets, new Date(row[1]).toISOString());
  } finally {
    lock.releaseLock();
  }
}


function tryAppendReminderLogRow_(row) {
  try {
    appendReminderLogRow_(row);
    return true;
  } catch (error) {
    return false;
  }
}

function appendReminderLogRow_(row) {
  var lock = LockService.getScriptLock();
  var hasLock = false;
  try {
    hasLock = typeof lock.tryLock === 'function' ? lock.tryLock(1500) : true;
    if (!hasLock) {
      appendReminderLogRowNoLock_(row);
      return;
    }
    if (typeof lock.tryLock !== 'function') {
      lock.waitLock(1500);
    }
    appendReminderLogRowNoLock_(row);
  } finally {
    if (hasLock) {
      lock.releaseLock();
    }
  }
}

function appendReminderLogRowNoLock_(row) {
  var sheets = getOrCreateUsageLogNoLock_();
  var nextRow = getLastRow_(sheets.reminderLog) + 1;
  sheets.reminderLog.getRange(nextRow, 1, 1, APP_CONFIG.reminderHeaders.length).setValues([row]);
}

function buildReminderLogRow_(id, timestamp, request, category, reminderDate, deliveryStatus, deliveryReference) {
  return [
    id,
    timestamp,
    request.sessionId,
    category.title,
    reminderDate.toISOString(),
    getEmailDomain_(request.email),
    deliveryStatus,
    deliveryReference || ''
  ];
}

function sendReminderEmail_(email, category, reminderDate) {
  MailApp.sendEmail(
    email,
    APP_CONFIG.reminderTitle,
    buildReminderEmailBody_(category, reminderDate),
    { name: APP_CONFIG.businessName }
  );
}

function buildReminderEmailBody_(category, reminderDate) {
  return [
    'Your Dublin Cleaners reminder is set for: ' + formatReminderDate_(reminderDate),
    '',
    'Want this on your calendar? Add a personal calendar reminder for the date above if you would like.',
    '',
    'Selected checklist: ' + category.title,
    '',
    'Bring these items:',
    '- ' + category.selectedItems.join('\n- '),
    '',
    'Forgotten items:',
    '- ' + category.forgottenItems.join('\n- '),
    '',
    'Smart add-on: ' + category.smartAddOn,
    'Best next step: ' + category.nextStep,
    '',
    'Dublin Cleaners phone: ' + APP_CONFIG.businessPhone,
    'Dublin Cleaners address: ' + APP_CONFIG.businessAddress
  ].join('\n');
}


function formatReminderDate_(date) {
  return Utilities.formatDate(date, APP_CONFIG.timeZone, "EEEE, MMMM d, yyyy 'at' h:mm a");
}

function normalizeReminderRequest_(request) {
  var source = request && typeof request === 'object' ? request : {};
  return {
    email: sanitizeText_(source.email || '', 254).toLowerCase(),
    category: sanitizeText_(source.category || '', 80),
    reminderDate: sanitizeText_(source.reminderDate || '', 40),
    sessionId: sanitizeText_(source.sessionId || '', 80)
  };
}

function isValidEmail_(email) {
  if (!email || email.length > 254 || email.indexOf('..') !== -1) {
    return false;
  }
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}

function getEmailDomain_(email) {
  var parts = String(email || '').toLowerCase().split('@');
  return parts.length === 2 ? sanitizeText_(parts[1], 120) : '';
}

function resolveReminderDate_(value) {
  var key = sanitizeText_(value || '', 40);
  if (['tomorrow', 'weekend', 'next_week'].indexOf(key) === -1) {
    return null;
  }

  var now = new Date();
  var target = new Date(now.getTime());
  if (key === 'tomorrow') {
    target.setDate(target.getDate() + 1);
  } else if (key === 'weekend') {
    var day = target.getDay();
    var daysUntilSaturday = (6 - day + 7) % 7;
    target.setDate(target.getDate() + (daysUntilSaturday || 7));
  } else if (key === 'next_week') {
    target.setDate(target.getDate() + 7);
  }
  target.setHours(9, 0, 0, 0);
  return target;
}

function ensureHeaders_(sheet, headers) {
  var headerRange = sheet.getRange(1, 1, 1, headers.length);
  var currentHeaders = headerRange.getValues()[0];
  var needsHeaders = currentHeaders.join('') === '' || currentHeaders.join('|') !== headers.join('|');
  if (needsHeaders) {
    headerRange.setValues([headers]);
    sheet.setFrozenRows(1);
  }
}

function buildLogRow_(request, category) {
  var auditNotes = category ? 'anonymous kiosk selection; server category matched' : 'anonymous kiosk action';
  return [
    Utilities.getUuid(),
    new Date().toISOString(),
    request.sessionId,
    sanitizeText_(request.deviceLabel || APP_CONFIG.defaultDeviceLabel, 80),
    request.displayMode,
    request.action,
    category ? category.title : '',
    category ? category.selectedItems.join(', ') : '',
    category ? category.forgottenItems.join(', ') : '',
    category ? category.smartAddOn : '',
    category ? category.nextStep : '',
    sanitizeText_(request.userAgent || '', 300),
    request.viewportWidth,
    request.viewportHeight,
    request.orientation,
    request.touchCapable,
    sanitizeText_(request.referrer || '', 300),
    auditNotes
  ];
}

function refreshSummarySheets_(sheets, timestamp) {
  var rows = readUsageRows_(sheets.usageLog);
  writeSummaryRows_(sheets.dailySummary, APP_CONFIG.dailySummaryHeaders, buildDailySummaryRows_(rows, timestamp));
  writeSummaryRows_(sheets.categorySummary, APP_CONFIG.categorySummaryHeaders, buildCategorySummaryRows_(rows, timestamp));
}

function readUsageRows_(sheet) {
  var lastRow = getLastRow_(sheet);
  if (lastRow < 2) {
    return [];
  }
  return sheet.getRange(2, 1, lastRow - 1, APP_CONFIG.usageHeaders.length).getValues();
}

function buildDailySummaryRows_(rows, timestamp) {
  var byDate = {};
  for (var i = 0; i < rows.length; i += 1) {
    var row = rows[i];
    var date = String(row[1] || '').slice(0, 10);
    if (!date) {
      continue;
    }
    if (!byDate[date]) {
      byDate[date] = { appLoads: 0, categorySelections: 0, sessions: {}, saves: 0, resets: 0, categories: {}, kiosk: 0, mobile: 0, desktop: 0 };
    }
    var summary = byDate[date];
    var action = row[5];
    var sessionId = row[2];
    var displayMode = row[4];
    var category = row[6];
    if (action === 'app_loaded') {
      summary.appLoads += 1;
      if (displayMode === 'kiosk') {
        summary.kiosk += 1;
      } else if (displayMode === 'mobile') {
        summary.mobile += 1;
      } else if (displayMode === 'desktop') {
        summary.desktop += 1;
      }
    }
    if (action === 'category_selected') {
      summary.categorySelections += 1;
      if (category) {
        summary.categories[category] = (summary.categories[category] || 0) + 1;
      }
    }
    if (action === 'save_list_opened') {
      summary.saves += 1;
    }
    if (action === 'reset_tapped') {
      summary.resets += 1;
    }
    if (sessionId) {
      summary.sessions[sessionId] = true;
    }
  }

  return Object.keys(byDate).sort().map(function(date) {
    var summary = byDate[date];
    return [date, summary.appLoads, summary.categorySelections, Object.keys(summary.sessions).length, summary.saves, summary.resets, getTopKey_(summary.categories), summary.kiosk, summary.mobile, summary.desktop, timestamp];
  });
}

function buildCategorySummaryRows_(rows, timestamp) {
  var totalSelections = 0;
  var byCategory = {};
  Object.keys(CHECKLISTS).forEach(function(key) {
    var category = CHECKLISTS[key];
    byCategory[category.title] = { count: 0, lastSelectedAt: '', smartAddOn: category.smartAddOn };
  });

  for (var i = 0; i < rows.length; i += 1) {
    var row = rows[i];
    if (row[5] !== 'category_selected' || !row[6]) {
      continue;
    }
    totalSelections += 1;
    if (!byCategory[row[6]]) {
      byCategory[row[6]] = { count: 0, lastSelectedAt: '', smartAddOn: row[9] || '' };
    }
    byCategory[row[6]].count += 1;
    byCategory[row[6]].lastSelectedAt = row[1] || byCategory[row[6]].lastSelectedAt;
    byCategory[row[6]].smartAddOn = row[9] || byCategory[row[6]].smartAddOn;
  }

  return Object.keys(byCategory).sort().map(function(category) {
    var summary = byCategory[category];
    var percent = totalSelections ? summary.count / totalSelections : 0;
    return [category, summary.count, summary.lastSelectedAt, percent, summary.smartAddOn, timestamp];
  });
}

function writeSummaryRows_(sheet, headers, rows) {
  ensureHeaders_(sheet, headers);
  var lastRow = getLastRow_(sheet);
  if (lastRow > 1) {
    sheet.getRange(2, 1, lastRow - 1, headers.length).clearContent();
  }
  if (rows.length) {
    sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
  }
}

function getTopKey_(counts) {
  var top = '';
  var topCount = 0;
  Object.keys(counts).forEach(function(key) {
    if (counts[key] > topCount) {
      top = key;
      topCount = counts[key];
    }
  });
  return top;
}

function getLastRow_(sheet) {
  if (typeof sheet.getLastRow === 'function') {
    return sheet.getLastRow();
  }
  return sheet.state && sheet.state.rows ? sheet.state.rows.length : 0;
}

function normalizeRequest_(request) {
  var source = request && typeof request === 'object' ? request : {};
  return {
    action: sanitizeText_(source.action || '', 40),
    category: sanitizeText_(source.category || '', 80),
    sessionId: sanitizeText_(source.sessionId || '', 80),
    deviceLabel: sanitizeText_(source.deviceLabel || APP_CONFIG.defaultDeviceLabel, 80),
    displayMode: normalizeDisplayMode_(source.displayMode),
    userAgent: sanitizeText_(source.userAgent || '', 300),
    viewportWidth: normalizePositiveInteger_(source.viewportWidth),
    viewportHeight: normalizePositiveInteger_(source.viewportHeight),
    orientation: normalizeOrientation_(source.orientation),
    touchCapable: source.touchCapable === true,
    referrer: sanitizeText_(source.referrer || '', 300)
  };
}

function normalizeDisplayMode_(value) {
  var mode = sanitizeText_(value || '', 20);
  return ['kiosk', 'mobile', 'desktop'].indexOf(mode) === -1 ? 'desktop' : mode;
}

function normalizeOrientation_(value) {
  var orientation = sanitizeText_(value || '', 20);
  return ['portrait', 'landscape'].indexOf(orientation) === -1 ? '' : orientation;
}

function normalizePositiveInteger_(value) {
  var number = parseInt(value, 10);
  if (!isFinite(number) || number < 0) {
    return '';
  }
  return Math.min(number, 10000);
}

function validateAction_(action) {
  if (APP_CONFIG.allowedActions.indexOf(action) === -1) {
    throw new Error('Invalid app action.');
  }
}

function validateAnonymousOnly_(request) {
  var blockedKeys = ['name', 'email', 'phone', 'customerName', 'customerEmail', 'customerPhone', 'customerDetails'];
  for (var i = 0; i < blockedKeys.length; i += 1) {
    if (Object.prototype.hasOwnProperty.call(request, blockedKeys[i])) {
      throw new Error('Customer details are not collected by this kiosk.');
    }
  }
}

function getCategoryById_(categoryId) {
  return CHECKLISTS[categoryId] || null;
}

function getPublicCategories_() {
  return Object.keys(CHECKLISTS).map(function(key) {
    var category = CHECKLISTS[key];
    return {
      id: category.id,
      title: escapeHtml_(category.title),
      icon: escapeHtml_(category.icon),
      helperText: escapeHtml_(category.helperText),
      selectedItems: category.selectedItems.map(escapeHtml_),
      forgottenItems: category.forgottenItems.map(escapeHtml_),
      smartAddOn: escapeHtml_(category.smartAddOn),
      nextStep: escapeHtml_(category.nextStep)
    };
  });
}

function sanitizeText_(value, maxLength) {
  var text = String(value == null ? '' : value).replace(/[\u0000-\u001f\u007f]/g, ' ').trim();
  return text.slice(0, maxLength);
}

function escapeHtml_(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
