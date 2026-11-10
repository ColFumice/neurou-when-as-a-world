use serde::Serialize;
use serde_json::Value;
use sha2::{Digest, Sha256};
use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::{Component, Path, PathBuf};
use std::sync::Mutex;
use tauri::State;
use uuid::Uuid;

pub type ActiveProjectRoot = Mutex<Option<PathBuf>>;

/// Workspace 根与项目根分离；两套命令各有独立 active root。
pub struct ActiveWorkspaceRoot(pub Mutex<Option<PathBuf>>);

#[derive(Debug, Serialize)]
pub struct WorkspaceDirEntry {
    pub name: String,
    pub kind: String,
}

#[derive(Debug, Serialize)]
pub struct FsError {
    pub code: String,
    pub message: String,
}

impl FsError {
    pub(crate) fn new(code: &str, message: impl Into<String>) -> Self {
        Self {
            code: code.to_string(),
            message: message.into(),
        }
    }

    fn project_not_open() -> Self {
        Self::new("ProjectNotOpen", "project root is not open")
    }

    fn invalid_path(message: impl Into<String>) -> Self {
        Self::new("InvalidPath", message)
    }

    fn escape(message: impl Into<String>) -> Self {
        Self::new("EscapeDetected", message)
    }

    fn io(error: impl std::fmt::Display) -> Self {
        Self::new("IoError", error.to_string())
    }
}

impl From<std::io::Error> for FsError {
    fn from(error: std::io::Error) -> Self {
        Self::io(error)
    }
}

impl From<serde_json::Error> for FsError {
    fn from(error: serde_json::Error) -> Self {
        Self::new("IoError", format!("json error: {error}"))
    }
}

pub(crate) fn active_root(state: &State<'_, ActiveProjectRoot>) -> Result<PathBuf, FsError> {
    let guard = state
        .lock()
        .map_err(|_| FsError::io("project root lock poisoned"))?;
    guard.clone().ok_or_else(FsError::project_not_open)
}

fn active_workspace_root(state: &State<'_, ActiveWorkspaceRoot>) -> Result<PathBuf, FsError> {
    let guard = state
        .0
        .lock()
        .map_err(|_| FsError::io("workspace root lock poisoned"))?;
    guard.clone().ok_or_else(|| FsError::new("WorkspaceNotOpen", "workspace root is not open"))
}

#[tauri::command]
pub fn project_open_root(
    state: State<'_, ActiveProjectRoot>,
    path: String,
) -> Result<(), FsError> {
    let canonical = fs::canonicalize(&path)
        .map_err(|error| FsError::io(format!("cannot open project root: {error}")))?;
    if !canonical.is_dir() {
        return Err(FsError::invalid_path("project root is not a directory"));
    }
    let mut guard = state
        .lock()
        .map_err(|_| FsError::io("project root lock poisoned"))?;
    *guard = Some(canonical);
    Ok(())
}

#[tauri::command]
pub fn project_get_root(state: State<'_, ActiveProjectRoot>) -> Result<String, FsError> {
    let root = active_root(&state)?;
    Ok(root.to_string_lossy().to_string())
}

#[tauri::command]
pub fn project_ensure_layout(state: State<'_, ActiveProjectRoot>) -> Result<(), FsError> {
    let root = active_root(&state)?;
    for name in ["worlds", "media", "drafts"] {
        let directory = resolve_in_root(&root, name)?;
        fs::create_dir_all(directory)?;
    }
    Ok(())
}

#[tauri::command]
pub fn project_read_json(
    state: State<'_, ActiveProjectRoot>,
    rel_path: String,
) -> Result<Option<Value>, FsError> {
    let root = active_root(&state)?;
    let target = resolve_in_root(&root, &rel_path)?;
    read_json_at(&target)
}

#[tauri::command]
pub fn project_write_json_atomic(
    state: State<'_, ActiveProjectRoot>,
    rel_path: String,
    value: Value,
) -> Result<(), FsError> {
    let root = active_root(&state)?;
    let target = resolve_in_root(&root, &rel_path)?;
    write_json_atomic_at(&target, &value)
}

#[tauri::command]
pub fn project_delete_file(
    state: State<'_, ActiveProjectRoot>,
    rel_path: String,
) -> Result<(), FsError> {
    let root = active_root(&state)?;
    let target = resolve_in_root(&root, &rel_path)?;
    if target.is_dir() {
        return Err(FsError::invalid_path("project_delete_file requires a file path"));
    }
    match fs::remove_file(target) {
        Ok(()) => Ok(()),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(error) => Err(FsError::io(error)),
    }
}

