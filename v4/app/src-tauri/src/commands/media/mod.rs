pub mod manifest;
pub mod model;
pub mod paths;
pub mod probe;
pub mod process;
pub mod stereo;

use crate::commands::fs::{active_root, ActiveProjectRoot, FsError};
use manifest::{commit_asset, find_asset, load_manifest};
use model::{
    MediaAsset, MediaFrame, MediaProbe, MediaStereoImport, MediaTrim, MediaTrimInfo,
    KIND_AUDIO, KIND_VIDEO,
};
use std::ffi::OsString;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tauri::State;

const TRANSCODE_TIMEOUT: Duration = Duration::from_secs(15 * 60);
const FRAME_TIMEOUT: Duration = Duration::from_secs(30);
const MAX_READ_BYTES: u64 = 256 * 1024 * 1024;
const MAX_FRAME_COUNT: usize = 120;
const MAX_TRIM_MS: i64 = 30 * 60 * 1000;
const MIN_TRIM_MS: i64 = 50;

pub struct MediaLock(pub Arc<Mutex<()>>);

impl Default for MediaLock {
    fn default() -> Self {
        Self(Arc::new(Mutex::new(())))
    }
}

fn task_failed(error: impl std::fmt::Display) -> FsError {
    FsError::new("TaskFailed", format!("media task failed: {error}"))
}

fn lock_media(lock: &Arc<Mutex<()>>) -> Result<std::sync::MutexGuard<'_, ()>, FsError> {
    lock.lock()
        .map_err(|_| FsError::new("LockPoisoned", "media lock is poisoned"))
}

#[tauri::command]
pub async fn media_probe(source_path: String) -> Result<MediaProbe, FsError> {
    tauri::async_runtime::spawn_blocking(move || {
        let source = paths::validate_source_path(&source_path)?;
        probe::probe_source(&source)
    })
    .await
    .map_err(task_failed)?
}

#[tauri::command]
pub async fn media_import_mono_stereo(
    state: State<'_, ActiveProjectRoot>,
    _lock: State<'_, MediaLock>,
    source_path: String,
    offset_ms: i64,
) -> Result<MediaStereoImport, FsError> {
    let root = active_root(&state)?;
    tauri::async_runtime::spawn_blocking(move || {
        let source = paths::validate_source_path(&source_path)?;
        stereo::import_mono_stereo(&root, &source, offset_ms)
    })
    .await
    .map_err(task_failed)?
}

#[tauri::command]
pub async fn media_import_stereo(
    state: State<'_, ActiveProjectRoot>,
    lock: State<'_, MediaLock>,
    left_path: String,
    right_path: String,
) -> Result<MediaStereoImport, FsError> {
    let root = active_root(&state)?;
    let lock = lock.0.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let _guard = lock_media(&lock)?;
        let left = paths::validate_source_path(&left_path)?;
        let right = paths::validate_source_path(&right_path)?;
        stereo::import_stereo(&root, &left, &right)
    })
    .await
    .map_err(task_failed)?
}

#[tauri::command]
pub async fn media_trim(
    state: State<'_, ActiveProjectRoot>,
    lock: State<'_, MediaLock>,
    asset_id: String,
    start_ms: i64,
    end_ms: i64,
) -> Result<MediaTrim, FsError> {
    let root = active_root(&state)?;
    let lock = lock.0.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let _guard = lock_media(&lock)?;
        trim_media(&root, &asset_id, start_ms, end_ms)
    })
    .await
    .map_err(task_failed)?
}

/// Demo 用：把 media/ 下的视频以字节返回，供前端 blob: 纹理使用，
/// 避免 WebGL 直接读取 asset protocol 的跨源视频纹理。
#[tauri::command]
pub async fn media_read_file(
    state: State<'_, ActiveProjectRoot>,
    rel_path: String,
) -> Result<Vec<u8>, FsError> {
    let root = active_root(&state)?;
    tauri::async_runtime::spawn_blocking(move || {
        let path = paths::resolve_media_output(&root, &rel_path)?;
        let metadata = fs::metadata(&path)?;
        if metadata.len() > MAX_READ_BYTES {
            return Err(FsError::new(
                "UnsupportedMedia",
                "media file exceeds the 256 MiB demo read limit",
            ));
        }
        fs::read(path).map_err(FsError::from)
    })
    .await
    .map_err(task_failed)?
}

