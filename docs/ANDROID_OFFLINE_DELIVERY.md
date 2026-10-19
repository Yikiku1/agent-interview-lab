# 安卓离线版交付

更新：2026-10-19（北京时间）。安卓离线版与现有 Next.js / PostgreSQL 桌面版独立，安装后不需要电脑、服务器、登录或网络。

当前版本 **1.0.1 / versionCode 2**。已在 Android 15 / WebView 124 模拟器中复现用户的 `net::ERR_HTTP_RESPONSE_CODE_FAILURE`，并通过原生日志定位：`loadDataWithBaseURL` 先发起空的内部 `data:text/html;charset=utf-8;base64,` 主文档请求，`shouldInterceptRequest` 错误返回 403，阻断了首页。仅修改导航回调无法解决。

资源拦截器现在只对这个精确匹配的内部主文档返回 `null`，让 WebView 自行加载；其他外部请求仍拒绝。相同模拟器修复前出现与用户一致的错误页，修复后首页、答题、SQLite 恢复和系统备份导入导出通过。页面初始化门控与明确空库标记保留；此前“特定手机无法导航合成域名”和“Java null 被转换”是缺少设备验证的诊断假设，不能当作已证实原因。

模拟器截图还发现原先直接给 WebView 加 padding 时，CSS fixed 底栏仍位于系统导航按钮之下。现在由父容器承接系统边距，实际 WebView 视口避开状态栏与导航栏；最终截图确认底部四个入口完整可见。

## 安装与使用

安装包：`.local/releases/interview-lab-offline-1.0.1.apk`，同内容兼容入口 `.local/releases/interview-lab-offline.apk`。将 APK 通过 USB、文件传输等方式复制到手机，在手机文件管理器点击安装；按系统提示允许该文件来源安装。覆盖升级保留原应用 ID 与签名，页头及“我的”显示 1.0.1 以便确认更新。支持 Android 8.0 及以上，需要支持 ES modules 与 top-level await 的较新 Android System WebView（建议保持系统 WebView 更新）。

首次安装从空进度开始，内置源码题库 670 题、30 道核心题、100 道简历分层答案，不打包电脑个人进度、数据库连接信息或浏览器草稿。电脑服务与数据库不受影响。

支持今日推荐、分类/项目/优先级/状态/搜索筛选、顺序/随机短轮、3/5/10/20 题目标、固定队列续练、自动保存回答草稿、正式完成与历史、自评与间隔复习、个人回答卡、要点勾选、五类卡点及补练、分类统计、VendorGuard/发票实习五节点模拟、真实面试复盘及关联后补练次数。答案默认在独立作答后主动查看；模拟参考在结束后展示。

普通正式完成才增加练习事件和安排复习；个人卡、卡点、模拟、复盘不写普通练习。普通草稿隔离到本轮，开始新轮会提示替换未完成队列。模拟草稿与复盘未保存编辑也在本机持久化。

“我的 → 备份与恢复”导出完整离线 JSON。导入前明确确认替换；版本、题目引用、计数、结构或日期错误时拒绝，原记录保持。备份上限 8MB。备份应存至应用之外，卸载会删除应用私有数据；覆盖安装需保留相同应用 ID 和签名。电脑 PostgreSQL 备份与离线 JSON 不兼容，不提供自动同步。

## 实现与构建

- `mobile/www/`：无外部 CDN 的本地 HTML/CSS/ESM 页面、题库与状态模块；沿用桌面版配色和阅读风格。
- `scripts/export-mobile-bank.ts`：只从源码生成题库，按题干 SHA256 派生稳定正整数 ID 并检查冲突，不读取 PostgreSQL；ID 与桌面 serial ID 无对应保证。
- `mobile/www/store.js`：先校验并持久化成功后才替换内存状态，正式完成按 attemptId 幂等。复习间隔与桌面一致：不会 1 天、模糊 3 天、掌握 1/3/7/14 天。推荐按北京日界线排除当天已完成，先到期/薄弱/核心或简历新题。
- `android/`：原生 Java Activity + WebView，同源 HTTPS assets 映射，SQLite 单行 JSON 原子写入；不声明网络或存储权限，外部请求阻断，系统文档选择器负责备份文件。

