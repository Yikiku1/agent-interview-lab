param([string]$JavaHome = $env:JAVA_HOME)
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$toolchain = Join-Path $root '.local/android-toolchain'
$work = Join-Path $root '.local/android-build'
$release = Join-Path $root '.local/releases'
if (!$JavaHome) {
    $settings = (& java -XshowSettings:properties -version 2>&1 | Out-String)
    if ($settings -match 'java.home\s*=\s*([^\r\n]+)') { $JavaHome = $Matches[1].Trim() }
}
if (!(Test-Path "$JavaHome/bin/javac.exe")) { throw 'JDK 17 or newer is required. Pass -JavaHome.' }
New-Item -ItemType Directory -Force $toolchain,$work,$release | Out-Null
function Run([string]$Exe, [string[]]$Arguments) {
    & $Exe @Arguments
    if ($LASTEXITCODE -ne 0) { throw "$Exe failed: $LASTEXITCODE" }
}
function EnsureArchive([string]$Name, [string]$Url, [string]$Expected) {
    if (!(Test-Path (Join-Path $toolchain $Expected))) {
        $zip = Join-Path $toolchain $Name
        if (!(Test-Path $zip) -or (Get-Item $zip).Length -eq 0) {
            Run 'curl.exe' @('-fL','--retry','3','--output',$zip,$Url)
        }
        Expand-Archive -LiteralPath $zip -DestinationPath $toolchain -Force
    }
}
EnsureArchive 'platform.zip' 'https://dl.google.com/android/repository/platform-35_r02.zip' 'android-35/android.jar'
EnsureArchive 'build-tools.zip' 'https://dl.google.com/android/repository/build-tools_r35_windows.zip' 'android-15/aapt2.exe'
$bt = Join-Path $toolchain 'android-15'
$platform = Join-Path $toolchain 'android-35/android.jar'
foreach ($file in @('index.html','app.js','store.js','questions.json','style.css')) {
    if (!(Test-Path (Join-Path $root "mobile/www/$file"))) { throw "Missing mobile/www/$file" }
}
$assets = Join-Path $work 'assets'
New-Item -ItemType Directory -Force "$assets/www","$work/classes","$work/dex" | Out-Null
# Remove only the known generated staging folder to avoid shipping stale assets.
Get-ChildItem -LiteralPath "$assets/www" -File | Remove-Item
Copy-Item -Path "$root/mobile/www/*" -Destination "$assets/www" -Recurse -Force
Run "$bt/aapt2.exe" @('link','-o',"$work/base.apk",'--manifest',"$PSScriptRoot/AndroidManifest.xml",'-I',$platform,'-A',$assets,'--min-sdk-version','26','--target-sdk-version','35')
$sources = @(Get-ChildItem "$PSScriptRoot/src" -Filter '*.java' -Recurse | ForEach-Object FullName)
Run "$JavaHome/bin/javac.exe" (@('--release','8','-encoding','UTF-8','-classpath',$platform,'-d',"$work/classes") + $sources)
Run "$JavaHome/bin/jar.exe" @('cf',"$work/classes.jar",'-C',"$work/classes",'.')
Run "$JavaHome/bin/java.exe" @('-cp',"$bt/lib/d8.jar",'com.android.tools.r8.D8','--lib',$platform,'--min-api','26','--output',"$work/dex","$work/classes.jar")
Copy-Item "$work/base.apk" "$work/unsigned.apk" -Force
Run "$JavaHome/bin/jar.exe" @('uf',"$work/unsigned.apk",'-C',"$work/dex",'classes.dex')
# Windows aapt2 can emit backslashes inside asset ZIP names; Android AssetManager needs '/'.
$inputZip = [IO.Compression.ZipFile]::OpenRead("$work/unsigned.apk")
$normalizedPath = "$work/normalized.apk"
if (Test-Path $normalizedPath) { Remove-Item -LiteralPath $normalizedPath }
$outputZip = [IO.Compression.ZipFile]::Open($normalizedPath, [IO.Compression.ZipArchiveMode]::Create)
try {
    foreach ($entry in $inputZip.Entries) {
        $name = $entry.FullName.Replace('\','/')
        $compression = if ($name -eq 'resources.arsc') { [IO.Compression.CompressionLevel]::NoCompression } else { [IO.Compression.CompressionLevel]::Optimal }
        $target = $outputZip.CreateEntry($name, $compression)
        $sourceStream = $entry.Open()
        $targetStream = $target.Open()
        try { $sourceStream.CopyTo($targetStream) } finally { $sourceStream.Dispose(); $targetStream.Dispose() }
    }
} finally { $inputZip.Dispose(); $outputZip.Dispose() }
Run "$bt/zipalign.exe" @('-f','-p','4',$normalizedPath,"$work/aligned.apk")
$key = Join-Path $toolchain 'release.jks'
$password = Join-Path $toolchain 'signing-password.txt'
if (!(Test-Path $key)) {
    if (!(Test-Path $password)) { [IO.File]::WriteAllText($password, [Guid]::NewGuid().ToString('N')) }
    Run "$JavaHome/bin/keytool.exe" @('-genkeypair','-keystore',$key,'-storepass:file',$password,'-keypass:file',$password,'-alias','offline','-keyalg','RSA','-keysize','3072','-validity','10000','-dname','CN=Interview Lab Offline,O=Personal,C=CN')
}
if (!(Test-Path $password)) { throw 'Signing password is missing. Restore it with release.jks; do not generate another upgrade key.' }
$apk = Join-Path $release 'interview-lab-offline.apk'
Run "$JavaHome/bin/java.exe" @('-jar',"$bt/lib/apksigner.jar",'sign','--ks',$key,'--ks-key-alias','offline','--ks-pass',"file:$password",'--out',$apk,"$work/aligned.apk")
Run "$JavaHome/bin/java.exe" @('-jar',"$bt/lib/apksigner.jar",'verify','--verbose','--print-certs',$apk)
Run "$bt/zipalign.exe" @('-c','-p','4',$apk)
Run "$bt/aapt2.exe" @('dump','badging',$apk)
$archive = [IO.Compression.ZipFile]::OpenRead($apk)
try {
    foreach ($name in @('app.js','index.html','questions.json','store.js','style.css')) {
        $entry = $archive.GetEntry("assets/www/$name")
        if (!$entry) { throw "Missing APK asset: $name" }
        $stream = $entry.Open()
        $sha = [Security.Cryptography.SHA256]::Create()
        try {
            $embeddedHash = [Convert]::ToHexString($sha.ComputeHash($stream))
            if ($embeddedHash -ne (Get-FileHash "$root/mobile/www/$name" -Algorithm SHA256).Hash) {
                throw "APK asset differs from source: $name. Source changed during build; rebuild."
            }
        } finally { $stream.Dispose(); $sha.Dispose() }
    }
} finally { $archive.Dispose() }
Write-Host 'All five embedded asset hashes match mobile/www.'
[xml]$releaseManifest = Get-Content "$PSScriptRoot/AndroidManifest.xml" -Raw
$releaseVersion = $releaseManifest.manifest.GetAttribute('versionName', 'http://schemas.android.com/apk/res/android')
$versionedApk = Join-Path $release "interview-lab-offline-$releaseVersion.apk"
Copy-Item -LiteralPath $apk -Destination $versionedApk -Force
Get-FileHash -LiteralPath $apk -Algorithm SHA256
Write-Host "APK: $apk"
Write-Host "Versioned APK: $versionedApk"
