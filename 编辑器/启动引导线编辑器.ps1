$projectPath = Split-Path -Parent $PSScriptRoot
$previewUrl = $null
foreach ($port in @(7457, 7456, 7458)) {
    try {
        $response = Invoke-WebRequest -UseBasicParsing -Uri "http://localhost:$port/scripting/x/import-map.json" -TimeoutSec 2
        if ($response.Content -match 'GuidanceEditorBuilder.ts') { $previewUrl = "http://localhost:$port/?guidanceEditor=1"; break }
    } catch {}
}
if (-not $previewUrl) {
    Write-Host '请用 Cocos Creator 3.8.8 打开此工程，等待资源编译并开启浏览器预览后，再运行本入口。'
    Write-Host $projectPath
    Read-Host '按 Enter 关闭'
    exit 1
}
Start-Process $previewUrl
