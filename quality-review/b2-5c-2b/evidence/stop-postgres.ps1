$ErrorActionPreference = 'Stop'
$taskDataRoot = Join-Path $PSScriptRoot 'runtime\.local\data'
$taskBinRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..\b2-real-auth\evidence\runtime\pgsql\bin'))
if (-not (Test-Path -LiteralPath (Join-Path $taskDataRoot 'PG_VERSION'))) { throw 'No c-2b cluster at the fixed isolated path.' }
& (Join-Path $taskBinRoot 'pg_ctl.exe') '-D' $taskDataRoot 'status' | Out-Null
if ($LASTEXITCODE -ne 0) { Write-Output 'c-2b isolated cluster already stopped; data retained.'; exit 0 }
& (Join-Path $taskBinRoot 'pg_ctl.exe') '-D' $taskDataRoot '-w' '-t' '30' '-m' 'fast' 'stop'
if ($LASTEXITCODE -ne 0) { throw 'c-2b PostgreSQL stop failed.' }
Write-Output 'c-2b isolated cluster stopped; data and private connection metadata retained.'
