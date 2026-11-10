mod commands;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(std::sync::Mutex::<Option<std::path::PathBuf>>::new(None))
        .manage(commands::fs::ActiveWorkspaceRoot(
            std::sync::Mutex::<Option<std::path::PathBuf>>::new(None),
        ))
        .manage(commands::media::MediaLock::default())
        .invoke_handler(tauri::generate_handler![
            commands::app_info::app_info,
            commands::ai::ai_http_request,
            commands::secret::secret_set,
            commands::secret::secret_get,
            commands::secret::secret_delete,
            commands::weather::location_resolve,
            commands::weather::weather_resolve,
            commands::fs::project_open_root,
            commands::fs::project_get_root,
            commands::fs::project_ensure_layout,
            commands::fs::project_read_json,
            commands::fs::project_write_json_atomic,
            commands::fs::project_delete_file,
            commands::fs::workspace_open_root,
            commands::fs::workspace_get_root,
            commands::fs::workspace_read_json,
            commands::fs::workspace_write_json_atomic,
            commands::fs::workspace_ensure_dir,
            commands::fs::workspace_list_dir,
            commands::fs::workspace_move_to_trash,
            commands::fs::workspace_restore_from_trash,
            commands::fs::ledger_read_head,
            commands::fs::ledger_read_lines,
            commands::fs::ledger_append_line,
            commands::fs::ledger_write_head,
            commands::fs::ledger_hash_sha256,
            commands::media::media_probe,
            commands::media::media_import_stereo,
            commands::media::media_import_mono_stereo,
            commands::media::media_read_file,
            commands::media::media_trim,
            commands::media::media_extract_frames,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
