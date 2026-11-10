use super::*;
use std::process::Command;
use std::sync::Mutex;
use uuid::Uuid;

static ENV_LOCK: Mutex<()> = Mutex::new(());

fn env_guard() -> std::sync::MutexGuard<'static, ()> {
    ENV_LOCK.lock().unwrap_or_else(|poisoned| poisoned.into_inner())
}

fn temp_root(tag: &str) -> PathBuf {
    let root = std::env::temp_dir().join(format!(
        "neurou-media-{tag}-{}",
        Uuid::new_v4()
    ));
    fs::create_dir_all(&root).expect("create temp root");
    root
}

fn cleanup(root: &Path) {
    let _ = fs::remove_dir_all(root);
}

fn asset_fixture(id: &str) -> MediaAsset {
    MediaAsset {
        asset_id: id.to_string(),
        kind: KIND_VIDEO.to_string(),
        display_name: "fixture.mp4".to_string(),
        rel_path: format!("media/{id}.mp4"),
        sha256: "a".repeat(64),
        source_sha256: Some("b".repeat(64)),
        bytes: 1,
        duration_ms: 1000,
        width: 320,
        height: 180,
        fps: 24.0,
        video_codec: Some("h264".to_string()),
        audio_codec: Some("aac".to_string()),
        audio_channels: 2,
        sample_rate: 48_000,
        created_at: 1,
        derived_from: None,
        trim: None,
        stereo_pair_id: None,
        eye: None,
        audio_channel: None,
    }
}

fn baseline_manifest(root: &Path) -> Vec<u8> {
    fs::create_dir_all(root.join("media")).expect("media dir");
    let manifest = model::MediaManifest {
        schema_version: 1,
        assets: vec![asset_fixture("base")],
        stereo_pairs: Vec::new(),
        updated_at: 1,
    };
    manifest::save_manifest(root, &manifest).expect("save baseline");
    fs::read(root.join("media/manifest.json")).expect("read baseline")
}

fn tool_available(tool: &str) -> bool {
    Command::new(tool)
        .arg("-version")
        .output()
        .map(|output| output.status.success())
        .unwrap_or(false)
}

fn generate_video(
    path: &Path,
    pattern: &str,
    duration: &str,
    width: u32,
    height: u32,
    audio_frequency: Option<u32>,
) {
    let mut command = Command::new("ffmpeg");
    command.args([
        "-nostdin",
        "-hide_banner",
        "-loglevel",
        "error",
        "-f",
        "lavfi",
        "-i",
        &format!("{pattern}=size={width}x{height}:rate=24:duration={duration}"),
    ]);
    if let Some(frequency) = audio_frequency {
        command.args([
            "-f",
            "lavfi",
            "-i",
            &format!("sine=frequency={frequency}:duration={duration}"),
        ]);
    }
    command.args([
        "-c:v",
        "libx264",
        "-pix_fmt",
        "yuv420p",
    ]);
    if audio_frequency.is_some() {
        command.args(["-c:a", "aac", "-b:a", "128k", "-shortest"]);
    } else {
        command.arg("-an");
    }
    let status = command
        .arg("-y")
        .arg(path)
        .status()
        .expect("run ffmpeg fixture");
    assert!(status.success(), "ffmpeg fixture generation failed");
}

