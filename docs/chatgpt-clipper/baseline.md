# P0 基线（2026-11-09）

- 工作目录最初为空，无用户既有文件。检出 https://github.com/obsidianmd/obsidian-clipper ，SHA `6d56d618b00bd970aa738d6a7a61edee27783e81`，1.7.1，MIT。
- FAB 参考 https://github.com/xiuluo211314/chatgpt-md-fab ，SHA `ae9f010e649dfc22c314849914dfa17fd4378798`，1.3.1，MIT。读取 markdown.js、content.js、README、测试及许可证。移植解析函数，不引入 FAB 按钮。
- 实际链路：声明式 content-loader → background 按需注入 content → getPageContent → extractPageContent → initializePageContent → buildVariables → popup 模板编辑 → handleClipObsidian → saveToObsidian。
- 首次选择缓存必须在 content-loader 启动，不能只放在懒加载 content 中。缓存仅保存在隔离世界的内存中。
- 现有保存支持 create/append/prepend/daily/overwrite；create 不添加 overwrite 参数。保留整个保存层与原权限。
- `npm ci` 成功。原始 `npm test`：208 通过，6 失败，全部位于 template-integration.test.ts（Windows checkout 的 CRLF 与输出 LF 不一致，YouTube 快照另依赖 America/Los_Angeles 时区；另有 Defuddle/jsdom Element 类型警告，但不是这 6 项断言的失败原因）。该问题在任何业务修改前即存在。
- 原始 `npx tsc --noEmit`：两处动态 import 与 es6 module 不兼容。构建已使用 ES2020，后续类型检查使用 `npx tsc --noEmit --module es2020`。
- 原始 `npm run build:chrome` 成功，3 个上游体积警告；产物 dist/，压缩包 builds/。
- 上游没有 lint 脚本或 ESLint 依赖；不额外引入 lint 工具，使用类型检查及 git diff --check。
- npm audit 报告 9 项依赖漏洞，属于上游依赖基线，未擅自升级依赖。

本次验收来源：用户指定的《ChatGPT_Obsidian_Clipper_实施方案》v1.0 第 3–9 节。范围 Phase 0–3；P1/P2 不实施。真实 Chrome/Edge + Obsidian 显示和写入仍需人工联调。
