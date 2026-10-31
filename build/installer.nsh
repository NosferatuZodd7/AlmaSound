; Start-menu shortcut to diagnostics.bat (included automatically by electron-builder).
!macro customInstall
  CreateShortCut "$SMPROGRAMS\AlmaSound diagnostics.lnk" "$INSTDIR\diagnostics.bat"
!macroend

!macro customUnInstall
  Delete "$SMPROGRAMS\AlmaSound diagnostics.lnk"
!macroend
