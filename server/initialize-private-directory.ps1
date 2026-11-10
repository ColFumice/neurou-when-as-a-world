param([string]$Path = (Join-Path $PSScriptRoot '.local'))
$ErrorActionPreference = 'Stop'
$resolved = [System.IO.Path]::GetFullPath($Path)
$workspace = [System.IO.Path]::GetFullPath($PSScriptRoot)
if (-not $resolved.StartsWith($workspace + [System.IO.Path]::DirectorySeparatorChar, [System.StringComparison]::OrdinalIgnoreCase)) { throw 'Private directory must be inside server package' }
New-Item -ItemType Directory -Path $resolved -Force | Out-Null
$acl = New-Object System.Security.AccessControl.DirectorySecurity
$acl.SetAccessRuleProtection($true, $false)
$inherit = [System.Security.AccessControl.InheritanceFlags]'ContainerInherit, ObjectInherit'
$propagate = [System.Security.AccessControl.PropagationFlags]::None
$allow = [System.Security.AccessControl.AccessControlType]::Allow
$identity = [System.Security.Principal.WindowsIdentity]::GetCurrent().User
foreach ($sid in @($identity, (New-Object System.Security.Principal.SecurityIdentifier 'S-1-5-18'), (New-Object System.Security.Principal.SecurityIdentifier 'S-1-5-32-544'))) {
  $rule = New-Object System.Security.AccessControl.FileSystemAccessRule($sid, 'FullControl', $inherit, $propagate, $allow)
  $acl.AddAccessRule($rule)
}
Set-Acl -LiteralPath $resolved -AclObject $acl
$verified = Get-Acl -LiteralPath $resolved
if (-not $verified.AreAccessRulesProtected) { throw 'Private directory inheritance remains enabled' }
Write-Output 'Private directory created with protected Windows ACL (current user, SYSTEM, Administrators).'
