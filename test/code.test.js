const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function makeSheet(name) {
  const state = {
    name,
    rows: [],
    frozenRows: 0
  };
  return {
    state,
    getRange(row, col, numRows, numCols) {
      return {
        getValues() {
          const values = [];
          for (let r = 0; r < numRows; r += 1) {
            const source = state.rows[row - 1 + r] || [];
            values.push(Array.from({ length: numCols }, (_, c) => source[col - 1 + c] || ''));
          }
          return values;
        },
        setValues(values) {
          values.forEach((valueRow, r) => {
            const targetIndex = row - 1 + r;
            state.rows[targetIndex] = state.rows[targetIndex] || [];
            valueRow.forEach((value, c) => {
              state.rows[targetIndex][col - 1 + c] = value;
            });
          });
        },
        clearContent() {
          for (let r = 0; r < numRows; r += 1) {
            const targetIndex = row - 1 + r;
            state.rows[targetIndex] = state.rows[targetIndex] || [];
            for (let c = 0; c < numCols; c += 1) {
              state.rows[targetIndex][col - 1 + c] = '';
            }
          }
        }
      };
    },
    setFrozenRows(count) {
      state.frozenRows = count;
    },
    appendRow(row) {
      state.rows.push(row);
    },
    getLastRow() {
      for (let i = state.rows.length - 1; i >= 0; i -= 1) {
        if ((state.rows[i] || []).some((value) => value !== '')) {
          return i + 1;
        }
      }
      return 0;
    }
  };
}

function makeSpreadsheet(id) {
  const sheets = {};
  return {
    id,
    getId() {
      return id;
    },
    getSheetByName(name) {
      return sheets[name] || null;
    },
    insertSheet(name) {
      sheets[name] = makeSheet(name);
      return sheets[name];
    },
    _sheets: sheets
  };
}

function loadCode() {
  const stores = {
    properties: {},
    spreadsheets: {},
    createCount: 0,
    locks: 0
  };
  const context = {
    console,
    Object,
    Date,
    String,
    Error,
    Utilities: {
      getUuid() {
        return `uuid-${stores.createCount}-${Math.random().toString(16).slice(2)}`;
      }
    },
    LockService: {
      getScriptLock() {
        return {
          waitLock() {
            stores.locks += 1;
          },
          releaseLock() {
            stores.locks -= 1;
          }
        };
      }
    },
    PropertiesService: {
      getScriptProperties() {
        return {
          getProperty(key) {
            return stores.properties[key] || null;
          },
          setProperty(key, value) {
            stores.properties[key] = value;
          }
        };
      }
    },
    SpreadsheetApp: {
      create(name) {
        stores.createCount += 1;
        const spreadsheet = makeSpreadsheet(`spreadsheet-${stores.createCount}`);
        spreadsheet.name = name;
        stores.spreadsheets[spreadsheet.id] = spreadsheet;
        return spreadsheet;
      },
      openById(id) {
        if (!stores.spreadsheets[id]) {
          throw new Error('Spreadsheet not found');
        }
        return stores.spreadsheets[id];
      }
    },
    HtmlService: {
      XFrameOptionsMode: { ALLOWALL: 'ALLOWALL' },
      createTemplateFromFile(file) {
        return {
          evaluate() {
            return this;
          },
          setTitle(title) {
            this.title = title;
            return this;
          },
          setXFrameOptionsMode(mode) {
            this.xFrameMode = mode;
            return this;
          },
          addMetaTag(name, content) {
            this.meta = { name, content };
            return this;
          },
          file
        };
      },
      createHtmlOutputFromFile(file) {
        return {
          getContent() {
            return fs.readFileSync(path.join(__dirname, '..', `${file}.html`), 'utf8');
          }
        };
      }
    }
  };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'Code.gs'), 'utf8'), context);
  context.__stores = stores;
  return context;
}

function test(name, fn) {
  try {
    fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    console.error(error);
    process.exitCode = 1;
  }
}

test('manifest supports public kiosk access without login', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'appsscript.json'), 'utf8'));
  assert.strictEqual(manifest.webapp.executeAs, 'USER_DEPLOYING');
  assert.strictEqual(manifest.webapp.access, 'ANYONE_ANONYMOUS');
});

