# WhatShIBringNxt

Important: This is not a desktop web app. Design and code it as a portrait-first vertical touchscreen kiosk for a 1080×1920 in-store monitor.

## Kiosk layout verification notes

- Primary target is a 1080px × 1920px portrait in-store touchscreen monitor.
- The app shell is capped at the kiosk width and remains centered on larger screens instead of becoming a desktop dashboard.
- The main experience is organized as a top brand/header area, middle 2-column × 3-row situation grid, and bottom result/CTA panel.
- All situation choices and reset actions are buttons with at least 72px tap targets and click/tap handlers; no primary action depends on hover, keyboard input, or customer form fields.
- Mobile stacks to one column with normal vertical scrolling and simplified save/QR space.
- Desktop and laptop browsers center the customer-facing experience inside a vertical kiosk preview frame with a subtle surrounding background, not a dashboard.
- Client-side display detection is layout-only; it does not control access, data permissions, or security.

## Manual adaptive display checks

- **1080×1920 kiosk portrait:** Confirm the body receives `data-display-mode="kiosk"`, the 2-column × 3-row situation grid fits without main-flow scrolling, the result panel remains visible in the lower portion, and reset/save actions are large enough for touch.
- **iPhone/Android portrait:** Confirm the body receives `data-display-mode="mobile"`, the logo is smaller, cards stack in one column, the result content appears below the selected card flow, normal vertical scrolling works, and the QR/save area is hidden if space is tight.
- **Desktop browser landscape:** Confirm the body receives `data-display-mode="desktop"`, the app is centered in a vertical kiosk-style frame with the optional “Kiosk Preview” label, and it never expands into a wide dashboard.
- **Desktop browser resized narrow:** Confirm the layout uses the mobile one-column stack at widths of 700px or less without introducing a hover-only or keyboard-only action.
- **Tablet portrait:** Confirm portrait tablet dimensions use the kiosk/tablet portrait CSS, preserve large tap targets, and remain customer-facing.
- **No hover dependency:** Confirm every customer flow can be completed with tap/click events and visible selected states.
- **Touch-only use:** Confirm choosing a situation and resetting the checklist works without mouse, keyboard, or text entry.

## Testing

Run the Apps Script unit checks with:

```sh
node test/code.test.js
```
