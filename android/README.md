# Android 离线壳

运行 `pwsh -File android/build.ps1`。需要 JDK 17+、PowerShell 7、curl；可用 `-JavaHome D:\JAVA` 指定 JDK。首次构建下载 Google Android platform 35 与 build-tools 35 到 `.local/android-toolchain`，无需 Gradle、Node 服务或安装全局 SDK。页面来源是 `mobile/www/`，每次构建重新复制。

产物：`.local/releases/interview-lab-offline.apk` 和带 manifest 版本名的 `.local/releases/interview-lab-offline-1.0.1.apk`。当前 `versionCode=2`。应用 ID `cn.interviewlab.offline`，Android 8.0（API 26）以上；更新时提高 manifest 的 `versionCode`。首次构建生成本地 RSA 签名密钥；`.local/android-toolchain/release.jks` 和 `signing-password.txt` 必须一起妥善保留，之后覆盖安装需使用同一密钥。这些文件已由仓库 `.local/` 忽略规则排除。

不声明 `INTERNET` 权限。WebView 响应 `https://appassets.androidplatform.net/` 的内置 assets，另允许 WebView 自行处理精确的空主文档 `data:text/html;charset=utf-8;base64,`；`loadDataWithBaseURL` 初始化需要该内部请求，资源拦截器返回 403 会使整个首页失败。其他请求和导航被拒绝。ES modules 以 HTTPS 同源方式加载。数据通过 `OfflineNative.readState()` / `writeState(json)` 写入应用私有 SQLite 数据库，单行替换为 SQLite 原子写入；正常退出与进程终止后可读取已保存状态。卸载会删除应用数据，先导出备份。

导入导出使用系统文档选择器，不需要存储权限。导入读取上限 8MB，并交给页面做结构校验；页面通过 `window.onNativeImport(jsonString)` 接收原始 JSON 字符串。导出成功、取消与文件读写失败通过 `window.onNativeFileResult(message)` 提示。导出过程中若系统回收应用进程，则返回后提示失败，需重试。

构建脚本最后运行 APK 签名验证、manifest badging 检查并输出 SHA256。编译签名通过不能替代 Android 运行验证。2026-10-19 已在 Android 15 / WebView 124 模拟器实际复现旧错误并验证 1.0.1 的启动/SQLite/强制停止后恢复/覆盖升级保留/系统导出和导入，详见 [交付记录](../docs/ANDROID_OFFLINE_DELIVERY.md)。

仪器测试仅对专用测试设备/模拟器执行，`write` 会写入测试回答。默认设备 `emulator-5554`；需 SDK platform-tools/adb 及已启动的设备，本机工具位于 `.local/android-toolchain/`。

```powershell
pwsh -File android/test-device.ps1 -Phase write
.local/android-toolchain/platform-tools/adb.exe -s emulator-5554 shell am force-stop cn.interviewlab.offline
pwsh -File android/test-device.ps1 -Phase restore
pwsh -File android/test-device.ps1 -Phase export
pwsh -File android/test-device.ps1 -Phase import
```

`write` 应使用新安装的测试资料，或确保没有进行中的队列。测试 APK 与主 APK 用同一签名；测试通过输出 `PASS:`，失败以非零状态退出。`export` 和 `import` 留出两分钟操作系统文件选择器，导入还需要原生确认；每个阶段验证 SQLite 原记录保留。恢复阶段必须先执行 force-stop，才能证明跨进程恢复。
