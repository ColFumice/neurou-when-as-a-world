$ErrorActionPreference = 'Stop'
$taskRuntimeRoot = Join-Path $PSScriptRoot 'runtime'
$taskPrivateRoot = Join-Path $taskRuntimeRoot '.local'
$taskDataRoot = Join-Path $taskPrivateRoot 'data'
$taskBinRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..\b2-real-auth\evidence\runtime\pgsql\bin'))
$taskPort = 55437
New-Item -ItemType Directory -Force -Path $taskPrivateRoot | Out-Null
& icacls.exe $taskPrivateRoot /inheritance:r /grant:r "$($env:USERNAME):(OI)(CI)F" | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Unable to restrict c-2b private runtime ACL.' }
function New-C2bPassword {
    [Convert]::ToBase64String([Security.Cryptography.RandomNumberGenerator]::GetBytes(32)).TrimEnd('=').Replace('+','-').Replace('/','_')
}
$taskConnectionFile = Join-Path $taskPrivateRoot 'connection.json'
if (-not (Test-Path -LiteralPath (Join-Path $taskDataRoot 'PG_VERSION'))) {
    if (Get-NetTCPConnection -LocalPort $taskPort -State Listen -ErrorAction SilentlyContinue) { throw 'Isolated c-2b PG port is occupied.' }
    $taskAdminPassword = New-C2bPassword
    $taskApplicationPassword = New-C2bPassword
    $taskPasswordFile = Join-Path $taskPrivateRoot 'initdb-password'
    [IO.File]::WriteAllText($taskPasswordFile,$taskAdminPassword,[Text.UTF8Encoding]::new($false))
    & (Join-Path $taskBinRoot 'initdb.exe') '-D' $taskDataRoot '-U' 'c2b_admin' '--pwfile' $taskPasswordFile '--auth-host=scram-sha-256' '--auth-local=scram-sha-256' '--encoding=UTF8' '--locale=C'
    if ($LASTEXITCODE -ne 0) { throw 'c-2b PostgreSQL initdb failed.' }
    $taskSqlFile = Join-Path $taskPrivateRoot 'bootstrap.sql'
    [IO.File]::WriteAllText($taskSqlFile,"CREATE ROLE c2b_app LOGIN PASSWORD '$taskApplicationPassword';`nCREATE DATABASE c2b_authority OWNER c2b_app;`nCREATE DATABASE c2b_history_auth OWNER c2b_app;`n",[Text.UTF8Encoding]::new($false))
    [ordered]@{ databaseUrl="postgresql://c2b_app:$taskApplicationPassword@127.0.0.1:$taskPort/c2b_authority"; historyDatabaseUrl="postgresql://c2b_app:$taskApplicationPassword@127.0.0.1:$taskPort/c2b_history_auth"; adminPassword=$taskAdminPassword; host='127.0.0.1'; port=$taskPort; database='c2b_authority'; historyDatabase='c2b_history_auth'; user='c2b_app'; bootstrapComplete=$false } | ConvertTo-Json | Set-Content -LiteralPath $taskConnectionFile -Encoding utf8
}
$taskConnection = Get-Content -LiteralPath $taskConnectionFile -Raw | ConvertFrom-Json
& (Join-Path $taskBinRoot 'pg_ctl.exe') '-D' $taskDataRoot 'status' | Out-Null
if ($LASTEXITCODE -ne 0) {
    $taskCtlArguments = @('-D',('"' + $taskDataRoot + '"'),'-l',('"' + (Join-Path $taskPrivateRoot 'postgres.log') + '"'),'-o',('"-h 127.0.0.1 -p ' + $taskPort + '"'),'-w','-t','30','start')
    $taskCtlProcess = Start-Process -FilePath (Join-Path $taskBinRoot 'pg_ctl.exe') -ArgumentList $taskCtlArguments -WindowStyle Hidden -Wait -PassThru -RedirectStandardOutput (Join-Path $taskPrivateRoot 'pg-ctl-start.stdout') -RedirectStandardError (Join-Path $taskPrivateRoot 'pg-ctl-start.stderr')
    if ($taskCtlProcess.ExitCode -ne 0) { throw 'c-2b PostgreSQL start failed.' }
}
if (-not $taskConnection.bootstrapComplete) {
    $env:PGPASSWORD = $taskConnection.adminPassword
    try {
        & (Join-Path $taskBinRoot 'psql.exe') '-h' '127.0.0.1' '-p' $taskPort '-U' 'c2b_admin' '-d' 'postgres' '-v' 'ON_ERROR_STOP=1' '-f' (Join-Path $taskPrivateRoot 'bootstrap.sql')
        if ($LASTEXITCODE -ne 0) { throw 'c-2b database bootstrap failed.' }
    } finally { Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue }
    $taskConnection.bootstrapComplete = $true
    $taskConnection | ConvertTo-Json | Set-Content -LiteralPath $taskConnectionFile -Encoding utf8
    Remove-Item -LiteralPath (Join-Path $taskPrivateRoot 'initdb-password'),(Join-Path $taskPrivateRoot 'bootstrap.sql') -ErrorAction SilentlyContinue
}
$env:PGPASSWORD = $taskConnection.adminPassword
try {
    & (Join-Path $taskBinRoot 'psql.exe') '-h' '127.0.0.1' '-p' $taskPort '-U' 'c2b_admin' '-d' 'postgres' '-v' 'ON_ERROR_STOP=1' '-c' "SELECT version(); SHOW listen_addresses; SHOW password_encryption; SELECT rolname, rolsuper, rolcreatedb, rolcreaterole FROM pg_roles WHERE rolname='c2b_app';"
    if ($LASTEXITCODE -ne 0) { throw 'c-2b database verification failed.' }
} finally { Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue }
Write-Output 'c-2b isolated PostgreSQL17 ready at 127.0.0.1:55437; private process-only connection metadata is stored under this round runtime/.local.'
