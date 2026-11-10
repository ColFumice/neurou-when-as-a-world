use super::manifest::{commit_stereo, find_asset, find_stereo_dedupe, load_manifest};
use super::model::{MediaAsset, MediaProbe, MediaStereoImport, StereoPair, KIND_AUDIO, KIND_VIDEO};
use super::paths;
use super::probe;
use super::process;
use crate::commands::fs::FsError;
use std::collections::HashSet;
use std::ffi::OsString;
use std::fs;
use std::path::{Path, PathBuf};
use std::time::Duration;

const TRANSCODE_TIMEOUT: Duration = Duration::from_secs(15 * 60);
const MAX_VIDEO_BYTES: u64 = 4 * 1024 * 1024 * 1024;
const DURATION_TOLERANCE_MS: i64 = 500;
const AUDIO_SAMPLE_RATE: u32 = 48_000;
const AUDIO_CHANNELS: u32 = 2;

fn run_ffmpeg(args: Vec<OsString>) -> Result<(), FsError> {
    let tool = process::ffmpeg_path()?;
    process::run_checked(&tool, &args, TRANSCODE_TIMEOUT, "FfmpegFailed")?;
    Ok(())
}

fn base_args() -> Vec<OsString> {
    vec![
        "-nostdin".into(),
        "-hide_banner".into(),
        "-loglevel".into(),
        "error".into(),
        "-protocol_whitelist".into(),
        "file".into(),
    ]
}

fn seconds(ms: i64) -> OsString {
    format!("{:.3}", ms as f64 / 1000.0).into()
}

pub(crate) fn validate_pair(left: &MediaProbe, right: &MediaProbe) -> Result<(), FsError> {
    if left.kind != KIND_VIDEO || right.kind != KIND_VIDEO {
        return Err(FsError::new(
            "UnsupportedMedia",
            "stereo import requires two video files",
        ));
    }
    if left.width == 0 || left.height == 0 || right.width == 0 || right.height == 0 {
        return Err(FsError::new(
            "UnsupportedMedia",
            "stereo videos must have non-zero resolution",
        ));
    }
    if left.width != right.width || left.height != right.height {
        return Err(FsError::new(
            "StereoResolutionMismatch",
            format!(
                "left {}x{}, right {}x{}",
                left.width, left.height, right.width, right.height
            ),
        ));
    }
    let delta = (left.duration_ms - right.duration_ms).abs();
    if delta > DURATION_TOLERANCE_MS {
        return Err(FsError::new(
            "StereoDurationMismatch",
            format!(
                "duration delta {}ms exceeds {}ms (left {}ms, right {}ms)",
                delta, DURATION_TOLERANCE_MS, left.duration_ms, right.duration_ms
            ),
        ));
    }
    Ok(())
}

fn stereo_video_args(source: &Path, output: &Path) -> Vec<OsString> {
    let mut args = base_args();
    args.extend([
        "-i".into(),
        source.as_os_str().to_os_string(),
        "-map".into(),
        "0:v:0".into(),
        "-an".into(),
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
        "-movflags".into(),
        "+faststart".into(),
        "-y".into(),
        output.as_os_str().to_os_string(),
    ]);
    args
}

fn stereo_audio_args(
    left: &Path,
    right: &Path,
    left_has_audio: bool,
    right_has_audio: bool,
    common_ms: i64,
    output: &Path,
) -> Vec<OsString> {
    let mut args = base_args();
    let duration = seconds(common_ms);
    let silence = "anullsrc=channel_layout=mono:sample_rate=48000".to_string();
    args.extend([
        "-i".into(),
        left.as_os_str().to_os_string(),
        "-i".into(),
        right.as_os_str().to_os_string(),
        "-f".into(),
        "lavfi".into(),
        "-t".into(),
        duration.clone(),
        "-i".into(),
        silence.clone().into(),
        "-f".into(),
        "lavfi".into(),
        "-t".into(),
        duration.clone(),
        "-i".into(),
        silence.into(),
    ]);

    let left_src = if left_has_audio { "[0:a]" } else { "[2:a]" };
    let right_src = if right_has_audio { "[1:a]" } else { "[3:a]" };
    let duration_text = format!("{:.3}", common_ms as f64 / 1000.0);
    let filter = format!(
        "{left_src}aformat=sample_rates=48000:channel_layouts=mono,pan=mono|c0=c0,apad,atrim=duration={duration_text},asetpts=PTS-STARTPTS[l];\
         {right_src}aformat=sample_rates=48000:channel_layouts=mono,pan=mono|c0=c0,apad,atrim=duration={duration_text},asetpts=PTS-STARTPTS[r];\
         [l][r]amerge=inputs=2,pan=stereo|c0=c0|c1=c1[a]"
    );
    args.extend([
        "-filter_complex".into(),
        filter.into(),
        "-map".into(),
        "[a]".into(),
        "-c:a".into(),
        "pcm_s16le".into(),
        "-ar".into(),
        AUDIO_SAMPLE_RATE.to_string().into(),
        "-ac".into(),
        AUDIO_CHANNELS.to_string().into(),
        "-t".into(),
        duration,
        "-y".into(),
        output.as_os_str().to_os_string(),
    ]);
    args
}