#[tauri::command]
pub fn workspace_open_root(
    state: State<'_, ActiveWorkspaceRoot>,
    path: String,
) -> Result<(), FsError> {
    let canonical = fs::canonicalize(&path)
        .map_err(|error| FsError::io(format!("cannot open workspace root: {error}")))?;
    if !canonical.is_dir() {
        return Err(FsError::invalid_path("workspace root is not a directory"));
    }
    let mut guard = state
        .0
        .lock()
        .map_err(|_| FsError::io("workspace root lock poisoned"))?;
    *guard = Some(canonical);
    Ok(())
}

#[tauri::command]
pub fn workspace_get_root(state: State<'_, ActiveWorkspaceRoot>) -> Result<String, FsError> {
    let root = active_workspace_root(&state)?;
    Ok(root.to_string_lossy().to_string())
}

#[tauri::command]
pub fn workspace_read_json(
    state: State<'_, ActiveWorkspaceRoot>,
    rel_path: String,
) -> Result<Option<Value>, FsError> {
    let root = active_workspace_root(&state)?;
    let target = resolve_workspace_path(&root, &rel_path, false)?;
    read_json_at(&target)
}

#[tauri::command]
pub fn workspace_write_json_atomic(
    state: State<'_, ActiveWorkspaceRoot>,
    rel_path: String,
    value: Value,
) -> Result<(), FsError> {
    let root = active_workspace_root(&state)?;
    let target = resolve_workspace_path(&root, &rel_path, false)?;
    write_json_atomic_at(&target, &value)
}

#[tauri::command]
pub fn workspace_ensure_dir(
    state: State<'_, ActiveWorkspaceRoot>,
    rel_path: String,
) -> Result<(), FsError> {
    let root = active_workspace_root(&state)?;
    workspace_ensure_dir_at(&root, &rel_path)
}

#[tauri::command]
pub fn workspace_list_dir(
    state: State<'_, ActiveWorkspaceRoot>,
    rel_path: String,
) -> Result<Vec<WorkspaceDirEntry>, FsError> {
    let root = active_workspace_root(&state)?;
    workspace_list_dir_at(&root, &rel_path)
}

#[tauri::command]
pub fn workspace_move_to_trash(
    state: State<'_, ActiveWorkspaceRoot>,
    rel_path: String,
) -> Result<String, FsError> {
    let root = active_workspace_root(&state)?;
    workspace_move_to_trash_at(&root, &rel_path)
}

#[tauri::command]
pub fn workspace_restore_from_trash(
    state: State<'_, ActiveWorkspaceRoot>,
    trash_rel_path: String,
    rel_path: String,
) -> Result<(), FsError> {
    let root = active_workspace_root(&state)?;
    workspace_restore_from_trash_at(&root, &trash_rel_path, &rel_path)
}

#[tauri::command]
pub fn ledger_read_head(
    state: State<'_, ActiveProjectRoot>,
    rel_path: String,
) -> Result<Option<Value>, FsError> {
    let root = active_root(&state)?;
    let target = resolve_in_root(&root, &rel_path)?;
    read_json_at(&target)
}

#[tauri::command]
pub fn ledger_read_lines(
    state: State<'_, ActiveProjectRoot>,
    rel_path: String,
) -> Result<Vec<String>, FsError> {
    let root = active_root(&state)?;
    let target = resolve_in_root(&root, &rel_path)?;
    read_lines_at(&target)
}

#[tauri::command]
pub fn ledger_append_line(
    state: State<'_, ActiveProjectRoot>,
    rel_path: String,
    line: String,
) -> Result<(), FsError> {
    let root = active_root(&state)?;
    let target = resolve_in_root(&root, &rel_path)?;
    append_line_at(&target, &line)
}

#[tauri::command]
pub fn ledger_write_head(
    state: State<'_, ActiveProjectRoot>,
    rel_path: String,
    value: Value,
) -> Result<(), FsError> {
    let root = active_root(&state)?;
    let target = resolve_in_root(&root, &rel_path)?;
    write_json_atomic_at(&target, &value)
}

#[tauri::command]
pub fn ledger_hash_sha256(text: String) -> Result<String, FsError> {
    Ok(sha256_hex(&text))
}

fn sha256_hex(text: &str) -> String {
    let digest = Sha256::digest(text.as_bytes());
    hex::encode(digest)
}