#[tauri::command]
pub async fn media_extract_frames(
    state: State<'_, ActiveProjectRoot>,
    lock: State<'_, MediaLock>,
    asset_id: String,
    times_ms: Vec<i64>,
    max_width: Option<u32>,
) -> Result<Vec<MediaFrame>, FsError> {
    let root = active_root(&state)?;
    let lock = lock.0.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let _guard = lock_media(&lock)?;
        extract_frames(&root, &asset_id, &times_ms, max_width)
    })
    .await
    .map_err(task_failed)?
}

fn trim_media(
    root: &Path,
    asset_id: &str,
    start_ms: i64,
    end_ms: i64,
) -> Result<MediaTrim, FsError> {
    if start_ms < 0 || end_ms <= start_ms {
        return Err(FsError::new("InvalidTimeRange", "trim range is invalid"));
    }
    if end_ms - start_ms < MIN_TRIM_MS {
        return Err(FsError::new(
            "InvalidTimeRange",
            format!("trim must be at least {MIN_TRIM_MS}ms"),
        ));
    }
    if end_ms - start_ms > MAX_TRIM_MS {
        return Err(FsError::new(
            "InvalidTimeRange",
            "trim must be at most 30 minutes",
        ));
    }

    let mut manifest = load_manifest(root)?;
    let source_asset = find_asset(&manifest, asset_id)
        .ok_or_else(|| FsError::new("AssetNotFound", format!("asset not found: {asset_id}")))?
        .clone();
    if end_ms > source_asset.duration_ms {
        return Err(FsError::new(
            "InvalidTimeRange",
            format!("trim end {}ms exceeds asset duration {}ms", end_ms, source_asset.duration_ms),
        ));
    }
    if !matches!(source_asset.kind.as_str(), KIND_VIDEO | KIND_AUDIO) {
        return Err(FsError::new(
            "UnsupportedMedia",
            "trim only supports video or audio assets",
        ));
    }
    if let Some(existing) = manifest.assets.iter().find(|asset| {
        asset.derived_from.as_deref() == Some(source_asset.asset_id.as_str())
            && asset
                .trim
                .as_ref()
                .is_some_and(|trim| trim.start_ms == start_ms && trim.end_ms == end_ms)
    }) {
        return Ok(MediaTrim {
            source_asset_id: source_asset.asset_id.clone(),
            asset: existing.clone(),
        });
    }

    let source_path = paths::resolve_media_output(root, &source_asset.rel_path)?;
    let source_ext = paths::extension_of(&source_path);
    let output_ext = if source_asset.kind == KIND_VIDEO {
        "mp4".to_string()
    } else if matches!(source_ext.as_str(), "wav" | "flac") {
        "wav".to_string()
    } else {
        "m4a".to_string()
    };

    let temp_dir = paths::create_temp_dir(root)?;
    let mut created_final: Option<PathBuf> = None;
    let result = (|| -> Result<MediaTrim, FsError> {
        let temp_out = temp_dir.join(format!("trim.{output_ext}"));
        let args = if source_asset.kind == KIND_VIDEO {
            video_trim_args(&source_path, &temp_out, start_ms, end_ms)
        } else {
            audio_trim_args(&source_path, &temp_out, start_ms, end_ms, &output_ext)
        };
        run_ffmpeg(args, TRANSCODE_TIMEOUT)?;
        paths::sync_file(&temp_out)?;

        let stored_sha = paths::sha256_file(&temp_out)?;
        let trim_asset_id = stored_sha[..16].to_string();
        if manifest.assets.iter().any(|asset| asset.asset_id == trim_asset_id) {
            return Err(FsError::new(
                "AssetConflict",
                "trim output collides with an existing asset",
            ));
        }
        let output_probe = probe::probe_source(&temp_out)?;
        let rel_path = paths::media_rel(&trim_asset_id, &output_ext)?;
        let final_path = paths::resolve_media_output(root, &rel_path)?;
        if final_path.exists() {
            return Err(FsError::new(
                "AssetConflict",
                "trim output already exists on disk",
            ));
        }
        fs::rename(&temp_out, &final_path)?;
        created_final = Some(final_path.clone());

        let asset = MediaAsset {
            asset_id: trim_asset_id,
            kind: source_asset.kind.clone(),
            display_name: source_asset.display_name.clone(),
            rel_path,
            sha256: stored_sha,
            source_sha256: None,
            bytes: fs::metadata(&final_path)?.len(),
            duration_ms: output_probe.duration_ms,
            width: output_probe.width,
            height: output_probe.height,
            fps: output_probe.fps,
            video_codec: output_probe.video_codec,
            audio_codec: output_probe.audio_codec,
            audio_channels: output_probe.audio_channels,
            sample_rate: output_probe.sample_rate,
            created_at: paths::now_ms(),
            derived_from: Some(source_asset.asset_id.clone()),
            trim: Some(MediaTrimInfo { start_ms, end_ms }),
            stereo_pair_id: source_asset.stereo_pair_id.clone(),
            eye: source_asset.eye.clone(),
            audio_channel: source_asset.audio_channel.clone(),
        };
        let returned = asset.clone();
        commit_asset(root, &mut manifest, asset, &final_path, false)?;
        Ok(MediaTrim {
            source_asset_id: source_asset.asset_id.clone(),
            asset: returned,
        })
    })();

    if result.is_err() {
        if let Some(path) = created_final {
            let _ = fs::remove_file(path);
        }
    }
    paths::cleanup_dir(&temp_dir);
    result
}

