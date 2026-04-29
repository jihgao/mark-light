use tauri::{menu::{Menu, MenuItem, PredefinedMenuItem, Submenu}, Manager};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_log::Builder::new().build())
        .setup(|app| {
            let file_menu = Submenu::with_items(
                app, "File", true,
                &[
                    &MenuItem::with_id(app, "new", "New", true, Some("CmdOrCtrl+N"))?,
                    &MenuItem::with_id(app, "open", "Open", true, Some("CmdOrCtrl+O"))?,
                    &PredefinedMenuItem::separator(app)?,
                    &MenuItem::with_id(app, "save", "Save", true, Some("CmdOrCtrl+S"))?,
                    &MenuItem::with_id(app, "save_as", "Save As...", true, Some("CmdOrCtrl+Shift+S"))?,
                    &PredefinedMenuItem::separator(app)?,
                    &PredefinedMenuItem::quit(app, None)?,
                ],
            )?;

            let edit_menu = Submenu::with_items(
                app, "Edit", true,
                &[
                    &MenuItem::with_id(app, "undo", "Undo", true, Some("CmdOrCtrl+Z"))?,
                    &MenuItem::with_id(app, "redo", "Redo", true, Some("CmdOrCtrl+Shift+Z"))?,
                    &PredefinedMenuItem::separator(app)?,
                    &MenuItem::with_id(app, "cut", "Cut", true, Some("CmdOrCtrl+X"))?,
                    &MenuItem::with_id(app, "copy", "Copy", true, Some("CmdOrCtrl+C"))?,
                    &MenuItem::with_id(app, "paste", "Paste", true, Some("CmdOrCtrl+V"))?,
                    &MenuItem::with_id(app, "select_all", "Select All", true, Some("CmdOrCtrl+A"))?,
                ],
            )?;

            let layout_submenu = Submenu::with_items(
                app, "Layout", true,
                &[
                    &MenuItem::with_id(app, "layout_split", "Editor & Preview", true, None::<&str>)?,
                    &MenuItem::with_id(app, "layout_editor", "Editor Only", true, None::<&str>)?,
                    &MenuItem::with_id(app, "layout_preview", "Preview Only", true, None::<&str>)?,
                ],
            )?;

            let theme_submenu = Submenu::with_items(
                app, "Theme", true,
                &[
                    &MenuItem::with_id(app, "theme_light", "Light", true, None::<&str>)?,
                    &MenuItem::with_id(app, "theme_dark", "Dark", true, None::<&str>)?,
                    &PredefinedMenuItem::separator(app)?,
                    &MenuItem::with_id(app, "theme_system", "System", true, None::<&str>)?,
                ],
            )?;

            let view_menu = Submenu::with_items(
                app, "View", true,
                &[
                    &MenuItem::with_id(app, "toggle_preview", "Toggle Preview", true, Some("CmdOrCtrl+P"))?,
                    &MenuItem::with_id(app, "toggle_line_numbers", "Toggle Line Numbers", true, Some("CmdOrCtrl+L"))?,
                    &PredefinedMenuItem::separator(app)?,
                    &layout_submenu,
                    &theme_submenu,
                ],
            )?;

            let menu = Menu::with_items(app, &[&file_menu, &edit_menu, &view_menu])?;
            app.set_menu(menu)?;
            Ok(())
        })
        .on_menu_event(|app, event| {
            let window = app.get_webview_window("main").unwrap();
            let _ = match event.id().as_ref() {
                "new" => window.eval("window.__handleMenu('new')"),
                "open" => window.eval("window.__handleMenu('open')"),
                "save" => window.eval("window.__handleMenu('save')"),
                "save_as" => window.eval("window.__handleMenu('save_as')"),
                "undo" => window.eval("document.execCommand('undo')"),
                "redo" => window.eval("document.execCommand('redo')"),
                "cut" => window.eval("document.execCommand('cut')"),
                "copy" => window.eval("document.execCommand('copy')"),
                "paste" => window.eval("document.execCommand('paste')"),
                "select_all" => window.eval("window.__handleMenu('select_all')"),
                "toggle_preview" => window.eval("window.__handleMenu('toggle_preview')"),
                "toggle_line_numbers" => window.eval("window.__handleMenu('toggle_line_numbers')"),
                "layout_split" => window.eval("window.__handleMenu('layout_split')"),
                "layout_editor" => window.eval("window.__handleMenu('layout_editor')"),
                "layout_preview" => window.eval("window.__handleMenu('layout_preview')"),
                "theme_light" => window.eval("window.__handleMenu('theme_light')"),
                "theme_dark" => window.eval("window.__handleMenu('theme_dark')"),
                "theme_system" => window.eval("window.__handleMenu('theme_system')"),
                _ => Ok(()),
            };
        })
        .run(tauri::generate_context!())
        .expect("error while running Tauri application");
}
