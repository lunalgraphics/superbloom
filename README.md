# SuperBloom

A real-time bloom/glow effect tool for images. Works as a standalone web app, a Photopea plugin, or a Photoshop plugin.

<!-- TODO: Add a screenshot or GIF demo here -->
<!-- ![SuperBloom demo](docs/demo.gif) -->

## Features

- **Threshold-based highlight isolation** — extracts the brightest parts of an image to use as a glow source
- **Layered bloom** — stacks multiple blur passes with screen blending for a natural, cinematic glow
- **Full control** — adjust threshold, depth, radius, brightness, saturation, hue shift, colorization, and anamorphic stretch
- **Presets** — built-in presets (Soft Haze, Jedi, Cinematic, Sunset) plus import/export of custom presets
- **Live preview** — see changes in real time with adjustable preview quality
- **Multi-platform** — runs standalone in the browser, as a Photopea plugin, or as a Photoshop plugin

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) 18+
- npm (comes with Node.js)

### Installation

```bash
git clone https://github.com/lunalgraphics/superbloom.git
cd superbloom
npm install
```

### Development

```bash
npm run dev
```

Opens a dev server at `http://localhost:5173`.

### Build

```bash
# Standalone web app
npm run build

# Photoshop plugin variant
npm run build:photoshop

# Electron desktop app (builds the web assets into electron-app/app/)
npm run build:electron
```

The standalone build outputs to `build/`. The Photoshop build outputs to `webview-contents/`. The electron build outputs to `electron-app/app/`.

### Desktop App (Electron)

After building the web assets with `npm run build:electron`, you can run or package the desktop app:

```bash
cd electron-app
npm install

# Run in development
npm start

# Package for your platform
npm run build-win32    # Windows (NSIS installer)
npm run build-darwin   # macOS (zip)
npm run build-linux    # Linux (deb)
npm run build-all      # All platforms
```

Packaged installers are output to `electron-app/dist/`. See [`electron-app/README.md`](electron-app/README.md) for more details.

### Preview production build

```bash
npm run preview
```

## Usage

### Standalone

1. Open the app in your browser
2. Click **Upload Image** to load a photo
3. Adjust the controls in the right panel
4. Click **Export Full Image** or **Export Bloom Layer**

### As a Photopea Plugin

1. In Photopea, go to **More → Plugins → SuperBloom**
2. The active document is loaded automatically
3. Adjust settings and click **Add to Document** to insert the bloom as a new layer

### As a Photoshop Plugin

Requires Adobe Photoshop 2022 (v23.3+) and the [UXP Developer Tool](https://developer.adobe.com/photoshop/uxp/2022/guides/devtool/installation/).

1. Build the plugin UI: `npm run build:photoshop`
2. Open the UXP Developer Tool
3. Click **Add Plugin** and select `photoshop-plugin/manifest.json`
4. Click **Load** — the SuperBloom panel appears under **Plugins → SuperBloom**
5. Open a document, click **New SuperBloom Layer**, adjust settings, and click **Finish**

The bloom is inserted as a Smart Object with Screen blending. You can re-edit it later by selecting the layer and clicking **Edit Selected Layer**.

See [`photoshop-plugin/README.md`](photoshop-plugin/README.md) for full architecture details.

## Presets

Presets are JSON files that store effect parameters. Built-in presets live in `src/lib/presets/`. You can export your current settings as a preset file and import presets from disk.

### Preset format

```json
{
  "threshold": 222,
  "glowLayers": 16,
  "glowRadius": 1,
  "colorize": false,
  "tintcolor": "#FF5500",
  "saturation": 100,
  "hue": 0,
  "tintopacity": 100,
  "brightness": 100,
  "anamorph": 0
}
```

## Project Structure

```
src/
├── lib/
│   ├── assets/          # Banner, cover art, icon
│   ├── bloom.js         # Core bloom rendering pipeline
│   ├── presets.js       # Preset serialization and validation
│   ├── components/
│   │   ├── Controls.svelte      # Effect parameter UI panel
│   │   └── LandingScreen.svelte # Upload / loading splash screen
│   ├── presets/         # Built-in preset JSON files
│   └── scripts/
│       └── isolate-highlights.js   # Pixel-level highlight extraction
├── routes/
│   ├── +layout.js       # Enables prerendering
│   └── +page.svelte     # App shell (wires components + platform logic)
electron-app/
├── main.js              # Electron main process entry point
├── package.json         # Electron dependencies and build config
├── app/                 # (generated) SvelteKit build output served by Electron
├── resources/           # App icons for packaging
└── dist/                # (generated) Packaged installers
photoshop-plugin/
├── index.html           # UXP panel markup
├── index.js             # UXP host logic (pixel transfer, Smart Object creation)
├── manifest.json        # UXP plugin manifest
├── icons/               # Plugin icons
└── webview-contents/    # (generated) SvelteKit build for the webview
static/                  # Favicon, plugin icon
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines on how to contribute.

## License

[MIT](LICENSE.md) © Yikuan Sun
