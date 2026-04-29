# MarkLight

A lightweight cross-platform desktop Markdown editor built with Tauri v2. Split-pane editor with live preview, three view modes, and a Catppuccin-inspired theme system.

## Features

- **Split-pane editor** with line numbers and live Markdown preview
- **Three view modes**: Editor & Preview, Editor Only, Preview Only
- **Draggable divider** with overlay to prevent textarea interference
- **Three themes**: Dark (Catppuccin Mocha), Light (Catppuccin Latte), System
- **Native menu bar**: File / Edit / View with keyboard shortcuts
- **File operations**: New, Open, Save, Save As via native dialogs
- **Status bar**: filename with dirty indicator, cursor position, word count
- **Unsaved changes warning** on close

## Quick Start

### Prerequisites

| Platform | Requirements |
|---|---|
| **All** | Rust toolchain (`rustup`), Node.js 18+ |
| **Linux** | `libwebkit2gtk-4.1-dev`, `build-essential`, `libssl-dev`, `libgtk-3-dev`, `libayatana-appindicator3-dev`, `librsvg2-dev` |
| **macOS** | Xcode Command Line Tools |
| **Windows** | Microsoft C++ Build Tools, WebView2 |

### Install

```bash
# Install Tauri CLI
cargo install tauri-cli

# Download marked library
mkdir -p dist && curl -sL https://cdn.jsdelivr.net/npm/marked/marked.min.js -o dist/marked.min.js
```

### Run (dev mode)

```bash
cargo tauri dev
```

### Build (release)

```bash
cargo tauri build
```

Outputs:
- **Linux**: `.deb` + `.AppImage` in `src-tauri/target/release/bundle/`
- **macOS**: `.dmg` in `src-tauri/target/release/bundle/`
- **Windows**: `.exe` installer in `src-tauri/target/release/bundle/`

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                      Window (1200x800)                       │
├──────────────────────────┬───────────────────────────────────┤
│   Editor Pane            │    Preview Pane                   │
│   ┌────────┬──────────┐  │  ┌─────────────────────────────┐  │
│   │ Line # │ textarea │  │  │ <div> rendered HTML from    │  │
│   │ gutter │ (plain)  │  │  │ marked.parse()              │  │
│   └────────┴──────────┘  │  └─────────────────────────────┘  │
│                          │                                   │
│  ← draggable divider →   │                                   │
└──────────────────────────┴───────────────────────────────────┘
┌──────────────────────────────────────────────────────────────┐
│  Status bar: filename* | Ln X, Col Y | N words               │
└──────────────────────────────────────────────────────────────┘
```

### Layered Design

| Layer | Technology | File(s) | Role |
|---|---|---|---|
| **Shell** | Rust + Tauri v2 | `src-tauri/src/main.rs`, `lib.rs` | App entry, native menu bar, plugin setup |
| **IPC** | Tauri JS API | `dist/editor.js` (`window.__TAURI__.*`) | File dialogs, read/write via plugins |
| **Permissions** | Tauri capabilities | `src-tauri/capabilities/default.json` | Grants dialog, fs, shell permissions |
| **Config** | JSON | `src-tauri/tauri.conf.json` | Window, CSP, bundle targets, icons |
| **Frontend** | HTML/CSS/JS (no framework) | `dist/index.html`, `style.css`, `editor.js` | Editor UI, layout, events, themes |
| **Markdown** | `marked` library | `dist/marked.min.js` (gitignored) | Markdown-to-HTML conversion |

### Theme System

Three themes via `data-theme` on `<html>`, saved to `localStorage`:

| Variable | Dark (Mocha) | Light (Latte) |
|---|---|---|
| `--bg-primary` | `#1e1e2e` | `#eff1f5` |
| `--bg-preview` | `#11111b` | `#ffffff` |
| `--text-primary` | `#cdd6f4` | `#4c4f69` |
| `--text-secondary` | `#a6adc8` | `#5c5f77` |
| `--accent` | `#89b4fa` | `#1e66f5` |
| `--code-inline` | `#fab387` | `#fe640b` |
| `--border` | `#313244` | `#ccd0da` |

Headings render in accent color. Inline code uses `--code-inline` on `--bg-secondary`. Code blocks use `--text-primary` for full readability.

### Platform-Aware Font Stacks

| Stack | Fonts | Purpose |
|---|---|---|
| **UI** | `-apple-system, BlinkMacSystemFont, "Segoe UI", "Ubuntu", "Cantarell", "Noto Sans", sans-serif` | Matches native OS fonts (macOS/Windows/Linux) |
| **Monospace** | `"SF Mono", "Cascadia Code", "JetBrains Mono", "Fira Code", "Consolas", "Courier New", monospace` | Terminal/editor fonts per platform |

### View Modes

Controlled by CSS class on `#container`:

| Mode | Class | Visible |
|---|---|---|
| Editor & Preview | (none) | Editor + divider + preview |
| Editor Only | `.view-editor` | Editor only |
| Preview Only | `.view-preview` | Preview only |

