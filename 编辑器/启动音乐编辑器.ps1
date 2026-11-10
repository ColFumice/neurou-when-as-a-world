$musicProjectPath = Split-Path -Parent $PSScriptRoot
$musicPreviewUrl = $null
foreach ($musicPort in @(7457, 7456, 7458)) {
    try {
        $musicResponse = Invoke-WebRequest -UseBasicParsing -Uri "http://localhost:$musicPort/scripting/x/import-map.json" -TimeoutSec 2
        if ($musicResponse.Content -match 'MusicEditorBuilder.ts') { $musicPreviewUrl = "http://localhost:$musicPort/"; break }
    } catch {}
}
if (-not $musicPreviewUrl) {
    Write-Host '请用 Cocos Creator 3.8.8 打开工程，等待资源编译并开启浏览器预览。'
    Write-Host $musicProjectPath
    Read-Host '按 Enter 关闭'
    exit 1
}
Write-Host '登录 → 世界编辑器文件夹 → 音乐编辑器 → MIDI以及音轨编辑器'
Start-Process $musicPreviewUrl