fn resolve_in_root(root: &Path, rel_path: &str) -> Result<PathBuf, FsError> {
    if rel_path.trim().is_empty() {
        return Err(FsError::invalid_path("relative path must not be empty"));
    }

    let mut normalized = PathBuf::new();
    for component in Path::new(rel_path).components() {
        match component {
            Component::Prefix(_) | Component::RootDir => {
                return Err(FsError::invalid_path(
                    "absolute, drive and UNC paths are not allowed",
                ));
            }
            Component::CurDir => {}
            Component::ParentDir => {
                if !normalized.pop() {
                    return Err(FsError::escape(
                        "relative path escapes the project root",
                    ));
                }
            }
            Component::Normal(part) => normalized.push(part),
        }
    }

    if normalized.as_os_str().is_empty() {
        return Err(FsError::invalid_path("relative path resolves to the root"));
    }

    let canonical_root = fs::canonicalize(root)
        .map_err(|error| FsError::io(format!("cannot canonicalize project root: {error}")))?;
    let candidate = canonical_root.join(normalized);
    ensure_existing_ancestor_inside(&canonical_root, &candidate)?;
    Ok(candidate)
}

pub(crate) fn ensure_existing_ancestor_inside(
    canonical_root: &Path,
    candidate: &Path,
) -> Result<(), FsError> {
    let mut probe = candidate;
    loop {
        if probe.exists() {
            let canonical = fs::canonicalize(probe)
                .map_err(|error| FsError::io(format!("cannot canonicalize path: {error}")))?;
            if !canonical.starts_with(canonical_root) {
                return Err(FsError::escape(
                    "path resolves outside the project root",
                ));
            }
            return Ok(());
        }
        probe = probe
            .parent()
            .ok_or_else(|| FsError::escape("path has no existing ancestor"))?;
    }
}

fn resolve_workspace_path(
    root: &Path,
    rel_path: &str,
    allow_root: bool,
) -> Result<PathBuf, FsError> {
    if rel_path.trim().is_empty() || rel_path.trim() == "." {
        if !allow_root {
            return Err(FsError::invalid_path("workspace relative path must not be empty"));
        }
        return fs::canonicalize(root)
            .map_err(|error| FsError::io(format!("cannot canonicalize workspace root: {error}")));
    }
    resolve_in_root(root, rel_path)
}

fn workspace_ensure_dir_at(root: &Path, rel_path: &str) -> Result<(), FsError> {
    let target = resolve_workspace_path(root, rel_path, false)?;
    fs::create_dir_all(target)?;
    Ok(())
}

fn workspace_list_dir_at(root: &Path, rel_path: &str) -> Result<Vec<WorkspaceDirEntry>, FsError> {
    let target = resolve_workspace_path(root, rel_path, true)?;
    let mut entries = Vec::new();
    for entry in fs::read_dir(target)? {
        let entry = entry?;
        let metadata = entry.metadata()?;
        entries.push(WorkspaceDirEntry {
            name: entry.file_name().to_string_lossy().to_string(),
            kind: if metadata.is_dir() {
                "directory".to_string()
            } else {
                "file".to_string()
            },
        });
    }
    entries.sort_by(|left, right| left.name.cmp(&right.name));
    Ok(entries)
}

fn is_trash_relative(rel_path: &str) -> bool {
    let normalized = rel_path.replace('\\', "/");
    normalized == ".trash" || normalized.starts_with(".trash/")
}

fn workspace_move_to_trash_at(root: &Path, rel_path: &str) -> Result<String, FsError> {
    if is_trash_relative(rel_path) {
        return Err(FsError::invalid_path("cannot trash the trash directory"));
    }
    let source = resolve_workspace_path(root, rel_path, false)?;
    let file_name = source
        .file_name()
        .ok_or_else(|| FsError::invalid_path("trash source has no file name"))?
        .to_string_lossy()
        .to_string();
    let trash_root = root.join(".trash");
    fs::create_dir_all(&trash_root)?;
    let canonical_root = fs::canonicalize(root)
        .map_err(|error| FsError::io(format!("cannot canonicalize workspace root: {error}")))?;
    let canonical_trash = fs::canonicalize(&trash_root)
        .map_err(|error| FsError::io(format!("cannot canonicalize trash: {error}")))?;
    if !canonical_trash.starts_with(&canonical_root) {
        return Err(FsError::escape("trash directory escapes workspace root"));
    }
    let trash_name = format!("{}-{}", Uuid::new_v4(), file_name);
    let destination = canonical_trash.join(&trash_name);
    fs::rename(&source, &destination)?;
    Ok(format!(".trash/{trash_name}"))
}