test('doGet loads the app without user-based authorization gates', () => {
  const app = loadCode();
  const output = app.doGet({ parameter: {} });
  assert.strictEqual(output.file, 'index');
  assert.strictEqual(output.xFrameMode, 'ALLOWALL');
  assert.match(output.title, /What Should I Bring Next/);
});

test('payload shape contains six complete categories and no private sheet id', () => {
  const app = loadCode();
  const payload = app.getAppPayload();
  assert.strictEqual(payload.categories.length, 6);
  assert.strictEqual(payload.deployment.loginRequired, false);
  assert.strictEqual(payload.deployment.storesCustomerData, false);
  assert.strictEqual(Object.prototype.hasOwnProperty.call(payload, 'spreadsheetId'), false);
  payload.categories.forEach((category) => {
    assert.ok(category.id);
    assert.ok(category.title);
    assert.strictEqual(category.selectedItems.length, 5);
    assert.strictEqual(category.forgottenItems.length, 3);
    assert.ok(category.helperText);
    assert.ok(category.smartAddOn);
    assert.ok(category.nextStep);
  });
});

test('result data integrity preserves exact MVP content', () => {
  const app = loadCode();
  const categories = app.getAppPayload().categories;
  const stain = categories.find((category) => category.id === 'stain_emergency');
  const laundry = categories.find((category) => category.id === 'laundry_overload');
  assert.strictEqual(JSON.stringify(stain.selectedItems), JSON.stringify(['Stained shirts', 'Dresses', 'Table linens', 'Jackets', 'Specialty fabrics']));
  assert.strictEqual(JSON.stringify(stain.forgottenItems), JSON.stringify(['Napkins', 'Matching pieces', 'Items they tried to spot-clean at home']));
  assert.strictEqual(stain.smartAddOn, 'Specialty stain treatment');
  assert.strictEqual(stain.nextStep, 'Bring it in today and don’t apply heat.');
  assert.strictEqual(laundry.smartAddOn, 'Wash and fold');
});

test('sheet creation creates headers and stores the sheet id server-side only', () => {
  const app = loadCode();
  const sheet = app.getOrCreateActivitySheet_();
  assert.strictEqual(app.__stores.createCount, 1);
  const spreadsheet = app.__stores.spreadsheets[app.__stores.properties[app.APP_CONFIG.spreadsheetPropertyKey]];
  assert.strictEqual(spreadsheet.name, app.APP_CONFIG.spreadsheetName);
  assert.strictEqual(JSON.stringify(sheet.state.rows[0]), JSON.stringify(app.APP_CONFIG.usageHeaders));
  assert.strictEqual(JSON.stringify(spreadsheet._sheets[app.APP_CONFIG.dailySummarySheetName].state.rows[0]), JSON.stringify(app.APP_CONFIG.dailySummaryHeaders));
  assert.strictEqual(JSON.stringify(spreadsheet._sheets[app.APP_CONFIG.categorySummarySheetName].state.rows[0]), JSON.stringify(app.APP_CONFIG.categorySummaryHeaders));
  assert.ok(app.__stores.properties[app.APP_CONFIG.spreadsheetPropertyKey]);
});

test('sheet reuse does not create a second spreadsheet', () => {
  const app = loadCode();
  const first = app.getOrCreateActivitySheet_();
  const second = app.getOrCreateActivitySheet_();
  assert.strictEqual(app.__stores.createCount, 1);
  assert.strictEqual(first, second);
});

