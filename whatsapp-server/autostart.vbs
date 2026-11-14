' Запускает WhatsApp-шлюз и публичный туннель без окон.
' Этот файл вызывается ярлыком из папки «Автозагрузка» при входе в Windows,
' поэтому сайт на Vercel снова может отправлять коды после перезагрузки.
' Текущий публичный адрес пишется в gateway-url.txt рядом с этим файлом.

Set fso = CreateObject("Scripting.FileSystemObject")
Set shell = CreateObject("WScript.Shell")

folder = fso.GetParentFolderName(WScript.ScriptFullName)
shell.CurrentDirectory = folder

shell.Run "cmd /c node start-public.js >> start-public.out.log 2>&1", 0, False