fn unique_asset_id(
    stored_sha: &str,
    salt: &str,
    used: &mut HashSet<String>,
    existing: &HashSet<String>,
) -> String {
    let mut id = stored_sha[..16].to_string();
    if used.contains(&id) || existing.contains(&id) {
        id = paths::sha256_text(&format!("{stored_sha}|{salt}"))[..16].to_string();
        let mut attempt = 1;
        while used.contains(&id) || existing.contains(&id) {
            id = paths::sha256_text(&format!("{stored_sha}|{salt}|{attempt}"))[..16].to_string();
            attempt += 1;
        }
    }
    used.insert(id.clone());
    id
}

fn ensure_no_asset_collision(manifest: &super::model::MediaManifest, ids: &[&str]) -> Result<(), FsError> {
    if ids.iter().any(|id| id.len() != 16)
        || ids[0] == ids[1]
        || ids[0] == ids[2]
        || ids[1] == ids[2]
    {
        return Err(FsError::new(
            "AssetConflict",
            "stereo outputs produced colliding asset IDs",
        ));
    }
    if manifest
        .assets
        .iter()
        .any(|asset| ids.contains(&asset.asset_id.as_str()))
    {
        return Err(FsError::new(
            "AssetConflict",
            "stereo output collides with an existing asset",
        ));
    }
    Ok(())
}

