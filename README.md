# Full Page & Element Screenshot

A Chrome/Edge browser extension that captures **full-page screenshots** —
including content that lives inside its own scrollable panel (e.g. a code
box, chat log, or embedded viewer with its own scrollbar), which standard
"capture visible tab" screenshots cut off.

It auto-detects whether the page itself or an inner panel is the thing that
actually scrolls, smoothly scrolls it to the bottom while capturing, and
stitches everything into a single PNG.

## Features

- **Auto Capture** — one click. Detects the right scroll target (page vs.
  inner panel) automatically and captures the whole thing.
- **Full-page capture** — scrolls the entire page top to bottom and stitches
  one image, for normal long pages.
- **Element picker** — hover to highlight any scrollable element on the page,
  click it, and only that element is scrolled and captured. Useful as a
  manual override when a page has more than one large scrollable area.
- No external dependencies, no network calls — everything happens locally in
  the browser tab.

## Installation

1. Clone or download this repository.
2. Open `chrome://extensions` (or `edge://extensions`) in your browser.
3. Enable **Developer mode** (top right).
4. Click **Load unpacked** and select the [`screenshot-extension`](screenshot-extension) folder.
5. Pin the extension icon to your toolbar for quick access.

## Usage

Click the extension icon on any page, then pick a mode:

| Button | What it does |
|---|---|
| **Auto Capture** | Detects whether the page or an inner panel scrolls, and captures it. Use this first. |
| **Capture Full Page (manual)** | Always captures the page itself, ignoring inner scrollable panels. |
| **Pick Scrollable Element…** | Closes the popup; hover the page to highlight scrollable elements in red, click one to capture just that element. Press `Esc` to cancel. |

The finished screenshot downloads automatically as `screenshot-<timestamp>.png`.

## How it works

Browsers can only screenshot what's currently visible in the viewport. This
extension works around that by:

1. Measuring the total scrollable height of the target (page or element).
2. Smoothly scrolling it in viewport-sized steps, waiting for each scroll to
   settle.
3. Capturing a screenshot at each step via `chrome.tabs.captureVisibleTab`.
4. Cropping each capture to the target's on-screen region and drawing it onto
   one tall canvas at the correct vertical offset.
5. Exporting the stitched canvas as a PNG download.

This is the same general technique used by other full-page screenshot tools,
extended here to work on **any** scrollable element, not just the page.

## Permissions

- `activeTab` — only used to read/capture the tab you click the extension on.
- `scripting` — used to inject the content script that does the scrolling and
  capturing.

No host permissions, no background network access, no data leaves your
browser.

## Project structure

```
screenshot-extension/
├── manifest.json    # Extension manifest (MV3)
├── background.js    # Service worker — handles captureVisibleTab calls
├── content.js        # Injected into the page: detection, scrolling, capture, stitching
├── popup.html         # Extension popup UI
└── popup.js           # Popup button wiring
```

## Known limitations

- Sticky/fixed elements (headers, floating buttons) repeat in every slice of
  a full-page capture, since they stay pinned to the viewport while the page
  scrolls.
- Horizontal scrolling isn't handled, only vertical.
- Large pages/panels take a few seconds, since Chrome rate-limits how
  frequently screenshots can be taken.

## Contributing

Issues and pull requests are welcome.