fn extract_frames(
    root: &Path,
    asset_id: &str,
    times_ms: &[i64],
    max_width: Option<u32>,
) -> Result<Vec<MediaFrame>, FsError> {
    if times_ms.is_empty() || times_ms.len() > MAX_FRAME_COUNT {
        return Err(FsError::new(
            "FrameLimitExceeded",
            format!("frame times must contain 1..={MAX_FRAME_COUNT} entries"),
        ));
    }
    if let Some(width) = max_width {
        if !(64..=1920).contains(&width) || width % 2 != 0 {
            return Err(FsError::new(
                "InvalidTimeRange",
                "maxWidth must be an even number between 64 and 1920",
            ));
        }
    }

    let manifest = load_manifest(root)?;
    let asset = find_asset(&manifest, asset_id)
        .ok_or_else(|| FsError::new("AssetNotFound", format!("asset not found: {asset_id}")))?
        .clone();
    if asset.kind != KIND_VIDEO {
        return Err(FsError::new(
            "UnsupportedMedia",
            "frame extraction only supports video assets",
        ));
    }

    let mut times = times_ms.to_vec();
    times.sort_unstable();
    times.dedup();
    for time in &times {
        if *time < 0 || *time > asset.duration_ms {
            return Err(FsError::new(
                "InvalidTimeRange",
                format!("frame time {time}ms is outside 0..{}ms", asset.duration_ms),
            ));
        }
    }

    let source_path = paths::resolve_media_output(root, &asset.rel_path)?;
    let temp_dir = paths::create_temp_dir(root)?;
    let mut moved: Vec<PathBuf> = Vec::new();
    let result = (|| -> Result<Vec<MediaFrame>, FsError> {
        let temp_frames = temp_dir.join("frames");
        fs::create_dir_all(&temp_frames)?;
        let frame_dir_rel = format!("media/frames/{asset_id}");
        let final_dir = paths::resolve_media_output(root, &frame_dir_rel)?;
        fs::create_dir_all(&final_dir)?;

        let mut frames = Vec::with_capacity(times.len());
        for time in &times {
            let temp_frame = temp_frames.join(format!("{time}.jpg"));
            let args = frame_args(
                &source_path,
                &temp_frame,
                *time,
                max_width,
            );
            run_ffmpeg(args, FRAME_TIMEOUT)?;
            let target = final_dir.join(format!("{time}.jpg"));
            if target.exists() {
                fs::remove_file(&target)?;
            }
            fs::rename(&temp_frame, &target)?;
            moved.push(target.clone());
            let (width, height) = frame_dimensions(&asset, max_width);
            frames.push(MediaFrame {
                time_ms: *time,
                rel_path: paths::frame_rel(asset_id, *time)?,
                width,
                height,
            });
        }
        Ok(frames)
    })();

    if result.is_err() {
        // 只清理本次已移动的帧；不动历史帧。
        for path in &moved {
            let _ = fs::remove_file(path);
        }
    }
    paths::cleanup_dir(&temp_dir);
    result
}

