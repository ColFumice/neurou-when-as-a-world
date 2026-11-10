param(
    [Parameter(Mandatory = $true)]
    [ValidateSet('check:naming', 'check:dependencies', 'typecheck')]
    [string]$Gate
)

$ErrorActionPreference = 'Stop'
$projectRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..\..'))
$safeName = $Gate.Replace(':', '-')
$logPath = Join-Path $PSScriptRoot ($safeName + '.log')
$recordPath = Join-Path $PSScriptRoot ($safeName + '.json')
$startedUtc = [DateTime]::UtcNow.ToString('o')
$timer = [System.Diagnostics.Stopwatch]::StartNew()
Push-Location -LiteralPath $projectRoot
try {
    $gateOutput = & npm.cmd run $Gate 2>&1 | Out-String -Width 4096
    $gateExitCode = $LASTEXITCODE
} finally {
    Pop-Location
}
$timer.Stop()
$gateOutput | Set-Content -LiteralPath $logPath -Encoding utf8
$warningLines = @($gateOutput -split '\r?\n' | Where-Object { $_ -match '(?i)^\s*(?:npm\s+)?WARN(?:ING)?\b' })
$reportedSummary = [regex]::Match($gateOutput, '(?m)汇总:\s*(\d+)\s+ERROR(?:\s*/\s*(\d+)\s+WARN)?')
$record = [ordered]@{
    command = 'npm run ' + $Gate
    executedVia = 'npm.cmd run ' + $Gate
    workingDirectory = $projectRoot
    startedUtc = $startedUtc
    completedUtc = [DateTime]::UtcNow.ToString('o')
    durationSeconds = [Math]::Round($timer.Elapsed.TotalSeconds, 3)
    exitCode = $gateExitCode
    passed = $gateExitCode -eq 0
    warningLineCount = $warningLines.Count
    warningLines = $warningLines
    reportedErrorCount = if ($reportedSummary.Success) { [int]$reportedSummary.Groups[1].Value } else { $null }
    reportedWarningCount = if ($reportedSummary.Success -and $reportedSummary.Groups[2].Success) { [int]$reportedSummary.Groups[2].Value } else { $null }
    log = $logPath
    logSha256 = (Get-FileHash -LiteralPath $logPath -Algorithm SHA256).Hash.ToLowerInvariant()
    warningCountingMethod = 'Emitted warning entries whose line begins with WARN, WARNING, npm WARN or npm WARNING; the summary line is excluded and its reported counts are stored separately.'
    limitation = 'The existing repository gate checks existing implementation paths; it does not compile or validate the new Markdown contract draft and does not attest real service deployment or security.'
}
$record | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $recordPath -Encoding utf8
$gateOutput
$record | ConvertTo-Json -Depth 8
exit $gateExitCode
