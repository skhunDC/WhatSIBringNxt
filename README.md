# WhatShIBringNxt

Important: This is not a desktop web app. Design and code it as a portrait-first vertical touchscreen kiosk for a 1080×1920 in-store monitor.

## Kiosk layout verification notes

- Primary target is a 1080px × 1920px portrait in-store touchscreen monitor.
- The app shell is capped at the kiosk width and remains centered on larger screens instead of becoming a desktop dashboard.
- The main experience is organized as a top brand/header area, middle 2-column × 3-row situation grid, and bottom result/CTA panel.
- All situation choices and reset actions are buttons with at least 72px tap targets and click/tap handlers; no primary action depends on hover, keyboard input, or customer form fields.
- Mobile can stack to one column, but large displays keep the portrait kiosk frame rather than stretching into wide horizontal layouts.

## Testing

Run the Apps Script unit checks with:

```sh
node test/code.test.js
```
