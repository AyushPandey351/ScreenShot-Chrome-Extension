# Full Page & Element Screenshot

Chrome/Edge extension that captures full-page screenshots, including content
that scrolls inside its own panel (like a code box with an internal scrollbar).

## Install (unpacked)

1. Open `chrome://extensions` (or `edge://extensions`).
2. Turn on **Developer mode** (top right).
3. Click **Load unpacked** and select this `screenshot-extension` folder.
4. Pin the extension icon for easy access.

## Use

- **Auto Capture** (recommended): automatically figures out whether the page
  itself or an inner panel (e.g. a code box with its own scrollbar) is the
  thing that actually scrolls, smoothly scrolls it to the bottom while
  capturing, then stitches the full content into one PNG.
- **Capture Full Page (manual)**: always targets the page itself, ignoring
  any inner scrollable panels.
- **Pick Scrollable Element…**: closes the popup, hover the page — any element
  with its own scrollbar gets a red outline. Click it to force that element as
  the capture target. Press `Esc` to cancel picking.

Use the manual buttons only if Auto Capture picks the wrong area (e.g. a page
has more than one large scrollable panel).

The result downloads automatically as `screenshot-<timestamp>.png`.

## How it works

Chrome's screenshot API only captures what's visible in the viewport. This
extension scrolls in viewport-sized steps, takes a capture at each step, crops
each capture to the target region, and draws the slices onto one tall canvas
at the right vertical offset — the same technique full-page screenshot tools
use, extended to work on any scrollable element, not just the page.

## Known limitations

- Sticky/fixed elements (headers, floating buttons) will repeat in every slice
  of a full-page capture, since they stay pinned to the viewport while the
  page scrolls.
- Horizontal scrolling isn't handled, only vertical.
- Very long pages/panels take a few seconds since Chrome rate-limits how fast
  screenshots can be taken (~300ms between captures here).
