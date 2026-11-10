use serde::{Deserialize, Serialize};

/// 媒体资产类型；与 X 层 MediaSource.kind 对齐。
pub const KIND_VIDEO: &str = "Video";
pub const KIND_AUDIO: &str = "Audio";
pub const KIND_IMAGE: &str = "Image";
#[allow(dead_code)]
pub const KIND_DEPTH: &str = "Depth";

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MediaTrimInfo {
    pub start_ms: i64,
    pub end_ms: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MediaAsset {
    pub asset_id: String,
    pub kind: String,
    pub display_name: String,
    pub rel_path: String,
    pub sha256: String,
    /// 原始输入文件 hash；转码资产用于去重。图片/深度与 sha256 相同。
    #[serde(default)]
    pub source_sha256: Option<String>,
    pub bytes: u64,
    pub duration_ms: i64,
    pub width: u32,
    pub height: u32,
    pub fps: f64,
    #[serde(default)]
    pub video_codec: Option<String>,
    #[serde(default)]
    pub audio_codec: Option<String>,
    #[serde(default)]
    pub audio_channels: u32,
    #[serde(default)]
    pub sample_rate: u32,
    pub created_at: i64,
    #[serde(default)]
    pub derived_from: Option<String>,
    #[serde(default)]
    pub trim: Option<MediaTrimInfo>,
    /// 成对立体媒体标识；三份资产共享同一个 ID。
    #[serde(default)]
    pub stereo_pair_id: Option<String>,
    /// 视频眼睛；Left / Right。
    #[serde(default)]
    pub eye: Option<String>,
    /// 音频声道语义；双声道 WAV 为 Stereo。
    #[serde(default)]
    pub audio_channel: Option<String>,
}

/// 一对立体媒体：left/right 视频 + 双声道 WAV。
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StereoPair {
    pub stereo_pair_id: String,
    pub left_asset_id: String,
    pub right_asset_id: String,
    pub audio_asset_id: String,
    pub created_at: i64,
    /// R5c-A.3：单目伪双目标记。
    #[serde(default)]
    pub pseudo_stereo: bool,
    #[serde(default)]
    pub derived_from: Option<String>,
    #[serde(default)]
    pub offset_ms: Option<i64>,
    #[serde(default)]
    pub offset_frames: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MediaManifest {
    pub schema_version: u32,
    pub assets: Vec<MediaAsset>,
    #[serde(default)]
    pub stereo_pairs: Vec<StereoPair>,
    #[serde(default)]
    pub updated_at: i64,
}

impl Default for MediaManifest {
    fn default() -> Self {
        Self {
            schema_version: 1,
            assets: Vec::new(),
            stereo_pairs: Vec::new(),
            updated_at: 0,
        }
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MediaProbe {
    pub kind: String,
    pub format_name: String,
    pub duration_ms: i64,
    pub width: u32,
    pub height: u32,
    pub fps: f64,
    pub video_codec: Option<String>,
    pub audio_codec: Option<String>,
    pub audio_channels: u32,
    pub sample_rate: u32,
    pub bytes: u64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MediaStereoImport {
    pub pair: StereoPair,
    pub left: MediaAsset,
    pub right: MediaAsset,
    pub audio: MediaAsset,
    pub deduped: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MediaTrim {
    pub source_asset_id: String,
    pub asset: MediaAsset,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MediaFrame {
    pub time_ms: i64,
    pub rel_path: String,
    pub width: u32,
    pub height: u32,
}
