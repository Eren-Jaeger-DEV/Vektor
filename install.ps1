# ============================================================
# Vektor — Standalone One-Line Installer (Windows PowerShell)
# ============================================================
$ErrorActionPreference = "Stop"

Write-Host "🚀 Installing Vektor Programming Language..." -ForegroundColor Cyan

$InstallDir = Join-Path $env:USERPROFILE ".vektor"
$BinDir = Join-Path $InstallDir "bin"
$StdlibDir = Join-Path $InstallDir "stdlib"

if (-not (Test-Path $BinDir)) {
    New-Item -ItemType Directory -Force -Path $BinDir | Out-Null
}
if (-not (Test-Path $StdlibDir)) {
    New-Item -ItemType Directory -Force -Path $StdlibDir | Out-Null
}

$Release = "vektor-windows-x64.zip"
$DownloadUrl = "https://github.com/Eren-Jaeger-DEV/VKS/releases/latest/download/$Release"
$ZipPath = Join-Path $InstallDir $Release

try {
    Write-Host "  ↓ Fetching $DownloadUrl..." -ForegroundColor Gray
    Invoke-WebRequest -Uri $DownloadUrl -OutFile $ZipPath -ErrorAction Stop
    Expand-Archive -Path $ZipPath -DestinationPath $InstallDir -Force
    Remove-Item $ZipPath
    Write-Host "  ✓ Downloaded and extracted release to $InstallDir" -ForegroundColor Green
} catch {
    Write-Host "  ℹ Release archive not online yet. Installing CLI wrapper..." -ForegroundColor Yellow
    $WrapperCmd = "@echo off`r`nnpx tsx %~dp0..\src\main.ts %*"
    Set-Content -Path (Join-Path $BinDir "vektor.cmd") -Value $WrapperCmd
    Write-Host "  ✓ Installed CLI wrapper at $BinDir\vektor.cmd" -ForegroundColor Green
}

# Update User PATH & VEKTOR_HOME environment variables
$UserPath = [Environment]::GetEnvironmentVariable("PATH", "User")
$HasPath = $UserPath -split ';' | Where-Object { $_ -eq $BinDir }

if (-not $HasPath) {
    Write-Host "  ✓ Adding $BinDir to user PATH..." -ForegroundColor Gray
    $NewPath = $UserPath + ";" + $BinDir
    [Environment]::SetEnvironmentVariable("PATH", $NewPath, "User")
}

[Environment]::SetEnvironmentVariable("VEKTOR_HOME", $InstallDir, "User")

Write-Host ""
Write-Host "🎉 Vektor installation complete!" -ForegroundColor Cyan
Write-Host "   Directory: $InstallDir" -ForegroundColor Gray
Write-Host "   Restart your PowerShell terminal and run 'vektor' to get started." -ForegroundColor Cyan