Switching modes resets inline `style.flex` from divider drag so CSS `flex: 1` takes over cleanly.

### Data Flow

```
User types → textarea "input" event
    ├── updateLineNumbers()  → lineNumbers.innerHTML with <br>
    ├── updateStatusBar()    → filename*, Ln/Col, word count
    └── renderMarkdown()     → marked.parse() → preview.innerHTML

Menu/keyboard shortcut
    ├── Rust on_menu_event() → window.eval("window.__handleMenu('...')")
    └── JS __handleMenu()    → dispatches to save/open/new/layout/theme handlers

Divider drag
    ├── mousedown → show #drag-overlay (blocks textarea events)
    ├── mousemove → adjust editor-pane / preview-pane flex
    └── mouseup → hide overlay
```

## CI/CD

Two GitHub Actions workflows:

| Workflow | Trigger | Output |
|---|---|---|
| `.github/workflows/ci.yml` | PRs to `master` | Builds on Linux/macOS/Windows, 14-day artifacts |
| `.github/workflows/release.yml` | Git tag `v*` | Builds all platforms, draft GitHub Release |

Both workflows use `actions/checkout@v6` and `softprops/action-gh-release@v3` (Node 24 native), `shell: bash` on build steps, and forward-slash paths in `action-gh-release` file patterns.

### Release

```bash
git tag v1.0.1 && git push origin v1.0.1
```

Then review and publish the draft release on GitHub.

## Icon Generation

Logo: centered bold blue **M** (`#4E6BFE`) on soft light background (`#F5F8FE`). Generated sizes:

```
src-tauri/icons/
├── 32x32.png        # Linux tray
├── 128x128.png      # Linux app icon
├── 128x128@2x.png   # HiDPI (256px)
├── 256x256.png      # Linux large icon
├── icon.ico         # Windows (multi-size 16–256px)
└── icon.icns        # macOS (multi-size 16–512px)
```

Regenerate with `imagemagick` and `png2icns`:
```bash
# Base icon from SVG (force 8-bit RGBA)
convert icon.svg -resize 1024x1024 -depth 8 PNG32:base_1024.png

# PNG sizes
for size in 32 128 256; do convert base_1024.png -resize ${size}x${size} -depth 8 PNG32:src-tauri/icons/${size}x${size}.png; done
convert base_1024.png -resize 128x128 -depth 8 PNG32:src-tauri/icons/128x128@2x.png

# Windows .ico
convert base_1024.png -resize 16x16 ico_16.png
convert base_1024.png -resize 32x32 ico_32.png
convert base_1024.png -resize 48x48 ico_48.png
convert base_1024.png -resize 256x256 ico_256.png
convert ico_16.png ico_32.png ico_48.png ico_256.png icon.ico

# macOS .icns (Linux)
mkdir -p /tmp/icns
for size in 16 32 128 256 512; do convert base_1024.png -resize ${size}x${size} -depth 8 PNG32:/tmp/icns/${size}.png; done
png2icns icon.icns /tmp/icns/*.png
rm -rf /tmp/icns ico_*.png base_1024.png icon.svg
```

## Known Caveats

- `document.execCommand()` for undo/redo/cut/copy/paste is deprecated but still functional. Tauri v2 doesn't expose a native clipboard API.
- No syntax highlighting — plain `<textarea>`. Adding highlighting would require CodeMirror or similar.
- `marked` is loaded as a global script, not an npm module. Avoids needing a bundler.
- `beforeDevCommand` and `beforeBuildCommand` are empty — no frontend build step.
- **Icons MUST be 8-bit RGBA PNGs.** GrayscaleAlpha causes `icon is not RGBA` build failures.
- **Textarea `min-width: 0` + `overflow: auto`** required to prevent flex overflow covering the divider.
- **Drag overlay** (`#drag-overlay`) required to prevent textarea from stealing `mousemove` during divider drag.

## Project Structure

```
marklight/
├── .github/workflows/
│   ├── ci.yml                # CI: build on PRs
│   └── release.yml           # Release: build on tags
├── dist/
│   ├── index.html            # UI layout
│   ├── style.css             # Catppuccin theme system
│   ├── editor.js             # Editor logic, file ops, themes, view modes
│   └── marked.min.js         # Markdown parser (gitignored)
├── src-tauri/
│   ├── src/
│   │   ├── main.rs           # Entry point (windows_subsystem)
│   │   └── lib.rs            # Tauri setup: menu, plugins, events
│   ├── capabilities/
│   │   └── default.json      # Permission grants + fs scope
│   ├── icons/                # App icons (all sizes)
│   ├── tauri.conf.json       # App config
│   ├── Cargo.toml            # Rust deps, lib/bin targets, release profile
│   └── build.rs              # Tauri build script
├── package.json              # npm scripts
├── marklight.desktop         # Linux desktop entry
├── PROMPT.md                 # AI generation prompt
├── README.md                 # This file
├── DEVELOPER.md              # Developer reference
└── .gitignore
```

## License

MIT
