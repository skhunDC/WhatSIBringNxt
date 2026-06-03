/**
 * Dublin Cleaners — What Should I Bring Next?
 * Google Apps Script HTMLService backend.
 */

var APP_CONFIG = Object.freeze({
  appName: 'What Should I Bring Next?',
  businessName: 'Dublin Cleaners',
  established: '1934',
  logoUrl: 'https://www.dublincleaners.com/wp-content/uploads/2024/12/Dublin-Logos-stacked.png',
  spreadsheetPropertyKey: 'DUBLIN_CLEANERS_KIOSK_SPREADSHEET_ID',
  sheetName: 'ActivityLog',
  defaultDeviceLabel: 'In-store touchscreen',
  allowedActions: ['app_ready', 'category_selected', 'save_list_opened', 'print_view_opened'],
  headers: [
    'id',
    'timestamp',
    'action',
    'category',
    'selectedItems',
    'forgottenItems',
    'smartAddOn',
    'nextStep',
    'deviceLabel',
    'userAgent',
    'auditNotes'
  ]
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
    title: 'Traveling Soon',
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
  if (cleanRequest.action === 'category_selected' && !category) {
    throw new Error('Invalid category selection.');
  }

  var row = buildLogRow_(cleanRequest, category);
  appendLogRow_(row);

  return {
    ok: true,
    id: row[0],
    action: row[2],
    category: row[3],
    auditNotes: row[10]
  };
}

function getOrCreateActivitySheet_() {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    return getOrCreateActivitySheetNoLock_();
  } finally {
    lock.releaseLock();
  }
}

function getOrCreateActivitySheetNoLock_() {
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
    spreadsheet = SpreadsheetApp.create(APP_CONFIG.businessName + ' Kiosk Activity');
    props.setProperty(APP_CONFIG.spreadsheetPropertyKey, spreadsheet.getId());
  }

  var sheet = spreadsheet.getSheetByName(APP_CONFIG.sheetName) || spreadsheet.insertSheet(APP_CONFIG.sheetName);
  ensureHeaders_(sheet);
  return sheet;
}

function appendLogRow_(row) {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var sheet = getOrCreateActivitySheetNoLock_();
    sheet.appendRow(row);
  } finally {
    lock.releaseLock();
  }
}

function ensureHeaders_(sheet) {
  var headerRange = sheet.getRange(1, 1, 1, APP_CONFIG.headers.length);
  var currentHeaders = headerRange.getValues()[0];
  var needsHeaders = currentHeaders.join('') === '' || currentHeaders.join('|') !== APP_CONFIG.headers.join('|');
  if (needsHeaders) {
    headerRange.setValues([APP_CONFIG.headers]);
    sheet.setFrozenRows(1);
  }
}

function buildLogRow_(request, category) {
  var auditNotes = category ? 'anonymous kiosk selection; server category matched' : 'anonymous kiosk action';
  return [
    Utilities.getUuid(),
    new Date().toISOString(),
    request.action,
    category ? category.title : '',
    category ? category.selectedItems.join(', ') : '',
    category ? category.forgottenItems.join(', ') : '',
    category ? category.smartAddOn : '',
    category ? category.nextStep : '',
    sanitizeText_(request.deviceLabel || APP_CONFIG.defaultDeviceLabel, 80),
    sanitizeText_(request.userAgent || '', 300),
    auditNotes
  ];
}

function normalizeRequest_(request) {
  var source = request && typeof request === 'object' ? request : {};
  return {
    action: sanitizeText_(source.action || '', 40),
    category: sanitizeText_(source.category || '', 80),
    deviceLabel: sanitizeText_(source.deviceLabel || APP_CONFIG.defaultDeviceLabel, 80),
    userAgent: sanitizeText_(source.userAgent || '', 300)
  };
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
