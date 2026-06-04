# SuperBloom — Electron Desktop App

A thin Electron wrapper that packages the SuperBloom web app as a native desktop application for Windows, macOS, and Linux.

## How It Works

The desktop app doesn't contain its own UI code. Instead:

1. The root project builds the SvelteKit app in "electron" mode (`npm run build:electron` from the repo root)
2. The build output is placed into `electron-app/app/`
3. Electron loads `app/index.html` as a local file in a BrowserWindow

This keeps the web and desktop versions in sync — the Electron shell is purely a host.

## Prerequisites

- [Node.js](https://nodejs.org/) 18+
- The web assets must be built first (see below)

## Setup

From the **repository root**:

```bash
# Install web project dependencies
npm install

# Build the web assets for Electron
npm run build:electron
```

Then, in this directory:

```bash
cd electron-app
npm install
```

## Development

```bash
npm start
```

This launches Electron and loads the pre-built `app/index.html`. DevTools are available in development mode (when not packaged).

To iterate on the UI, rebuild the web assets from the root whenever you make changes:

```bash
# From repo root
npm run build:electron

# Then back in electron-app/
npm start
```

## Packaging

Build distributable installers with electron-builder:

```bash
npm run build-win32    # Windows — NSIS installer → dist/
npm run build-darwin   # macOS — zip archive → dist/
npm run build-linux    # Linux — .deb package → dist/
npm run build-all      # All platforms (requires cross-platform tooling or CI)
```

Output goes to `dist/`.

## Project Structure

```
electron-app/
├── main.js          # Electron main process — creates the BrowserWindow
├── package.json     # Dependencies, scripts, and electron-builder config
├── app/             # (generated) Web build output served by Electron
│   ├── index.html   # Entry point loaded by BrowserWindow
│   └── _app/        # SvelteKit immutable assets (JS, CSS, images)
├── resources/       # Icons used by electron-builder for app packaging
│   ├── icon.png     # Default app icon (256x256+ recommended)
│   └── icons/       # Platform-specific icon sizes
└── dist/            # (generated) Packaged installers
```

## Configuration

All electron-builder configuration lives in `package.json` under the `"build"` key:

- **`files`** — only `main.js` and `app/**/*` are included in the packaged app
- **`win.target`** — NSIS installer
- **`mac.target`** — zip archive
- **`linux.target`** — .deb package
- **`directories.buildResources`** — points to `resources/` for icons

## Notes

- `app/` and `dist/` are gitignored — they are generated artifacts
- `package-lock.json` is also gitignored (consider committing it for reproducible builds)
- The `version` in this `package.json` should be kept in sync with the root project version for release tagging
