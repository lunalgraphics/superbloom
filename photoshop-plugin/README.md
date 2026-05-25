# SuperBloom — Photoshop Plugin

UXP plugin that brings SuperBloom's bloom/glow effect directly into Adobe Photoshop.

## How It Works

The plugin opens a panel in Photoshop with two actions:

- **New SuperBloom Layer** — flattens the active document into a temporary copy, sends the pixel data to a webview running the SuperBloom UI, and inserts the resulting bloom as a Smart Object layer with Screen blending.
- **Edit Selected Layer** — re-opens a previously created SuperBloom Smart Object so you can tweak the settings non-destructively.

The webview loads a static build of the main SuperBloom SvelteKit app (the `webview-contents/` folder). Communication between the UXP host and the webview happens via `postMessage`.

## Prerequisites

- Adobe Photoshop 2022 (v23.3) or later
- [UXP Developer Tool](https://developer.adobe.com/photoshop/uxp/2022/guides/devtool/installation/) for loading unpacked plugins during development

## Building

From the repository root:

```bash
npm install
npm run build:photoshop
```

This outputs the SvelteKit static build to `photoshop-plugin/webview-contents/`. The Vite build sets the `__IS_PHOTOSHOP_PLUGIN__` flag so the UI uses the Photoshop communication path.

## Loading the Plugin

1. Open the UXP Developer Tool
2. Click **Add Plugin** and select `photoshop-plugin/manifest.json`
3. Click **Load** to load the plugin into Photoshop
4. The SuperBloom panel appears under **Plugins → SuperBloom**

## File Structure

```
photoshop-plugin/
├── index.html          # UXP panel markup (buttons + dialog with webview)
├── index.js            # UXP host logic (pixel transfer, layer creation, Smart Object handling)
├── manifest.json       # UXP plugin manifest (permissions, entrypoints, version)
├── banner_glow.png     # Panel branding image
├── icons/              # Plugin icons at various scales
│   ├── icon@1x.png
│   ├── icon@2x.png
│   ├── icon@4x.png
│   └── publisher/      # Marketplace publisher icons
└── webview-contents/    # (generated) SvelteKit build output loaded by the webview
```

## Architecture Notes

- The plugin stores preset metadata inside a hidden text layer within the Smart Object. This allows "Edit Selected Layer" to recover the original settings.
- The webview runs the same SuperBloom UI as the standalone app, but exports raw pixel data back to the host instead of downloading a file.
- `webview-contents/` is a build artifact and should not be committed to version control. Run `npm run build:photoshop` to regenerate it.

## Permissions

The manifest requests:
- `webview` — to render the SuperBloom UI inside a dialog
- `launchProcess` — to open external links (documentation, bug reports)
