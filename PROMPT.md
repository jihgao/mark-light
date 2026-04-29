# Prompt: Build MarkLight — A Cross-Platform Desktop Markdown Editor with Tauri v2

Build a complete, cross-platform desktop Markdown editor called **MarkLight** using **Tauri v2**. The app targets Linux, macOS, and Windows. It uses **no frontend framework and no bundler** — only plain static HTML/CSS/JS files served by Tauri's built-in server, plus a single vendored library (`marked.min.js`) for Markdown parsing.

---

## Architecture Overview

```
marklight/
├── dist/                          # Frontend (plain static files)
│   ├── index.html
│   ├── editor.js
│   ├── style.css
│   └── marked.min.js              # Downloaded from CDN, gitignored
├── src-tauri/
│   ├── src/
│   │   ├── main.rs                # Entry point, delegates to lib.rs
│   │   └── lib.rs                 # Builder logic, plugins, menus, menu↔JS bridge
│   ├── capabilities/
│   │   └── default.json           # Tauri v2 capability-based permissions
│   ├── icons/                     # App icons (8-bit RGBA PNGs + .icns + .ico)
│   ├── Cargo.toml
│   ├── build.rs
│   └── tauri.conf.json
├── .github/workflows/
│   ├── ci.yml
│   └── release.yml
├── package.json
├── marklight.desktop              # Linux desktop entry
└── .gitignore
```

---

## Feature Specification

### 1. Split-Pane Editor with Live Preview

Horizontal split: code editor on the left, live-rendered Markdown preview on the right, separated by a draggable divider.

**Editor pane (`#editor-pane`):**
- `<textarea>` with line-number gutter (`#line-numbers`) on the left
- Line numbers rendered using `innerHTML` with `<br>` tags — NOT `textContent` with `\n`
- Line-number gutter scroll synced with textarea via `translateY(-editor.scrollTop)`
- Tab key inserts 4 spaces instead of changing focus
- `white-space: pre; word-wrap: normal;` for raw text editing
- `min-width: 0` and `overflow: auto` (both axes) — critical to prevent flex overflow

**Preview pane (`#preview-pane`):**
- Renders editor content as HTML using `marked.parse()`
- Updates live on every `input` event
- Full Markdown styling: headings (accent color), paragraphs, links, inline code, code blocks, blockquotes, lists, tables, horizontal rules, images
- No `max-width` on the preview container — content fills available width

**Divider (`#divider`):**
- 5px wide, transparent background with `border-left: 1px solid var(--border)`
- On hover: background changes to accent color, width shrinks to 3px
- **MANDATORY: Full-screen transparent overlay (`#drag-overlay`) during drag.** The overlay is `display:none` by default; set to `display:block` on mousedown, back to `none` on mouseup. This prevents the textarea from stealing mouse events during drag.
- Dragging adjusts the flex ratio of editor/preview panes, clamped to 20%–80%

### 2. Three View Modes

Controlled by `viewMode` state (`"split"` | `"editor"` | `"preview"`) and CSS class on `#container`:

| Mode | Visible | CSS class on `#container` |
|---|---|---|
| Editor & Preview | Editor + divider + preview | (none) |
| Editor Only | Editor only | `.view-editor` |
| Preview Only | Preview only | `.view-preview` |

When switching modes, **reset any inline flex styles** set by dragging (`element.style.flex = ""`) so CSS `flex: 1` takes over cleanly.

Cmd/Ctrl+P toggles between split ↔ editor-only.

### 3. Theme System (Light / Dark / System)

Controlled via `data-theme` attribute on `<html>`, saved to `localStorage` as `marklight-theme`:

- **Dark** (`data-theme="dark"`): Catppuccin Mocha — dark mode default
- **Light** (`data-theme="light"`): Catppuccin Latte
- **System** (`data-theme="system"`): Uses `@media (prefers-color-scheme)` CSS queries

All colors via CSS custom properties. Include `color-scheme: light/dark`.

**Dark theme key values:**
```
--bg-primary: #1e1e2e; --bg-secondary: #181825; --bg-editor: #1e1e2e;
--bg-preview: #11111b; --text-primary: #cdd6f4; --text-secondary: #a6adc8;
--text-muted: #585b70; --accent: #89b4fa; --border: #313244;
--status-bg: #11111b; --code-inline: #fab387; --blockquote-bg: rgba(137,180,250,0.05);
--selection: rgba(137,180,250,0.2); --scrollbar-thumb: #45475a; --scrollbar-track: transparent;
```

