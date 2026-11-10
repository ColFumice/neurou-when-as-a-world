param(
    [ValidateSet('capture', 'compare')][string]$Mode = 'compare'
)

$ErrorActionPreference = 'Stop'
$projectRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..\..'))
$baselinePath = Join-Path $PSScriptRoot 'protected-files-before.json'
$resultPath = Join-Path $PSScriptRoot 'protected-files-comparison.json'
$excludedTopLevelDirectories = @('node_modules', 'library', 'temp', 'tmp', '.git')
$excludedDeliveryRelativePath = 'quality-review/b2-real-service-freeze/'

function Get-ProtectedSnapshot {
    $candidateFiles = [System.Collections.Generic.List[System.IO.FileInfo]]::new()
    foreach ($item in Get-ChildItem -LiteralPath $projectRoot -Force) {
        if (-not $item.PSIsContainer) {
            $candidateFiles.Add($item)
            continue
        }
        if ($excludedTopLevelDirectories -contains $item.Name) { continue }
        foreach ($file in Get-ChildItem -LiteralPath $item.FullName -File -Recurse -Force) {
            $candidateFiles.Add($file)
        }
    }

    $records = foreach ($file in $candidateFiles) {
        $relativePath = [System.IO.Path]::GetRelativePath($projectRoot, $file.FullName).Replace('\', '/')
        if ($relativePath.StartsWith($excludedDeliveryRelativePath, [System.StringComparison]::OrdinalIgnoreCase)) { continue }
        [ordered]@{
            path = $relativePath
            bytes = $file.Length
            sha256 = (Get-FileHash -LiteralPath $file.FullName -Algorithm SHA256).Hash.ToLowerInvariant()
        }
    }
    @($records | Sort-Object -Property path)
}

$currentRecords = @(Get-ProtectedSnapshot)
if ($Mode -eq 'capture') {
    if (Test-Path -LiteralPath $baselinePath) { throw 'Baseline already exists; refusing to overwrite.' }
    $baseline = [ordered]@{
        schema = 1
        root = $projectRoot
        capturedUtc = [DateTime]::UtcNow.ToString('o')
        excludedTopLevelDirectories = $excludedTopLevelDirectories
        excludedDeliveryDirectory = $excludedDeliveryRelativePath
        scope = 'All root files and recursively all other directories, including src, constants, assets/scripts, scripts, archive, docs, editor directories, types, package files, tsconfig, root reference DOCX and prior quality-review records.'
        files = $currentRecords
    }
    $baseline | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $baselinePath -Encoding utf8
    Write-Output ('Captured protected files: ' + $currentRecords.Count)
    exit 0
}

$baseline = Get-Content -LiteralPath $baselinePath -Raw | ConvertFrom-Json
$beforeMap = @{}
$afterMap = @{}
foreach ($entry in $baseline.files) { $beforeMap[$entry.path] = $entry }
foreach ($entry in $currentRecords) { $afterMap[$entry.path] = $entry }
$removed = @($beforeMap.Keys | Where-Object { -not $afterMap.ContainsKey($_) } | Sort-Object)
$added = @($afterMap.Keys | Where-Object { -not $beforeMap.ContainsKey($_) } | Sort-Object)
$changed = @($beforeMap.Keys | Where-Object {
    $afterMap.ContainsKey($_) -and ($beforeMap[$_].sha256 -ne $afterMap[$_].sha256 -or $beforeMap[$_].bytes -ne $afterMap[$_].bytes)
} | Sort-Object)
$unchanged = ($removed.Count + $added.Count + $changed.Count) -eq 0
$result = [ordered]@{
    comparedUtc = [DateTime]::UtcNow.ToString('o')
    baselineFile = $baselinePath
    baselineSha256 = (Get-FileHash -LiteralPath $baselinePath -Algorithm SHA256).Hash.ToLowerInvariant()
    beforeCount = $baseline.files.Count
    afterCount = $currentRecords.Count
    removed = $removed
    added = $added
    changed = $changed
    unchanged = $unchanged
    limitation = 'This verifies byte stability since the initial B2.5a snapshot, not the origin or correctness of files that predated this work. Runtime caches/dependencies and the new delivery directory are excluded.'
}
$result | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $resultPath -Encoding utf8
$result | ConvertTo-Json -Depth 8
if ($unchanged) { exit 0 } else { exit 1 }
