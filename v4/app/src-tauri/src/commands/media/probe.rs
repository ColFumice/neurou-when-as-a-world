use super::model::{MediaProbe, KIND_AUDIO, KIND_IMAGE, KIND_VIDEO};
use super::process::{ffprobe_path, run_checked};
use crate::commands::fs::FsError;
use serde_json::Value;
use std::ffi::OsString;
use std::fs;
use std::path::Path;
use std::time::Duration;

const PROBE_TIMEOUT: Duration = Duration::from_secs(15);
#[allow(dead_code)]
const MAX_DEPTH_JSON_BYTES: u64 = 64 * 1024 * 1024;

pub fn probe_source(path: &Path) -> Result<MediaProbe, FsError> {
    let tool = ffprobe_path()?;
    let args: Vec<OsString> = vec![
        "-v".into(),
        "error".into(),
        "-print_format".into(),
        "json".into(),
        "-show_format".into(),
        "-show_streams".into(),
        "-protocol_whitelist".into(),
        "file".into(),
        "-i".into(),
        path.as_os_str().to_os_string(),
    ];
    let output = run_checked(&tool, &args, PROBE_TIMEOUT, "ProbeFailed")?;
    let root: Value = serde_json::from_slice(&output.stdout)
        .map_err(|error| FsError::new("ProbeFailed", format!("invalid ffprobe json: {error}")))?;
    parse_probe_json(&root, path)
}

fn parse_probe_json(root: &Value, path: &Path) -> Result<MediaProbe, FsError> {
    let format = root.get("format").and_then(Value::as_object);
    let streams = root
        .get("streams")
        .and_then(Value::as_array)
        .ok_or_else(|| FsError::new("ProbeFailed", "ffprobe returned no streams"))?;

    let mut video_codec = None;
    let mut width = 0u32;
    let mut height = 0u32;
    let mut fps = 0.0f64;
    let mut audio_codec = None;
    let mut audio_channels = 0u32;
    let mut sample_rate = 0u32;
    let mut stream_duration = 0.0f64;

    for stream in streams {
        let Some(stream) = stream.as_object() else {
            continue;
        };
        let codec_type = stream
            .get("codec_type")
            .and_then(Value::as_str)
            .unwrap_or_default();
        let duration = stream
            .get("duration")
            .and_then(parse_f64)
            .unwrap_or(0.0);
        if duration.is_finite() && duration > stream_duration {
            stream_duration = duration;
        }

        match codec_type {
            "video" => {
                if video_codec.is_none() {
                    video_codec = stream
                        .get("codec_name")
                        .and_then(Value::as_str)
                        .map(ToString::to_string);
                    width = stream
                        .get("width")
                        .and_then(Value::as_u64)
                        .unwrap_or(0) as u32;
                    height = stream
                        .get("height")
                        .and_then(Value::as_u64)
                        .unwrap_or(0) as u32;
                    fps = stream
                        .get("avg_frame_rate")
                        .and_then(Value::as_str)
                        .map(parse_rate)
                        .filter(|value| *value > 0.0)
                        .or_else(|| {
                            stream
                                .get("r_frame_rate")
                                .and_then(Value::as_str)
                                .map(parse_rate)
                        })
                        .unwrap_or(0.0);
                }
            }
            "audio" => {
                if audio_codec.is_none() {
                    audio_codec = stream
                        .get("codec_name")
                        .and_then(Value::as_str)
                        .map(ToString::to_string);
                    audio_channels = stream
                        .get("channels")
                        .and_then(Value::as_u64)
                        .unwrap_or(0) as u32;
                    sample_rate = stream
                        .get("sample_rate")
                        .and_then(Value::as_str)
                        .and_then(|value| value.parse::<u32>().ok())
                        .unwrap_or(0);
                }
            }
            _ => {}
        }
    }

    let format_duration = format
        .and_then(|value| value.get("duration"))
        .and_then(parse_f64)
        .unwrap_or(0.0);
    let duration = if format_duration.is_finite() && format_duration > 0.0 {
        format_duration
    } else {
        stream_duration
    };
    let duration_ms = if duration.is_finite() && duration > 0.0 {
        (duration * 1000.0).round() as i64
    } else {
        0
    };

    let format_name = format
        .and_then(|value| value.get("format_name"))
        .and_then(Value::as_str)
        .unwrap_or_default()
        .to_string();

    let has_video = video_codec.is_some();
    let has_audio = audio_codec.is_some();
    let is_image = has_video
        && !has_audio
        && (duration_ms <= 0
            || format_name.contains("image")
            || video_codec
                .as_deref()
                .is_some_and(|codec| matches!(codec, "png" | "mjpeg" | "jpeg" | "webp" | "bmp" | "tiff" | "gif")));

    let kind = if is_image {
        KIND_IMAGE
    } else if has_video {
        KIND_VIDEO
    } else if has_audio {
        KIND_AUDIO
    } else {
        return Err(FsError::new(
            "UnsupportedMedia",
            "ffprobe found neither video nor audio streams",
        ));
    };

    let bytes = format
        .and_then(|value| value.get("size"))
        .and_then(Value::as_str)
        .and_then(|value| value.parse::<u64>().ok())
        .or_else(|| fs::metadata(path).ok().map(|meta| meta.len()))
        .unwrap_or(0);

    Ok(MediaProbe {
        kind: kind.to_string(),
        format_name,
        duration_ms,
        width,
        height,
        fps,
        video_codec,
        audio_codec,
        audio_channels,
        sample_rate,
        bytes,
    })
}