/// 成对立体媒体导入：严格时长/分辨率校验 + 左/右声道硬分离。
pub fn import_stereo(
    root: &Path,
    left: &Path,
    right: &Path,
) -> Result<MediaStereoImport, FsError> {
    paths::ensure_media_layout(root)?;
    for (label, path) in [("left", left), ("right", right)] {
        let metadata = fs::metadata(path)?;
        if metadata.len() > MAX_VIDEO_BYTES {
            return Err(FsError::new(
                "UnsupportedMedia",
                format!("{label} video exceeds the 4 GiB limit"),
            ));
        }
    }

    let left_probe = probe::probe_source(left)?;
    let right_probe = probe::probe_source(right)?;
    validate_pair(&left_probe, &right_probe)?;
    let common_ms = left_probe.duration_ms.max(right_probe.duration_ms);
    if common_ms <= 0 {
        return Err(FsError::new(
            "StereoDurationMismatch",
            "stereo videos must have a positive duration",
        ));
    }

    let left_source_sha = paths::sha256_file(left)?;
    let right_source_sha = paths::sha256_file(right)?;
    let mut manifest = load_manifest(root)?;
    if let Some((pair, left_asset, right_asset, audio_asset)) =
        find_stereo_dedupe(&manifest, &left_source_sha, &right_source_sha)
    {
        return Ok(MediaStereoImport {
            pair,
            left: left_asset,
            right: right_asset,
            audio: audio_asset,
            deduped: true,
        });
    }

    let pair_id =
        paths::sha256_text(&format!("{left_source_sha}|{right_source_sha}"))[..16].to_string();
    if manifest
        .stereo_pairs
        .iter()
        .any(|pair| pair.stereo_pair_id == pair_id)
    {
        return Err(FsError::new(
            "AssetConflict",
            "stereo pair id already exists with different assets",
        ));
    }

    let temp_dir = paths::create_temp_dir(root)?;
    let mut created_dir: Option<PathBuf> = None;
    let result = (|| -> Result<MediaStereoImport, FsError> {
        let temp_left = temp_dir.join("left.mp4");
        let temp_right = temp_dir.join("right.mp4");
        let temp_audio = temp_dir.join("audio.wav");

        run_ffmpeg(stereo_video_args(left, &temp_left))?;
        run_ffmpeg(stereo_video_args(right, &temp_right))?;
        run_ffmpeg(stereo_audio_args(
            left,
            right,
            left_probe.audio_codec.is_some(),
            right_probe.audio_codec.is_some(),
            common_ms,
            &temp_audio,
        ))?;
        for output in [&temp_left, &temp_right, &temp_audio] {
            paths::sync_file(output)?;
        }

        let left_sha = paths::sha256_file(&temp_left)?;
        let right_sha = paths::sha256_file(&temp_right)?;
        let audio_sha = paths::sha256_file(&temp_audio)?;
        let existing: HashSet<String> = manifest
            .assets
            .iter()
            .map(|asset| asset.asset_id.clone())
            .collect();
        let mut used = HashSet::new();
        let left_asset_id = unique_asset_id(
            &left_sha,
            &format!("{pair_id}|left"),
            &mut used,
            &existing,
        );
        let right_asset_id = unique_asset_id(
            &right_sha,
            &format!("{pair_id}|right"),
            &mut used,
            &existing,
        );
        let audio_asset_id = unique_asset_id(
            &audio_sha,
            &format!("{pair_id}|audio"),
            &mut used,
            &existing,
        );
        ensure_no_asset_collision(
            &manifest,
            &[&left_asset_id, &right_asset_id, &audio_asset_id],
        )?;

        let final_dir_rel = format!("media/stereo/{pair_id}");
        let final_dir = paths::resolve_media_output(root, &final_dir_rel)?;
        if final_dir.exists() {
            return Err(FsError::new(
                "AssetConflict",
                "stereo output directory already exists",
            ));
        }
        fs::create_dir_all(&final_dir)?;
        created_dir = Some(final_dir.clone());

        let final_left = final_dir.join("left.mp4");
        let final_right = final_dir.join("right.mp4");
        let final_audio = final_dir.join("audio.wav");
        fs::rename(&temp_left, &final_left)?;
        fs::rename(&temp_right, &final_right)?;
        fs::rename(&temp_audio, &final_audio)?;

        let left_output = probe::probe_source(&final_left)?;
        let right_output = probe::probe_source(&final_right)?;
        let audio_output = probe::probe_source(&final_audio)?;
        let created_at = paths::now_ms();
        let pair = StereoPair {
            stereo_pair_id: pair_id.clone(),
            left_asset_id: left_asset_id.clone(),
            right_asset_id: right_asset_id.clone(),
            audio_asset_id: audio_asset_id.clone(),
            created_at,
            pseudo_stereo: false,
            derived_from: None,
            offset_ms: None,
            offset_frames: None,
        };
        let left_asset = MediaAsset {
            asset_id: left_asset_id,
            kind: KIND_VIDEO.to_string(),
            display_name: paths::sanitized_display_name(None, left),
            rel_path: paths::stereo_rel(&pair_id, "left.mp4")?,
            sha256: left_sha,
            source_sha256: Some(left_source_sha),
            bytes: fs::metadata(&final_left)?.len(),
            duration_ms: left_output.duration_ms,
            width: left_output.width,
            height: left_output.height,
            fps: left_output.fps,
            video_codec: left_output.video_codec,
            audio_codec: None,
            audio_channels: 0,
            sample_rate: 0,
            created_at,
            derived_from: None,
            trim: None,
            stereo_pair_id: Some(pair_id.clone()),
            eye: Some("Left".to_string()),
            audio_channel: None,
        };
        let right_asset = MediaAsset {
            asset_id: right_asset_id,
            kind: KIND_VIDEO.to_string(),
            display_name: paths::sanitized_display_name(None, right),
            rel_path: paths::stereo_rel(&pair_id, "right.mp4")?,
            sha256: right_sha,
            source_sha256: Some(right_source_sha),
            bytes: fs::metadata(&final_right)?.len(),
            duration_ms: right_output.duration_ms,
            width: right_output.width,
            height: right_output.height,
            fps: right_output.fps,
            video_codec: right_output.video_codec,
            audio_codec: None,
            audio_channels: 0,
            sample_rate: 0,
            created_at,
            derived_from: None,
            trim: None,
            stereo_pair_id: Some(pair_id.clone()),
            eye: Some("Right".to_string()),
            audio_channel: None,
        };
        let audio_asset = MediaAsset {
            asset_id: audio_asset_id,
            kind: KIND_AUDIO.to_string(),
            display_name: "audio.wav".to_string(),
            rel_path: paths::stereo_rel(&pair_id, "audio.wav")?,
            sha256: audio_sha,
            source_sha256: None,
            bytes: fs::metadata(&final_audio)?.len(),
            duration_ms: audio_output.duration_ms,
            width: 0,
            height: 0,
            fps: 0.0,
            video_codec: None,
            audio_codec: audio_output.audio_codec,
            audio_channels: AUDIO_CHANNELS,
            sample_rate: AUDIO_SAMPLE_RATE,
            created_at,
            derived_from: None,
            trim: None,
            stereo_pair_id: Some(pair_id.clone()),
            eye: None,
            audio_channel: Some("Stereo".to_string()),
        };
        let returned = MediaStereoImport {
            pair: pair.clone(),
            left: left_asset.clone(),
            right: right_asset.clone(),
            audio: audio_asset.clone(),
            deduped: false,
        };
        commit_stereo(
            root,
            &mut manifest,
            vec![left_asset, right_asset, audio_asset],
            pair,
            &final_dir,
            false,
        )?;
        Ok(returned)
    })();

    if result.is_err() {
        if let Some(dir) = created_dir {
            let _ = fs::remove_dir_all(dir);
        }
    }
    paths::cleanup_dir(&temp_dir);
    result
}