fn base_ffmpeg_args() -> Vec<OsString> {
    vec![
        "-nostdin".into(),
        "-hide_banner".into(),
        "-loglevel".into(),
        "error".into(),
        "-protocol_whitelist".into(),
        "file".into(),
    ]
}

fn video_trim_args(source: &Path, output: &Path, start_ms: i64, end_ms: i64) -> Vec<OsString> {
    let mut args = base_ffmpeg_args();
    args.extend([
        "-ss".into(),
        seconds(start_ms),
        "-i".into(),
        source.as_os_str().to_os_string(),
        "-t".into(),
        seconds(end_ms - start_ms),
        "-map".into(),
        "0:v:0".into(),
        "-map".into(),
        "0:a:0?".into(),
        "-sn".into(),
        "-dn".into(),
        "-map_metadata".into(),
        "0".into(),
        "-c:v".into(),
        "libx264".into(),
        "-preset".into(),
        "veryfast".into(),
        "-crf".into(),
        "20".into(),
        "-pix_fmt".into(),
        "yuv420p".into(),
        "-c:a".into(),
        "aac".into(),
        "-b:a".into(),
        "192k".into(),
        "-movflags".into(),
        "+faststart".into(),
        "-y".into(),
        output.as_os_str().to_os_string(),
    ]);
    args
}

fn audio_trim_args(
    source: &Path,
    output: &Path,
    start_ms: i64,
    end_ms: i64,
    ext: &str,
) -> Vec<OsString> {
    let mut args = base_ffmpeg_args();
    args.extend([
        "-ss".into(),
        seconds(start_ms),
        "-i".into(),
        source.as_os_str().to_os_string(),
        "-t".into(),
        seconds(end_ms - start_ms),
        "-map".into(),
        "0:a:0".into(),
        "-vn".into(),
        "-y".into(),
    ]);
    if ext == "wav" {
        args.extend(["-c:a".into(), "pcm_s16le".into()]);
    } else {
        args.extend([
            "-c:a".into(),
            "aac".into(),
            "-b:a".into(),
            "192k".into(),
            "-movflags".into(),
            "+faststart".into(),
        ]);
    }
    args.push(output.as_os_str().to_os_string());
    args
}

fn frame_args(
    source: &Path,
    output: &Path,
    time_ms: i64,
    max_width: Option<u32>,
) -> Vec<OsString> {
    let mut args = base_ffmpeg_args();
    args.extend([
        "-ss".into(),
        seconds(time_ms),
        "-i".into(),
        source.as_os_str().to_os_string(),
        "-frames:v".into(),
        "1".into(),
        "-q:v".into(),
        "2".into(),
    ]);
    if let Some(width) = max_width {
        args.extend([
            "-vf".into(),
            format!("scale=min({width}\\,iw):-2").into(),
        ]);
    }
    args.extend([
        "-y".into(),
        output.as_os_str().to_os_string(),
    ]);
    args
}

fn run_ffmpeg(args: Vec<OsString>, timeout: Duration) -> Result<(), FsError> {
    let tool = process::ffmpeg_path()?;
    process::run_checked(&tool, &args, timeout, "FfmpegFailed")?;
    Ok(())
}

fn seconds(ms: i64) -> OsString {
    format!("{:.3}", ms as f64 / 1000.0).into()
}

fn frame_dimensions(asset: &MediaAsset, max_width: Option<u32>) -> (u32, u32) {
    let Some(max_width) = max_width else {
        return (asset.width, asset.height);
    };
    if asset.width == 0 || asset.height == 0 || asset.width <= max_width {
        return (asset.width, asset.height);
    }
    let height = ((asset.height as f64 * max_width as f64) / asset.width as f64).round() as u32;
    (max_width, height.max(2))
}

#[cfg(test)]
mod tests;
