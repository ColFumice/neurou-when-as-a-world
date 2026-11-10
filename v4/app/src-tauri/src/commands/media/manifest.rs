use super::model::{MediaAsset, MediaManifest, StereoPair};
use super::paths::{now_ms, resolve_media_output};
use crate::commands::fs::{read_json_at, write_json_atomic_at, FsError};
use std::collections::HashSet;
use std::fs;
use std::path::Path;

const MANIFEST_REL: &str = "media/manifest.json";

pub fn load_manifest(root: &Path) -> Result<MediaManifest, FsError> {
    let path = resolve_media_output(root, MANIFEST_REL)?;
    let raw = match read_json_at(&path) {
        Ok(value) => value,
        Err(error) => {
            return Err(FsError::new(
                "ManifestCorrupt",
                format!("cannot read media manifest: {}", error.message),
            ));
        }
    };
    let Some(value) = raw else {
        return Ok(MediaManifest::default());
    };
    let manifest: MediaManifest = serde_json::from_value(value).map_err(|error| {
        FsError::new(
            "ManifestCorrupt",
            format!("invalid media manifest: {error}"),
        )
    })?;
    if manifest.schema_version != 1 {
        return Err(FsError::new(
            "ManifestCorrupt",
            format!(
                "unsupported media manifest schemaVersion: {}",
                manifest.schema_version
            ),
        ));
    }
    let mut seen = HashSet::new();
    for asset in &manifest.assets {
        if asset.asset_id.is_empty() || !seen.insert(asset.asset_id.clone()) {
            return Err(FsError::new(
                "ManifestCorrupt",
                "media manifest contains empty or duplicate assetId",
            ));
        }
    }
    let mut pair_ids = HashSet::new();
    for pair in &manifest.stereo_pairs {
        if pair.stereo_pair_id.is_empty() || !pair_ids.insert(pair.stereo_pair_id.clone()) {
            return Err(FsError::new(
                "ManifestCorrupt",
                "media manifest contains empty or duplicate stereoPairId",
            ));
        }
        for asset_id in [
            &pair.left_asset_id,
            &pair.right_asset_id,
            &pair.audio_asset_id,
        ] {
            if !seen.contains(asset_id) {
                return Err(FsError::new(
                    "ManifestCorrupt",
                    "stereo pair references a missing asset",
                ));
            }
        }
    }
    Ok(manifest)
}

pub fn save_manifest(root: &Path, manifest: &MediaManifest) -> Result<(), FsError> {
    let path = resolve_media_output(root, MANIFEST_REL)?;
    let value = serde_json::to_value(manifest)
        .map_err(|error| FsError::new("ManifestCorrupt", format!("cannot serialize manifest: {error}")))?;
    write_json_atomic_at(&path, &value).map_err(|error| {
        if error.code == "ManifestCorrupt" {
            error
        } else {
            FsError::new(
                "ManifestCorrupt",
                format!("cannot write media manifest: {}", error.message),
            )
        }
    })
}

pub fn find_asset<'a>(manifest: &'a MediaManifest, asset_id: &str) -> Option<&'a MediaAsset> {
    manifest.assets.iter().find(|asset| asset.asset_id == asset_id)
}

/// 以左右源 hash 查找已存在的 stereo pair（顺序固定）。
pub fn find_stereo_dedupe(
    manifest: &MediaManifest,
    left_source_sha256: &str,
    right_source_sha256: &str,
) -> Option<(StereoPair, MediaAsset, MediaAsset, MediaAsset)> {
    for pair in &manifest.stereo_pairs {
        let left = find_asset(manifest, &pair.left_asset_id)?;
        let right = find_asset(manifest, &pair.right_asset_id)?;
        let audio = find_asset(manifest, &pair.audio_asset_id)?;
        if left.source_sha256.as_deref() == Some(left_source_sha256)
            && right.source_sha256.as_deref() == Some(right_source_sha256)
        {
            return Some((pair.clone(), left.clone(), right.clone(), audio.clone()));
        }
    }
    None
}

/// 提交一对立体资产 + stereo pair；失败时回滚最终目录，不写 manifest。
pub fn commit_stereo(
    root: &Path,
    manifest: &mut MediaManifest,
    assets: Vec<MediaAsset>,
    pair: StereoPair,
    final_dir: &Path,
    fail_manifest_write: bool,
) -> Result<(), FsError> {
    let asset_mark = manifest.assets.len();
    let pair_mark = manifest.stereo_pairs.len();
    manifest.assets.extend(assets);
    manifest.stereo_pairs.push(pair);
    manifest.updated_at = now_ms();

    let rollback = |manifest: &mut MediaManifest| {
        manifest.assets.truncate(asset_mark);
        manifest.stereo_pairs.truncate(pair_mark);
        let _ = fs::remove_dir_all(final_dir);
    };

    if fail_manifest_write {
        rollback(manifest);
        return Err(FsError::new(
            "ImportRollback",
            "injected stereo manifest write failure",
        ));
    }
    if let Err(error) = save_manifest(root, manifest) {
        rollback(manifest);
        return Err(error);
    }
    Ok(())
}

/// 提交 asset：失败时回滚最终文件，不写 manifest。最后一步才是 manifest 原子写。
pub fn commit_asset(
    root: &Path,
    manifest: &mut MediaManifest,
    asset: MediaAsset,
    final_path: &Path,
    fail_manifest_write: bool,
) -> Result<(), FsError> {
    manifest.assets.push(asset);
    manifest.updated_at = now_ms();
    if fail_manifest_write {
        manifest.assets.pop();
        let _ = fs::remove_file(final_path);
        return Err(FsError::new(
            "ImportRollback",
            "injected manifest write failure",
        ));
    }
    if let Err(error) = save_manifest(root, manifest) {
        manifest.assets.pop();
        let _ = fs::remove_file(final_path);
        return Err(error);
    }
    Ok(())
}