fn mono_video_args(
    source: &Path,
    output: &Path,
    start_ms: i64,
    frames: i64,
) -> Vec<OsString> {
    let mut args = base_args();
    if start_ms > 0 {
        args.extend(["-ss".into(), seconds(start_ms)]);
    }
    args.extend([
        "-i".into(),
        source.as_os_str().to_os_string(),
        "-frames:v".into(),
        frames.to_string().into(),
        "-map".into(),
        "0:v:0".into(),
        "-an".into(),
        "-sn".into(),
        "-dn".into(),
        "-c:v".into(),
        "libx264".into(),
        "-preset".into(),
        "veryfast".into(),
        "-crf".into(),
        "20".into(),
        "-pix_fmt".into(),
        "yuv420p".into(),
        "-movflags".into(),
        "+faststart".into(),
        "-y".into(),
        output.as_os_str().to_os_string(),
    ]);
    args
}

fn mono_audio_args(
    source: &Path,
    has_audio: bool,
    duration_ms: i64,
    output: &Path,
) -> Vec<OsString> {
    let mut args = base_args();
    if has_audio {
        args.extend([
            "-i".into(),
            source.as_os_str().to_os_string(),
            "-map".into(),
            "0:a:0".into(),
        ]);
    } else {
        args.extend([
            "-f".into(),
            "lavfi".into(),
            "-i".into(),
            "anullsrc=channel_layout=stereo:sample_rate=48000".into(),
        ]);
    }
    args.extend([
        "-t".into(),
        seconds(duration_ms),
        "-c:a".into(),
        "pcm_s16le".into(),
        "-ar".into(),
        AUDIO_SAMPLE_RATE.to_string().into(),
        "-ac".into(),
        AUDIO_CHANNELS.to_string().into(),
        "-y".into(),
        output.as_os_str().to_os_string(),
    ]);
    args
}

/// 将请求的毫秒偏移量化为整数帧；超过 50ms 时取较小帧数，避免 UI 上限被突破。
pub(crate) fn mono_offset_frames(offset_ms: i64, fps: f64) -> (i64, i64) {
    let frame_ms = 1000.0 / (if fps.is_finite() && fps > 0.0 { fps } else { 30.0 });
    let mut frames = ((offset_ms as f64 / frame_ms).round() as i64).max(1);
    let mut effective = (frames as f64 * frame_ms).round() as i64;
    if effective > 50 {
        frames = ((offset_ms as f64 / frame_ms).floor() as i64).max(1);
        effective = (frames as f64 * frame_ms).round() as i64;
    }
    (frames, effective)
}