**Light theme key values:**
```
--bg-primary: #eff1f5; --bg-secondary: #e6e9ef; --bg-editor: #eff1f5;
--bg-preview: #ffffff; --text-primary: #4c4f69; --text-secondary: #5c5f77;
--text-muted: #9ca0b0; --accent: #1e66f5; --border: #ccd0da;
--status-bg: #e6e9ef; --code-inline: #fe640b; --blockquote-bg: rgba(30,102,245,0.05);
--selection: rgba(30,102,245,0.15); --scrollbar-thumb: #bcc0cc; --scrollbar-track: transparent;
```

Default theme on startup: `system`.

### 3b. Platform-Aware Font Stacks

Use cross-platform font stacks so text looks native on every OS:

- **UI font:** `-apple-system, BlinkMacSystemFont, "Segoe UI", "Ubuntu", "Cantarell", "Noto Sans", sans-serif`
  - macOS picks `-apple-system`, Windows picks `Segoe UI`, Linux picks `Ubuntu`/`Noto Sans`.

- **Monospace:** `"SF Mono", "Cascadia Code", "JetBrains Mono", "Fira Code", "Consolas", "Courier New", monospace`
  - macOS picks `SF Mono`, Windows picks `Cascadia Code`, Linux picks `Fira Code`/`Consolas`.

### 4. Native Menu Bar (Rust ↔ JS Bridge)

Define menus in Rust using `MenuItem::with_id`. Dispatch to JS via:
```rust
window.eval("window.__handleMenu('action_id')")
```

**File menu:** New (Cmd+N), Open… (Cmd+O), separator, Save (Cmd+S), Save As… (Cmd+Shift+S), separator, Quit

**Edit menu:** Undo (Cmd+Z), Redo (Cmd+Shift+Z), separator, Cut (Cmd+X), Copy (Cmd+C), Paste (Cmd+V), Select All (Cmd+A). Edit commands use `document.execCommand()`.

**View menu:**
- Toggle Preview (Cmd+P)
- Toggle Line Numbers (Cmd+L)
- separator
- **Layout** submenu → Editor & Preview / Editor Only / Preview Only
- **Theme** submenu → Light / Dark / separator / System

### 5. Status Bar

Fixed 28px bar (`#status-bar`) at the bottom:
- **Left (`#status-file`):** Current filename (or "Untitled") with `*` dirty indicator
- **Center (`#status-info`):** Cursor position (`Ln X, Col Y`)
- **Right (`#status-words`):** Word count

### 6. File Operations

Use Tauri v2 global APIs (`window.__TAURI__.*`):
- `dialog.open()` and `dialog.save()` for file dialogs
- `fs.readTextFile()` and `fs.writeTextFile()` for read/write
- File filters: Markdown (`.md`, `.markdown`, `.txt`) + All Files
- Window title: `* filename — MarkLight` format
- `beforeunload` handler warns on unsaved changes

---

## Tauri v2 Configuration Details

### tauri.conf.json
- `productName`: `"MarkLight"`
- `identifier`: Must NOT end with `.app`. Use `com.marklight.editor`.
- `app.withGlobalTauri`: `true`
- `build.frontendDist`: `"../dist"`
- Default window: 1200×800, resizable, label `"main"`

### capabilities/default.json
Grant: `core:default`, `core:window:allow-set-title`, `dialog:default`, `dialog:allow-open`, `dialog:allow-save`, `dialog:allow-message`, `dialog:allow-ask`, `fs:default`, `fs:allow-read-text-file`, `fs:allow-write-text-file`, `fs:allow-exists`, `shell:allow-open`.
Add `fs:scope` for `$HOME/**`, `$DOCUMENT/**`, `$DESKTOP/**`.

### Cargo.toml
- Package name: `marklight`
- `[lib]`: `name = "marklight_lib"`, `crate-type = ["lib", "cdylib", "staticlib"]`
- `[[bin]]`: `name = "marklight"`, `path = "src/main.rs"`
- Dependencies: `tauri` v2 (`["image-ico", "image-png"]`), `tauri-plugin-dialog` v2, `tauri-plugin-fs` v2, `tauri-plugin-shell` v2, `tauri-plugin-log` v2, `serde` v1 (derive), `serde_json` v1
- Build dep: `tauri-build` v2
- `[profile.release]`: `strip = true, lto = true, codegen-units = 1, panic = "abort"`

