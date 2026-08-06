# X Thread PDF Exporter

A small Chrome extension that captures an entire X (Twitter) thread — including replies that only load as you scroll — and exports it to PDF.

X only renders replies into the DOM as you scroll, so a simple "print page" misses most of a long thread. This extension solves that by:

1. **Intercepting network traffic** (`fetch` and `XHR`) for `TweetDetail`/GraphQL responses and parsing out every post X sends back, even ones that never get scrolled into view.
2. **Auto-scrolling the page** and harvesting any posts visible in the DOM along the way, as a fallback/supplement to the network capture.
3. **Building a clean, print-friendly overlay** of all captured posts and triggering the browser's native print-to-PDF dialog.

> **Privacy by design:** the extension has no `host_permissions` at all — it only ever runs via `activeTab`, only on tabs you explicitly invoke it on, and its content script is scoped to `x.com`/`twitter.com` in the manifest. It cannot read any other site you visit, has no network access of its own, and sends nothing anywhere — see [Privacy & Permissions](#privacy--permissions) below.

## Installation

This extension is not published on the Chrome Web Store — install it as an unpacked extension:

1. Download or clone this repository.
2. Open `chrome://extensions` in Chrome.
3. Enable **Developer mode** (top right).
4. Click **Load unpacked** and select the folder containing this repo.

## Usage

1. Navigate to a thread on `x.com` or `twitter.com` (the post detail page, with replies visible).
2. Click the extension icon in your toolbar.
3. The page will auto-scroll to load and capture all replies — a status badge shows progress.
4. Once capturing finishes, your browser's print dialog opens with a formatted version of the thread. Choose **Save as PDF** as the destination.

## How it works

| File | Role |
|---|---|
| [manifest.json](manifest.json) | Manifest V3 config: permissions, and registers the content script. |
| [content.js](content.js) | Injected at `document_start` into the page's main world. Wraps `window.fetch` and `XMLHttpRequest` to snoop on X's own GraphQL calls and extract tweet data (id, author, text, avatar, timestamp) into a shared in-memory map. |
| [background.js](background.js) | Service worker that runs when you click the extension icon. Auto-scrolls the page to trigger loading of more replies, harvests any posts visible in the DOM as a fallback, then renders all captured posts into a print-only overlay and calls `window.print()`. |

No data ever leaves your browser — everything is read from responses your browser already received from X and rendered locally into the print dialog.

## Privacy & Permissions

This extension is intentionally scoped as narrowly as Chrome allows:

- **`activeTab`** — grants access only to the specific tab you're currently viewing, and only after you click the extension's icon. It cannot act in the background or on tabs you haven't interacted with.
- **`scripting`** — lets the extension inject its capture-and-print logic into that active tab when invoked. Nothing runs unless you click the icon.
- **Content script scope** — [manifest.json](manifest.json) restricts `content.js` to `https://x.com/*` and `https://twitter.com/*` only. The extension has no visibility into any other site you browse.
- **No `host_permissions`** — the extension does not request always-on access to any domain, including X itself. It cannot read or run on `x.com` in the background; it only activates in the current tab on demand.
- **No remote network calls** — the extension makes no requests of its own. It only reads responses your browser already received from X (via `fetch`/`XHR` interception) and reads posts already rendered in the page DOM.
- **No data collection or transmission** — everything captured is held in an in-memory `Map` in the page and rendered directly into your browser's local print/PDF dialog. Nothing is written to disk, sent to a server, or persisted anywhere outside that print output.

## Limitations

- Depends on X's current GraphQL response shape and DOM structure (`data-testid` attributes, etc.), so it may break if X changes its frontend.
- Very long threads take time to auto-scroll through — the extension waits for the page to stop growing before finishing.
- Media (images/videos) attached to posts are not currently included in the export, only text, author info, and avatars.

## License

[MIT](LICENSE)
