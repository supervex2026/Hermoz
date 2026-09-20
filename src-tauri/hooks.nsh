; Momo NSIS Installer Hooks
; Detects existing installations, handles clean in-place updates, closes running instances,
; verifies Microsoft VC++ Redistributable, and creates desktop shortcuts.

!macro NSIS_HOOK_PREINSTALL
    DetailPrint "Checking for previous Momo installations..."
    
    ; 1. Close any running Momo instances so files aren't locked during update
    nsExec::Exec 'taskkill /F /IM Momo.exe /T'
    nsExec::Exec 'taskkill /F /IM momo.exe /T'
    Sleep 500

    ; 2. Check registry for existing Momo installation
    StrCpy $1 ""
    ReadRegStr $1 HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Momo" "DisplayVersion"
    ${If} $1 == ""
        ReadRegStr $1 HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\Momo" "DisplayVersion"
    ${EndIf}
    ${If} $1 == ""
        ReadRegStr $1 HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\momo" "DisplayVersion"
    ${EndIf}

    ${If} $1 != ""
        DetailPrint "Found existing Momo installation (v$1). Performing seamless update..."
        MessageBox MB_ICONINFORMATION|MB_OK "Previous version of Momo (v$1) was detected.$\r$\n$\r$\nMomo will now update your installation while keeping your settings and API keys safe."
    ${Else}
        DetailPrint "No previous installation detected. Performing fresh installation..."
    ${EndIf}

    ; 3. Verify Microsoft Visual C++ Redistributable prerequisite
    DetailPrint "Verifying Microsoft Visual C++ Redistributable prerequisite..."
    ReadRegDWORD $0 HKLM "SOFTWARE\Microsoft\VisualStudio\14.0\VC\Runtimes\X64" "Installed"
    ${If} $0 != 1
        ReadRegDWORD $0 HKLM "SOFTWARE\WOW6432Node\Microsoft\VisualStudio\14.0\VC\Runtimes\X64" "Installed"
    ${EndIf}
    ${If} $0 != 1
        DetailPrint "Visual C++ Runtime missing. Downloading official Microsoft VC++ Redistributable (x64)..."
        nsExec::ExecToLog 'powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; (New-Object Net.WebClient).DownloadFile(\"https://aka.ms/vs/17/release/vc_redist.x64.exe\", \"$TEMP\vc_redist.x64.exe\"); Start-Process \"$TEMP\vc_redist.x64.exe\" -ArgumentList \"/install\", \"/passive\", \"/norestart\" -Wait"'
        DetailPrint "Visual C++ Runtime verification finished."
    ${Else}
        DetailPrint "Visual C++ Redistributable is already present on this system."
    ${EndIf}
!macroend

!macro NSIS_HOOK_POSTINSTALL
    DetailPrint "Creating / updating Momo Desktop Shortcut..."
    CreateShortCut "$DESKTOP\Momo.lnk" "$INSTDIR\Momo.exe" "" "$INSTDIR\Momo.exe" 0
!macroend

!macro NSIS_HOOK_POSTUNINSTALL
    Delete "$DESKTOP\Momo.lnk"
!macroend
