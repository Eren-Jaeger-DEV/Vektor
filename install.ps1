$ErrorActionPreference = "Stop"

Write-Host "Downloading Vektor..." -ForegroundColor Cyan

$Release = "vektor-windows-x64.zip"
$InstallDir = Join-Path $env:USERPROFILE ".vk"
$DownloadUrl = "https://github.com/Eren-Jaeger-DEV/VKS/releases/latest/download/$Release"
$ZipPath = Join-Path $InstallDir $Release

if (-not (Test-Path $InstallDir)) {
    New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null
}

Write-Host "Fetching $DownloadUrl"
Invoke-WebRequest -Uri $DownloadUrl -OutFile $ZipPath

Write-Host "Extracting archive..."
Expand-Archive -Path $ZipPath -DestinationPath $InstallDir -Force
Remove-Item $ZipPath

Write-Host "Vektor has been installed to $InstallDir" -ForegroundColor Green

# Add to PATH
$BinDir = Join-Path $InstallDir "bin"
$UserPath = [Environment]::GetEnvironmentVariable("PATH", "User")
$HasPath = $UserPath -split ';' | Where-Object { $_ -eq $BinDir }

if (-not $HasPath) {
    Write-Host "Adding $BinDir to user PATH"
    $NewPath = $UserPath + ";" + $BinDir
    [Environment]::SetEnvironmentVariable("PATH", $NewPath, "User")
}

[Environment]::SetEnvironmentVariable("VEKTOR_HOME", $InstallDir, "User")

Write-Host "Installation Complete! Please restart your terminal and try running 'vektor'" -ForegroundColor Cyan
