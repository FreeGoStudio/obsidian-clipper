# P0 测试与交付报告

日期：2026-11-09。实施范围：方案 Phase 0–3；P1/P2 未实施。

**实现完成，自动验证通过；最终实机验收待完成。** 不将人工构造页面的浏览器测试等同于真实 ChatGPT + Obsidian 联调。

## 自动验证

| 验证 | 结果 |
| --- | --- |
| `npm test` | 19 文件，265 项通过，0 失败（原有 214 项 + 新增 51 项） |
| `npm run typecheck` | 通过，使用与 webpack 相同的 ES2020 module |
| `npm run build:chrome` | 通过；保留上游 3 项 bundle 体积警告 |
| `git diff --check` | 通过 |
| `npm run test:browser` | 真实 Chromium 158.0.8127.18 加载 MV3 扩展；使用拦截的人工 HTML，不登录、不保存到真实 Vault |
| Manifest 权限对照 | 与上游 SHA 6d56d61 完全一致，未新增 permission/host_permission |
| 分发内容 | dist 与 ZIP 包含上游 LICENSE 和 FAB THIRD_PARTY_NOTICES.md |
| lint | 上游没有可运行的 lint 脚本/依赖；不声称运行过 ESLint |

测试环境：Windows x64，Node v24.15.0，Vitest 4.1.11，Playwright 1.65.0。日期快照固定 America/Los_Angeles（上游快照原本的时区），Markdown 快照固定 LF。这两项仅稳定测试环境，不重写预期正文或业务要求。

基线中 6 个模板 fixture 曾因 CRLF 失败，YouTube 还有时区差异；已解决。Defuddle 在原有模板测试中仍会输出与混合 DOM 实现有关的 Element 警告，所有断言通过。npm audit 仍报告上游依赖的 9 项漏洞（1 low、4 moderate、3 high、1 critical）；本次未扩大为依赖升级任务。

## 覆盖到的验收点

- SEL-01–07：真实字符裁剪、整条切换、多段顺序、跨消息/用户消息拒绝、弹窗失焦缓存、重渲染/文本变更/SPA 导航失效。
- DOM-01–02：旧 role/turn 属性；新 search-unit、message-style 属性。
- MD-01–12：标题、段落、强调/删除线、列表/任务、多位数编号、引用、代码围栏/空行/空白、CodeMirror、公式、表格、链接/图片、混排、降级提示。
- INT-01–04：`{{content}}` 与 `{{selection}}` 映射、直接 Markdown 不经过二次 HTML 转换、普通网页仍调用原转换器、模板编译保真。
- OBS-01–02：调用原 URI 保存器，检查 Vault、目录、标签、正文与 create 不添加 overwrite；**这些是自动化参数验证，不是实际 Obsidian 文件写入验证**。
- SEC-01–02：脚本/事件属性不输出可执行 HTML，危险协议不生成链接；新增 Provider 无网络采集或持久化对话。

## 浏览器观察

Browser plugin not available，因此使用 Playwright。浏览器下载首次受 C 盘空间不足影响，改用 D 盘专用缓存后成功；没有删除用户文件。

人工页面 URL 为 `https://chatgpt.com/c/synthetic-test`，请求由测试直接返回本仓库 fixture。页面身份、可见内容、无错误覆盖层、无未捕获异常、无相关应用 console error 均通过。外部图片故意不可访问，其资源错误不属于应用异常。

在 1100×850 页面及 350×540 扩展面板验证：

1. 选中文字，清空实时 Selection，再懒加载内容脚本，仍得到原选区。
2. 打开真实扩展内嵌面板，默认仅选区；切换整条后增加回答正文并保留代码和公式。
3. 修改标题/目录后切换范围，编辑值仍在；正文可手工编辑。
4. 图片和 Canvas 降级提示可见；紧凑面板的预览和保存按钮可用。
5. 替换原选区 DOM 后请求失败并提示重选；选择用户消息同样拒绝。

本机截图：`D:/workspace/.clipper-browser-temp/qa/selection.png`、`answer.png`、`compact.png`。测试脚本为 `scripts/test-chatgpt-browser.mjs`，可重新运行获取新证据。测试不会主动调用 Obsidian。

性能抽样：911 字节人工 HTML；转换器预热 10 次后运行 200 次，总耗时 124 ms。仅表示上述 Node/jsdom 环境的小样本，不承诺真实大回答的固定性能。

## 关键变更与回合并风险

| 位置 | 原要求与变更目的 |
| --- | --- |
| providers/chatgpt | 同一助手回答定位、缓存有效性、局部/整条解析、格式保真和告警；独立于保存层 |
| content-loader.ts | 页面加载即缓存选择，覆盖上游延迟注入时序 |
| content.ts | ChatGPT 直接返回专用结果/错误，避免整页 Defuddle；其他域名保留原路径 |
| content-extractor.ts | 模板变量直接使用专用 Markdown；不把 Markdown 冒充 contentHtml |
| popup.ts / popup-controls.ts / popup.scss | 范围切换、错误和警告、预览编辑、明确点击保存；保持原模板与 Vault/目录 UI |
| obsidian-note-creator.ts | 仅移除日志中的完整 URI，避免回退保存时泄漏正文；协议及保存行为未改变 |
| 测试、构建、文档 | 重现回归、便携测试环境、浏览器冒烟、许可分发、可选模板及人工检查表 |

回合并主要风险是上游 content-loader、popup 初始化/模板刷新接口变化；保存协议未复制。建议保留 Provider 的独立 fixture 回归。

## 尚未完成的最终验收

真实登录 ChatGPT 的持续变化 DOM、正式 Chrome/Edge 工具栏弹窗、用户 Vault 写入及 Obsidian 阅读模式渲染尚未人工验证。应按 usage.md 检查表完成。P0 实现与自动检查完成不代表这几项已签收。

图片本地化、复杂表格无损 HTML、SVG 附件、交互图截图和更完整引用属于 P1/P2。当前仅明确降级，不宣称离线完整或全格式无损。公开发布前还需独立名称、图标及品牌素材。

## 2026-11-10 目标仓库迁入复验

已将原工作目录 `D:/workspace/ChatGPT_Obsidian_Clipper` 中改名前的功能迁入 `D:/workspace/obsidian-clipper`，保留 Obsidian Web Clipper 名称。目标仓库原基线为 `6d56d61`，迁入前工作区干净。仅额外清理两个新增文件末尾的空白行以通过差异检查。

在目标仓库重新执行：265 项测试全部通过，`npm run typecheck`、`npm run build:chrome` 和 `npm run test:browser` 均通过。构建仍有原有 3 项体积警告。测试快照工作区换行按 `.gitattributes` 规范化为 LF，预期正文未修改。新的浏览器证据位于 `D:/workspace/.clipper-browser-temp/merged-qa/`；可加载构建位于目标仓库 `dist/`。真实 ChatGPT/Obsidian 最终联调状态仍为待验收。