fn workspace_restore_from_trash_at(
    root: &Path,
    trash_rel_path: &str,
    rel_path: &str,
) -> Result<(), FsError> {
    if !trash_rel_path.starts_with(".trash/") || !is_trash_relative(trash_rel_path) {
        return Err(FsError::invalid_path("trash path must be under .trash/"));
    }
    if is_trash_relative(rel_path) {
        return Err(FsError::invalid_path("restore destination must not be .trash"));
    }
    let source = resolve_workspace_path(root, trash_rel_path, false)?;
    let destination = resolve_workspace_path(root, rel_path, false)?;
    if destination.exists() {
        return Err(FsError::invalid_path("restore destination already exists"));
    }
    if let Some(parent) = destination.parent() {
        fs::create_dir_all(parent)?;
    }
    fs::rename(source, destination)?;
    Ok(())
}

pub(crate) fn read_json_at(target: &Path) -> Result<Option<Value>, FsError> {
    match fs::read_to_string(target) {
        Ok(text) => {
            let value = serde_json::from_str(&text)
                .map_err(|error| FsError::io(format!("invalid json {}: {error}", target.display())))?;
            Ok(Some(value))
        }
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(error) => Err(FsError::io(error)),
    }
}

fn read_lines_at(target: &Path) -> Result<Vec<String>, FsError> {
    match fs::read_to_string(target) {
        Ok(text) => {
            if text.is_empty() {
                return Ok(Vec::new());
            }
            let mut lines: Vec<String> = text.split('\n').map(ToString::to_string).collect();
            if lines.last().is_some_and(|line| line.is_empty()) {
                lines.pop();
            }
            Ok(lines)
        }
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(Vec::new()),
        Err(error) => Err(FsError::io(error)),
    }
}

fn append_line_at(target: &Path, line: &str) -> Result<(), FsError> {
    if let Some(parent) = target.parent() {
        fs::create_dir_all(parent)?;
    }
    let mut file = OpenOptions::new()
        .create(true)
        .append(true)
        .open(target)?;
    file.write_all(line.as_bytes())?;
    file.write_all(b"\n")?;
    file.sync_data()?;
    Ok(())
}

