#define MyAppName "飞鸟壁纸"
#define MyAppVersion "1.3.7"
#define MyAppPublisher "OXOYO"
#define MyAppURL "https://github.com/OXOYO/Flying-Bird-Wallpaper"
#define MyAppExeName "Flying Bird Wallpaper.exe"

[Setup]
AppId={{38CA1441-B5F8-4955-8246-F5D46F7AC5D0}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppPublisherURL={#MyAppURL}
AppSupportURL={#MyAppURL}
AppUpdatesURL={#MyAppURL}
DefaultDirName={autopf}\Flying Bird Wallpaper
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
DefaultGroupName={#MyAppName}
AllowNoIcons=yes
PrivilegesRequired=admin
OutputDir=D:\Webstorm_WorkSpace\Flying-Bird-Wallpaper\dist_setup
OutputBaseFilename=Flying Bird Wallpaper-{#MyAppVersion}
SetupIconFile=D:\Webstorm_WorkSpace\Flying-Bird-Wallpaper\build\icon.ico
Compression=lzma2/ultra
SolidCompression=yes
WizardStyle=modern
DiskSpanning=yes
UninstallDisplayIcon={app}\{#MyAppExeName}
AppMutex=FlyingBirdWallpaperMutex
SetupMutex=FlyingBirdWallpaperSetupMutex
DisableProgramGroupPage=yes
CloseApplications=yes

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"
Name: "chinesesimplified"; MessagesFile: "compiler:Languages\ChineseSimplified.isl"

[Code]
; 自动检测系统语言
function .onInit
  ; 获取系统语言ID
  System::Call "kernel32::GetSystemDefaultLangID() i .r0"
  ; 根据语言ID设置安装程序语言
  StrCmp $0 0x0804 "Chinese"
  ; 默认使用英语
  Goto "English"
  
  Chinese:
    ; 设置为简体中文
    Push "chinesesimplified"
    Goto "End"
  
  English:
    ; 设置为英语
    Push "english"
  
  End:
    ; 设置安装程序语言
    Pop $1
    StrCmp $1 "" ""
    ExecShell "open" "$INSTDIR\" /L=$1
function end

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: unchecked

[Files]
Source: "D:\Webstorm_WorkSpace\Flying-Bird-Wallpaper\dist\win-unpacked\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{group}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"
Name: "{group}\{cm:ProgramOnTheWeb,{#MyAppName}}"; Filename: "{#MyAppURL}"
Name: "{group}\{cm:UninstallProgram,{#MyAppName}}"; Filename: "{uninstallexe}"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; Tasks: desktopicon

[Run]
Filename: "{app}\{#MyAppExeName}"; Description: "{cm:LaunchProgram,{#StringChange(MyAppName, '&', '&&')}}"; Flags: nowait postinstall skipifsilent

[UninstallDelete]
Type: filesandordirs; Name: "{app}"

[Code]
// 检查应用是否正在运行，如果是则关闭它
function InitializeSetup(): Boolean;
var
  ResultCode: Integer;
begin
  Result := True;

  // 尝试关闭正在运行的应用实例
  if Exec(ExpandConstant('{sys}\taskkill.exe'), '/f /im "{#MyAppExeName}"', '', SW_HIDE, ewWaitUntilTerminated, ResultCode) then
  begin
    // 等待一会儿确保应用完全关闭
    Sleep(1000);
  end;
end;
