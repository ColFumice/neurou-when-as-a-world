use crate::commands::fs::{ensure_existing_ancestor_inside, FsError};
use sha2::{Digest, Sha256};
use std::fs::{self, File};
use std::io::Read;
use std::path::{Component, Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};
use uuid::Uuid;

const MAX_SOURCE_PATH_CHARS: usize = 4096;

/// 输入路径安全：用户选择的绝对路径，允许在项目外，但必须是普通本地文件。
pub fn validate_source_path(source: &str) -> Result<PathBuf, FsError> {
    let trimmed = source.trim();
    if trimmed.is_empty() {
        return Err(FsError::new("InvalidPath", "source path must not be empty"));
    }
    if trimmed.len() > MAX_SOURCE_PATH_CHARS {
        return Err(FsError::new("InvalidPath", "source path is too long"));
    }
    if trimmed.contains('\0') || trimmed.contains('\n') || trimmed.contains('\r') {
        return Err(FsError::new("InvalidPath", "source path contains control characters"));
    }

    #[cfg(windows)]
    {
        let raw_text = trimmed.to_ascii_lowercase();
        if raw_text.starts_with(r"\\.\")
            || raw_text.starts_with(r"\\?\globalroot")
            || raw_text.starts_with(r"\\?\unc\")
        {
            return Err(FsError::new(
                "UnsupportedSourcePath",
                "device, UNC and GLOBALROOT paths are not supported",
            ));
        }
    }

    let raw = Path::new(trimmed);
    if !raw.is_absolute() {
        return Err(FsError::new("InvalidPath", "source path must be absolute"));
    }

    let canonical = fs::canonicalize(raw)
        .map_err(|error| FsError::new("InvalidPath", format!("cannot resolve source: {error}")))?;

    #[cfg(windows)]
    {
        let text = canonical.to_string_lossy().to_ascii_lowercase();
        if text.starts_with(r"\\.\")
            || text.starts_with(r"\\?\globalroot")
            || text.starts_with(r"\\?\unc\")
        {
            return Err(FsError::new(
                "UnsupportedSourcePath",
                "device, UNC and GLOBALROOT paths are not supported",
            ));
        }
        if let Some(name) = canonical.file_name().and_then(|value| value.to_str()) {
            if is_windows_device_name(name) {
                return Err(FsError::new(
                    "UnsupportedSourcePath",
                    "Windows device names are not supported",
                ));
            }
        }
    }

    #[cfg(unix)]
    {
        let text = canonical.to_string_lossy();
        if text.starts_with("/dev/") || text.starts_with("/proc/") || text.starts_with("/sys/") {
            return Err(FsError::new(
                "UnsupportedSourcePath",
                "device and virtual filesystem paths are not supported",
            ));
        }
    }

    if !canonical.is_file() {
        return Err(FsError::new("InvalidPath", "source path is not a regular file"));
    }

    Ok(canonical)
}

#[cfg(windows)]
fn is_windows_device_name(name: &str) -> bool {
    let stem = name
        .split('.')
        .next()
        .unwrap_or(name)
        .trim_end_matches(|ch| ch == ' ' || ch == '.')
        .to_ascii_uppercase();
    matches!(
        stem.as_str(),
        "CON" | "PRN" | "AUX" | "NUL"
            | "COM1" | "COM2" | "COM3" | "COM4" | "COM5" | "COM6" | "COM7" | "COM8" | "COM9"
            | "LPT1" | "LPT2" | "LPT3" | "LPT4" | "LPT5" | "LPT6" | "LPT7" | "LPT8" | "LPT9"
    )
}

/// 输出路径安全：只允许 media/ 下的相对路径；拒绝绝对路径、盘符、UNC 和任何 `..`。
pub fn resolve_media_output(root: &Path, rel_path: &str) -> Result<PathBuf, FsError> {
    let trimmed = rel_path.trim();
    if trimmed.is_empty() {
        return Err(FsError::new("InvalidPath", "media relative path must not be empty"));
    }

    let mut normalized = PathBuf::new();
    for component in Path::new(trimmed).components() {
        match component {
            Component::Prefix(_) | Component::RootDir => {
                return Err(FsError::new(
                    "InvalidPath",
                    "absolute, drive and UNC media paths are not allowed",
                ));
            }
            Component::CurDir => {}
            Component::ParentDir => {
                return Err(FsError::new(
                    "InvalidPath",
                    "media path must not contain '..'",
                ));
            }
            Component::Normal(part) => normalized.push(part),
        }
    }

    let mut components = normalized.components();
    let first = components.next();
    match first {
        Some(Component::Normal(part)) if part.to_string_lossy() == "media" => {}
        _ => {
            return Err(FsError::new(
                "InvalidPath",
                "media output must live under media/",
            ));
        }
    }
    let rest: PathBuf = components.collect();
    if rest.as_os_str().is_empty() {
        return Err(FsError::new("InvalidPath", "media output must name a file"));
    }

    let media_root = root.join("media");
    fs::create_dir_all(&media_root)?;
    let canonical_root = fs::canonicalize(root)
        .map_err(|error| FsError::new("IoError", format!("cannot canonicalize project root: {error}")))?;
    let canonical_media = fs::canonicalize(&media_root)
        .map_err(|error| FsError::new("IoError", format!("cannot canonicalize media root: {error}")))?;
    let candidate = canonical_media.join(rest);
    ensure_existing_ancestor_inside(&canonical_root, &candidate)?;
    if !candidate.starts_with(&canonical_media) {
        return Err(FsError::new(
            "EscapeDetected",
            "media output resolves outside media/",
        ));
    }
    Ok(candidate)
}

pub fn media_rel(asset_id: &str, extension: &str) -> Result<String, FsError> {
    if !is_safe_asset_id(asset_id) {
        return Err(FsError::new("InvalidPath", "unsafe asset id"));
    }
    if !is_safe_extension(extension) {
        return Err(FsError::new("InvalidPath", "unsafe media extension"));
    }
    Ok(format!("media/{asset_id}.{extension}"))
}

/// 立体对固定目录：media/stereo/<pairId>/{left.mp4,right.mp4,audio.wav}。
pub fn stereo_rel(pair_id: &str, file: &str) -> Result<String, FsError> {
    if !is_safe_asset_id(pair_id) {
        return Err(FsError::new("InvalidPath", "unsafe stereo pair id"));
    }
    if !matches!(file, "left.mp4" | "right.mp4" | "audio.wav") {
        return Err(FsError::new("InvalidPath", "unsafe stereo output filename"));
    }
    Ok(format!("media/stereo/{pair_id}/{file}"))
}

pub fn frame_rel(asset_id: &str, time_ms: i64) -> Result<String, FsError> {
    if !is_safe_asset_id(asset_id) {
        return Err(FsError::new("InvalidPath", "unsafe frame asset id"));
    }
    if time_ms < 0 {
        return Err(FsError::new("InvalidTimeRange", "frame time must be non-negative"));
    }
    Ok(format!("media/frames/{asset_id}/{time_ms}.jpg"))
}

pub fn create_temp_dir(root: &Path) -> Result<PathBuf, FsError> {
    let base = resolve_media_output(root, "media/.tmp")?;
    fs::create_dir_all(&base)?;
    let dir = base.join(Uuid::new_v4().to_string());
    fs::create_dir_all(&dir)?;
    Ok(dir)
}

pub fn cleanup_dir(dir: &Path) {
    let _ = fs::remove_dir_all(dir);
}

pub fn is_safe_asset_id(value: &str) -> bool {
    !value.is_empty()
        && value.len() <= 64
        && value.chars().all(|ch| ch.is_ascii_hexdigit())
}

pub fn is_safe_extension(value: &str) -> bool {
    !value.is_empty()
        && value.len() <= 8
        && value.chars().all(|ch| ch.is_ascii_alphanumeric())
}

pub fn sha256_text(value: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(value.as_bytes());
    hex::encode(hasher.finalize())
}

pub fn sha256_file(path: &Path) -> Result<String, FsError> {
    let mut file = File::open(path)?;
    let mut hasher = Sha256::new();
    let mut buffer = [0u8; 64 * 1024];
    loop {
        let read = file.read(&mut buffer)?;
        if read == 0 {
            break;
        }
        hasher.update(&buffer[..read]);
    }
    Ok(hex::encode(hasher.finalize()))
}

pub fn sync_file(path: &Path) -> Result<(), FsError> {
    // Windows 的 FlushFileBuffers 需要可写句柄；只读 File::open 会拒绝访问。
    let file = fs::OpenOptions::new().read(true).write(true).open(path)?;
    file.sync_all()?;
    Ok(())
}

pub fn now_ms() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis() as i64)
        .unwrap_or(0)
}

pub fn sanitized_display_name(raw: Option<&str>, source: &Path) -> String {
    let candidate = raw
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToString::to_string)
        .or_else(|| {
            source
                .file_name()
                .and_then(|value| value.to_str())
                .map(ToString::to_string)
        })
        .unwrap_or_else(|| "asset".to_string());
    let cleaned: String = candidate
        .chars()
        .filter(|ch| !ch.is_control())
        .take(200)
        .collect();
    if cleaned.trim().is_empty() {
        "asset".to_string()
    } else {
        cleaned
    }
}

pub fn extension_of(path: &Path) -> String {
    path.extension()
        .and_then(|value| value.to_str())
        .unwrap_or("")
        .to_ascii_lowercase()
}

pub fn ensure_media_layout(root: &Path) -> Result<(), FsError> {
    fs::create_dir_all(root.join("media"))?;
    fs::create_dir_all(root.join("media").join("frames"))?;
    Ok(())
}
