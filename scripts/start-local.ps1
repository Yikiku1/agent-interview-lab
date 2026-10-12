[CmdletBinding()]
param(
    [ValidateRange(1, 65535)][int]$Port = 3000,
    [switch]$NoBrowser,
    [switch]$Build
)
$ErrorActionPreference = 'Stop'
$projectRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$nodeCommand = Get-Command node -ErrorAction Stop
$originalDirectory = Get-Location
try {
    Set-Location -LiteralPath $projectRoot
    $startArguments = @('--import', 'tsx', 'scripts/start-local.ts', '--port', "$Port")
    if ($Build) { $startArguments += '--build' }
    & $nodeCommand.Source @startArguments
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    if (!$NoBrowser) { Start-Process -FilePath "http://localhost:$Port" }
} finally {
    Set-Location -LiteralPath $originalDirectory
}
