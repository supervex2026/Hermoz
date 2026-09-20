# Momo Release Build & Package Script
$ErrorActionPreference = "Stop"

Write-Host "=========================================" -ForegroundColor Green
Write-Host "  Momo Release Build Pipeline Starting  " -ForegroundColor Green
Write-Host "=========================================" -ForegroundColor Green

$env:PATH = "C:\Program Files (x86)\NSIS;$env:USERPROFILE\.cargo\bin;$env:PATH"
$env:CARGO_TARGET_DIR = "E:\momo_build_target"

Set-Location "E:\Momo\momo"

Write-Host "[1/4] Building Frontend..." -ForegroundColor Cyan
npm run build

Write-Host "[2/4] Building Tauri Windows Application & NSIS Installer..." -ForegroundColor Cyan
npx tauri build --ignore-version-mismatches

Write-Host "[3/4] Copying final binaries to E:\Momo\..." -ForegroundColor Cyan
Stop-Process -Name "momo" -Force -ErrorAction SilentlyContinue
Stop-Process -Name "Momo" -Force -ErrorAction SilentlyContinue
Start-Sleep -Milliseconds 500

$releaseDir = "E:\momo_build_target\release"
$nsisDir = "$releaseDir\bundle\nsis"

if (Test-Path "$releaseDir\momo.exe") {
    Copy-Item "$releaseDir\momo.exe" "E:\Momo\Momo.exe" -Force
    Write-Host "  -> Successfully updated E:\Momo\Momo.exe" -ForegroundColor Green
}

$installer = Get-ChildItem "$nsisDir\*.exe" | Select-Object -First 1
if ($installer) {
    Copy-Item $installer.FullName "E:\Momo\Momo_Setup.exe" -Force
    Write-Host "  -> Successfully updated E:\Momo\Momo_Setup.exe ($($installer.Name))" -ForegroundColor Green
}

Write-Host "[4/4] Release Build Complete!" -ForegroundColor Green
Write-Host "Standalone executable: E:\Momo\Momo.exe" -ForegroundColor Yellow
Write-Host "Installer package:     E:\Momo\Momo_Setup.exe" -ForegroundColor Yellow