test('valid category logging appends anonymous server-side checklist details', () => {
  const app = loadCode();
  const response = app.recordAppAction({
    action: 'category_selected',
    category: 'wedding_event',
    sessionId: 'anon-test-session',
    deviceLabel: 'Lobby kiosk',
    displayMode: 'kiosk',
    userAgent: 'Test Browser',
    viewportWidth: 1080,
    viewportHeight: 1920,
    orientation: 'portrait',
    touchCapable: true,
    referrer: 'https://example.test/start'
  });
  const sheet = app.getOrCreateActivitySheet_();
  const row = sheet.state.rows[1];
  assert.strictEqual(response.ok, true);
  assert.strictEqual(row[2], 'anon-test-session');
  assert.strictEqual(row[3], 'Lobby kiosk');
  assert.strictEqual(row[4], 'kiosk');
  assert.strictEqual(row[5], 'category_selected');
  assert.strictEqual(row[6], 'Wedding / Event');
  assert.match(row[7], /Suits/);
  assert.match(row[8], /Pocket squares/);
  assert.strictEqual(row[11], 'Test Browser');
  assert.strictEqual(row[12], 1080);
  assert.strictEqual(row[13], 1920);
  assert.strictEqual(row[14], 'portrait');
  assert.strictEqual(row[15], true);
  assert.strictEqual(row[16], 'https://example.test/start');
  assert.match(row[17], /anonymous/);
  const spreadsheet = app.__stores.spreadsheets[app.__stores.properties[app.APP_CONFIG.spreadsheetPropertyKey]];
  const dailyRow = spreadsheet._sheets[app.APP_CONFIG.dailySummarySheetName].state.rows[1];
  const categoryRow = spreadsheet._sheets[app.APP_CONFIG.categorySummarySheetName].state.rows.find((summaryRow) => summaryRow[0] === 'Wedding / Event');
  assert.strictEqual(dailyRow[2], 1);
  assert.strictEqual(dailyRow[3], 1);
  assert.strictEqual(dailyRow[6], 'Wedding / Event');
  assert.strictEqual(categoryRow[1], 1);
  assert.strictEqual(categoryRow[3], 1);
});

test('invalid category rejection proves server-side category validation', () => {
  const app = loadCode();
  assert.throws(() => {
    app.recordAppAction({ action: 'category_selected', category: 'not_real' });
  }, /Invalid category selection/);
});

test('invalid app action is rejected', () => {
  const app = loadCode();
  assert.throws(() => {
    app.recordAppAction({ action: 'delete_sheet', category: 'wedding_event' });
  }, /Invalid app action/);
});

test('anonymous-only logging rejects customer details', () => {
  const app = loadCode();
  assert.throws(() => {
    app.recordAppAction({ action: 'app_loaded', email: 'customer@example.com' });
  }, /Customer details are not collected/);
});

