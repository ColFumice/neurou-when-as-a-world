const APP_COMMANDS: &[&str] = &[
    "app_info",
    "ai_http_request",
    "secret_set",
    "secret_get",
    "secret_delete",
    "location_resolve",
    "weather_resolve",
    "project_open_root",
    "project_get_root",
    "project_ensure_layout",
    "project_read_json",
    "project_write_json_atomic",
    "workspace_open_root",
    "workspace_get_root",
    "workspace_read_json",
    "workspace_write_json_atomic",
    "workspace_ensure_dir",
    "workspace_list_dir",
    "workspace_move_to_trash",
    "workspace_restore_from_trash",
    "ledger_read_head",
    "ledger_read_lines",
    "ledger_append_line",
    "ledger_write_head",
    "ledger_hash_sha256",
    "media_probe",
    "media_import_stereo",
    "media_import_mono_stereo",
    "media_read_file",
    "media_trim",
    "media_extract_frames",
];

fn main() {
    let attributes = tauri_build::Attributes::new()
        .app_manifest(tauri_build::AppManifest::new().commands(APP_COMMANDS));
    tauri_build::try_build(attributes).expect("failed to run tauri-build");
}
