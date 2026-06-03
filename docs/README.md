# Dublin Cleaners — What Should I Bring Next?

“What Should I Bring Next?” is a Google Apps Script HTMLService web app for an in-store Dublin Cleaners vertical touchscreen. It gives customers a fast, premium checklist based on a real-life situation.

## Public web app deployment model

Deploy the Apps Script project as a Web App:

- **Execute as:** Me
- **Who has access:** Anyone with the link

This is intentional for a controlled in-store kiosk. Customers should not need to sign in, and staff should not need to unlock the normal touchscreen flow.

## Kiosk-safe access flow

1. The customer sees the Dublin Cleaners branded loading screen immediately.
2. The loading screen shows “Preparing your workspace…” and a UX-paced 3–5 second countdown.
3. The shell UI renders from inline HTML/CSS and a bundled fallback dataset.
4. Apps Script hydrates the same pre-approved checklist content after paint.
5. Tapping a situation shows the checklist and logs one anonymous event server-side.

The app does not show an unauthorized screen because the kiosk content is pre-approved and non-sensitive.

## Server-side data safety protections

- No login is required for kiosk use.
- No names, emails, phone numbers, or customer details are collected.
- Category selections are validated server-side against known category IDs.
- App actions are validated server-side against an allowlist.
- User-facing checklist data is escaped before being returned to the client.
- Sheet IDs and private configuration stay in Script Properties and are never sent to the browser.
- Sheet writes use `LockService` to reduce write collisions.
- All Sheets reads and writes happen in `Code.gs` only.

## Loading and performance strategy

- Critical CSS is included inline through `styles.html`.
- The first screen is static HTML, so the browser never shows a blank page.
- Category cards render from a local fallback payload right after paint.
- `google.script.run` hydration happens after the shell is visible.
- Server calls are batched: one payload call and small anonymous log calls only after meaningful user actions.
- Animations are limited to loading fade, tap/hover states, and the result panel transition.

## Sheets model

The app creates or reuses one spreadsheet stored in Script Properties under a private key. It creates or reuses the `ActivityLog` sheet with these columns:

| Column | Purpose |
| --- | --- |
| id | UUID for the anonymous event |
| timestamp | ISO timestamp |
| action | Allowed app action |
| category | Human-readable selected category |
| selectedItems | Server-side selected item list |
| forgottenItems | Server-side forgotten item list |
| smartAddOn | Server-side premium add-on |
| nextStep | Server-side recommended next step |
| deviceLabel | Anonymous kiosk/device label |
| userAgent | Browser user agent string |
| auditNotes | Anonymous logging note |

## Setup steps

1. Create a Google Apps Script project.
2. Add these files to the project: `appsscript.json`, `Code.gs`, `index.html`, `print.html`, `styles.html`, and `scripts.html`.
3. Confirm the manifest uses `ANYONE_ANONYMOUS` access and `USER_DEPLOYING` execution.
4. Open the Apps Script editor and run `getAppPayload` once if you want to authorize the project before deployment.
5. Run `getOrCreateActivitySheet_` from the editor if you want to pre-create the activity spreadsheet.

## Deployment steps

1. In Apps Script, choose **Deploy > New deployment**.
2. Select **Web app**.
3. Set **Execute as** to **Me**.
4. Set **Who has access** to **Anyone with the link**.
5. Deploy and copy the Web App URL.
6. Open the URL on the in-store touchscreen browser in full-screen/kiosk mode.

## Testing instructions

From this repository, run:

```bash
node test/code.test.js
```

The tests mock Apps Script services and validate kiosk access assumptions, payload shape, sheet creation/reuse, anonymous logging, valid/invalid category handling, server-side category validation, and checklist data integrity.
