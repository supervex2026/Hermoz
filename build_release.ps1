# Hermoz Release Build & Package Script
$ErrorActionPreference = "Stop"

Write-Host "=========================================" -ForegroundColor Green
Write-Host "  Hermoz Release Build Pipeline Starting  " -ForegroundColor Green
Write-Host "=========================================" -ForegroundColor Green

$env:PATH = "C:\Program Files (x86)\NSIS;$env:USERPROFILE\.cargo\bin;$env:PATH"
$scriptDir = $PSScriptRoot
if (-not $scriptDir) { $scriptDir = (Get-Location).Path }

Set-Location $scriptDir

Write-Host "[1/4] Building Frontend..." -ForegroundColor Cyan
npm run build

Write-Host "[2/4] Building Tauri Windows Application & NSIS Installer..." -ForegroundColor Cyan
npx tauri build --ignore-version-mismatches

Write-Host "[3/4] Copying final binaries to releases\..." -ForegroundColor Cyan
Stop-Process -Name "hermoz" -Force -ErrorAction SilentlyContinue
Stop-Process -Name "Hermoz" -Force -ErrorAction SilentlyContinue
Start-Sleep -Milliseconds 500

$targetDir = if ($env:CARGO_TARGET_DIR) { $env:CARGO_TARGET_DIR } else { "$scriptDir\src-tauri\target" }
$releaseDir = "$targetDir\release"
$nsisDir = "$releaseDir\bundle\nsis"

$releasesOutput = "$scriptDir\releases"
if (-not (Test-Path $releasesOutput)) {
    New-Item -ItemType Directory -Path $releasesOutput | Out-Null
}

if (Test-Path "$releaseDir\hermoz.exe") {
    Copy-Item "$releaseDir\hermoz.exe" "$releasesOutput\Hermoz.exe" -Force
    Write-Host "  -> Successfully updated $releasesOutput\Hermoz.exe" -ForegroundColor Green
}

$installer = Get-ChildItem "$nsisDir\*.exe" | Select-Object -First 1
if ($installer) {
    Copy-Item $installer.FullName "$releasesOutput\Hermoz_0.1.0_x64-setup.exe" -Force
    Write-Host "  -> Successfully updated $releasesOutput\Hermoz_0.1.0_x64-setup.exe ($($installer.Name))" -ForegroundColor Green
}

Write-Host "[4/4] Release Build Complete!" -ForegroundColor Green
Write-Host "Standalone executable: $releasesOutput\Hermoz.exe" -ForegroundColor Yellow
Write-Host "Installer package:     $releasesOutput\Hermoz_0.1.0_x64-setup.exe" -ForegroundColor Yellow