/// 读 PCM16 stereo WAV，返回左右声道的 max abs sample。
fn wav_stereo_peaks(path: &Path) -> (i32, i32) {
    let bytes = fs::read(path).expect("read wav");
    assert!(bytes.len() >= 44, "wav too short");
    assert_eq!(&bytes[0..4], b"RIFF");
    assert_eq!(&bytes[8..12], b"WAVE");

    let mut pos = 12usize;
    let mut audio_format = 0u16;
    let mut channels = 0u16;
    let mut bits = 0u16;
    let mut data: Option<&[u8]> = None;
    while pos + 8 <= bytes.len() {
        let id = &bytes[pos..pos + 4];
        let size = u32::from_le_bytes(bytes[pos + 4..pos + 8].try_into().unwrap()) as usize;
        let start = pos + 8;
        let end = start.checked_add(size).expect("wav chunk overflow");
        assert!(end <= bytes.len(), "wav chunk out of range");
        if id == b"fmt " {
            assert!(size >= 16, "fmt chunk too short");
            audio_format = u16::from_le_bytes(bytes[start..start + 2].try_into().unwrap());
            channels = u16::from_le_bytes(bytes[start + 2..start + 4].try_into().unwrap());
            bits = u16::from_le_bytes(bytes[start + 14..start + 16].try_into().unwrap());
        } else if id == b"data" {
            data = Some(&bytes[start..end]);
        }
        pos = end + (size & 1);
    }
    assert_eq!(audio_format, 1, "wav must be PCM");
    assert_eq!(channels, 2, "wav must be stereo");
    assert_eq!(bits, 16, "wav must be PCM16");

    let data = data.expect("wav data chunk");
    assert_eq!(data.len() % 4, 0, "stereo PCM16 frame size");
    let mut left_peak = 0i32;
    let mut right_peak = 0i32;
    for frame in data.chunks_exact(4) {
        let left = i16::from_le_bytes([frame[0], frame[1]]) as i32;
        let right = i16::from_le_bytes([frame[2], frame[3]]) as i32;
        left_peak = left_peak.max(left.abs());
        right_peak = right_peak.max(right.abs());
    }
    (left_peak, right_peak)
}

#[test]
fn media_output_rejects_parent_and_non_media_paths() {
    let root = temp_root("paths");
    assert_eq!(
        paths::resolve_media_output(&root, "../outside.mp4")
            .unwrap_err()
            .code,
        "InvalidPath"
    );
    assert_eq!(
        paths::resolve_media_output(&root, "media/../outside.mp4")
            .unwrap_err()
            .code,
        "InvalidPath"
    );
    assert_eq!(
        paths::resolve_media_output(&root, "worlds/outside.mp4")
            .unwrap_err()
            .code,
        "InvalidPath"
    );
    assert!(paths::resolve_media_output(&root, "media/ok.mp4").is_ok());
    assert!(paths::resolve_media_output(&root, "media/stereo/abc/left.mp4").is_ok());
    cleanup(&root);
}

#[test]
fn source_path_must_be_absolute_and_existing_file() {
    let root = temp_root("source-path");
    assert_eq!(
        paths::validate_source_path("relative.mp4").unwrap_err().code,
        "InvalidPath"
    );
    assert_eq!(
        paths::validate_source_path("").unwrap_err().code,
        "InvalidPath"
    );
    let file = root.join("clip.mp4");
    fs::write(&file, b"not a real video").expect("write fixture");
    assert!(paths::validate_source_path(file.to_str().unwrap()).is_ok());
    #[cfg(windows)]
    {
        assert_eq!(
            paths::validate_source_path(r"\\.\NUL").unwrap_err().code,
            "UnsupportedSourcePath"
        );
        assert_eq!(
            paths::validate_source_path(r"\\?\GLOBALROOT\Device\HarddiskVolume1\x")
                .unwrap_err()
                .code,
            "UnsupportedSourcePath"
        );
    }
    cleanup(&root);
}

#[test]
fn missing_ffprobe_returns_media_tool_missing() {
    let _guard = env_guard();
    let root = temp_root("tool-missing");
    let source = root.join("clip.mp4");
    fs::write(&source, b"not a real video").expect("write fixture");
    let missing = root.join("missing-ffprobe.exe");
    std::env::set_var("NEUROU_FFPROBE", &missing);
    let error = probe::probe_source(&source).unwrap_err();
    std::env::remove_var("NEUROU_FFPROBE");
    assert_eq!(error.code, "MediaToolMissing");
    cleanup(&root);
}

#[test]
fn missing_ffmpeg_returns_media_tool_missing() {
    let _guard = env_guard();
    let root = temp_root("ffmpeg-missing");
    let missing = root.join("missing-ffmpeg.exe");
    std::env::set_var("NEUROU_FFMPEG", &missing);
    let error = super::run_ffmpeg(Vec::new(), std::time::Duration::from_secs(1))
        .unwrap_err();
    std::env::remove_var("NEUROU_FFMPEG");
    assert_eq!(error.code, "MediaToolMissing");
    cleanup(&root);
}

