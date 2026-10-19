param([ValidateSet('write','restore','export','import')][string]$Phase = 'write', [string]$JavaHome = $env:JAVA_HOME, [string]$Device = 'emulator-5554')
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$toolchain = Join-Path $root '.local/android-toolchain'
$work = Join-Path $root '.local/android-tests'
if (!$JavaHome) {
    $settings = (& java -XshowSettings:properties -version 2>&1 | Out-String)
    if ($settings -match 'java.home\s*=\s*([^\r\n]+)') { $JavaHome = $Matches[1].Trim() }
}
function Run([string]$Exe, [string[]]$Arguments) {
    & $Exe @Arguments
    if ($LASTEXITCODE -ne 0) { throw "$Exe failed: $LASTEXITCODE" }
}
New-Item -ItemType Directory -Force "$work/classes","$work/dex" | Out-Null
$bt = Join-Path $toolchain 'android-15'
$platform = Join-Path $toolchain 'android-35/android.jar'
Run "$bt/aapt2.exe" @('link','-o',"$work/test.apk",'--manifest',"$PSScriptRoot/tests/AndroidManifest.xml",'-I',$platform)
Run "$JavaHome/bin/javac.exe" @('--release','8','-encoding','UTF-8','-classpath',$platform,'-d',"$work/classes","$PSScriptRoot/tests/SmokeTest.java")
Run "$JavaHome/bin/jar.exe" @('cf',"$work/classes.jar",'-C',"$work/classes",'.')
Run "$JavaHome/bin/java.exe" @('-cp',"$bt/lib/d8.jar",'com.android.tools.r8.D8','--lib',$platform,'--min-api','26','--output',"$work/dex","$work/classes.jar")
Run "$JavaHome/bin/jar.exe" @('uf',"$work/test.apk",'-C',"$work/dex",'classes.dex')
Run "$bt/zipalign.exe" @('-f','4',"$work/test.apk","$work/aligned.apk")
Run "$JavaHome/bin/java.exe" @('-jar',"$bt/lib/apksigner.jar",'sign','--ks',"$toolchain/release.jks",'--ks-key-alias','offline','--ks-pass',"file:$toolchain/signing-password.txt",'--out',"$work/signed.apk","$work/aligned.apk")
$adb = Join-Path $toolchain 'platform-tools/adb.exe'
Run $adb @('-s',$Device,'install','-r',"$work/signed.apk")
$result = & $adb -s $Device shell am instrument -w -e phase $Phase cn.interviewlab.offline.tests/.SmokeTest
$result | Write-Output
if ($LASTEXITCODE -ne 0 -or ($result | Out-String) -notmatch 'PASS:' -or ($result | Out-String) -match 'FAIL:') { throw 'Android device regression failed' }
