' Ridge-Link Hidden Launcher
' Runs a batch file with no visible window.
' Usage: wscript.exe run_hidden.vbs "path\to\script.bat"

If WScript.Arguments.Count = 0 Then
    WScript.Quit 1
End If

Dim shell
Set shell = CreateObject("WScript.Shell")
shell.Run Chr(34) & WScript.Arguments(0) & Chr(34), 0, False
