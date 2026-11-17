$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
$root = [IO.Path]::GetFullPath($PSScriptRoot) + [IO.Path]::DirectorySeparatorChar
$count = 0
foreach ($line in (Get-Content -LiteralPath (Join-Path $PSScriptRoot 'MANIFEST.sha256'))) {
    $parts = $line -split '  ', 2
    if ($parts.Count -ne 2 -or $parts[0] -notmatch '^[0-9a-f]{64}$') { throw 'MANIFEST_FORMAT' }
    $path = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot $parts[1]))
    if (-not $path.StartsWith($root, [StringComparison]::OrdinalIgnoreCase)) { throw 'MANIFEST_PATH' }
    if ((Get-Item -LiteralPath $path).Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'MANIFEST_LINK' }
    if ((Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash.ToLowerInvariant() -ne $parts[0]) { throw 'MANIFEST_HASH' }
    $count++
}
if ($count -lt 3) { throw 'MANIFEST_INCOMPLETE' }
# No key is read by PowerShell, passed on argv, placed in environment, or logged.
# Existing native Python installation is used; no install or online dependency fetch.
$python = Join-Path $PSScriptRoot '.venv\Scripts\python.exe'
if (Test-Path -LiteralPath $python) {
    & $python -I -B -m unittest discover -s $PSScriptRoot -p test_clipboard_preflight.py
} else {
    & py -3 -I -B -m unittest discover -s $PSScriptRoot -p test_clipboard_preflight.py
}
if ($LASTEXITCODE -ne 0) { throw 'OFFLINE_CLIPBOARD_TESTS_FAILED' }
Write-Output 'Only TEST public GET; A/B Auth and Storage cleanup remain separate gates.'
$null = Read-Host 'Copy the TEST Publishable Key, then press Enter'
if (Test-Path -LiteralPath $python) {
    & $python -I -B (Join-Path $PSScriptRoot 'clipboard_preflight.py')
} else {
    & py -3 -I -B (Join-Path $PSScriptRoot 'clipboard_preflight.py')
}
exit $LASTEXITCODE
