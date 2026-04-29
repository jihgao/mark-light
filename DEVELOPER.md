# DEVELOPER.md

Developer reference for the MarkLight codebase.

## Project Overview

**MarkLight** — a lightweight cross-platform desktop Markdown editor built with Tauri v2. Features a split-pane editor with live preview, three view modes, a Catppuccin-based theme system, and native menu bar. Targets Linux, macOS, and Windows.

## Essential Commands

```bash
# Install Tauri CLI (if not present)
cargo install tauri-cli

# Download marked library (required before dev/build)
mkdir -p dist && curl -sL https://cdn.jsdelivr.net/npm/marked/marked.min.js -o dist/marked.min.js

# Development (hot-reload)
cargo tauri dev

# Release build
cargo tauri build
# Outputs: MarkLight_1.0.1_amd64.deb + .AppImage (Linux), .dmg (macOS), .exe (Windows)
```

## Architecture

**No framework, no bundler.** Plain static files in `dist/` served by Tauri's built-in HTTP server.

### Tauri v2 Structure

- `src-tauri/src/main.rs` — Entry point with `windows_subsystem = "windows"` attribute, delegates to `lib.rs`
- `src-tauri/src/lib.rs` — All builder logic: plugins (dialog, fs, shell, log), native menu bar (File/Edit/View), `on_menu_event` handler that dispatches to JS via `window.eval("window.__handleMenu('...')")`
- `src-tauri/capabilities/default.json` — Permission grants. Tauri v2 uses a capability-based system, not v1 feature flags
- `src-tauri/tauri.conf.json` — App config: `productName: "MarkLight"`, `identifier: "com.marklight.editor"`, `frontendDist: "../dist"`, `withGlobalTauri: true`

### Cargo.toml

- Package name: `marklight`
- Lib crate: `marklight_lib` (cdylib, staticlib)
- Binary: `marklight` from `src/main.rs`
- Release profile: `strip = true, lto = true, codegen-units = 1, panic = "abort"`

### Frontend (`dist/`)

- `index.html` — Split-pane layout: editor (textarea + line number gutter) | preview (div) | status bar. Uses `data-theme` on `<html>` for theming.
- `editor.js` — All editor logic: file operations via `window.__TAURI__.*`, view modes, theme system, line numbers toggle, divider drag with overlay.
- `style.css` — Catppuccin Dark/Light/System themes via CSS custom properties. Headings use accent color, inline code uses `--code-inline` on `--bg-secondary`, code blocks use `--text-primary` for readability.
- `marked.min.js` — Markdown parser (gitignored, downloaded from CDN)

### View Modes

Three modes controlled by CSS class on `#container`:
| Mode | CSS class | Visible |
|---|---|---|
| Split | (none) | Editor + divider + preview |
| Editor only | `.view-editor` | Editor only |
| Preview only | `.view-preview` | Preview only |

Switching modes resets inline `style.flex` values so CSS `flex: 1` takes over cleanly.

### Theme System

Three themes via `data-theme` attribute on `<html>`:
- `dark` — Catppuccin Mocha (default)
- `light` — Catppuccin Latte
- `system` — Follows `prefers-color-scheme`

All colors are CSS custom properties (`--bg-primary`, `--text-primary`, `--accent`, etc.). Saved to `localStorage` as `marklight-theme`.

### Platform-Aware Font Stacks

- **UI font:** `-apple-system, BlinkMacSystemFont, "Segoe UI", "Ubuntu", "Cantarell", "Noto Sans", sans-serif` — uses the native OS font on macOS, Windows, and Linux.
- **Monospace:** `"SF Mono", "Cascadia Code", "JetBrains Mono", "Fira Code", "Consolas", "Courier New", monospace` — prefers the terminal/editor fonts available on each platform.

### Menu ↔ Frontend Bridge

Menu items defined in Rust (`lib.rs`) with `MenuItem::with_id` and submenus (Layout, Theme). On click, `on_menu_event` calls `window.eval("window.__handleMenu('action')")`. The JS function `window.__handleMenu` dispatches to the appropriate handler. Edit commands (undo/redo/cut/copy/paste) use `document.execCommand()` directly.

### Key CSS Design Decisions

- `#editor` has `min-width: 0` and `overflow: auto` — prevents flex overflow from covering the divider
- `white-space: pre; word-wrap: normal` on textarea for raw text editing
- Divider is 5px with transparent background + `border-left: 1px solid var(--border)` — large hit target
- Full-screen `#drag-overlay` during divider drag prevents textarea from stealing mouse events
- Line numbers use `innerHTML` with `<br>`, NOT `textContent` with `\n`
- Inline code: `color: var(--code-inline)` on `--bg-secondary` for readability
- Code blocks: `color: var(--text-primary)` explicitly set
- Headings in preview use `--accent` color

## Key Gotchas

- **Icons MUST be 8-bit RGBA PNGs.** Simple SVGs (white on transparent) produce GrayscaleAlpha by default. Force RGBA: `convert -size NxN xc:none -background none logo.svg -resize NxN -composite -depth 8 PNG32:icon.png`. Otherwise Tauri fails with `icon is not RGBA` on macOS/Linux. For `.ico`, add `-depth 8` to avoid `Unsupported PNG bit depth: Sixteen`.
- **`#editor` needs `min-width: 0` + `overflow: auto`** — without this, `white-space: pre` content pushes the editor pane beyond its flex allocation and covers the divider.
- **Line numbers use `innerHTML` with `<br>`, NOT `textContent` with `\n`** — the browser collapses newlines.
- **No Tauri v1 feature flags** — permissions are handled by `tauri-plugin-*` crates and `capabilities/default.json`.
- **`dist/marked.min.js` is gitignored.** Download it before building.
- **Version consistency:** When releasing, update `package.json` version, `src-tauri/tauri.conf.json` version, then tag `v<version>`.
- **`MenuItem::with_id`** requires `None::<&str>` for the keyboard shortcut parameter when there's no shortcut.
- **`PredefinedMenuItem::quit(app, None)`** requires the second `text` argument in Tauri v2.
- **Drag overlay is mandatory** — without it, the textarea steals `mousemove` events during divider drag.
- **`document.execCommand()` for undo/redo/cut/copy/paste is deprecated** but still functional. Tauri v2 has no native clipboard API, so this is the simplest approach.
- **Linux system deps** required at build time: `libwebkit2gtk-4.1-dev`, `libgtk-3-dev`, `libayatana-appindicator3-dev`, `librsvg2-dev`, `build-essential`, `libssl-dev`.

## CI/CD

- `.github/workflows/ci.yml` — PR builds on all platforms (Linux/macOS x86/macOS arm64/Windows), 14-day artifact retention
- `.github/workflows/release.yml` — Tag-triggered builds, attaches to draft GitHub Release
- Uses `actions/checkout@v6` and `softprops/action-gh-release@v3` (Node 24 native)
- All `run:` steps with `mkdir -p`/`curl` use `shell: bash` (Windows defaults to PowerShell)
- Use forward-slash paths in `action-gh-release` file patterns (GitHub Actions handles them correctly on all platforms)

## Desktop Entry

- Custom `marklight.desktop` file in repo root
- `Exec=marklight`, `Icon=marklight`, `Name=MarkLight`
- MIME types: `text/plain`, `text/markdown`, `text/x-markdown`
