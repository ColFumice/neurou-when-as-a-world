$ErrorActionPreference = 'Stop'
$evidenceRoot = $PSScriptRoot
$connection = Get-Content -LiteralPath (Join-Path $evidenceRoot 'runtime\.local\connection.json') -Raw | ConvertFrom-Json
$connectionUri = [Uri]$connection.databaseUrl
$privateValues = @($connection.databaseUrl,$connection.adminPassword,[Uri]::UnescapeDataString($connectionUri.UserInfo.Split(':',2)[1]))
$shareableFiles = @('code.diff','changed-files.json','protected-comparison.json','server-build.log','server-contract-and-http.log','server-test-results.json','..\client-tests\results-contract.json','..\client-tests\results-contract-and-http.json','..\client-tests\http-requests.json')
$checks = foreach ($file in $shareableFiles) {
    $content = [IO.File]::ReadAllText((Join-Path $evidenceRoot $file))
    [ordered]@{
        file = $file.Replace('\','/')
        knownCredentialValueFound = @($privateValues | Where-Object { $content.Contains($_) }).Count -gt 0
        privateKeyBlockFound = [regex]::IsMatch($content,'-----BEGIN (?:EC |RSA )?PRIVATE KEY-----\r?\n[\s\S]+?-----END (?:EC |RSA )?PRIVATE KEY-----')
    }
}
$oldNaming = Get-Content -LiteralPath (Join-Path $evidenceRoot '..\..\b2-real-service-freeze\evidence\check-naming.json') -Raw | ConvertFrom-Json
$gates = Get-Content -LiteralPath (Join-Path $evidenceRoot 'final-gates\results.json') -Raw | ConvertFrom-Json
$newNaming = $gates.runs | Where-Object name -EQ 'check-naming'
$warningDelta = @(Compare-Object -ReferenceObject @($oldNaming.warningLines) -DifferenceObject @($newNaming.warningLines))
$report = [ordered]@{
    auditedUtc = [DateTime]::UtcNow.ToString('o')
    phase = 'Final source after client asynchronous verification-deadline review fix'
    shareableKnownCredentialPass = @($checks | Where-Object { $_.knownCredentialValueFound -or $_.privateKeyBlockFound }).Count -eq 0
    checks = @($checks)
    namingWarningsBefore = $oldNaming.reportedWarningCount
    namingWarningsAfter = $newNaming.reportedWarnings
    warningTextDeltaCount = $warningDelta.Count
    warningDelta = $warningDelta
    limit = 'Checks known local DB credentials and private PEM material; ephemeral auth values are not printed by the test harness and not independently enumerated here.'
}
$report | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath (Join-Path $evidenceRoot 'shareable-and-warning-audit.json') -Encoding utf8
$report | ConvertTo-Json -Depth 6
if (-not $report.shareableKnownCredentialPass -or $report.warningTextDeltaCount -ne 0) { exit 1 }
