# ChatGPT → Obsidian：P0 本地增强版

基于 Obsidian Web Clipper 1.7.1 的本地开发分支。支持 `https://chatgpt.com` 和 `https://chat.openai.com`。未发布扩展商店；不要把它作为 Obsidian 官方发布版分发。

## 安装与使用

1. 在 Chrome 打开 `chrome://extensions`，或 Edge 打开 `edge://extensions`，启用开发者模式。
2. 点击“加载已解压的扩展程序”，选择本仓库的 **dist** 目录（不是 src，也不是 zip 文件）。可以暂时停用官方 Clipper，避免两个同名按钮混淆。
3. 在扩展设置里添加已有 Obsidian Vault。按需从模板设置导入本目录的 **chatgpt-template.json**；这是可选模板，不会自动覆盖用户模板，也没有自动匹配触发器。
4. **刷新已打开的 ChatGPT 页面**，使提前缓存选区的脚本生效。
5. 在同一条助手回答内选择文字，再打开扩展。默认“仅选中内容”；需要完整回答时切换“整条回答”。一个字的选区也可以定位完整回答。
6. 检查 Markdown 正文和警告，按需修改标题、标签、模板、Vault 和目录，再主动点击保存。切换范围会重新生成正文，所以请在确定范围后编辑正文。标题与目录编辑会保留。
7. 在 Obsidian 中检查结果。默认 create 模式不添加 overwrite；若选择追加、日记或覆盖模板，将沿用用户主动选择的上游行为。

无选区、用户消息、跨消息、选区失效时会显示重新选择提示，不会回退为整个聊天页面。重新选择后关闭并重新打开弹窗；长期打开的侧栏可刷新摘录面板。ChatGPT 快捷摘录仅打开预览，需点击保存。

## 格式兼容矩阵

| 内容 | P0 行为 |
| --- | --- |
| 标题 H1–H6、段落、强调、删除线、行内代码、分割线 | 原生 Markdown |
| 有序、无序、任务及嵌套列表；多段/嵌套引用 | 保留容器语义、起始编号 |
| pre/code、CodeMirror | 保留所选代码的缩进、空行、尾随空格；提取可用语言标记；围栏避让内部反引号 |
| KaTeX / TeX annotation / data-math | 行内 `$...$` 或块级 `$$...$$`；局部选区扩展完整公式并提示 |
| 普通表格 | Markdown 表格，对齐、管道符及换行处理；局部选区扩展整表并提示 |
| 链接、图片 | 安全 HTTP(S) 链接，邮件链接；图片仅保留远程 URL 并警告，不下载附件 |
| 公式缺少源、无目标引用 | 保留文字并警告，不伪造 LaTeX 或链接 |
| 合并单元格、SVG、Canvas、交互组件 | 尽量保留文本并警告，不能保证结构和图像；不输出未经清理的 HTML |
| 仍在生成/已知折叠内容 | 在可识别时警告；未加载、虚拟化或未知结构不保证完整 |
| 非 ChatGPT 网站 | 原 Defuddle、模板、预览和保存路径 |

这不是“所有格式无损”工具。复杂表格、附件离线保存、SVG 附件、交互图表截图属于 P1/P2，未实现。选择必须为一个连续选区；缓存仅在当前页面的扩展内存中，刷新页面会清除。页面 DOM 改版可能需要更新适配器。

专用分支不提供整页 `contentHtml` / `fullHtml`，避免将 Markdown 冒充 HTML；推荐模板使用 `{{content}}` 和 `{{selection}}`。不会新增后端或上传服务。原版的可选 Interpreter 仍属于用户配置能力，默认关闭；若主动启用含 AI 提示的模板，应理解其现有远程调用行为。

## 开发与验证

```powershell
npm ci
npm run typecheck
npm test
npm run build:chrome
npx playwright install chromium
npm run test:browser
```

浏览器测试使用独立临时配置和人工 HTML，不登录 ChatGPT，不调用实际 Obsidian 保存。输出截图默认在系统临时目录 `chatgpt-clipper-qa`，可通过 `CLIPPER_TEST_OUTPUT` 指定；浏览器缓存可用 `PLAYWRIGHT_BROWSERS_PATH` 指定。最终加载目录为 `dist/`，zip 为 `builds/obsidian-web-clipper-1.7.1-chrome.zip`。

## 必须完成的人工联调

- [ ] Chrome 与 Edge 分别加载 dist，刷新真实 ChatGPT 页面，无启动异常。
- [ ] 在新旧可见消息结构中选择普通文本、多段、代码、公式、表格；默认仅选区。
- [ ] 只选一个字切换整条回答；再切回选区，不夹带其他回答或用户消息。
- [ ] 选中用户消息、跨消息、取消选区、页面重新渲染和切换会话时提示明确。
- [ ] 编辑标题、正文、标签、路径、Vault 和模板，点击保存。
- [ ] 在 Obsidian 源码与阅读模式核查列表、代码、公式、表格及来源链接。
- [ ] 同标题重复摘录不擅自覆盖；追加/日记/覆盖仅按用户选择的模板执行。
- [ ] 缺失公式源、图片和复杂组件显示提示，不声称离线完整保存。
- [ ] 普通网页重复摘录，确认原体验；长期侧栏、多次打开、刷新后正常。

## 许可证和维护

上游 MIT 许可证见仓库 LICENSE；FAB 适配来源和完整 MIT 声明见 THIRD_PARTY_NOTICES.md，两份文件随构建产物附带。当前本地构建保留上游界面与素材，**公开发布前必须替换官方名称、图标和品牌素材，使用独立扩展身份**。

Provider 独立在 `src/providers/chatgpt/`；上游合并主要关注 content-loader 的注入时序、getPageContent 响应、模板变量参数和 popup 生命周期。保存协议未重写，仅将原保存层的 URI 日志改成不含正文的提示，以满足方案的隐私约束。