test('HTML renders the portrait kiosk shell immediately without a blocking workspace screen', () => {
  const index = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const scripts = fs.readFileSync(path.join(__dirname, '..', 'scripts.html'), 'utf8');
  assert.match(index, /portrait-first vertical touchscreen kiosk for a 1080×1920/);
  assert.match(index, /class=\"app-shell kiosk-frame kiosk-shell\"/);
  assert.match(index, /Loading fresh checklist data…/);
  assert.match(index, /Your quick checklist appears here/);
  assert.doesNotMatch(index, /primary-cta/);
  assert.match(scripts, /revealResultPanel/);
  assert.match(scripts, /scrollIntoView/);
});

test('CSS locks the primary experience to a portrait touchscreen kiosk frame', () => {
  const styles = fs.readFileSync(path.join(__dirname, '..', 'styles.html'), 'utf8');
  assert.match(styles, /--kiosk-width:\s*1080px/);
  assert.match(styles, /max-width:\s*var\(--kiosk-width\)/);
  assert.match(styles, /--space-shell:/);
  assert.match(styles, /--font-headline:/);
  assert.match(styles, /--card-min-height:/);
  assert.match(styles, /min-height:\s*100vh/);
  assert.match(styles, /grid-template-rows:\s*20svh 55svh 25svh/);
  assert.match(styles, /grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(styles, /--tap:\s*clamp\(56px, calc\(72px \* var\(--display-scale\)\), 82px\)/);
  assert.match(styles, /touch-action:\s*manipulation/);
  assert.match(styles, /user-select:\s*none/);
  assert.doesNotMatch(styles, /grid-template-columns:\s*repeat\(3/);
});

test('Scripts keep category selection touch-first with selected state, checklist reveal, and no keyboard dependency', () => {
  const scripts = fs.readFileSync(path.join(__dirname, '..', 'scripts.html'), 'utf8');
  assert.match(scripts, /card\.type = 'button'/);
  assert.match(scripts, /addEventListener\('click'/);
  assert.match(scripts, /aria-pressed/);
  assert.match(scripts, /is-selected/);
  assert.match(scripts, /requestAnimationFrame/);
  assert.match(scripts, /showCategory\(category\.id\)/);
  assert.match(scripts, /renderList\('selectedItems', category\.selectedItems\)/);
  assert.match(scripts, /byId\('checklistColumns'\)\.hidden = false/);
  assert.match(scripts, /revealResultPanel\(\)/);
  assert.match(scripts, /panel\.scrollIntoView/);
  assert.doesNotMatch(scripts, /prompt\(/);
  assert.doesNotMatch(scripts, /<input/);
});


test('Adaptive kiosk-first CSS exposes required shells, modes, breakpoints, and mobile stacking', () => {
  const index = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const styles = fs.readFileSync(path.join(__dirname, '..', 'styles.html'), 'utf8');
  assert.match(index, /app-shell/);
  assert.match(index, /kiosk-frame/);
  assert.match(index, /situation-grid/);
  assert.match(styles, /\.app-shell/);
  assert.match(styles, /\.kiosk-frame/);
  assert.match(styles, /\.situation-grid/);
  assert.match(styles, /\.result-panel/);
  assert.match(styles, /mode-kiosk/);
  assert.match(styles, /mode-mobile/);
  assert.match(styles, /mode-desktop/);
  assert.match(styles, /@media \(max-width:\s*700px\)/);
  assert.match(styles, /@media \(min-width:\s*701px\) and \(orientation:\s*portrait\)/);
  assert.match(styles, /@media \(min-width:\s*901px\) and \(orientation:\s*landscape\)/);
  assert.match(styles, /\.save-card \{ display: none; \}/);
  assert.match(index, /Kiosk Preview/);
});

test('Tap another situation resets the result and scrolls back to the page top', () => {
  const scripts = fs.readFileSync(path.join(__dirname, '..', 'scripts.html'), 'utf8');
  assert.match(scripts, /function scrollToPageTop\(\)/);
  assert.match(scripts, /window\.scrollTo\(\{\s*top: 0,\s*left: 0,\s*behavior: 'smooth'/);
  assert.match(scripts, /byId\('appShell'\)/);
  assert.match(scripts, /backButton\.addEventListener\('click', function\(\) \{\s*resetResult\('reset_tapped'\);\s*scrollToPageTop\(\);\s*resetInactivityTimer\(\);/);
});

test('detectDisplayMode reads viewport, pointer, touch, orientation, and updates responsive body state', () => {
  const scripts = fs.readFileSync(path.join(__dirname, '..', 'scripts.html'), 'utf8');
  assert.match(scripts, /function getViewportMetrics\(\)/);
  assert.match(scripts, /window\.visualViewport/);
  assert.match(scripts, /window\.innerWidth/);
  assert.match(scripts, /window\.innerHeight/);
  assert.match(scripts, /window\.screen/);
  assert.match(scripts, /window\.devicePixelRatio/);
  assert.match(scripts, /function classifyDevice\(metrics, pointerProfile\)/);
  assert.match(scripts, /matchMedia\("\(pointer: coarse\)"\)/);
  assert.match(scripts, /matchMedia\("\(pointer: fine\)"\)/);
  assert.match(scripts, /matchMedia\("\(hover: none\)"\)/);
  assert.match(scripts, /navigator\.maxTouchPoints/);
  assert.match(scripts, /navigator\.userAgent/);
  assert.match(scripts, /mode: 'mobile'/);
  assert.match(scripts, /mode: 'kiosk'/);
  assert.match(scripts, /mode: 'desktop'/);
  assert.match(scripts, /function calculateDisplayScale\(metrics, mode\)/);
  assert.match(scripts, /--viewport-width/);
  assert.match(scripts, /--viewport-height/);
  assert.match(scripts, /--display-scale/);
  assert.match(scripts, /body\.dataset\.displayMode = classification\.mode/);
  assert.match(scripts, /body\.dataset\.deviceType = classification\.deviceType/);
  assert.match(scripts, /body\.dataset\.screenResolution/);
  assert.match(scripts, /window\.addEventListener\("resize", scheduleViewportRefresh\)/);
  assert.match(scripts, /window\.addEventListener\("orientationchange", scheduleViewportRefresh\)/);
  assert.match(scripts, /window\.visualViewport\.addEventListener\("resize", scheduleViewportRefresh\)/);
  assert.match(scripts, /document\.addEventListener\("DOMContentLoaded", applyResponsiveViewport\)/);
  assert.doesNotMatch(scripts, /displayMode.*recordAppAction/);
});