pub(crate) fn write_json_atomic_at(target: &Path, value: &Value) -> Result<(), FsError> {
    let parent = target
        .parent()
        .ok_or_else(|| FsError::invalid_path("target has no parent directory"))?;
    fs::create_dir_all(parent)?;

    let text = serde_json::to_string_pretty(value)?;
    let file_name = target
        .file_name()
        .ok_or_else(|| FsError::invalid_path("target has no file name"))?
        .to_string_lossy();
    let temp = parent.join(format!(".{file_name}.tmp-{}", Uuid::new_v4()));
    let backup = parent.join(format!("{file_name}.bak"));

    let result = (|| -> Result<(), FsError> {
        let mut file = OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&temp)?;
        file.write_all(text.as_bytes())?;
        file.sync_all()?;
        drop(file);

        if target.exists() {
            fs::copy(target, &backup)?;
        }
        fs::rename(&temp, target)?;
        Ok(())
    })();

    if result.is_err() {
        let _ = fs::remove_file(&temp);
    }
    result
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn temp_root(tag: &str) -> PathBuf {
        let root = std::env::temp_dir().join(format!(
            "neurou-r3-{tag}-{}",
            Uuid::new_v4()
        ));
        fs::create_dir_all(&root).expect("create temp root");
        root
    }

    fn cleanup(root: &Path) {
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn resolve_in_root_allows_normal_subpath() {
        let root = temp_root("resolve-normal");
        let canonical = root.canonicalize().unwrap();
        let resolved = resolve_in_root(&root, "worlds/w1").unwrap();
        assert_eq!(resolved, canonical.join("worlds").join("w1"));

        let normalized = resolve_in_root(&root, "worlds/../media").unwrap();
        assert_eq!(normalized, canonical.join("media"));
        cleanup(&root);
    }

    #[test]
    fn resolve_in_root_rejects_parent_escape() {
        let root = temp_root("resolve-escape");
        let error = resolve_in_root(&root, "../outside").unwrap_err();
        assert_eq!(error.code, "EscapeDetected");
        cleanup(&root);
    }

    #[test]
    fn resolve_in_root_rejects_absolute_and_unc() {
        let root = temp_root("resolve-absolute");
        assert_eq!(
            resolve_in_root(&root, "/absolute").unwrap_err().code,
            "InvalidPath"
        );
        #[cfg(windows)]
        {
            assert_eq!(
                resolve_in_root(&root, "C:\\Windows\\System32").unwrap_err().code,
                "InvalidPath"
            );
            assert_eq!(
                resolve_in_root(&root, "\\\\server\\share").unwrap_err().code,
                "InvalidPath"
            );
        }
        cleanup(&root);
    }

    #[cfg(windows)]
    #[test]
    fn resolve_in_root_rejects_symlink_escape_when_available() {
        let root = temp_root("resolve-symlink");
        let outside = temp_root("resolve-symlink-outside");
        let link = root.join("link");
        let created = std::os::windows::fs::symlink_dir(&outside, &link).is_ok();
        if created {
            let error = resolve_in_root(&root, "link/escaped").unwrap_err();
            assert_eq!(error.code, "EscapeDetected");
        }
        cleanup(&root);
        cleanup(&outside);
    }

    #[test]
    fn atomic_write_keeps_old_value_until_rename() {
        let root = temp_root("atomic");
        let target = root.join("project.json");
        write_json_atomic_at(&target, &json!({ "value": 1 })).unwrap();

        let leftover = root.join(".project.json.tmp-test");
        fs::write(&leftover, "{ broken").unwrap();
        let current = read_json_at(&target).unwrap().unwrap();
        assert_eq!(current["value"], 1);
        fs::remove_file(&leftover).unwrap();

        write_json_atomic_at(&target, &json!({ "value": 2 })).unwrap();
        let updated = read_json_at(&target).unwrap().unwrap();
        assert_eq!(updated["value"], 2);
        let backup = read_json_at(&root.join("project.json.bak")).unwrap().unwrap();
        assert_eq!(backup["value"], 1);
        cleanup(&root);
    }

    #[test]
    fn append_and_read_lines_round_trip() {
        let root = temp_root("ledger");
        let target = root.join("worlds/w1/ledger.ndjson");
        append_line_at(&target, "line-1").unwrap();
        append_line_at(&target, "line-2").unwrap();
        assert_eq!(
            read_lines_at(&target).unwrap(),
            vec!["line-1".to_string(), "line-2".to_string()]
        );
        cleanup(&root);
    }

    #[test]
    fn workspace_ensure_list_read_write() {
        let root = temp_root("workspace-io");
        workspace_ensure_dir_at(&root, "pf-0001/12345678/worlds/w1").unwrap();
        let target = root.join("pf-0001/12345678/project.json");
        write_json_atomic_at(&target, &json!({ "schemaVersion": 2 })).unwrap();
        assert_eq!(
            read_json_at(&target).unwrap().unwrap()["schemaVersion"],
            2
        );

        let entries = workspace_list_dir_at(&root, "pf-0001/12345678").unwrap();
        assert_eq!(entries.len(), 2);
        assert_eq!(entries[0].name, "project.json");
        assert_eq!(entries[1].name, "worlds");
        assert_eq!(entries[1].kind, "directory");

        let root_entries = workspace_list_dir_at(&root, "").unwrap();
        assert_eq!(root_entries[0].name, "pf-0001");
        cleanup(&root);
    }

    #[test]
    fn workspace_trash_and_restore_round_trip() {
        let root = temp_root("workspace-trash");
        workspace_ensure_dir_at(&root, "pf-0001/12345678").unwrap();
        let project_file = root.join("pf-0001/12345678/project.json");
        write_json_atomic_at(&project_file, &json!({ "value": 1 })).unwrap();

        let trash_path = workspace_move_to_trash_at(&root, "pf-0001/12345678").unwrap();
        assert!(trash_path.starts_with(".trash/"));
        assert!(!root.join("pf-0001/12345678").exists());
        assert!(root.join(&trash_path).exists());

        workspace_restore_from_trash_at(&root, &trash_path, "pf-0001/12345678").unwrap();
        assert!(project_file.exists());
        assert!(!root.join(&trash_path).exists());
        cleanup(&root);
    }

    #[test]
    fn workspace_rejects_escapes_and_trash_escape() {
        let root = temp_root("workspace-escape");
        assert_eq!(
            resolve_workspace_path(&root, "../outside", false).unwrap_err().code,
            "EscapeDetected"
        );
        assert_eq!(
            workspace_move_to_trash_at(&root, ".trash").unwrap_err().code,
            "InvalidPath"
        );
        assert_eq!(
            workspace_restore_from_trash_at(&root, "../outside", "pf-0001/12345678")
                .unwrap_err()
                .code,
            "InvalidPath"
        );
        cleanup(&root);
    }

    #[test]
    fn sha256_matches_known_vector() {
        assert_eq!(
            sha256_hex("abc"),
            "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
        );
    }
}
