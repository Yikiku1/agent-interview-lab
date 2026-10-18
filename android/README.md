# Android 离线壳

运行 `pwsh -File android/build.ps1`。需要 JDK 17+、PowerShell 7、curl；可用 `-JavaHome D:\JAVA` 指定 JDK。首次构建下载 Google Android platform 35 与 build-tools 35 到 `.local/android-toolchain`，无需 Gradle、Node 服务或安装全局 SDK。页面来源是 `mobile/www/`，每次构建重新复制。

产物：`.local/releases/interview-lab-offline.apk`。应用 ID `cn.interviewlab.offline`，Android 8.0（API 26）以上；更新时提高 manifest 的 `versionCode`。首次构建生成本地 RSA 签名密钥；`.local/android-toolchain/release.jks` 和 `signing-password.txt` 必须一起妥善保留，之后覆盖安装需使用同一密钥。这些文件已由仓库 `.local/` 忽略规则排除。

不声明 `INTERNET` 权限。WebView 只响应 `https://appassets.androidplatform.net/` 的内置 assets，其他请求和导航被拒绝。ES modules 以 HTTPS 同源方式加载。数据通过 `OfflineNative.readState()` / `writeState(json)` 写入应用私有 SQLite 数据库，单行替换为 SQLite 原子写入；正常退出与进程终止后可读取已保存状态。卸载会删除应用数据，先导出备份。

导入导出使用系统文档选择器，不需要存储权限。导入读取上限 8MB，并交给页面做结构校验；页面通过 `window.onNativeImport(jsonString)` 接收原始 JSON 字符串。导出成功、取消与文件读写失败通过 `window.onNativeFileResult(message)` 提示。导出过程中若系统回收应用进程，则返回后提示失败，需重试。

构建脚本最后运行 APK 签名验证、manifest badging 检查并输出 SHA256。没有连接设备或模拟器时，这些检查仅证明构建和签名成功；系统文档选择器、Android WebView、返回键与跨进程持久化仍需真机验证。可安装后开启飞行模式，完成一题、退出重开、导出、修改进度后导回，并分别测试取消导入/导出。