fn parse_f64(value: &Value) -> Option<f64> {
    value
        .as_f64()
        .or_else(|| value.as_str().and_then(|text| text.parse::<f64>().ok()))
        .filter(|value| value.is_finite())
}

fn parse_rate(value: &str) -> f64 {
    let Some((numerator, denominator)) = value.split_once('/') else {
        return value.parse::<f64>().unwrap_or(0.0);
    };
    let numerator = numerator.parse::<f64>().unwrap_or(0.0);
    let denominator = denominator.parse::<f64>().unwrap_or(0.0);
    if denominator == 0.0 {
        0.0
    } else {
        numerator / denominator
    }
}

/// 深度 JSON 最小 schema：{ width, height, data: number[] }。
#[allow(dead_code)]
pub fn validate_depth_json(path: &Path) -> Result<(u32, u32), FsError> {
    let metadata = fs::metadata(path)?;
    if metadata.len() > MAX_DEPTH_JSON_BYTES {
        return Err(FsError::new("UnsupportedMedia", "depth json exceeds 64 MiB"));
    }
    let text = fs::read_to_string(path)?;
    let value: Value = serde_json::from_str(&text)
        .map_err(|error| FsError::new("UnsupportedMedia", format!("invalid depth json: {error}")))?;
    let width = value
        .get("width")
        .and_then(Value::as_u64)
        .filter(|value| (1..=4096).contains(value))
        .ok_or_else(|| FsError::new("UnsupportedMedia", "depth json width must be 1..4096"))?
        as u32;
    let height = value
        .get("height")
        .and_then(Value::as_u64)
        .filter(|value| (1..=4096).contains(value))
        .ok_or_else(|| FsError::new("UnsupportedMedia", "depth json height must be 1..4096"))?
        as u32;
    let data = value
        .get("data")
        .and_then(Value::as_array)
        .ok_or_else(|| FsError::new("UnsupportedMedia", "depth json data must be an array"))?;
    if data.len() != (width as usize) * (height as usize) {
        return Err(FsError::new(
            "UnsupportedMedia",
            "depth json data length must equal width * height",
        ));
    }
    for item in data {
        let Some(number) = item.as_f64() else {
            return Err(FsError::new(
                "UnsupportedMedia",
                "depth json data must contain numbers",
            ));
        };
        if !number.is_finite() || !(0.0..=65535.0).contains(&number) {
            return Err(FsError::new(
                "UnsupportedMedia",
                "depth json values must be within 0..65535",
            ));
        }
    }
    Ok((width, height))
}