```powershell
node --import tsx scripts/export-mobile-bank.ts
pwsh -NoProfile -File android/build.ps1
```

JDK 17+；脚本按需下载 Android platform/build-tools 35，不依赖失效的 pnpm wrapper。签名密钥与密码位于 `.local/android-toolchain/`，勿删除；遗失后无法以原签名覆盖更新。原生构建与安装边界见 [android/README](../android/README.md)。仅预览手机页面可执行 `node scripts/serve-mobile.mjs`，访问 `http://127.0.0.1:4173`；浏览器预览使用 localStorage，APK 使用 SQLite。

## 2026-10-18 验证

69/69 单元测试通过（其中新增离线状态测试 11 项），TypeScript 与本次源码 ESLint 通过。未改变桌面数据库契约，不重复运行个人库迁移、seed 或数据库集成测试。

Browser plugin 不可用，使用已有 Playwright + 已安装 Chrome headless；390×844 手机视口及 1280×900 桌面视口验证。题库加载、100 题简历筛选与分层、草稿刷新、正式完成及统计、个人卡保存重载、卡点解决、五节点模拟与草稿、复盘草稿恢复/保存、目标范围/三题队列、主题、导航、无横向溢出通过。无页面运行错误、无外部网络请求。首页及作答截图保存在本次 Codex 可视化目录。

通过浏览器注入 Native bridge 替身验证同步 read/write、导出回调、有效/无效备份恢复、关闭页面后重新读取；该检查不等同安卓 SQLite 或系统文件选择器实测。

实际 APK 已完成 javac/D8 编译、zipalign、v2/v3 签名验证、Manifest 无网络权限检查，五个 APK 内资源 SHA256 与最终源文件逐一比对。具体产物 SHA256 由构建脚本输出；密钥与产物在 `.local/`，不提交仓库。

## 2026-10-19 Android 实际运行验证

使用 Google AOSP Android 15（API 35）x86_64 模拟器，实际 WebView `124.0.6367.219`。最终 1.0.1 APK 已安装运行，模拟器开启飞行模式后验证以下流程：

- 清空仅模拟器测试应用数据后首次打开，首页正常；实际输入草稿并完成题目，直接通过 Java Bridge 读 SQLite 验证回答已保存。
- 筛选简历范围显示 100 题，打开备份界面。
- `am force-stop` 后重新启动，正式回答与本轮位置恢复。
- 旧版 1.0.0 升级至同签名 1.0.1 后，原先保存的回答保留。
- 原生系统文档选择器实际导出至 Downloads，导出的 JSON 包含测试正式回答；再次从选择器导入，确认覆盖，恢复成功且回答保留。

新增 `android/tests/SmokeTest.java` 仪器测试与 `android/test-device.ps1`，直接驱动实际 APK 的 WebView/SQLite，无浏览器替身。`write` 与 `restore` 可自动执行；`export` / `import` 等待操作系统文件选择器与确认框。命令与设备限制见 [android/README](../android/README.md)。

本次最终 APK SHA256：`92AD0F8D162985C6AAA767545BA6FC6D3722133BB737F2DC5953FAE060312B19`。同签名、versionCode 2，编译/zipalign/v2/v3 签名及内嵌资源比对通过。本次主机检查：70/70 单元测试（离线状态 12 项）、TypeScript、目标 ESLint、差异检查通过。桌面个人 PostgreSQL 未写入。

## 当前限制

已在上述 Android 模拟器验证；尚未连接用户实体手机，未覆盖各厂商 WebView、旧版 WebView及全部系统版本。系统返回手势未纳入本次仪器测试。

离线版复盘每条记录目前只包含一个实际问题，多问题分别保存；没有移植桌面版的多问题编辑、并发 revision 合并、服务端分页与跨设备能力。个人卡以点击保存为准，未保存卡片编辑不承诺恢复；模拟没有可选计时。普通完整答案保留 Markdown 标题/列表/代码等阅读内容，外部资料仅提示，不在 App 内联网打开。手机与电脑各自记录，题库内容更新需重新构建 APK。