/// R5c-A.3：单源伪双目。右侧按整数帧偏移；音频只保留源音轨一次，不偏移。
pub fn import_mono_stereo(
    root: &Path,
    source: &Path,
    offset_ms: i64,
) -> Result<MediaStereoImport, FsError> {
    paths::ensure_media_layout(root)?;
    let metadata = fs::metadata(source)?;
    if metadata.len() > MAX_VIDEO_BYTES {
        return Err(FsError::new(
            "UnsupportedMedia",
            "mono source exceeds the 4 GiB limit",
        ));
    }
    if offset_ms <= 0 || offset_ms > 2_000 {
        return Err(FsError::new(
            "InvalidTimeRange",
            "offsetMs must be within 1..2000",
        ));
    }
    let source_probe = probe::probe_source(source)?;
    if source_probe.kind != KIND_VIDEO || source_probe.width == 0 || source_probe.height == 0 {
        return Err(FsError::new(
            "UnsupportedMedia",
            "mono stereo import requires a video with non-zero resolution",
        ));
    }
    let fps = if source_probe.fps.is_finite() && source_probe.fps > 0.0 {
        source_probe.fps
    } else {
        30.0
    };
    let (frames, effective_ms) = mono_offset_frames(offset_ms, fps);
    let common_ms = source_probe.duration_ms - effective_ms;
    if common_ms < 100 {
        return Err(FsError::new(
            "StereoDurationMismatch",
            "source is shorter than the requested pseudo-stereo offset",
        ));
    }

    let source_sha = paths::sha256_file(source)?;
    let pair_id = paths::sha256_text(&format!("mono-stereo|{source_sha}|{effective_ms}"))[..16]
        .to_string();
    let mut manifest = load_manifest(root)?;
    if let Some(pair) = manifest
        .stereo_pairs
        .iter()
        .find(|pair| pair.stereo_pair_id == pair_id)
    {
        if let (Some(left), Some(right), Some(audio)) = (
            find_asset(&manifest, &pair.left_asset_id),
            find_asset(&manifest, &pair.right_asset_id),
            find_asset(&manifest, &pair.audio_asset_id),
        ) {
            return Ok(MediaStereoImport {
                pair: pair.clone(),
                left: left.clone(),
                right: right.clone(),
                audio: audio.clone(),
                deduped: true,
            });
        }
    }

    let temp_dir = paths::create_temp_dir(root)?;
    let mut created_dir: Option<PathBuf> = None;
    let result = (|| -> Result<MediaStereoImport, FsError> {
        let temp_left = temp_dir.join("left.mp4");
        let temp_right = temp_dir.join("right.mp4");
        let temp_audio = temp_dir.join("audio.wav");
        let output_frames = ((common_ms as f64 * fps / 1000.0).floor() as i64).max(1);
        // 先做右眼 seek；输入 seek 会丢首帧，用右眼实际时长反推共同帧数，左眼对齐。
        run_ffmpeg(mono_video_args(source, &temp_right, effective_ms, output_frames))?;
        let right_probe = probe::probe_source(&temp_right)?;
        let actual_frames = ((right_probe.duration_ms as f64 * fps / 1000.0).round() as i64)
            .max(1);
        run_ffmpeg(mono_video_args(source, &temp_left, 0, actual_frames))?;
        run_ffmpeg(mono_audio_args(
            source,
            source_probe.audio_codec.is_some(),
            common_ms,
            &temp_audio,
        ))?;
        for output in [&temp_left, &temp_right, &temp_audio] {
            paths::sync_file(output)?;
        }

        let left_sha = paths::sha256_file(&temp_left)?;
        let right_sha = paths::sha256_file(&temp_right)?;
        let audio_sha = paths::sha256_file(&temp_audio)?;
        let existing: HashSet<String> = manifest
            .assets
            .iter()
            .map(|asset| asset.asset_id.clone())
            .collect();
        let mut used = HashSet::new();
        let left_asset_id = unique_asset_id(&left_sha, &format!("{pair_id}|left"), &mut used, &existing);
        let right_asset_id = unique_asset_id(&right_sha, &format!("{pair_id}|right"), &mut used, &existing);
        let audio_asset_id = unique_asset_id(&audio_sha, &format!("{pair_id}|audio"), &mut used, &existing);
        ensure_no_asset_collision(&manifest, &[&left_asset_id, &right_asset_id, &audio_asset_id])?;

        let final_dir_rel = format!("media/stereo/{pair_id}");
        let final_dir = paths::resolve_media_output(root, &final_dir_rel)?;
        if final_dir.exists() {
            return Err(FsError::new(
                "AssetConflict",
                "pseudo-stereo output directory already exists",
            ));
        }
        fs::create_dir_all(&final_dir)?;
        created_dir = Some(final_dir.clone());
        let final_left = final_dir.join("left.mp4");
        let final_right = final_dir.join("right.mp4");
        let final_audio = final_dir.join("audio.wav");
        fs::rename(&temp_left, &final_left)?;
        fs::rename(&temp_right, &final_right)?;
        fs::rename(&temp_audio, &final_audio)?;

        let left_output = probe::probe_source(&final_left)?;
        let right_output = probe::probe_source(&final_right)?;
        let audio_output = probe::probe_source(&final_audio)?;
        let created_at = paths::now_ms();
        let pair = StereoPair {
            stereo_pair_id: pair_id.clone(),
            left_asset_id: left_asset_id.clone(),
            right_asset_id: right_asset_id.clone(),
            audio_asset_id: audio_asset_id.clone(),
            created_at,
            pseudo_stereo: true,
            derived_from: Some(source_sha.clone()),
            offset_ms: Some(effective_ms),
            offset_frames: Some(frames),
        };
        let left_asset = MediaAsset {
            asset_id: left_asset_id,
            kind: KIND_VIDEO.to_string(),
            display_name: paths::sanitized_display_name(None, source),
            rel_path: paths::stereo_rel(&pair_id, "left.mp4")?,
            sha256: left_sha,
            source_sha256: Some(source_sha.clone()),
            bytes: fs::metadata(&final_left)?.len(),
            duration_ms: left_output.duration_ms,
            width: left_output.width,
            height: left_output.height,
            fps: left_output.fps,
            video_codec: left_output.video_codec,
            audio_codec: None,
            audio_channels: 0,
            sample_rate: 0,
            created_at,
            derived_from: Some(source_sha.clone()),
            trim: None,
            stereo_pair_id: Some(pair_id.clone()),
            eye: Some("Left".to_string()),
            audio_channel: None,
        };
        let right_asset = MediaAsset {
            asset_id: right_asset_id,
            kind: KIND_VIDEO.to_string(),
            display_name: paths::sanitized_display_name(None, source),
            rel_path: paths::stereo_rel(&pair_id, "right.mp4")?,
            sha256: right_sha,
            source_sha256: Some(source_sha.clone()),
            bytes: fs::metadata(&final_right)?.len(),
            duration_ms: right_output.duration_ms,
            width: right_output.width,
            height: right_output.height,
            fps: right_output.fps,
            video_codec: right_output.video_codec,
            audio_codec: None,
            audio_channels: 0,
            sample_rate: 0,
            created_at,
            derived_from: Some(source_sha.clone()),
            trim: None,
            stereo_pair_id: Some(pair_id.clone()),
            eye: Some("Right".to_string()),
            audio_channel: None,
        };
        let audio_asset = MediaAsset {
            asset_id: audio_asset_id,
            kind: KIND_AUDIO.to_string(),
            display_name: "audio.wav".to_string(),
            rel_path: paths::stereo_rel(&pair_id, "audio.wav")?,
            sha256: audio_sha,
            source_sha256: None,
            bytes: fs::metadata(&final_audio)?.len(),
            duration_ms: audio_output.duration_ms,
            width: 0,
            height: 0,
            fps: 0.0,
            video_codec: None,
            audio_codec: audio_output.audio_codec,
            audio_channels: AUDIO_CHANNELS,
            sample_rate: AUDIO_SAMPLE_RATE,
            created_at,
            derived_from: Some(source_sha.clone()),
            trim: None,
            stereo_pair_id: Some(pair_id.clone()),
            eye: None,
            audio_channel: Some("Stereo".to_string()),
        };
        let returned = MediaStereoImport {
            pair: pair.clone(),
            left: left_asset.clone(),
            right: right_asset.clone(),
            audio: audio_asset.clone(),
            deduped: false,
        };
        commit_stereo(
            root,
            &mut manifest,
            vec![left_asset, right_asset, audio_asset],
            pair,
            &final_dir,
            false,
        )?;
        Ok(returned)
    })();

    if result.is_err() {
        if let Some(dir) = created_dir {
            let _ = fs::remove_dir_all(dir);
        }
    }
    paths::cleanup_dir(&temp_dir);
    result
}

#[cfg(test)]
mod mono_offset_tests {
    use super::mono_offset_frames;

    #[test]
    fn quantizes_to_integer_frames_for_common_rates() {
        assert_eq!(mono_offset_frames(33, 24.0), (1, 42));
        assert_eq!(mono_offset_frames(33, 30.0), (1, 33));
        assert_eq!(mono_offset_frames(33, 60.0), (2, 33));
        assert_eq!(mono_offset_frames(50, 30.0), (1, 33));
        assert_eq!(mono_offset_frames(20, 30.0), (1, 33));
    }
}