#[test]
fn manifest_rollback_removes_final_file_and_keeps_manifest() {
    let root = temp_root("rollback");
    let before = baseline_manifest(&root);
    let final_path = root.join("media/new.mp4");
    fs::write(&final_path, b"new asset").expect("write final");
    let mut manifest = manifest::load_manifest(&root).expect("load manifest");
    let error = manifest::commit_asset(
        &root,
        &mut manifest,
        asset_fixture("new"),
        &final_path,
        true,
    )
    .unwrap_err();
    assert_eq!(error.code, "ImportRollback");
    assert!(!final_path.exists());
    let after = fs::read(root.join("media/manifest.json")).expect("read manifest");
    assert_eq!(before, after);
    assert_eq!(manifest.assets.len(), 1);
    cleanup(&root);
}

#[test]
fn depth_json_schema_validation() {
    let root = temp_root("depth-json");
    let valid = root.join("depth.json");
    fs::write(&valid, r#"{"width":2,"height":2,"data":[0,0.5,1,65535]}"#)
        .expect("write depth");
    assert_eq!(probe::validate_depth_json(&valid).unwrap(), (2, 2));

    let invalid = root.join("bad.json");
    fs::write(&invalid, r#"{"width":2,"height":2,"data":[0,1]}"#).expect("write bad depth");
    assert_eq!(
        probe::validate_depth_json(&invalid).unwrap_err().code,
        "UnsupportedMedia"
    );
    cleanup(&root);
}

fn probe_fixture(width: u32, height: u32, duration_ms: i64) -> MediaProbe {
    MediaProbe {
        kind: KIND_VIDEO.to_string(),
        format_name: "mov,mp4".to_string(),
        duration_ms,
        width,
        height,
        fps: 24.0,
        video_codec: Some("h264".to_string()),
        audio_codec: None,
        audio_channels: 0,
        sample_rate: 0,
        bytes: 1,
    }
}

#[test]
fn stereo_alignment_boundary_is_strict() {
    assert!(stereo::validate_pair(
        &probe_fixture(320, 180, 1000),
        &probe_fixture(320, 180, 1500),
    ).is_ok());
    assert_eq!(
        stereo::validate_pair(
            &probe_fixture(320, 180, 1000),
            &probe_fixture(320, 180, 1501),
        ).unwrap_err().code,
        "StereoDurationMismatch"
    );
    assert_eq!(
        stereo::validate_pair(
            &probe_fixture(320, 180, 1000),
            &probe_fixture(320, 182, 1000),
        ).unwrap_err().code,
        "StereoResolutionMismatch"
    );
}

#[test]
fn stereo_duration_mismatch_is_rejected_without_manifest_change() {
    if !tool_available("ffmpeg") || !tool_available("ffprobe") {
        return;
    }
    let _guard = env_guard();
    let root = temp_root("stereo-duration");
    let before = baseline_manifest(&root);
    let left = root.join("left.mp4");
    let right = root.join("right.mp4");
    generate_video(&left, "testsrc2", "0.6", 160, 90, None);
    generate_video(&right, "testsrc2", "1.3", 160, 90, None);

    let error = stereo::import_stereo(&root, &left, &right).unwrap_err();
    assert_eq!(error.code, "StereoDurationMismatch");
    let after = fs::read(root.join("media/manifest.json")).expect("read manifest");
    assert_eq!(before, after);
    assert!(!root.join("media/stereo").exists());
    cleanup(&root);
}

#[test]
fn stereo_resolution_mismatch_is_rejected_without_manifest_change() {
    if !tool_available("ffmpeg") || !tool_available("ffprobe") {
        return;
    }
    let _guard = env_guard();
    let root = temp_root("stereo-resolution");
    let before = baseline_manifest(&root);
    let left = root.join("left.mp4");
    let right = root.join("right.mp4");
    generate_video(&left, "testsrc2", "0.6", 160, 90, None);
    generate_video(&right, "testsrc2", "0.6", 160, 92, None);

    let error = stereo::import_stereo(&root, &left, &right).unwrap_err();
    assert_eq!(error.code, "StereoResolutionMismatch");
    let after = fs::read(root.join("media/manifest.json")).expect("read manifest");
    assert_eq!(before, after);
    assert!(!root.join("media/stereo").exists());
    cleanup(&root);
}

#[test]
fn stereo_import_splits_channels_and_links_manifest() {
    if !tool_available("ffmpeg") || !tool_available("ffprobe") {
        return;
    }
    let _guard = env_guard();
    let root = temp_root("stereo-real");
    let left = root.join("left.mp4");
    let right = root.join("right.mp4");
    // Q3 边界：左视频没有音轨，右视频有 440Hz 音轨；左右画面必须不同，避免转码后 assetId 碰撞。
    generate_video(&left, "testsrc2", "0.6", 160, 90, None);
    generate_video(&right, "smptebars", "0.6", 160, 90, Some(440));

    let imported = stereo::import_stereo(&root, &left, &right).expect("stereo import");
    assert!(!imported.deduped);
    assert_eq!(imported.pair.left_asset_id, imported.left.asset_id);
    assert_eq!(imported.pair.right_asset_id, imported.right.asset_id);
    assert_eq!(imported.pair.audio_asset_id, imported.audio.asset_id);
    assert_eq!(imported.left.eye.as_deref(), Some("Left"));
    assert_eq!(imported.right.eye.as_deref(), Some("Right"));
    assert_eq!(imported.audio.audio_channel.as_deref(), Some("Stereo"));
    assert_eq!(
        imported.left.stereo_pair_id.as_deref(),
        Some(imported.pair.stereo_pair_id.as_str())
    );
    assert_eq!(
        imported.right.stereo_pair_id.as_deref(),
        Some(imported.pair.stereo_pair_id.as_str())
    );
    assert_eq!(
        imported.audio.stereo_pair_id.as_deref(),
        Some(imported.pair.stereo_pair_id.as_str())
    );

    let dir = root
        .join("media/stereo")
        .join(&imported.pair.stereo_pair_id);
    assert!(dir.join("left.mp4").exists());
    assert!(dir.join("right.mp4").exists());
    assert!(dir.join("audio.wav").exists());

    let left_probe = probe::probe_source(&dir.join("left.mp4")).expect("left probe");
    let right_probe = probe::probe_source(&dir.join("right.mp4")).expect("right probe");
    assert_eq!(left_probe.kind, KIND_VIDEO);
    assert_eq!(right_probe.kind, KIND_VIDEO);
    assert_eq!(left_probe.audio_codec, None);
    assert_eq!(right_probe.audio_codec, None);

    let audio_probe = probe::probe_source(&dir.join("audio.wav")).expect("audio probe");
    assert_eq!(audio_probe.kind, KIND_AUDIO);
    assert_eq!(audio_probe.audio_codec.as_deref(), Some("pcm_s16le"));
    assert_eq!(audio_probe.audio_channels, 2);
    assert_eq!(audio_probe.sample_rate, 48_000);

    let (left_peak, right_peak) = wav_stereo_peaks(&dir.join("audio.wav"));
    assert_eq!(left_peak, 0, "left channel must be silent");
    assert!(right_peak > 1000, "right channel must carry the right audio");

    let manifest = load_manifest(&root).expect("load manifest");
    assert_eq!(manifest.assets.len(), 3);
    assert_eq!(manifest.stereo_pairs.len(), 1);
    let pair = &manifest.stereo_pairs[0];
    assert_eq!(pair.stereo_pair_id, imported.pair.stereo_pair_id);
    assert_eq!(pair.left_asset_id, imported.left.asset_id);
    assert_eq!(pair.right_asset_id, imported.right.asset_id);
    assert_eq!(pair.audio_asset_id, imported.audio.asset_id);
    assert_eq!(
        manifest::find_asset(&manifest, &pair.left_asset_id)
            .and_then(|asset| asset.eye.as_deref()),
        Some("Left")
    );
    assert_eq!(
        manifest::find_asset(&manifest, &pair.right_asset_id)
            .and_then(|asset| asset.eye.as_deref()),
        Some("Right")
    );
    assert_eq!(
        manifest::find_asset(&manifest, &pair.audio_asset_id)
            .and_then(|asset| asset.audio_channel.as_deref()),
        Some("Stereo")
    );
    let raw = fs::read_to_string(root.join("media/manifest.json")).expect("manifest text");
    assert!(raw.contains("\"stereoPairs\""));
    assert!(raw.contains("\"stereoPairId\""));

    let deduped = stereo::import_stereo(&root, &left, &right).expect("stereo dedupe");
    assert!(deduped.deduped);
    assert_eq!(deduped.pair.stereo_pair_id, imported.pair.stereo_pair_id);
    assert_eq!(load_manifest(&root).unwrap().assets.len(), 3);
    cleanup(&root);
}

#[test]
fn stereo_import_keeps_left_audio_when_right_is_silent() {
    if !tool_available("ffmpeg") || !tool_available("ffprobe") {
        return;
    }
    let _guard = env_guard();
    let root = temp_root("stereo-left-audio");
    let left = root.join("left.mp4");
    let right = root.join("right.mp4");
    // 同画面、不同音轨：验证左右视频 output hash 相同时 assetId 仍不会碰撞。
    generate_video(&left, "testsrc2", "0.5", 160, 90, Some(330));
    generate_video(&right, "testsrc2", "0.5", 160, 90, None);

    let imported = stereo::import_stereo(&root, &left, &right).expect("stereo import");
    let (left_peak, right_peak) = wav_stereo_peaks(
        &paths::resolve_media_output(&root, &imported.audio.rel_path).unwrap(),
    );
    assert!(left_peak > 1000, "left channel must carry the left audio");
    assert_eq!(right_peak, 0, "right channel must be silent");
    cleanup(&root);
}

#[test]
fn stereo_assets_can_be_trimmed_and_sampled() {
    if !tool_available("ffmpeg") || !tool_available("ffprobe") {
        return;
    }
    let _guard = env_guard();
    let root = temp_root("stereo-followup");
    let left = root.join("left.mp4");
    let right = root.join("right.mp4");
    generate_video(&left, "testsrc2", "0.8", 160, 90, Some(330));
    generate_video(&right, "smptebars", "0.8", 160, 90, Some(660));
    let imported = stereo::import_stereo(&root, &left, &right).expect("stereo import");

    let video_trim = trim_media(&root, &imported.left.asset_id, 100, 500).expect("video trim");
    assert_eq!(video_trim.asset.kind, KIND_VIDEO);
    assert_eq!(
        video_trim.asset.derived_from.as_deref(),
        Some(imported.left.asset_id.as_str())
    );
    assert!(paths::resolve_media_output(&root, &video_trim.asset.rel_path)
        .unwrap()
        .exists());

    let audio_trim = trim_media(&root, &imported.audio.asset_id, 100, 500).expect("audio trim");
    assert_eq!(audio_trim.asset.kind, KIND_AUDIO);
    assert!(audio_trim.asset.rel_path.ends_with(".wav"));

    let frames = extract_frames(&root, &imported.left.asset_id, &[0, 300], Some(160))
        .expect("frames");
    assert_eq!(frames.len(), 2);
    for frame in frames {
        assert!(paths::resolve_media_output(&root, &frame.rel_path)
            .unwrap()
            .exists());
    }
    cleanup(&root);
}

#[test]
fn mono_stereo_import_has_equal_duration_and_pseudo_metadata() {
    if !tool_available("ffmpeg") {
        return;
    }
    let root = temp_root("mono-stereo");
    let source = root.join("source.mp4");
    generate_video(&source, "testsrc2", "2", 320, 180, None);
    let imported = stereo::import_mono_stereo(&root, &source, 33).expect("mono stereo import");
    assert!(imported.pair.pseudo_stereo);
    assert_eq!(imported.pair.offset_frames, Some(1));
    assert_eq!(imported.pair.offset_ms, Some(42));
    assert_eq!(imported.left.duration_ms, imported.right.duration_ms);
    assert!(imported.left.duration_ms <= 2_000);
    let manifest = manifest::load_manifest(&root).expect("manifest");
    assert!(manifest.stereo_pairs.iter().any(|pair| pair.pseudo_stereo));
    cleanup(&root);
}

#[test]
fn mono_stereo_import_demo_loop_source() {
    if !tool_available("ffmpeg") { return; }
    let root = temp_root("mono-demo");
    let source = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../.stereo-demo/project/media/theme/rain-night-left-loop.mp4");
    if !source.exists() { return; }
    let imported = stereo::import_mono_stereo(&root, &source, 33).expect("mono stereo demo");
    assert!(imported.pair.pseudo_stereo);
    assert_eq!(imported.left.duration_ms, imported.right.duration_ms);
    cleanup(&root);
}

#[test]
fn demo_manifest_loads() {
    let root = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../.stereo-demo/project");
    let manifest = manifest::load_manifest(&root).expect("demo manifest");
    assert!(manifest.assets.iter().any(|asset| asset.asset_id == "asset:audio:sfx-layer1"));
}