### main.rs
```rust
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
fn main() { marklight_lib::run(); }
```

### lib.rs
- `tauri::Builder::default()` with plugins chained
- `.setup()`: build menu with File/Edit/View submenus (including Layout and Theme submenus), attach via `app.set_menu(menu)`
- `.on_menu_event()`: dispatch all menu actions to JS via `window.eval()`
- Note: `MenuItem::with_id(..., None::<&str>)` for items without keyboard shortcuts
- Note: `PredefinedMenuItem::quit(app, None)` — requires the second `text` argument

---

## Critical Implementation Gotchas

1. **Icons MUST be 8-bit RGBA PNGs.** Force `PNG32:` and `-depth 8`. Tauri fails with `icon is not RGBA` on GrayscaleAlpha or `Unsupported PNG bit depth: Sixteen` on 16-bit PNGs.

2. **Textarea `min-width: 0` + `overflow: auto`** — without this, `white-space: pre` content pushes the editor pane beyond its flex allocation and covers the divider.

3. **Drag overlay** — textarea steals `mousemove` events. A full-screen `#drag-overlay` (`position:fixed; inset:0; z-index:100`) shown during drag is the only reliable fix.

4. **Line numbers: `innerHTML` with `<br>`, not `textContent` with `\n`.** Browsers collapse newlines.

5. **No Tauri v1 patterns.** Tauri v2 uses `tauri-plugin-*` crates + `capabilities/default.json`, not v1 `allowlist` feature flags.

6. **`marked.min.js` is gitignored.** Download before dev/build: `mkdir -p dist && curl -sL https://cdn.jsdelivr.net/npm/marked/marked.min.js -o dist/marked.min.js`.

7. **No `max-width` on preview** — content must fill the preview pane when the divider is dragged.

8. **Reset inline flex on view mode switch** — stale `style.flex` values from dragging override CSS. Always set `element.style.flex = ""` in `setViewMode()`.

9. **`MenuItem::with_id` requires typed `None`** — `None::<&str>` for the keyboard shortcut parameter.

10. **`PredefinedMenuItem::quit` takes 2 args** — `PredefinedMenuItem::quit(app, None)`.

11. **`document.execCommand()` for undo/redo/cut/copy/paste is deprecated** but still functional in all browsers. Tauri v2 has no native clipboard API, so this is the simplest approach.

12. **Linux system dependencies are required at build time:** `libwebkit2gtk-4.1-dev`, `libgtk-3-dev`, `libayatana-appindicator3-dev`, `librsvg2-dev`, `build-essential`, `libssl-dev`.

---

## Build & Run

```bash
cargo install tauri-cli
mkdir -p dist && curl -sL https://cdn.jsdelivr.net/npm/marked/marked.min.js -o dist/marked.min.js
cargo tauri dev    # hot-reload
cargo tauri build  # release: .deb/.AppImage (Linux), .dmg (macOS), .exe (Windows)
```

---

## GitHub Actions CI/CD

### ci.yml — PR Build Validation
- Triggers on `pull_request` to `master`
- Matrix: `ubuntu-latest`, `macos-latest` (x86 + arm64), `windows-latest`
- Install Linux deps, download marked, install tauri-cli, `cargo tauri build`
- Upload artifacts with 14-day retention via `actions/upload-artifact@v4`

### release.yml — Tag-Triggered Release
- Triggers on `v*` tag push
- Same matrix build
- Attach all artifacts to a **draft** GitHub Release via `softprops/action-gh-release@v3`
- Requires `permissions: contents: write`

### CI/CD Gotchas
- All `run:` steps with `mkdir -p`/`curl`/`cargo install` MUST use `shell: bash`
- Use `actions/checkout@v6` and `softprops/action-gh-release@v3` (Node 24 native)
- Version consistency: `package.json` and `tauri.conf.json` versions match the git tag
- Use forward-slash paths in `action-gh-release` file patterns (GitHub Actions handles them correctly on all platforms)
